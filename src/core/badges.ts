import { create } from "zustand";
import { api, type Notification } from "./api";
import { useAuth } from "./auth";
import type { Tab } from "./nav";

/** Unread counters for the tab bar and the Admin menu – like the little numbers on social apps.
 *  Tabs: unread notifications, grouped by what they are about (a booking answer belongs to Sale, a trainer message to Social …),
 *  plus unread conversations for Social. Opening a tab marks that tab's notifications read, so the number disappears.
 *  Admin: real to-do counts (pending users, bookings to approve, open orders …) – they only go away when the task is done. */
export const TAB_KINDS: Record<Exclude<Tab, "home" | "more" | "admin">, string[]> = {
  rooms: ["booking", "session", "substitute"],
  team: ["message", "badge", "milestone"],   // trainer messages, comments on them, conversations
  social: ["post"],                           // the teams' own feed
  events: ["event"],
  shop: ["order", "punch", "payment"],
};
export type AdminCounts = { pending: number; bookings: number; subs: number; reports: number; orders: number; cards: number; payments: number };
type Badges = {
  tabs: Partial<Record<Tab, number>>;
  admin: AdminCounts;
  adminTotal: number;
  unread: Notification[];
  refresh: () => Promise<void>;
  seen: (tab: Tab) => Promise<void>;
};
const EMPTY: AdminCounts = { pending: 0, bookings: 0, subs: 0, reports: 0, orders: 0, cards: 0, payments: 0 };
const sum = (c: AdminCounts) => c.pending + c.bookings + c.subs + c.reports + c.orders + c.cards + c.payments;

export const useBadges = create<Badges>((set, get) => ({
  tabs: {}, admin: EMPTY, adminTotal: 0, unread: [],
  async refresh() {
    const me = useAuth.getState().me; if (!me) { set({ tabs: {}, admin: EMPTY, adminTotal: 0, unread: [] }); return; }
    const isAdmin = me.person.is_admin;
    const people = [me.person.id, ...me.children.map((c) => c.id)];
    const [notifs, threads] = await Promise.all([api.listNotifications(people).catch(() => [] as Notification[]), api.listThreads().catch(() => [])]);
    const unread = notifs.filter((n) => !n.read_at);
    const tabs: Partial<Record<Tab, number>> = {};
    for (const [tab, kinds] of Object.entries(TAB_KINDS) as [Tab, string[]][]) { const n = unread.filter((x) => kinds.includes(x.kind)).length; if (n) tabs[tab] = n; }
    const unreadThreads = threads.filter((x) => x.unread).length; if (unreadThreads) tabs.social = (tabs.social ?? 0) + unreadThreads;
    let admin = EMPTY;
    if (isAdmin) {
      const from = new Date(); from.setHours(0, 0, 0, 0); const to = new Date(from); to.setDate(to.getDate() + 60); const to14 = new Date(from); to14.setDate(to14.getDate() + 14);
      const [p, b, s, r, o, c, w] = await Promise.all([
        api.listPending().catch(() => []), api.listBookings(from.toISOString(), to.toISOString()).catch(() => []), api.listSessions(from.toISOString(), to14.toISOString()).catch(() => []),
        api.listReports().catch(() => []), api.listOrders(true).catch(() => []), api.listPunchCards(true).catch(() => []), api.listWebSignups().catch(() => []),
      ]);
      admin = {
        pending: p.length,
        bookings: b.filter((x) => x.status === "pending").length,
        subs: s.filter((x) => x.substitute_wanted && !x.substitute_id).length,
        reports: r.filter((x) => !x.resolved_at).length,
        orders: o.filter((x) => x.status === "awaiting_payment" || x.status === "paid").length,
        cards: c.filter((x) => x.status === "awaiting_payment").length,
        payments: w.filter((x) => x.status === "awaiting_payment" && x.claimed_paid_at).length,   // someone says "I have paid" – Line checks and confirms
      };
    }
    const adminTotal = sum(admin); if (adminTotal) tabs.admin = adminTotal;
    set({ tabs, admin, adminTotal, unread });
  },
  async seen(tab) {
    const kinds = (TAB_KINDS as Record<string, string[]>)[tab]; if (!kinds) return;
    const ids = get().unread.filter((n) => kinds.includes(n.kind)).map((n) => n.id);
    if (!ids.length) return;
    try { await api.markNotificationsRead(ids); } catch { /* ignore */ }
    set((s) => ({ unread: s.unread.filter((n) => !ids.includes(n.id)), tabs: { ...s.tabs, [tab]: Math.max(0, (s.tabs[tab] ?? 0) - ids.length) || undefined } }));
  },
}));
