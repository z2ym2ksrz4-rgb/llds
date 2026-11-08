import type { Me, NotifyPrefs } from "@/core/api";

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
  { key: "payment", emoji: "💳" },
  { key: "booking", emoji: "🏠" },
  { key: "signup", emoji: "📝", admin: true },
];
/** Only the kinds this person can actually receive: a parent never gets "vikar søges", a child login never gets shop/payment rows. */
export function notifyKindsFor(me: Me) {
  const p = me.person; const own = me.memberships.filter((m) => m.person_id === p.id);
  const staff = p.is_admin || own.some((m) => m.role !== "dancer");
  const dancerish = p.is_admin || own.some((m) => m.role === "dancer") || me.children.length > 0;
  const adult = !p.supervised_by;
  const ok: Record<string, boolean> = {
    message: true, session: true, event: true, post: true,
    substitute: staff,
    badge: dancerish, milestone: dancerish,
    order: adult, punch: adult, payment: adult, booking: adult,
    signup: p.is_admin,
  };
  return NOTIFY_KINDS.filter((k) => ok[k.key] ?? true);
}
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
