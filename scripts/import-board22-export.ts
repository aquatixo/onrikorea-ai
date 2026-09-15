/**
 * One-time migration: reads the task-board-22-export.json dump (fetched directly from
 * onrikorea-dashboard.shop's own /api/backend/task-board/* endpoints -- see chat history)
 * and populates WorkItem/WorkComment.
 *
 * Mapping:
 * - category (담당자, e.g. "Jake (안동헌)")   -> WorkItem.assigneeName ("안동헌")
 * - subCategory (브랜드/주제, e.g. "PG / 피에로구르망") -> WorkItem.category
 * - task.title / task.color                  -> WorkItem.title / .color
 * - LAST schedule's status/description        -> WorkItem.status/.content (current state)
 * - LAST schedule's [날짜]/[목표일] in the text -> WorkItem.startDate/.endDate
 * - EVERY schedule (including the last)        -> one WorkComment each, preserving full history
 *
 * Source schedule.status values seen: in_progress, pending, done, waiting, "완료" (legacy alias).
 * Source schedule.timelines/files/checklists/memos/meetings were empty on every row at export
 * time -- nothing lost by not mapping those sub-tables.
 *
 * Usage:
 *   npx tsx scripts/import-board22-export.ts "C:\Users\onrikorea\Downloads\task-board-22-export.json"
 *
 * Deletes all existing WorkItem/WorkComment rows first (dummy/test data) -- NOT safe to
 * re-run against real data without expecting a full wipe-and-reimport.
 */
import { readFileSync } from "fs";
import { PrismaClient, WorkStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const filePath = process.argv[2] ?? "C:\\Users\\onrikorea\\Downloads\\task-board-22-export.json";

const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

const PERSON_MAP: Record<string, string> = {
  "Jake (안동헌)": "안동헌",
  "Daniel (오성민)": "오성민",
  "Will (현명수)": "현명수",
};

function resolveAssignee(categoryName: string): string {
  if (PERSON_MAP[categoryName]) return PERSON_MAP[categoryName];
  return categoryName.replace(/^[^\p{L}\p{N}]+/u, "").trim() || categoryName;
}

const STATUS_MAP: Record<string, WorkStatus> = {
  in_progress: "IN_PROGRESS",
  pending: "TODO",
  waiting: "AWAITING_REPLY",
  done: "DONE",
  "완료": "DONE",
};

function resolveStatus(raw: string | null | undefined): WorkStatus {
  if (!raw) return "TODO";
  return STATUS_MAP[raw] ?? "TODO";
}

function extractDate(text: string | null | undefined, tag: string): Date | undefined {
  if (!text) return undefined;
  const match = text.match(new RegExp(`\\[${tag}\\]\\s*(\\d{4}-\\d{2}-\\d{2})`));
  if (!match) return undefined;
  const d = new Date(match[1]);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

type SourceSchedule = {
  id: number;
  title: string;
  description: string | null;
  status: string | null;
  createdAt: string;
};

type SourceTask = {
  id: number;
  title: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  schedules: SourceSchedule[];
};

type SourceCategory = {
  id: number;
  name: string;
  subCategories: { id: number; name: string; tasks: { id: number }[] }[];
};

type Export = {
  categories: SourceCategory[];
  tasks: SourceTask[];
};

async function main() {
  const raw = readFileSync(filePath, "utf-8");
  const data: Export = JSON.parse(raw);

  const taskById = new Map(data.tasks.map((t) => [t.id, t]));

  console.log(`Loaded ${data.tasks.length} tasks from ${filePath}`);

  const deleted = await db.workItem.deleteMany({});
  console.log(`Deleted ${deleted.count} existing WorkItem rows (dummy/test data + cascaded comments)`);

  let itemCount = 0;
  let commentCount = 0;

  for (const category of data.categories) {
    const assigneeName = resolveAssignee(category.name);

    for (const subCategory of category.subCategories ?? []) {
      for (const taskRef of subCategory.tasks ?? []) {
        const task = taskById.get(taskRef.id);
        if (!task) continue;

        const schedules = [...(task.schedules ?? [])].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const last = schedules[schedules.length - 1];

        const startDate = extractDate(last?.description, "날짜");
        const endDate = extractDate(last?.description, "목표일");

        const item = await db.workItem.create({
          data: {
            title: task.title,
            assigneeName,
            category: subCategory.name,
            color: task.color ?? undefined,
            status: resolveStatus(last?.status),
            content: last?.description ?? undefined,
            startDate,
            endDate,
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt),
          },
        });
        itemCount++;

        for (const schedule of schedules) {
          const header = schedule.title && schedule.title !== "내용" ? `[${schedule.title}]\n` : "";
          await db.workComment.create({
            data: {
              workItemId: item.id,
              authorName: "(이전 데이터)",
              body: `${header}${schedule.description ?? ""}`.trim() || "(내용 없음)",
              createdAt: new Date(schedule.createdAt),
            },
          });
          commentCount++;
        }
      }
    }
  }

  console.log(`Created ${itemCount} WorkItem rows and ${commentCount} WorkComment rows.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
