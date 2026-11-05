import type { Api, Me, Membership, PendingPerson, Person, Role, SignUpInput, Team } from "./types";
import { scheduleOps, seedSchedule, type SchedState } from "./mock-schedule";

/**
 * In-memory stand-in for Supabase. Used when app.config.json has no supabase.url (dev, smoke tests, web demo).
 * Persists in localStorage so a reload keeps you signed in. Any 6-digit code is accepted.
 * The special address admin@demo signs in as Line (approved admin).
 */
const KEY = "llds_mock";
type State = { email: string | null; persons: Person[]; guardians: { parent_id: string; child_id: string }[]; memberships: Membership[]; teams: Team[]; S: SchedState };

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
  closed: closed as boolean, parents_see_video: psv as boolean, punch_card_open: punch as boolean, color: null, sort: i,
}));

const id = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

function load(): State {
  try { const s = localStorage.getItem(KEY); if (s) { const st = JSON.parse(s) as State; if (st.S && st.teams) return st; } } catch { /* ignore */ }
  const line: Person = { id: "p-line", school_id: SCHOOL, user_id: "u-line", first_name: "Line", last_name: "Lund Olesen", email: "admin@demo", phone: "+45 22 44 01 55", birth_year: 1990, status: "approved", is_admin: true, photo_consent: true, wished_roles: ["trainer"], wished_teams: null, supervised_by: null, created_at: now() };
  const maja: Person = { ...line, id: "p-maja", user_id: "u-maja", first_name: "Maja", last_name: "Kristensen", email: "maja@demo", is_admin: false, wished_roles: ["trainer"] };
  const sofie: Person = { ...line, id: "p-sofie", user_id: "u-sofie", first_name: "Sofie", last_name: "Dahl", email: "sofie@demo", is_admin: false };
  const st: Person = { ...line, id: "p-st", user_id: "u-st", first_name: "Steffen", last_name: "Therkildsen", email: "parent@demo", is_admin: false, wished_roles: ["parent"] };
  const freja: Person = { ...line, id: "p-freja", user_id: null, first_name: "Freja", last_name: "Therkildsen", email: null, is_admin: false, birth_year: 2013, wished_roles: ["dancer"] };
  const pendingParent: Person = { ...line, id: "p-karin", user_id: "u-karin", first_name: "Karin", last_name: "Nielsen", email: "karin@demo", status: "pending", is_admin: false, wished_roles: ["parent"], wished_teams: "The AXIS (Alma)" };
  const pendingChild: Person = { ...freja, id: "p-alma", first_name: "Alma", last_name: "Nielsen", birth_year: 2012, status: "pending" };
  return {
    email: null,
    persons: [line, maja, sofie, st, freja, pendingParent, pendingChild],
    teams: TEAMS,
    S: seedSchedule(TEAMS, [line, maja, sofie]),
    guardians: [{ parent_id: "p-st", child_id: "p-freja" }, { parent_id: "p-karin", child_id: "p-alma" }],
    memberships: [
      { person_id: "p-freja", team_id: "team-0", role: "dancer" }, { person_id: "p-freja", team_id: "team-14", role: "dancer" },
      { person_id: "p-maja", team_id: "team-12", role: "trainer" }, { person_id: "p-maja", team_id: "team-15", role: "trainer" }, { person_id: "p-maja", team_id: "team-14", role: "dancer" },
      { person_id: "p-sofie", team_id: "team-8", role: "trainer" }, { person_id: "p-sofie", team_id: "team-11", role: "trainer" }, { person_id: "p-line", team_id: "team-0", role: "trainer" }, { person_id: "p-line", team_id: "team-1", role: "trainer" },
      { person_id: "p-alma", team_id: "team-0", role: "dancer" }, { person_id: "p-karin", team_id: "team-0", role: "dancer" },
    ],
  };
}
let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ignore */ } };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const meRow = () => S.persons.find((p) => p.email === S.email && p.user_id) ?? null;

const sched = scheduleOps(() => ({ get S() { return S.S; }, get persons() { return S.persons; }, get memberships() { return S.memberships; }, set memberships(v) { S.memberships = v; }, get guardians() { return S.guardians; }, get teams() { return S.teams; }, me: meRow, save, emit }));

export const mockApi: Api = {
  ...sched,
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
    const childIds = S.guardians.filter((g) => g.parent_id === person.id).map((g) => g.child_id);
    const children = S.persons.filter((p) => childIds.includes(p.id));
    const ids = [person.id, ...childIds];
    const memberships = S.memberships.filter((m) => ids.includes(m.person_id));
    return { person, children, memberships, teams: person.status === "approved" ? S.teams : [] };
  },
  async signUp(i: SignUpInput) {
    if (!S.email) throw new Error("not signed in");
    if (meRow()) throw new Error("already registered");
    const pid = "p-" + id();
    S.persons.push({ id: pid, school_id: SCHOOL, user_id: "u-" + id(), first_name: i.firstName, last_name: i.lastName, email: S.email, phone: i.phone, birth_year: i.birthYear, status: "pending", is_admin: false, photo_consent: null, wished_roles: i.roles, wished_teams: i.wishedTeams, supervised_by: null, created_at: now() });
    for (const c of i.children) {
      const cid = "p-" + id();
      S.persons.push({ id: cid, school_id: SCHOOL, user_id: null, first_name: c.firstName, last_name: i.lastName, email: null, phone: null, birth_year: c.birthYear, status: "pending", is_admin: false, photo_consent: null, wished_roles: ["dancer"], wished_teams: null, supervised_by: null, created_at: now() });
      S.guardians.push({ parent_id: pid, child_id: cid });
    }
    save(); emit();
  },

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
};

export function mockReset() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } S = load(); emit(); }
