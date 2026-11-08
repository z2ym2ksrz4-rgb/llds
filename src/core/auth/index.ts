import { create } from "zustand";
import { api, type Me, type Role, type Team } from "@/core/api";
import { registerPush } from "@/core/push";
import appConfig from "../../../app.config.json";

/** Oldest possible dancer age on a team, from its "årgang" text ("2017–2020", "Fra årgang 2016", "3 år til skolestart", "14 år+"). null = unknown. */
export function teamMaxAge(t: Team | undefined): number | null {
  if (!t?.years) return null;
  const y = new Date().getFullYear();
  const years = (t.years.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
  if (years.length) return y - Math.min(...years);
  const ages = (t.years.match(/(\d+)\s*år/g) ?? []).map((m) => parseInt(m));
  if (ages.length) return /\+|ældre|fra/i.test(t.years) ? 99 : Math.max(...ages);
  if (/skolestart|skolegruppen/i.test(t.years)) return 6;
  return null;
}
/** What access a dancer of the team's oldest age would have. */
export function dancerAccess(t: Team | undefined): "none" | "child" | "own" | "unknown" {
  const a = teamMaxAge(t); if (a == null) return "unknown";
  return a < appConfig.supervisedFromAge ? "none" : a < appConfig.minAccountAge ? "child" : "own";
}

export type Phase = "loading" | "signedOut" | "register" | "pending" | "rejected" | "ready";

/** Which hat the user wears right now: themselves, or one of their children. */
export type Viewing = { personId: string; isChild: boolean };
/** "Vis appen som": an admin previews the app as a real test persona (person id). null = your real self. */
export type ViewRole = string;
export type Persona = { id: string; first_name: string; age: number | null; roles: string[]; is_admin: boolean; supervised: boolean; children: string[] };

type Store = {
  phase: Phase;
  email: string | null;
  me: Me | null;                 // what the app sees (filtered by viewAs)
  realMe: Me | null;             // the real profile
  viewAs: ViewRole | null;
  viewing: Viewing | null;
  teamId: string | null;         // currently selected team (holdvælger)
  error: string | null;
  boot: () => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setViewing: (v: Viewing) => void;
  setTeam: (id: string) => void;
  setViewAs: (personId: ViewRole | null) => Promise<void>;
  /** test personas an admin can preview as (persons named "Testperson") */
  personas: Persona[];
  loadPersonas: () => Promise<void>;
  /** when previewing as a child too young for any login */
  previewBlocked: () => Team | null;
  /** derived */
  isAdmin: () => boolean;
  isStaff: () => boolean;
  roleOn: (teamId: string, personId?: string) => Role | "parent" | null;
  myTeams: () => Team[];
};

const VIEW_KEY = "llds_view";
const ROLE_KEY = "llds_viewas";

export const useAuth = create<Store>((set, get) => ({
  phase: "loading", email: null, me: null, realMe: null, viewAs: null, viewing: null, teamId: null, error: null, personas: [],

  async boot() {
    api.onAuthChange(() => { void get().refresh(); });
    await get().refresh();
  },

  async refresh() {
    try {
      const email = await api.sessionEmail();
      if (!email) { set({ phase: "signedOut", email: null, me: null, viewing: null }); return; }
      const real = await api.getMe();
      if (!real) { set({ phase: "register", email, me: null, realMe: null }); return; }
      let viewAs: ViewRole | null = null;
      try { viewAs = sessionStorage.getItem(ROLE_KEY) || null; } catch { /* ignore */ }
      let me = real;
      if (viewAs && real.person.is_admin) { try { me = await api.getMeFor(viewAs); } catch { viewAs = null; } } else viewAs = null;
      const st = me.person.status;
      const phase: Phase = st === "approved" ? "ready" : st === "rejected" ? "rejected" : "pending";
      // restore the last hat + team, else sensible defaults
      let viewing: Viewing = { personId: me.person.id, isChild: false };
      let teamId: string | null = null;
      try { const saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null"); if (saved?.personId && (saved.personId === me.person.id || me.children.some((c) => c.id === saved.personId))) { viewing = saved.viewing; teamId = saved.teamId; } } catch { /* ignore */ }
      const ownTeams = me.memberships.filter((m) => m.person_id === me.person.id);
      if (!ownTeams.length && me.children.length && viewing.personId === me.person.id) viewing = { personId: me.children[0].id, isChild: true };
      const teamsOf = me.memberships.filter((m) => m.person_id === viewing.personId && (!viewing.isChild || m.role === "dancer")).map((m) => m.team_id);
      if (!teamId || !teamsOf.includes(teamId)) teamId = teamsOf[0] ?? (real.person.is_admin ? (teamId && real.teams.some((t) => t.id === teamId) ? teamId : real.teams[0]?.id ?? null) : null);
      set({ phase, email, me, realMe: real, viewAs, viewing, teamId, error: null });
      if (phase === "ready") void registerPush();
    } catch (e) {
      set({ phase: "signedOut", error: (e as Error).message });
    }
  },

  async signOut() { await api.signOut(); try { sessionStorage.removeItem(ROLE_KEY); } catch { /* ignore */ } set({ phase: "signedOut", me: null, realMe: null, viewAs: null, viewing: null, teamId: null }); },

  async setViewAs(personId) {
    const real = get().realMe; if (!real) return;
    if (!personId || !real.person.is_admin) { set({ viewAs: null, me: real, viewing: { personId: real.person.id, isChild: false }, teamId: real.teams[0]?.id ?? null }); try { sessionStorage.removeItem(ROLE_KEY); } catch { /* ignore */ } return; }
    const me = await api.getMeFor(personId);
    const own = me.memberships.filter((m) => m.person_id === me.person.id);
    // a pure parent wears the first child's hat straight away – that is what they see when they log in
    const viewing: Viewing = !own.length && me.children.length ? { personId: me.children[0].id, isChild: true } : { personId: me.person.id, isChild: false };
    const teamsOf = me.memberships.filter((m) => m.person_id === viewing.personId && (!viewing.isChild || m.role === "dancer")).map((m) => m.team_id);
    const teamId = teamsOf[0] ?? (me.person.is_admin ? me.teams[0]?.id ?? null : null);
    set({ viewAs: personId, me, viewing, teamId });
    try { sessionStorage.setItem(ROLE_KEY, personId); } catch { /* ignore */ }
  },
  async loadPersonas() {
    const real = get().realMe; if (!real?.person.is_admin) { set({ personas: [] }); return; }
    try {
      const all = await api.listMembers();
      const tests = all.filter((p) => p.last_name === "Testperson" && p.status === "approved");
      const personas: Persona[] = tests.filter((p) => !p.parents.length || !!p.supervised_by || p.memberships.some((m) => m.role !== "dancer") || (p.birth_year && new Date().getFullYear() - p.birth_year >= 13)).map((p) => {   // children without a login of their own are not personas
        const roles: string[] = [];
        if (p.is_admin) roles.push("admin");
        if (p.memberships.some((m) => m.role === "trainer")) roles.push("trainer");
        if (p.memberships.some((m) => m.role === "assistant")) roles.push("assistant");
        if (p.memberships.some((m) => m.role === "dancer")) roles.push(p.supervised_by ? "dancerChild" : "dancer");
        if (p.children.length) roles.push("parent");
        return { id: p.id, first_name: p.first_name, age: p.birth_year ? new Date().getFullYear() - p.birth_year : null, roles, is_admin: p.is_admin, supervised: !!p.supervised_by, children: p.children.map((c) => c.first_name) };
      }).sort((a, b) => a.roles.length - b.roles.length || a.first_name.localeCompare(b.first_name));
      set({ personas });
    } catch { set({ personas: [] }); }
  },
  previewBlocked() {
    const { viewAs, me, teamId } = get(); if (!me || !viewAs) return null;
    const age = me.person.birth_year ? new Date().getFullYear() - me.person.birth_year : null;
    if (age === null || age >= appConfig.supervisedFromAge) return null;
    return me.teams.find((t) => t.id === teamId) ?? me.teams[0] ?? null;
  },

  setViewing(v) {
    const me = get().me; if (!me) return;
    const teams = me.memberships.filter((m) => m.person_id === v.personId).map((m) => m.team_id);
    const teamId = teams[0] ?? null;
    set({ viewing: v, teamId });
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ personId: v.personId, viewing: v, teamId })); } catch { /* ignore */ }
  },
  setTeam(id) {
    set({ teamId: id });
    const v = get().viewing;
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ personId: v?.personId, viewing: v, teamId: id })); } catch { /* ignore */ }
  },

  isAdmin: () => !!get().me?.person.is_admin,
  isStaff: () => { const me = get().me; return !!me && (me.person.is_admin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer")); },
  roleOn: (teamId, personId) => {
    const me = get().me; if (!me) return null;
    const pid = personId ?? get().viewing?.personId ?? me.person.id;
    // a parent only follows the teams where the child DANCES – a child's trainer/assistant role is the child's own
    const m = me.memberships.find((x) => x.team_id === teamId && x.person_id === pid && (pid === me.person.id || x.role === "dancer"));
    if (m) return pid === me.person.id ? m.role : "parent";
    return null;
  },
  myTeams: () => {
    const me = get().me; const v = get().viewing; if (!me || !v) return [];
    // an admin previewing a role may pick any team – the membership is synthesised on the chosen one
    if (me.person.is_admin) return me.teams;                       // admin: every team's wall
    const ids = new Set(me.memberships.filter((m) => m.person_id === v.personId && (!v.isChild || m.role === "dancer")).map((m) => m.team_id));
    return me.teams.filter((t) => ids.has(t.id));
  },
}));
