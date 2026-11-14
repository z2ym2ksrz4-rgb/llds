import type { Api, Appearance, WebSignup, Me, Membership, PendingPerson, Person, Role, SignUpInput, Team } from "./types";
import { scheduleOps, seedSchedule, type SchedState } from "./mock-schedule";
import { socialOps, seedSocial, type SocialState } from "./mock-social";
import { shopOps, seedShop, type ShopState } from "./mock-shop";

/**
 * In-memory stand-in for Supabase. Used when app.config.json has no supabase.url (dev, smoke tests, web demo).
 * Persists in localStorage so a reload keeps you signed in. Any 6-digit code is accepted.
 * The special address admin@demo signs in as Line (approved admin).
 */
const KEY = "llds_mock";
type State = { email: string | null; appearance?: Appearance; payments?: WebSignup[]; persons: Person[]; guardians: { parent_id: string; child_id: string }[]; memberships: Membership[]; teams: Team[]; S: SchedState; X: SocialState; Y: ShopState };

const SCHOOL = "school-llds";
const TEAMS: Team[] = [
  ["The AXIS", "Showdance", "junior", "Elite+", true, false, false],
  ["Apexion", "Showdance", "junior", "Elite+", true, false, false],
  ["Airy", "Showdance", "junior", "Elite", true, false, false],
  ["New Age", "Showdance", "kids", "Elite", true, true, false],
  ["Mini Angels", "Showdance", "mini", "Øvet+", true, true, false],
  ["Empire", "Showdance", "junior", "Øvet", false, false, false],
  ["Control", "Showdance", "junior", "Øvet+", false, false, false],
  ["Division", "Showdance", "junior", "Begynder", false, false, false],
  ["Satellite Stars", "Showdance", "kids", "Øvet", false, true, false],
  ["Sky Stars", "Showdance", "kids", "Øvet+", false, true, false],
  ["Shining Stars", "Showdance", "kids", "Begynder", false, true, false],
  ["Mini Cuties", "Showdance", "mini", "Begynder", false, true, false],
  ["Hip Hop Junior & Voksen Elite", "Hip Hop", "mixed", "Øvet & Elite", false, false, false],
  ["Contemporary Begynder", "Contemporary", "mixed", "Begynder & Let øvet", false, false, true],
  ["Contemporary Elite", "Contemporary", "mixed", "Øvet & Elite", false, false, true],
  ["Styrketræning Junior & Voksen", "Styrke", "mixed", "Øvet+ & Elite", false, false, false],
].map(([name, style, category, level, closed, psv, punch], i) => ({
  id: `team-${i}`, name: name as string, style: style as string, category: category as Team["category"], level: level as string,
  closed: closed as boolean, admission: (closed ? "audition" : "open") as Team["admission"], parents_see_video: psv as boolean, punch_card_open: punch as boolean, color: null, sort: i,
  years: ({ mini: "2017–2020", kids: "2014–2016", junior: "2008–2013", adult: "2007 og ældre (17 år+)", mixed: "Fra årgang 2012" } as Record<string, string>)[category as string],
  price: ({ mini: "2.400 kr. for hel sæson, eller 1.750 kr. for halv sæson", kids: "2.650 kr. for hel sæson, eller 1.900 kr. for halv sæson", junior: "3.200 kr. for hel sæson, eller 2.250 kr. for halv sæson", adult: "2.900 kr. for hel sæson", mixed: "2.250 kr. for hel sæson, eller 1.550 kr. for halv sæson" } as Record<string, string>)[category as string],
  price_full: ({ mini: 2400, kids: 2650, junior: 3200, adult: 2900, mixed: 2250 } as Record<string, number>)[category as string], price_half: ({ mini: 1750, kids: 1900, junior: 2250, mixed: 1550 } as Record<string, number>)[category as string] ?? null, installments_allowed: true,
  description: `${name} er et ${(style as string).toLowerCase()}-hold på niveauet ${level}. Vi træner teknik, udtryk og sammenhold – og glæder os til at se dig på gulvet.`,
}));

