/** The catch-all assignee for work items without a person. Stored in Korean ("기타") --
 * it's data, not UI text -- so display goes through assigneeLabel to follow the language. */
export const ETC_ASSIGNEE = "기타";

export function assigneeLabel(name: string, etcLabel: string): string {
  return name === ETC_ASSIGNEE ? etcLabel : name;
}
