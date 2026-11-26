import i18n from "@/core/i18n";

/** Server errors come back as short English codes ("signups closed"). Shown to people they must read as a sentence in their own language. */
const CODES = ["signups closed", "audition closed", "audition required", "not an audition team", "already member", "not allowed", "not your person", "unknown team", "needs parent", "too young", "needs birth date", "parent needs child", "last admin", "too many", "bad email", "missing name", "not open", "full", "closed", "already"] as const;
export function humanize(msg: string | null | undefined): string {
  if (!msg) return "";
  const low = msg.toLowerCase();
  for (const c of CODES) if (low === c || low.endsWith(": " + c) || low.includes(c) && c.includes(" ")) { const k = "errors." + c.replace(/ /g, "_"); const tr = i18n.t(k); return tr === k ? msg : msg.toLowerCase() === c ? tr : msg.replace(new RegExp(c, "i"), tr); }
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return i18n.t("errors.offline");
  return msg;
}
