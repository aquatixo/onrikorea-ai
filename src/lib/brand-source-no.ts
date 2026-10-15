import { db } from "@/lib/db";

/** sourceNo is the running "No" column everyone actually reads down the Brands list -- a
 * newly added brand needs the next number in that same sequence, not a blank. */
export async function nextSourceNo(): Promise<number> {
  const { _max } = await db.brand.aggregate({ _max: { sourceNo: true } });
  return (_max.sourceNo ?? 0) + 1;
}
