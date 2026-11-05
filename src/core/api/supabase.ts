import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import appConfig from "../../../app.config.json";
import type { Api, Membership, PendingPerson, Person, Role, Team } from "./types";

/** Real backend. Row Level Security in supabase/migrations/0001_schema.sql decides what each user may read. */
export function supabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const schoolSlug = appConfig.schoolSlug;
  const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

  return {
    async sessionEmail() {
      const { data } = await sb.auth.getSession();
      return data.session?.user.email ?? null;
    },
    async sendCode(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { lang: "da", school: schoolSlug } } });
      fail(error);
    },
    async verifyCode(email, code) {
      const { error } = await sb.auth.verifyOtp({ email, token: code, type: "email" });
      fail(error);
    },
    async signOut() { await sb.auth.signOut(); },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb());
      return () => data.subscription.unsubscribe();
    },

    async getMe() {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return null;
      const { data: person, error } = await sb.from("person").select("*").eq("user_id", u.user.id).maybeSingle();
      fail(error);
      if (!person) return null;
      const { data: g } = await sb.from("guardian").select("child_id").eq("parent_id", person.id);
      const childIds = (g ?? []).map((r) => r.child_id as string);
      const children = childIds.length ? ((await sb.from("person").select("*").in("id", childIds)).data ?? []) as Person[] : [];
      const ids = [person.id, ...childIds];
      const memberships = ((await sb.from("membership").select("person_id,team_id,role").in("person_id", ids)).data ?? []) as Membership[];
      const teams = person.status === "approved" ? (((await sb.from("team").select("*").eq("archived", false).order("sort")).data ?? []) as Team[]) : [];
      return { person: person as Person, children, memberships, teams };
    },

    async signUp(i) {
      const { error } = await sb.rpc("sign_up", {
        p_school_slug: schoolSlug, p_first: i.firstName, p_last: i.lastName, p_phone: i.phone, p_birth_year: i.birthYear,
        p_roles: i.roles, p_wished_teams: i.wishedTeams,
        p_children: i.children.map((c) => ({ first_name: c.firstName, birth_year: c.birthYear })),
      });
      fail(error);
    },

    async listPending() {
      // adults = pending people with a login; their children ride along via guardian
      const { data: adults, error } = await sb.from("person").select("*").eq("status", "pending").not("user_id", "is", null).order("created_at");
      fail(error);
      const out: PendingPerson[] = [];
      for (const p of (adults ?? []) as Person[]) {
        const { data: g } = await sb.from("guardian").select("child_id").eq("parent_id", p.id);
        const ids = (g ?? []).map((r) => r.child_id as string);
        const children = ids.length ? (((await sb.from("person").select("*").in("id", ids)).data ?? []) as Person[]) : [];
        out.push({ ...p, children });
      }
      return out;
    },
    async listTeams() {
      const { data, error } = await sb.from("team").select("*").eq("archived", false).order("sort");
      fail(error);
      return (data ?? []) as Team[];
    },
    async approve(personId, memberships: { team_id: string; role: Role }[], isAdmin = false) {
      const { error } = await sb.rpc("approve_person", { p_id: personId, p_admin: isAdmin, p_memberships: memberships });
      fail(error);
    },
    async reject(personId) {
      const { error } = await sb.rpc("reject_person", { p_id: personId });
      fail(error);
    },
  };
}