const id = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

function load(): State {
  try { const s = localStorage.getItem(KEY); if (s) { const st = JSON.parse(s) as State; if (st.S && st.teams && st.X && st.Y) return st; } } catch { /* ignore */ }
  const line: Person = { id: "p-line", school_id: SCHOOL, user_id: "u-line", first_name: "Line", last_name: "Lund Olesen", email: "admin@demo", phone: "+45 22 44 01 55", birth_year: 1990, status: "approved", is_admin: true, photo_consent: true, wished_roles: ["trainer"], wished_teams: null, supervised_by: null, created_at: now() };
  const maja: Person = { ...line, id: "p-maja", user_id: "u-maja", first_name: "Maja", last_name: "Kristensen", email: "maja@demo", is_admin: false, wished_roles: ["trainer"] };
  const sofie: Person = { ...line, id: "p-sofie", user_id: "u-sofie", first_name: "Sofie", last_name: "Dahl", email: "sofie@demo", is_admin: false };
  const st: Person = { ...line, id: "p-st", user_id: "u-st", first_name: "Steffen", last_name: "Therkildsen", email: "parent@demo", is_admin: false, wished_roles: ["parent"] };
  const freja: Person = { ...line, id: "p-freja", user_id: null, first_name: "Freja", last_name: "Therkildsen", email: null, is_admin: false, birth_year: 2013, wished_roles: ["dancer"] };
  const pendingParent: Person = { ...line, id: "p-karin", user_id: "u-karin", first_name: "Karin", last_name: "Nielsen", email: "karin@demo", status: "pending", is_admin: false, wished_roles: ["parent"], wished_teams: "The AXIS (Alma)" };
  const pendingChild: Person = { ...freja, id: "p-alma", first_name: "Alma", last_name: "Nielsen", birth_year: 2012, status: "pending" };
  // test personas for "Vis appen som" – mirror of supabase/migrations/0036_test_persons.sql
  const yr = new Date().getFullYear();
  const tp = (id: string, first: string, birth: number, extra: Partial<Person> = {}): Person => ({ ...line, id, user_id: null, email: null, phone: null, first_name: first, last_name: "Testperson", birth_year: birth, birth_date: `${birth}-05-15`, is_admin: false, supervised_by: null, wished_roles: [], source: "admin", ...extra });
  const tPia = tp("t-pia", "Pia", 1984), tTilde = tp("t-tilde", "Tilde", yr - 15), tMilo = tp("t-milo", "Milo", yr - 13, { supervised_by: "t-pia" }), tIda = tp("t-ida", "Ida", yr - 8), tRasmus = tp("t-rasmus", "Rasmus", 1996), tHelle = tp("t-helle", "Helle", yr - 16), tJonas = tp("t-jonas", "Jonas", 2004), tSanne = tp("t-sanne", "Sanne", 1988), tNoor = tp("t-noor", "Noor", yr - 10), tCamilla = tp("t-camilla", "Camilla", 1981, { is_admin: true });
  const testPersons = [tTilde, tMilo, tPia, tIda, tRasmus, tHelle, tJonas, tSanne, tNoor, tCamilla];
  return {
    email: null,
    persons: [line, maja, sofie, st, freja, pendingParent, pendingChild, ...testPersons],
    teams: TEAMS,
    S: seedSchedule(TEAMS, [line, maja, sofie]),
    X: seedSocial(TEAMS, [line, maja, sofie, st, freja]),
    Y: seedShop(TEAMS),
    guardians: [{ parent_id: "p-st", child_id: "p-freja" }, { parent_id: "p-karin", child_id: "p-alma" }, { parent_id: "t-pia", child_id: "t-milo" }, { parent_id: "t-pia", child_id: "t-ida" }, { parent_id: "t-sanne", child_id: "t-noor" }, { parent_id: "t-camilla", child_id: "t-milo" }],
    memberships: [
      { person_id: "p-freja", team_id: "team-0", role: "dancer" }, { person_id: "p-freja", team_id: "team-14", role: "dancer" },
      { person_id: "p-maja", team_id: "team-12", role: "trainer" }, { person_id: "p-maja", team_id: "team-15", role: "trainer" }, { person_id: "p-maja", team_id: "team-14", role: "dancer" },
      { person_id: "p-sofie", team_id: "team-8", role: "trainer" }, { person_id: "p-sofie", team_id: "team-11", role: "trainer" }, { person_id: "p-line", team_id: "team-0", role: "trainer" }, { person_id: "p-line", team_id: "team-1", role: "trainer" },
      { person_id: "p-alma", team_id: "team-0", role: "dancer" }, { person_id: "p-karin", team_id: "team-0", role: "dancer" },
      { person_id: "t-tilde", team_id: "team-0", role: "dancer" }, { person_id: "t-milo", team_id: "team-4", role: "dancer" }, { person_id: "t-ida", team_id: "team-11", role: "dancer" },
      { person_id: "t-rasmus", team_id: "team-12", role: "trainer" }, { person_id: "t-rasmus", team_id: "team-5", role: "trainer" }, { person_id: "t-helle", team_id: "team-11", role: "assistant" },
      { person_id: "t-jonas", team_id: "team-1", role: "dancer" }, { person_id: "t-jonas", team_id: "team-5", role: "trainer" }, { person_id: "t-sanne", team_id: "team-14", role: "dancer" }, { person_id: "t-noor", team_id: "team-4", role: "dancer" }, { person_id: "t-camilla", team_id: "team-0", role: "trainer" },
    ],
  };
}
let S = load();
const buildMe = (person: Person): Me => {
  const childIds = S.guardians.filter((g) => g.parent_id === person.id).map((g) => g.child_id);
  const children = S.persons.filter((p) => childIds.includes(p.id));
  const ids = [person.id, ...childIds];
  const memberships = S.memberships.filter((m) => ids.includes(m.person_id));
  return { person, children, memberships, teams: person.status === "approved" ? S.teams : [] };
};
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ignore */ } };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const meRow = () => S.persons.find((p) => p.email === S.email && p.user_id) ?? null;

