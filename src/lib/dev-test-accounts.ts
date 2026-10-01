// Seed accounts used only for local development/testing, never real team members --
// any UI that lists "who can be picked" (an assignee roster, a visitor checklist, etc.)
// should exclude them so test logins never show up next to actual teammates.
export const DEV_TEST_USERNAMES = ["admin", "user"];

export function isRealTeamUser(username: string): boolean {
  return !DEV_TEST_USERNAMES.includes(username);
}
