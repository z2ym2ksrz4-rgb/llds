import type { NotifyPrefs } from "@/core/api";

/** Notification kinds a person can switch on/off. `admin` kinds only show for admins (they are only ever sent to admins). */
export const NOTIFY_KINDS: { key: string; emoji: string; admin?: boolean }[] = [
  { key: "message", emoji: "✉️" },
  { key: "session", emoji: "⚠️" },
  { key: "substitute", emoji: "🙋" },
  { key: "event", emoji: "📅" },
  { key: "post", emoji: "💬" },
  { key: "badge", emoji: "🔥" },
  { key: "milestone", emoji: "🏅" },
  { key: "order", emoji: "🛍" },
  { key: "punch", emoji: "🎟" },
  { key: "booking", emoji: "🏠" },
  { key: "signup", emoji: "📝", admin: true },
];
export const kindOn = (p: NotifyPrefs | null | undefined, kind: string) => (p?.on ?? true) && (p?.kinds?.[kind] ?? true);

/** Browser notification (web/PWA) when the app is open and something new arrives. Native push is handled by core/push. */
export async function askBrowserPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try { return (await Notification.requestPermission()) === "granted"; } catch { return false; }
}
export function browserNotify(title: string, body: string | null) {
  try { if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") new Notification(title, { body: body ?? undefined, icon: `${import.meta.env.BASE_URL}brand/mark.png` }); } catch { /* ignore */ }
}
