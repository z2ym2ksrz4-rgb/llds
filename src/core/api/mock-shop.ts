import type { Event, EventInput, EventSignup, Membership, Milestone, Notification, Order, OrderLine, Person, Product, PunchCard, PunchCardType, Team } from "./types";
import { downscaleImage, fileToDataUrl } from "./image";

/** Phase-4 half of the mock: events, shop, punch cards, milestones, notifications. */
export type ShopState = {
  events: Event[]; signups: EventSignup[]; products: Product[]; orders: Order[]; orderSeq: number;
  cardTypes: PunchCardType[]; cards: PunchCard[]; punches: { card_id: string; session_id: string }[]; milestones: Milestone[]; notifications: Notification[];
};
const id = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const imgs = new Map<string, string>();

export function seedShop(teams: Team[]): ShopState {
  const axis = teams.find((t) => t.name === "The AXIS")!; const apex = teams.find((t) => t.name === "Apexion")!;
  const d = (days: number, h = 10) => { const x = new Date(); x.setDate(x.getDate() + days); x.setHours(h, 0, 0, 0); return x.toISOString(); };
  return {
    events: [
      { id: "ev-1", title: "DM 2026 – Showdance", kind: "competition", starts_at: d(40, 8), ends_at: d(41, 18), place: "Vejle Musikteater", meet_time: "07:15 ved studiet (bus)", team_ids: [axis.id, apex.id], team_names: [axis.name, apex.name], plan: [{ time: "07:15", text: "Afgang fra Ulstrup" }, { time: "09:30", text: "Gennemløb på scenen" }, { time: "13:00", text: "Første runde" }], pack_list: ["Kostume + reservestrømper", "Madpakke og vand", "Hårspray, nåle, knoldnet", "Dansesko", "Sovepose (overnatning)"], info: "Egenbetaling 450 kr. dækker startgebyr og bus. Betales via MobilePay efter tilmelding.", signup_deadline: d(14).slice(0, 10), price_dkk: 450, visibility: "public", signups: 1, created_at: now() },
      { id: "ev-2", title: "Juleshow", kind: "show", starts_at: d(44, 14), ends_at: null, place: "Ulstrup Hallen", meet_time: "12:30", team_ids: [], team_names: null, plan: [], pack_list: ["Kostume", "Vandflaske"], info: "Alle hold danser. Billetter til familie sælges ved indgangen – 40 kr.", signup_deadline: null, price_dkk: null, visibility: "public", signups: 0, created_at: now() },
    ],
    signups: [{ event_id: "ev-1", person_id: "p-alma", person_name: "Alma Nielsen", team_name: axis.name, paid: false, created_at: now() }],
    products: [
      { id: "pr-1", name: "LL Dance Studio hoodie", price_dkk: 349, sizes: ["122/128", "134/140", "146/152", "XS", "S", "M", "L"], stock: 20, image_path: null, visibility: "public", active: true },
      { id: "pr-2", name: "Træningstop (sort/guld)", price_dkk: 199, sizes: ["XS", "S", "M", "L"], stock: 12, image_path: null, visibility: "public", active: true },
      { id: "pr-3", name: "Drikkedunk", price_dkk: 89, sizes: [], stock: null, image_path: null, visibility: "public", active: true },
    ],
    orders: [], orderSeq: 100,
    cardTypes: [{ id: "pct-1", name: "10 klip – Hit Fit Dance", punches: 10, valid_days: 365, price_dkk: 625, active: true }],
    cards: [], punches: [],
    milestones: [{ id: "ms-1", person_id: "p-freja", person_name: "Freja Therkildsen", title: "Første konkurrence 🏆", reached_on: "2026-03-14", team_id: axis.id, team_name: axis.name, given_by_name: "Line Lund Olesen", created_at: now() }],
    notifications: [],
  };
}

export const MILESTONE_IDEAS = ["Første konkurrence 🏆", "Første show 🎭", "Spagat ✨", "100 træninger 💯", "Solo på scenen 🌟", "Årets danser ⭐"];

