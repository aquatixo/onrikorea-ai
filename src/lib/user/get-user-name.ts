import { cookies } from "next/headers";
import { USER_NAME_COOKIE } from "@/lib/user/name-cookie";

/**
 * Stand-in for a real logged-in identity until auth is wired up: a name the user sets
 * once in the sidebar, stored in a cookie, used automatically everywhere a comment
 * needs an author -- so nobody re-types their name per comment or can post as someone
 * else just by editing a form field.
 */
export async function getUserName(): Promise<string> {
  const store = await cookies();
  const raw = store.get(USER_NAME_COOKIE)?.value;
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}
