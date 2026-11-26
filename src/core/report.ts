import { api } from "@/core/api";

/** Catches uncaught errors and unhandled rejections and files them (max 5 per session) – shown under Admin → App insights. */
let sent = 0; const seen = new Set<string>();
function file(message: string, stack?: string | null) {
  if (!message || sent >= 5 || seen.has(message)) return;
  if (/ResizeObserver loop|Failed to fetch|NetworkError|Load failed|AbortError/i.test(message)) return;   // noise, not bugs
  seen.add(message); sent++;
  void api.logClientError({ message, stack: stack ?? null, url: location.pathname + location.hash });
}
export function installErrorReporter() {
  addEventListener("error", (e) => file(e.message, (e.error as Error | undefined)?.stack));
  addEventListener("unhandledrejection", (e) => { const r = e.reason as Error | string | undefined; file(typeof r === "string" ? r : r?.message ?? "unhandled rejection", typeof r === "string" ? null : r?.stack); });
}