export function shopOps(get: () => { Y: ShopState; persons: Person[]; memberships: Membership[]; guardians: { parent_id: string; child_id: string }[]; teams: Team[]; me: () => Person | null; save: () => void; emit: () => void; notify: (pid: string, kind: string, title: string, body: string | null, ref?: Record<string, string>) => void }) {
  const name = (pid: string | null) => { const p = get().persons.find((x) => x.id === pid); return p ? `${p.first_name} ${p.last_name}` : ""; };
  const myPeople = () => { const g = get(); const me = g.me(); if (!me) return []; return [me.id, ...g.guardians.filter((x) => x.parent_id === me.id).map((x) => x.child_id)]; };
  const family = (pid: string) => { const g = get(); return [pid, ...g.guardians.filter((x) => x.child_id === pid).map((x) => x.parent_id)]; };
  const admins = () => get().persons.filter((p) => p.is_admin && p.status === "approved");
  const audience = (teamIds: string[]) => { const g = get(); const set = new Set<string>(); for (const m of g.memberships) if (teamIds.includes(m.team_id)) for (const x of family(m.person_id)) { const p = g.persons.find((pp) => pp.id === x); if (p?.user_id && p.status === "approved") set.add(x); } return [...set]; };
  const everyone = () => get().persons.filter((p) => p.user_id && p.status === "approved").map((p) => p.id);

  return {
    async listEvents(includePast = false): Promise<Event[]> {
      const g = get(); const cut = new Date(Date.now() - 864e5).toISOString();
      const mine = myPeople();
      return g.Y.events.filter((e) => includePast || e.starts_at >= cut).map((e) => ({ ...e, mySignups: g.Y.signups.filter((s) => s.event_id === e.id && mine.includes(s.person_id)).length, signups: g.Y.signups.filter((s) => s.event_id === e.id).length, team_names: e.team_ids.length ? e.team_ids.map((t) => g.teams.find((x) => x.id === t)?.name ?? "?") : null })).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    },
    async saveEvent(i: EventInput, eid?: string) {
      const g = get();
      if (eid) { const e = g.Y.events.find((x) => x.id === eid); if (e) Object.assign(e, i); }
      else { const e: Event = { ...i, id: "ev-" + id(), signups: 0, team_names: null, created_at: now() }; g.Y.events.push(e); for (const pid of i.team_ids.length ? audience(i.team_ids) : everyone()) g.notify(pid, "event", e.title, (e.place ?? "") , { event_id: e.id }); }
      g.save(); g.emit();
    },
    async deleteEvent(eid: string) { const g = get(); g.Y.events = g.Y.events.filter((e) => e.id !== eid); g.Y.signups = g.Y.signups.filter((s) => s.event_id !== eid); g.save(); g.emit(); },
    async listSignups(eventId: string): Promise<EventSignup[]> { const g = get(); const me = g.me()!; const staff = me.is_admin || g.memberships.some((m) => m.person_id === me.id && m.role !== "dancer"); const mine = myPeople(); return g.Y.signups.filter((s) => s.event_id === eventId && (staff || mine.includes(s.person_id))); },
    async signUp_(eventId: string, personId: string, on: boolean) {
      const g = get(); g.Y.signups = g.Y.signups.filter((s) => !(s.event_id === eventId && s.person_id === personId));
      if (on) { const e = g.Y.events.find((x) => x.id === eventId); const tn = g.memberships.filter((m) => m.person_id === personId && e?.team_ids.includes(m.team_id)).map((m) => g.teams.find((t) => t.id === m.team_id)?.name)[0] ?? null; g.Y.signups.push({ event_id: eventId, person_id: personId, person_name: name(personId), team_name: tn, paid: false, created_at: now() }); }
      g.save(); g.emit();
    },
    async setSignupPaid(eventId: string, personId: string, paid: boolean) { const g = get(); const s = g.Y.signups.find((x) => x.event_id === eventId && x.person_id === personId); if (s) s.paid = paid; g.save(); g.emit(); },

    async listProducts(all = false): Promise<Product[]> { return get().Y.products.filter((p) => all || p.active).map((p) => ({ ...p, image_url: p.image_path ? imgs.get(p.image_path) ?? null : null })); },
    async saveProduct(i: Omit<Product, "id" | "image_url"> & { image?: File | null }, pid?: string) {
      const g = get(); const { image, ...rest } = i; let image_path = rest.image_path;
      if (image) { image_path = "mock/shop/" + id(); imgs.set(image_path, await fileToDataUrl(await downscaleImage(image, 800, 0.8))); }
      if (pid) { const p = g.Y.products.find((x) => x.id === pid); if (p) Object.assign(p, { ...rest, image_path }); } else g.Y.products.push({ ...rest, image_path, id: "pr-" + id() });
      g.save(); g.emit();
    },
    async listOrders(all = false): Promise<Order[]> { const mine = myPeople(); return get().Y.orders.filter((o) => all || mine.includes(o.person_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async createOrder(personId: string, lines: OrderLine[]): Promise<Order> {
      const g = get(); const o: Order = { id: "o-" + id(), person_id: personId, person_name: name(personId), number: ++g.Y.orderSeq, lines, total_dkk: lines.reduce((s, l) => s + l.qty * l.price_dkk, 0), status: "awaiting_payment", claimed_paid_at: null, created_at: now() };
      g.Y.orders.push(o); g.save(); g.emit(); return o;
    },
    async claimPaid(oid: string) { const g = get(); const o = g.Y.orders.find((x) => x.id === oid); if (o) { o.claimed_paid_at = now(); for (const a of admins()) g.notify(a.id, "order", "Betaling meldt", `Ordre #${o.number} · ${o.total_dkk} kr.`, { order_id: o.id }); } g.save(); g.emit(); },
    async setOrderStatus(oid: string, status: Order["status"]) { const g = get(); const o = g.Y.orders.find((x) => x.id === oid); if (o && o.status !== status) { o.status = status; for (const pid of family(o.person_id)) g.notify(pid, "order", status === "paid" ? "Betaling modtaget" : status === "delivered" ? "Ordre udleveret" : "Ordre annulleret", `Ordre #${o.number}`, { order_id: o.id }); } g.save(); g.emit(); },

    async listPunchCardTypes(): Promise<PunchCardType[]> { return get().Y.cardTypes; },
    async savePunchCardType(i: Omit<PunchCardType, "id">, tid?: string) { const g = get(); if (tid) { const t = g.Y.cardTypes.find((x) => x.id === tid); if (t) Object.assign(t, i); } else g.Y.cardTypes.push({ ...i, id: "pct-" + id() }); g.save(); g.emit(); },
    async listPunchCards(all = false): Promise<PunchCard[]> { const g = get(); const mine = myPeople(); return g.Y.cards.filter((c) => all || mine.includes(c.person_id)).map((c) => ({ ...c, used: g.Y.punches.filter((p) => p.card_id === c.id).length })).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async buyPunchCard(typeId: string, personId: string): Promise<PunchCard> {
      const g = get(); const ty = g.Y.cardTypes.find((x) => x.id === typeId)!;
      const c: PunchCard = { id: "pc-" + id(), type_id: ty.id, type_name: ty.name, person_id: personId, person_name: name(personId), punches_total: ty.punches, punches_left: ty.punches, used: 0, expires_on: new Date(Date.now() + ty.valid_days * 864e5).toISOString().slice(0, 10), status: "awaiting_payment", claimed_paid_at: null, price_dkk: ty.price_dkk, created_at: now() };
      g.Y.cards.push(c); g.save(); g.emit(); return c;
    },
    async claimPunchCardPaid(cid: string) { const g = get(); const c = g.Y.cards.find((x) => x.id === cid); if (c) { c.claimed_paid_at = now(); for (const a of admins()) g.notify(a.id, "punch", "Klippekort – betaling meldt", `${c.person_name} · ${c.type_name}`, { card_id: c.id }); } g.save(); g.emit(); },
    async activatePunchCard(cid: string) {
      const g = get(); const c = g.Y.cards.find((x) => x.id === cid); if (!c) return; const ty = g.Y.cardTypes.find((x) => x.id === c.type_id)!;
      c.status = "active"; c.expires_on = new Date(Date.now() + ty.valid_days * 864e5).toISOString().slice(0, 10);
      for (const t of g.teams.filter((x) => x.punch_card_open)) if (!g.memberships.some((m) => m.person_id === c.person_id && m.team_id === t.id)) g.memberships.push({ person_id: c.person_id, team_id: t.id, role: "dancer" });
      for (const pid of family(c.person_id)) g.notify(pid, "punch", "Klippekort aktiveret", `${ty.name} · ${ty.punches} klip`, { card_id: c.id }); g.save(); g.emit();
    },
    /** called by saveAttendance in the schedule mock: present on a punch-card team → one punch */
    punchFor(sessionTeamId: string | null, personId: string, sessionId: string) {
      const g = get(); const t = g.teams.find((x) => x.id === sessionTeamId); if (!t?.punch_card_open) return false;
      const c = g.Y.cards.find((x) => x.person_id === personId && x.status === "active" && x.punches_left > 0); if (!c) return false;
      if (g.Y.punches.some((p) => p.card_id === c.id && p.session_id === sessionId)) return true;
      g.Y.punches.push({ card_id: c.id, session_id: sessionId }); c.punches_left -= 1; if (c.punches_left <= 0) c.status = "expired";
      for (const pid of family(c.person_id)) g.notify(pid, "punch", "Klip brugt", `${t.name} · ${c.punches_left} klip tilbage`, { card_id: c.id }); return true;
    },

    async listMilestones(personId?: string): Promise<Milestone[]> { const g = get(); const me = g.me()!; const staff = me.is_admin || g.memberships.some((m) => m.person_id === me.id && m.role !== "dancer"); const mine = myPeople(); return g.Y.milestones.filter((m) => (!personId || m.person_id === personId) && (staff || mine.includes(m.person_id))).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async giveMilestone(personId: string, title: string, teamId: string | null) {
      const g = get(); const me = g.me()!; const m: Milestone = { id: "ms-" + id(), person_id: personId, person_name: name(personId), title, reached_on: now().slice(0, 10), team_id: teamId, team_name: g.teams.find((t) => t.id === teamId)?.name ?? null, given_by_name: name(me.id), created_at: now() };
      g.Y.milestones.push(m); for (const pid of family(personId)) g.notify(pid, "milestone", "Ny milepæl 🏅", title, { milestone_id: m.id }); g.save(); g.emit();
    },
    async deleteMilestone(mid: string) { const g = get(); g.Y.milestones = g.Y.milestones.filter((m) => m.id !== mid); g.save(); g.emit(); },

    async listNotifications(): Promise<Notification[]> { const mine = myPeople(); return get().Y.notifications.filter((n) => mine.includes(n.person_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 60); },
    async savePushToken() { /* no-op in mock */ },
    async markNotificationsRead(ids?: string[]) { const g = get(); const mine = myPeople(); for (const n of g.Y.notifications) if (mine.includes(n.person_id) && !n.read_at && (!ids || ids.includes(n.id))) n.read_at = now(); g.save(); g.emit(); },
  };
}
