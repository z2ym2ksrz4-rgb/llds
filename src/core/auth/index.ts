import { create } from "zustand";
import { api, type Me, type Role, type Team } from "@/core/api";

export type Phase = "loading" | "signedOut" | "register" | "pending" | "rejected" | "ready";

/** Which hat the user wears right now: themselves, or one of their children. */
export type Viewing = { personId: string; isChild: boolean };

type Store = {
  phase: Phase;
  email: string | null;
  me: Me | null;
  viewing: Viewing | null;
  teamId: string | null;         // currently selected team (holdvælger)
  error: string | null;
  boot: () => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  setViewing: (v: Viewing) => void;
  setTeam: (id: string) => void;
  /** derived */
  isAdmin: () => boolean;
  isStaff: () => boolean;
  roleOn: (teamId: string, personId?: string) => Role | "parent" | null;
  myTeams: () => Team[];
};

const VIEW_KEY = "llds_view";

export const useAuth = create<Store>((set, get) => ({
  phase: "loading", email: null, me: null, viewing: null, teamId: null, error: null,

  async boot() {
    api.onAuthChange(() => { void get().refresh(); });
    await get().refresh();
  },

  async refresh() {
    try {
      const email = await api.sessionEmail();
      if (!email) { set({ phase: "signedOut", email: null, me: null, viewing: null }); return; }
      const me = await api.getMe();
      if (!me) { set({ phase: "register", email, me: null }); return; }
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
      set({ phase, email, me, viewing, teamId, error: null });
    } catch (e) {
      set({ phase: "signedOut", error: (e as Error).message });
    }
  },

  async signOut() { await api.signOut(); set({ phase: "signedOut", me: null, viewing: null, teamId: null }); },

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
    const m = me.memberships.find((x) => x.team_id === teamId && x.person_id === pid);
    if (m) return pid === me.person.id ? m.role : "parent";
    return null;
  },
  myTeams: () => {
    const me = get().me; const v = get().viewing; if (!me || !v) return [];
    const ids = new Set(me.memberships.filter((m) => m.person_id === v.personId).map((m) => m.team_id));
    return me.teams.filter((t) => ids.has(t.id));
  },
}));