const wants = (p: Person | undefined, kind: string) => !!p?.user_id && (p.notify_prefs?.on ?? true) && (p.notify_prefs?.kinds?.[kind] ?? true);
const notify = (person_id: string, kind: string, title: string, body: string | null, ref: Record<string, string> = {}) => { if (!wants(S.persons.find((p) => p.id === person_id), kind)) return; S.Y.notifications.push({ id: "n-" + id(), person_id, kind, title, body, ref, read_at: null, created_at: now() }); };
const ctx = () => ({ get S() { return S.S; }, get X() { return S.X; }, get Y() { return S.Y; }, notify, punchFor: (teamId: string | null, personId: string, sessionId: string) => shop.punchFor(teamId, personId, sessionId), awardAuto: (pid: string) => shop.awardAutoBadges(pid, S.S.attendance, S.S.sessions, S.S.absences), get persons() { return S.persons; }, get memberships() { return S.memberships; }, set memberships(v: Membership[]) { S.memberships = v; }, get guardians() { return S.guardians; }, set guardians(v: { parent_id: string; child_id: string }[]) { S.guardians = v; }, get teams() { return S.teams; }, me: meRow, save, emit });
const social = socialOps(ctx);
const shop = shopOps(ctx);
const { punchFor: _pf, ...shopApi } = shop; void _pf;
const sched = scheduleOps(ctx);

