import { create } from "zustand";
import { api, type Me, type Role, type Team } from "@/core/api";
import { registerPush } from "@/core/push";

export type Phase = "loading" | "signedOut" | "register" | "pending" | "rejected" | "ready";

/** Which hat the user wears right now: themselves, or one of their children. */
export type Viewing = { personId: string; isChild: boolean };
/** "Vis appen som": preview the app with one of your roles (or, as admin, any role). null = your real self. */
export type ViewRole = "admin" | "trainer" | "assistant" | "dancer" | "parent";

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
  setViewAs: (r: ViewRole | null) => void;
  /** roles this account can preview: the ones it holds, or all five for an admin */
  viewOptions: () => ViewRole[];
  /** derived */
  isAdmin: () => boolean;
  isStaff: () => boolean;
  roleOn: (teamId: string, personId?: string) => Role | "parent" | null;
  myTeams: () => Team[];
};

const VIEW_KEY = "llds_view";
const ROLE_KEY = "llds_viewas";

/** Build the profile the app should see for a given preview role. Admins get a synthesised membership on the chosen team when they hold none. */
function applyView(real: Me, viewAs: ViewRole | null, teamId: string | null): Me {
  if (!viewAs || (viewAs === "admin" && real.person.is_admin)) return real;
  const own = real.memberships.filter((m) => m.person_id === real.person.id);
  const person = { ...real.person, is_admin: false };
  if (viewAs === "parent") return { ...real, person, memberships: real.memberships.filter((m) => m.person_id !== real.person.id) };
  let mine = own.filter((m) => m.role === viewAs);
  if (!mine.length && real.person.is_admin) { const tid = teamId && real.teams.some((t) => t.id === teamId) ? teamId : real.teams[0]?.id; if (tid) mine = [{ person_id: real.person.id, team_id: tid, role: viewAs }]; }
  return { ...real, person, children: [], memberships: mine };
}

export const useAuth = create<Store>((set, get) => ({
  phase: "loading", email: null, me: null, realMe: null, viewAs: null, viewing: null, teamId: null, error: null,

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
      try { viewAs = (sessionStorage.getItem(ROLE_KEY) as ViewRole | null) || null; } catch { /* ignore */ }
      let savedTeam: string | null = null;
      try { savedTeam = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null")?.teamId ?? null; } catch { /* ignore */ }
      const me = applyView(real, viewAs, savedTeam);
      const st = me.person.status;
      const phase: Phase = st === "approved" ? "ready" : st === "rejected" ? "rejected" : "pending";
      // restore the last hat + team, else sensible defaults
      let viewing: Viewing = { personId: me.person.id, isChild: false };
      let teamId: string | null = null;
      try { const saved = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "null"); if (saved?.personId && (saved.personId === me.person.id || me.children.some((c) => c.id === saved.personId))) { viewing = saved.viewing; teamId = saved.teamId; } } catch { /* ignore */ }
      const ownTeams = me.memberships.filter((m) => m.person_id === me.person.id);
      if (!ownTeams.length && me.children.length && viewing.personId === me.person.id) viewing = { personId: me.children[0].id, isChild: true };
      const teamsOf = me.memberships.filter((m) => m.person_id === viewing.personId).map((m) => m.team_id);
      if (!teamId || !teamsOf.includes(teamId)) teamId = teamsOf[0] ?? null;
      set({ phase, email, me, realMe: real, viewAs, viewing, teamId, error: null });
      if (phase === "ready") void registerPush();
    } catch (e) {
      set({ phase: "signedOut", error: (e as Error).message });
    }
  },

  async signOut() { await api.signOut(); try { sessionStorage.removeItem(ROLE_KEY); } catch { /* ignore */ } set({ phase: "signedOut", me: null, realMe: null, viewAs: null, viewing: null, teamId: null }); },

  setViewAs(r) {
    const real = get().realMe; if (!real) return;
    const viewAs = r === "admin" && real.person.is_admin ? null : r;
    const me = applyView(real, viewAs, get().teamId);
    const own = me.memberships.filter((m) => m.person_id === me.person.id);
    const viewing: Viewing = viewAs === "parent" && me.children.length ? { personId: me.children[0].id, isChild: true } : { personId: me.person.id, isChild: false };
    const teamsOf = me.memberships.filter((m) => m.person_id === viewing.personId).map((m) => m.team_id);
    const teamId = teamsOf.includes(get().teamId ?? "") ? get().teamId : teamsOf[0] ?? (own[0]?.team_id ?? null);
    set({ viewAs, me, viewing, teamId });
    try { if (viewAs) sessionStorage.setItem(ROLE_KEY, viewAs); else sessionStorage.removeItem(ROLE_KEY); } catch { /* ignore */ }
  },
  viewOptions() {
    const real = get().realMe; if (!real) return [];
    const own = real.memberships.filter((m) => m.person_id === real.person.id);
    const has = (r: ViewRole) => own.some((m) => m.role === r);
    const opts: ViewRole[] = [];
    if (real.person.is_admin) opts.push("admin");
    for (const r of ["trainer", "assistant", "dancer"] as ViewRole[]) if (real.person.is_admin || has(r)) opts.push(r);
    if (real.children.length) opts.push("parent");
    return opts;
  },

  setViewing(v) {
    const me = get().me; if (!me) return;
    const teams = me.memberships.filter((m) => m.person_id === v.personId).map((m) => m.team_id);
    const teamId = teams[0] ?? null;
    set({ viewing: v, teamId });
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ personId: v.personId, viewing: v, teamId })); } catch { /* ignore */ }
  },
  setTeam(id) {
    const { realMe, viewAs } = get();
    set({ teamId: id, ...(realMe && viewAs ? { me: applyView(realMe, viewAs, id) } : {}) });
    const v = get().viewing;
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ personId: v?.personId, viewing: v, teamId: id })); } catch { /* ignore */ }
  },

  isAdmin: () => !!get().me?.person.is_admin,
  isStaff: () => { const me = get().me; return !!me && (me.person.is_admin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer")); },
  roleOn: (teamId, personId) => {
    const me = get().me; if (!me) return null;
    const pid = personId ?? get().viewing?.personId ?? me.person.id;
    const m = me.memberships.find((x) => x.team_id === teamId && x.person_id === pid);
    if (m) return pid === me.person.id ? m.role : "parent";
    return null;
  },
  myTeams: () => {
    const me = get().me; const v = get().viewing; if (!me || !v) return [];
    // an admin previewing a role may pick any team – the membership is synthesised on the chosen one
    if (get().viewAs && get().realMe?.person.is_admin && !get().realMe!.memberships.some((m) => m.person_id === me.person.id && m.role === get().viewAs)) return me.teams;
    const ids = new Set(me.memberships.filter((m) => m.person_id === v.personId).map((m) => m.team_id));
    return me.teams.filter((t) => ids.has(t.id));
  },
}));
