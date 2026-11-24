import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Notification } from "@/core/api";
import { TAB_KINDS } from "@/core/badges";
import { useNav, type Tab } from "@/core/nav";
import { useAuth } from "@/core/auth";
import { ago } from "../lib/time";

const ICON: Record<string, string> = { message: "✉️", booking: "🏠", substitute: "🙋", session: "⚠️", event: "📅", milestone: "🏅", badge: "🔥", order: "🛍", punch: "🎟", payment: "💳", post: "💬", signup: "📝" };
const DAYS = 3;
const DISMISS_KEY = "llds_news_dismissed";

/** Which tab a notification belongs to, and what to open there. Nothing to open → just the tab. */
export function targetOf(n: Notification): { tab: Tab; ref: Record<string, string> } | null {
  const r = n.ref ?? {};
  if (r.session_id) return { tab: "rooms", ref: { session_id: r.session_id } };
  if (r.booking_id) return { tab: "rooms", ref: { booking_id: r.booking_id } };
  if (r.event_id) return { tab: "events", ref: { event_id: r.event_id } };
  if (r.message_id) return { tab: "team", ref: { message_id: r.message_id } };
  if (r.thread_id) return { tab: "team", ref: { thread_id: r.thread_id } };
  if (r.post_id) return { tab: "social", ref: { post_id: r.post_id } };
  if (r.order_id || n.kind === "punch" || n.kind === "payment") return { tab: "shop", ref: r.order_id ? { order_id: r.order_id } : {} };
  for (const [tab, kinds] of Object.entries(TAB_KINDS) as [Tab, string[]][]) if (kinds.includes(n.kind)) return { tab, ref: {} };
  return null;
}

/** "Nyt siden sidst" at the top of a tab: the notifications that made the tab's badge light up (last 3 days), each explaining
 *  what happened and opening the thing it is about. Unread ones carry a dot until the badge has been cleared. */
export function TabNews({ tab }: { tab: Tab }) {
  const { t } = useTranslation();
  const openRef = useNav((s) => s.openRef);
  const [list, setList] = useState<Notification[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => { try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]") as string[]); } catch { return new Set(); } });
  const dismiss = (ids: string[]) => {   // swipe-away: gone from this card on this device, marked read on the server (badges + bell)
    const next = new Set(dismissed); for (const id of ids) next.add(id); setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...next].slice(-300))); } catch { /* ignore */ }
    void api.markNotificationsRead(ids).catch(() => { /* ignore */ });
  };
  useEffect(() => {
    let on = true;
    const kinds = (TAB_KINDS as Record<string, string[]>)[tab] ?? [];
    const since = Date.now() - DAYS * 864e5;
    const me = useAuth.getState().me; const people = me ? [me.person.id, ...me.children.map((c) => c.id)] : undefined;
    api.listNotifications(people).then((all) => { if (on) setList(all.filter((n) => kinds.includes(n.kind) && new Date(n.created_at).getTime() > since)); }).catch(() => { /* ignore */ });
    return () => { on = false; };
  }, [tab]);
  const live = list.filter((n) => !dismissed.has(n.id));
  if (!live.length) return null;
  const rows = showAll ? live : live.slice(0, 3);
  return (
    <div className="card list tabnews" data-testid={`tabnews-${tab}`}>
      <div className="tabnews-head"><span className="eyebrow">{t("news.title")} · {live.length}</span><button type="button" className="linklike small" onClick={() => dismiss(live.map((n) => n.id))} data-testid="tabnews-clear">{t("news.clear")}</button></div>
      {rows.map((n) => { const tg = targetOf(n); const canOpen = !!tg && Object.keys(tg.ref).length > 0; return (
        <div key={n.id} className="tabnews-row">
          <button type="button" className="item" disabled={!canOpen} onClick={() => tg && openRef(tg.tab, tg.ref)} data-testid="tabnews-row">
            <span className="avatar small">{ICON[n.kind] ?? "•"}</span>
            <span className="grow"><div>{n.title}</div>{n.body && <div className="tiny">{n.body}</div>}</span>
            <span className="tiny">{ago(n.created_at)}</span>{!n.read_at && <span className="dot gold" aria-label={t("news.unread")} />}{canOpen && <span className="gold">›</span>}
          </button>
          <button type="button" className="tabnews-x" aria-label={t("news.dismiss")} title={t("news.dismiss")} onClick={() => dismiss([n.id])} data-testid="tabnews-dismiss">×</button>
        </div>); })}
      {live.length > 3 && !showAll && <button type="button" className="linklike small" onClick={() => setShowAll(true)}>{t("news.showAll", { n: live.length })}</button>}
    </div>
  );
}
