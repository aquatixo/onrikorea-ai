// Server-only: reads process.env. Imported by the sourcing page and its run action.

export type SourcingBackend = "serper" | "tavily";

/**
 * The search API keys a sourcing run on this backend needs, which are missing here.
 * The Korea check always uses Serper, so a Tavily run needs both keys. Only presence is
 * checked, never the value -- and only the key NAMES ever reach the browser.
 *
 * Without this, a keyless run started anyway: every search failed, each failure still
 * counted against the day's budget, the whole budget was "used" in seconds, every query
 * was recorded as finding nothing, and the run ended as "done" with no visible error.
 */
export function missingSourcingKeys(backend: SourcingBackend): string[] {
  const needed = backend === "tavily" ? ["TAVILY_API_KEY", "SERPER_API_KEY"] : ["SERPER_API_KEY"];
  return needed.filter((key) => !process.env[key]?.trim());
}