export const mockApi: Api = {
  ...sched,
  ...social,
  ...shopApi,
  async sessionEmail() { return S.email; },
  async sendCode(email) { if (!email.includes("@")) throw new Error("Ugyldig e-mail"); },
  async verifyCode(email, code) {
    if (!/^\d{6}$/.test(code)) throw new Error("Koden skal være 6 cifre");
    S.email = email.toLowerCase(); save(); emit();
  },
  async signOut() { S.email = null; save(); emit(); },
  onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },

  async getMe(): Promise<Me | null> {
    if (!S.email) return null;
    const person = meRow();
    if (!person) return null;
    return buildMe(person);
  },
  async getMeFor(personId: string): Promise<Me> {
    const person = S.persons.find((p) => p.id === personId); if (!person) throw new Error("not found");
    return buildMe(person);
  },
  async signUp(i: SignUpInput) {
    if (!S.email) throw new Error("not signed in");
    if (meRow()) throw new Error("already registered");
    const pid = "p-" + id();
    S.persons.push({ id: pid, school_id: SCHOOL, user_id: "u-" + id(), first_name: i.firstName, last_name: i.lastName, email: S.email, phone: i.phone, birth_year: i.birthYear, birth_date: i.birthDate, status: "pending", is_admin: false, photo_consent: null, wished_roles: i.roles, wished_teams: i.wishedTeams, supervised_by: null, created_at: now() });
    for (const c of i.children) {
      const cid = "p-" + id();
      S.persons.push({ id: cid, school_id: SCHOOL, user_id: null, first_name: c.firstName, last_name: i.lastName, email: null, phone: null, birth_year: c.birthYear, birth_date: c.birthDate || null, status: "pending", is_admin: false, photo_consent: null, wished_roles: ["dancer"], wished_teams: null, supervised_by: null, created_at: now() });
      S.guardians.push({ parent_id: pid, child_id: cid });
    }
    for (const a of S.persons.filter((p) => p.is_admin && p.status === "approved")) notify(a.id, "signup", "Ny tilmelding 📝", `${i.firstName} ${i.lastName}${i.wishedTeams ? " – " + i.wishedTeams : ""}`, { person_id: pid });
    save(); emit();
  },
  async updateNotifyPrefs(prefs) { const me = meRow(); if (me) me.notify_prefs = prefs; save(); emit(); },
  async listWebSignups() { return S.payments ?? []; },
  async setWebSignupStatus(id, status) { const p = (S.payments ?? []).find((x) => x.id === id); if (p) { if (status === "paid" && (p.installments ?? 1) > 1) { p.rates_paid = Math.min(p.installments!, (p.rates_paid ?? 0) + 1); p.claimed_paid_at = null; if (!S.memberships.some((m) => m.person_id === p.dancer_id && m.team_id === p.team_id)) S.memberships.push({ person_id: p.dancer_id, team_id: p.team_id, role: "dancer" }); if (p.rates_paid! < p.installments!) { save(); emit(); return; } } p.status = status; if (status === "paid") { if (!S.memberships.some((m) => m.person_id === p.dancer_id && m.team_id === p.team_id)) S.memberships.push({ person_id: p.dancer_id, team_id: p.team_id, role: "dancer" }); for (const pid of new Set([p.dancer_id, p.contact_id])) notify(pid, "payment", "Betaling modtaget ✓", `${p.team_name} · ${p.amount_dkk} kr.`, { payment_id: p.id }); } } save(); emit(); },
  async listMyPayments() { const me = meRow(); if (!me) return []; const mine = new Set([me.id, ...S.guardians.filter((g) => g.parent_id === me.id).map((g) => g.child_id)]); return (S.payments ?? []).filter((p) => mine.has(p.dancer_id) || mine.has(p.contact_id)); },
  async claimPaymentPaid(id) { const p = (S.payments ?? []).find((x) => x.id === id); if (p && !p.claimed_paid_at) { p.claimed_paid_at = now(); for (const a of S.persons.filter((x) => x.is_admin && x.status === "approved")) notify(a.id, "payment", "Betaling meldt", `${p.dancer_name} · ${p.team_name} · ${p.amount_dkk} kr.`, { payment_id: p.id }); } save(); emit(); },
  async appSignupTeam(teamId, personId, plan) {
    const me = meRow()!; const team = S.teams.find((t) => t.id === teamId)!; const p = S.persons.find((x) => x.id === personId)!;
    if (S.memberships.some((m) => m.person_id === personId && m.team_id === teamId)) throw new Error("already member");
    const n = plan === "rates2" ? 2 : plan === "rates4" ? 4 : plan === "rates10" ? 10 : 1;
    const before = plan === "half" && team.price_half ? team.price_half : team.price_signup ?? team.price_full ?? null;
    const pct = before != null && (S.payments ?? []).some((w) => w.contact_id === me.id && w.status !== "cancelled" && (w.amount_before_dkk ?? w.amount_dkk ?? 0) >= before) ? 10 : 0;
    const net = before == null ? null : Math.round(before * (100 - pct) / 100);
    const fee = n > 1 && !(S.payments ?? []).some((w) => w.contact_id === me.id && w.status !== "cancelled" && w.installments === n) ? 50 * n : 0;
    const amount = net == null ? null : net + fee; const perRate = amount == null ? null : n > 1 ? Math.ceil(amount / n) : amount; const reference = `${team.name.slice(0, 18)} ${p.first_name}`; const pid = "pay-" + id();
    (S.payments ??= []).push({ id: pid, dancer_id: p.id, contact_id: me.id, team_id: team.id, team_name: team.name, dancer_name: `${p.first_name} ${p.last_name}`, contact_name: `${me.first_name} ${me.last_name}`, email: me.email, phone: me.phone, plan, amount_dkk: amount, amount_before_dkk: before, discount_pct: pct, installments: n, fee_dkk: fee, per_rate_dkk: perRate, rates_paid: 0, price_note: team.price_note ?? null, source: "app", message: null, reference, note: null, status: "awaiting_payment", claimed_paid_at: null, created_at: now() });
    for (const a of S.persons.filter((x) => x.is_admin && x.status === "approved")) notify(a.id, "signup", "Ny holdtilmelding i appen 📝", `${p.first_name} → ${team.name}`, { payment_id: pid });
    save(); emit(); return { id: pid, reference, amount_dkk: amount, amount_before_dkk: before, discount_pct: pct, team: team.name, installments: n, fee_dkk: fee, per_rate_dkk: perRate, note: team.price_note ?? null };
  },
  async requestPayment(i) {
    const team = S.teams.find((t) => t.id === i.team_id); if (!team) return 0; let n = 0;
    for (const pid of i.person_ids) { const p = S.persons.find((x) => x.id === pid); if (!p) continue; const contact = p.user_id || p.email ? p : S.persons.find((x) => x.id === S.guardians.find((g) => g.child_id === pid)?.parent_id) ?? p;
      const amount = Math.round(i.amount_dkk * (100 - i.discount_pct) / 100);
      (S.payments ??= []).push({ id: "pay-" + id(), dancer_id: p.id, contact_id: contact.id, team_id: team.id, team_name: team.name, dancer_name: `${p.first_name} ${p.last_name}`, contact_name: `${contact.first_name} ${contact.last_name}`, email: contact.email, phone: contact.phone, plan: i.plan, amount_dkk: amount, amount_before_dkk: i.amount_dkk, discount_pct: i.discount_pct, source: "admin", message: i.message ?? null, reference: `${team.name.slice(0, 18)} ${p.first_name}`, note: null, status: "awaiting_payment", claimed_paid_at: null, created_at: now() });
      notify(contact.id, "payment", `Betaling: ${team.name}`, `${p.first_name} · ${amount} kr.${i.discount_pct ? ` (rabat ${i.discount_pct} %)` : ""}${i.message ? " · " + i.message : ""}`, {}); n++; }
    save(); emit(); return n;
  },
  async deleteMyAccount() { const me = meRow(); if (!me) return; const kids = S.guardians.filter((g) => g.parent_id === me.id).map((g) => g.child_id); S.persons = S.persons.filter((p) => p.id !== me.id && !kids.includes(p.id)); S.guardians = S.guardians.filter((g) => g.parent_id !== me.id); S.memberships = S.memberships.filter((m) => m.person_id !== me.id && !kids.includes(m.person_id)); S.email = null; save(); emit(); },
  async getAppearance() { return S.appearance ?? {}; },
  async saveAppearance(a) { S.appearance = a; save(); emit(); },

  async listPending(): Promise<PendingPerson[]> {
    return S.persons.filter((p) => p.status === "pending" && p.user_id).map((p) => ({
      ...p, children: S.persons.filter((c) => S.guardians.some((g) => g.parent_id === p.id && g.child_id === c.id)),
    }));
  },
  async listTeams() { return S.teams; },
  async approve(personId, memberships: { team_id: string; role: Role }[], isAdmin = false) {
    const p = S.persons.find((x) => x.id === personId); if (!p) return;
    p.status = "approved"; p.is_admin = isAdmin;
    S.memberships = S.memberships.filter((m) => m.person_id !== personId).concat(memberships.map((m) => ({ person_id: personId, ...m })));
    save(); emit();
  },
  async reject(personId) { const p = S.persons.find((x) => x.id === personId); if (p) p.status = "rejected"; save(); emit(); },
  async lastMailStatus() { return "sent"; },
  async invitePerson(i) {
    if (S.persons.some((p) => p.email?.toLowerCase() === i.email.toLowerCase())) throw new Error("email exists");
    const pid = "p-" + id();
    S.persons.push({ id: pid, school_id: SCHOOL, user_id: null, first_name: i.first_name, last_name: i.last_name, email: i.email, phone: i.phone || null, birth_year: null, birth_date: null, status: "approved", is_admin: false, photo_consent: null, wished_roles: [i.is_parent ? "parent" : "dancer"], wished_teams: null, supervised_by: null, created_at: now() });
    for (const m of i.memberships) S.memberships.push({ person_id: pid, team_id: m.team_id, role: m.role });
    for (const c of i.children) {
      if (c.id) { S.guardians.push({ parent_id: pid, child_id: c.id }); continue; }
      const cid = "p-" + id();
      S.persons.push({ id: cid, school_id: SCHOOL, user_id: null, first_name: c.first_name, last_name: i.last_name, email: null, phone: null, birth_year: c.birth_date ? Number(c.birth_date.slice(0, 4)) : null, birth_date: c.birth_date || null, status: "approved", is_admin: false, photo_consent: null, wished_roles: ["dancer"], wished_teams: null, supervised_by: null, created_at: now() });
      S.guardians.push({ parent_id: pid, child_id: cid });
      for (const m of c.memberships) S.memberships.push({ person_id: cid, team_id: m.team_id, role: "dancer" });
    }
    save(); emit(); return pid;
  },
  async resendInvite() { /* mail only */ },
  async confirmChild(childId: string) { const p = S.persons.find((x) => x.id === childId); const me = meRow(); if (p && me) p.supervised_by = me.id; save(); emit(); },
  async inviteExisting(personId: string, email: string) { const p = S.persons.find((x) => x.id === personId); if (!p) throw new Error("not found"); if (S.persons.some((x) => x.id !== personId && x.email?.toLowerCase() === email.toLowerCase())) throw new Error("email exists"); const age = p.birth_year ? new Date().getFullYear() - p.birth_year : null; const par = S.guardians.find((g) => g.child_id === personId)?.parent_id; if (age != null && age < 18 && !par) throw new Error("needs parent"); p.email = email.toLowerCase(); if (age != null && age < 18) p.supervised_by = par ?? null; p.status = "approved"; save(); emit(); },
};

export function mockReset() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } S = load(); emit(); }
