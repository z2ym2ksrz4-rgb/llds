import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import appConfig from "../../../app.config.json";
import type { Api, Appearance, WebSignup, Me, Membership, PendingPerson, Person, Role, Team } from "./types";
import { supabaseSchedule } from "./supabase-schedule";
import { supabaseSocial } from "./supabase-social";
import { supabaseShop } from "./supabase-shop";

/** Real backend. Row Level Security in supabase/migrations/0001_schema.sql decides what each user may read. */
export function supabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const schoolSlug = appConfig.schoolSlug;
  const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };
  const myPersonId = async () => { const { data } = await sb.rpc("my_person_id"); return (data as string | null) ?? null; };
  const schoolId = async () => { const { data } = await sb.rpc("my_school_id"); return data as string; };

  const buildMe = async (person: Person): Promise<Me> => {
      const { data: g } = await sb.from("guardian").select("child_id").eq("parent_id", person.id);
      const childIds = (g ?? []).map((r) => r.child_id as string);
      const children = childIds.length ? ((await sb.from("person").select("*").in("id", childIds)).data ?? []) as Person[] : [];
      const ids = [person.id, ...childIds];
      const avatars = [person, ...children].filter((p) => p.photo_path).map((p) => p.photo_path as string);
      if (avatars.length) { const { data: signed } = await sb.storage.from("media").createSignedUrls(avatars, 3600); for (const p of [person, ...children]) { const hit = signed?.find((x) => x.path === p.photo_path); if (hit?.signedUrl) p.photo_url = hit.signedUrl; } }
      const memberships = ((await sb.from("membership").select("person_id,team_id,role").in("person_id", ids)).data ?? []) as Membership[];
      const teams = person.status === "approved" ? (((await sb.from("team").select("*").eq("archived", false).order("sort")).data ?? []) as Team[]) : [];
      const covers = teams.filter((t) => t.cover_path).map((t) => t.cover_path as string);
      if (covers.length) { const { data: signed } = await sb.storage.from("media").createSignedUrls(covers, 3600); for (const t of teams) { const hit = signed?.find((x) => x.path === t.cover_path); if (hit?.signedUrl) { t.alt_url = t.cover_url; t.cover_url = hit.signedUrl; } } }
      return { person, children, memberships, teams };
  };
  return {
    ...supabaseSchedule(sb, fail, schoolId, myPersonId),
    ...supabaseSocial(sb, fail, schoolId, myPersonId, schoolSlug),
    ...supabaseShop(sb, fail, schoolId, myPersonId, schoolSlug),
    async sessionEmail() {
      const { data } = await sb.auth.getSession();
      return data.session?.user.email ?? null;
    },
    async sendCode(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: typeof window !== "undefined" ? window.location.origin + window.location.pathname : undefined, data: { lang: "da", school: schoolSlug } } });
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
      let { data: person } = await sb.from("person").select("*").eq("user_id", u.user.id).maybeSingle();
      if (!person) { // a parent may have pre-created this person (supervised child) with this e-mail
        const { data: claimed } = await sb.rpc("claim_person");
        if (claimed) ({ data: person } = await sb.from("person").select("*").eq("id", claimed).maybeSingle());
      }
      if (!person) return null;
      return buildMe(person as Person);
    },
    async getMeFor(personId: string): Promise<Me> {
      const { data: person, error } = await sb.from("person").select("*").eq("id", personId).single(); fail(error);
      return buildMe(person as Person);
    },


    async updateNotifyPrefs(prefs) {
      const pid = await myPersonId(); if (!pid) return;
      const { error } = await sb.from("person").update({ notify_prefs: prefs }).eq("id", pid); fail(error);
    },
    async getAppearance() {
      const { data } = await sb.from("school").select("appearance").eq("slug", schoolSlug).maybeSingle();
      return ((data as { appearance?: Appearance } | null)?.appearance ?? {}) as Appearance;
    },
    async saveAppearance(a) { const { error } = await sb.from("school").update({ appearance: a }).eq("slug", schoolSlug); fail(error); },
    async deleteMyAccount() { const { error } = await sb.rpc("delete_my_account"); fail(error); await sb.auth.signOut(); },
    async listWebSignups() { const { data, error } = await sb.from("web_signup_view").select("*").order("created_at", { ascending: false }).limit(200); fail(error); return (data ?? []) as WebSignup[]; },
    async listMyPayments() { const { data, error } = await sb.from("web_signup_view").select("*").order("created_at", { ascending: false }); fail(error); return (data ?? []) as WebSignup[]; },
    async claimPaymentPaid(id) { const { error } = await sb.rpc("web_signup_claim_paid", { p_id: id }); fail(error); },
    async appSignupTeam(teamId, personId, plan) { const { data, error } = await sb.rpc("app_signup_team", { p_team: teamId, p_person: personId, p_plan: plan }); fail(error); return data as { id: string; reference: string; amount_dkk: number | null; amount_before_dkk: number | null; discount_pct: number; team: string; installments?: number; fee_dkk?: number; per_rate_dkk?: number | null; note?: string | null }; },
    async requestPayment(i) { const { data, error } = await sb.rpc("request_payment", { p_team: i.team_id, p_person_ids: i.person_ids, p_plan: i.plan, p_amount: i.amount_dkk, p_discount_pct: i.discount_pct, p_message: i.message ?? null }); fail(error); return (data as number) ?? 0; },
    async setWebSignupStatus(id, status) { if (status === "paid") { const { error } = await sb.rpc("mark_payment_paid", { p_id: id }); fail(error); return; } const { error } = await sb.from("web_signup").update({ status }).eq("id", id); fail(error); },
    async signUp(i) {
      const { error } = await sb.rpc("sign_up", {
        p_school_slug: schoolSlug, p_first: i.firstName, p_last: i.lastName, p_phone: i.phone, p_birth_year: i.birthYear, p_birth_date: i.birthDate,
        p_roles: i.roles, p_wished_teams: i.wishedTeams,
        p_children: i.children.map((c) => ({ first_name: c.firstName, birth_year: c.birthYear, birth_date: c.birthDate || null })),
      });
      fail(error);
    },

    async listPending() {
      // adults = pending people with a login; their children ride along via guardian
      const { data: adults, error } = await sb.from("person").select("*").eq("status", "pending").or("user_id.not.is.null,source.eq.web").is("supervised_by", null).order("created_at");
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
    async invitePerson(i) {
      const { data, error } = await sb.rpc("invite_person", { p_first: i.first_name, p_last: i.last_name, p_email: i.email, p_phone: i.phone, p_is_parent: i.is_parent, p_memberships: i.memberships, p_children: i.children, p_message: i.message ?? null });
      fail(error); return data as string;
    },
    async resendInvite(personId) { const { error } = await sb.rpc("resend_invite", { p_id: personId }); fail(error); },
    async lastMailStatus(personId) { const { data } = await sb.from("mail_log").select("status").contains("ref", { person_id: personId }).order("created_at", { ascending: false }).limit(1).maybeSingle(); return (data?.status as string | undefined) ?? null; },
  };
}
