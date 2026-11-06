import type { SupabaseClient } from "@supabase/supabase-js";
import type { Absence, Booking, Member, Membership, Person, PersonStatus, Role, Room, RosterEntry, Session, SessionInput, Team, TeamInput } from "./types";

type Fail = (e: { message: string } | null) => void;

/** Phase-2 half of the Supabase API. All reads go through RLS; writes that span rows use the RPCs in 0002_schedule.sql. */
export function supabaseSchedule(sb: SupabaseClient, fail: Fail, schoolId: () => Promise<string>, myPersonId: () => Promise<string | null>) {
  const mapSession = (r: Record<string, unknown>): Session => ({
    id: r.id as string, team_id: r.team_id as string | null, team_name: r.team_name as string | null, room_id: r.room_id as string | null, room_name: r.room_name as string | null,
    title: r.title as string | null, starts_at: r.starts_at as string, ends_at: r.ends_at as string, trainer_id: r.trainer_id as string | null, trainer_name: r.trainer_name as string | null,
    substitute_id: r.substitute_id as string | null, substitute_name: r.substitute_name as string | null, assistant_id: (r.assistant_id as string | null) ?? null, assistant_name: (r.assistant_name as string | null) ?? null, lesson_plan: r.lesson_plan as string | null, lesson_plan_read_at: r.lesson_plan_read_at as string | null,
    cancelled: !!r.cancelled, cancel_note: r.cancel_note as string | null, weekly_rule_id: r.weekly_rule_id as string | null, substitute_wanted: !!r.substitute_wanted,
  });
  return {
    async listRooms(): Promise<Room[]> { const { data, error } = await sb.from("room").select("id,name,sort").order("sort"); fail(error); return (data ?? []) as Room[]; },
    async listSessions(from: string, to: string): Promise<Session[]> {
      const { data, error } = await sb.from("session_view").select("*").gte("starts_at", from).lt("starts_at", to).order("starts_at"); fail(error);
      return (data ?? []).map(mapSession);
    },
    async createSession(i: SessionInput) {
      if (i.repeatWeeklyUntil) {
        const { error } = await sb.rpc("create_weekly_sessions", { p_team: i.team_id, p_room: i.room_id, p_title: i.title ?? null, p_start: i.starts_at, p_end: i.ends_at, p_trainer: i.trainer_id ?? null, p_until: i.repeatWeeklyUntil, p_assistant: i.assistant_id ?? null }); fail(error);
      } else {
        const { error } = await sb.from("session").insert({ school_id: await schoolId(), team_id: i.team_id, room_id: i.room_id, title: i.title ?? null, starts_at: i.starts_at, ends_at: i.ends_at, trainer_id: i.trainer_id ?? null, assistant_id: i.assistant_id ?? null }); fail(error);
      }
    },
    async updateSession(id: string, patch: Record<string, unknown>, scope: "one" | "future" = "one") {
      const { repeatWeeklyUntil: _r, ...p } = patch as Record<string, unknown> & { repeatWeeklyUntil?: unknown }; void _r;
      if (scope === "one") { const { error } = await sb.from("session").update(p).eq("id", id); fail(error); return; }
      const { data: s0 } = await sb.from("session").select("weekly_rule_id,starts_at").eq("id", id).single();
      if (!s0?.weekly_rule_id) { const { error } = await sb.from("session").update(p).eq("id", id); fail(error); return; }
      const { data: all } = await sb.from("session").select("id,starts_at,ends_at").eq("weekly_rule_id", s0.weekly_rule_id).gte("starts_at", s0.starts_at);
      for (const s of all ?? []) {
        const q = { ...p };
        if (p.starts_at && p.ends_at) {
          const d = new Date(s.starts_at); const ns = new Date(p.starts_at as string); d.setHours(ns.getHours(), ns.getMinutes()); q.starts_at = d.toISOString();
          const d2 = new Date(s.ends_at); const ne = new Date(p.ends_at as string); d2.setHours(ne.getHours(), ne.getMinutes()); q.ends_at = d2.toISOString();
        }
        const { error } = await sb.from("session").update(q).eq("id", s.id); fail(error);
      }
    },
    async deleteSession(id: string, scope: "one" | "future" = "one") {
      if (scope === "future") {
        const { data: s0 } = await sb.from("session").select("weekly_rule_id,starts_at").eq("id", id).single();
        if (s0?.weekly_rule_id) { const { error } = await sb.from("session").delete().eq("weekly_rule_id", s0.weekly_rule_id).gte("starts_at", s0.starts_at); fail(error); return; }
      }
      const { error } = await sb.from("session").delete().eq("id", id); fail(error);
    },
    async listBookings(from: string, to: string): Promise<Booking[]> {
      const { data, error } = await sb.from("booking_view").select("*").gte("starts_at", from).lt("starts_at", to).order("starts_at"); fail(error); return (data ?? []) as Booking[];
    },
    async createBooking(i: { room_id: string; title: string; starts_at: string; ends_at: string; person_id: string }): Promise<Booking> {
      const { data: me } = await sb.from("person").select("is_admin").eq("id", await myPersonId()).single();
      const { data: staffRows } = await sb.from("membership").select("role").eq("person_id", await myPersonId()).neq("role", "dancer");
      const status = me?.is_admin || (staffRows ?? []).length ? "approved" : "pending";
      const { data, error } = await sb.from("booking").insert({ school_id: await schoolId(), ...i, status }).select("id").single(); fail(error);
      const { data: b } = await sb.from("booking_view").select("*").eq("id", data!.id).single(); return b as Booking;
    },
    async setBookingStatus(id: string, status: Booking["status"]) { const { error } = await sb.from("booking").update({ status }).eq("id", id); fail(error); },
    async deleteBooking(id: string) { const { error } = await sb.from("booking").delete().eq("id", id); fail(error); },
    async listAbsences(ids: string[]): Promise<Absence[]> { if (!ids.length) return []; const { data, error } = await sb.from("absence").select("id,session_id,person_id,reason,note").in("session_id", ids); fail(error); return (data ?? []) as Absence[]; },
    async reportAbsence(session_id: string, person_id: string, reason: string | null, note: string | null) {
      const { error } = await sb.from("absence").upsert({ session_id, person_id, reason, note, reported_by: await myPersonId() }, { onConflict: "session_id,person_id" }); fail(error);
    },
    async withdrawAbsence(session_id: string, person_id: string) { const { error } = await sb.from("absence").delete().eq("session_id", session_id).eq("person_id", person_id); fail(error); },
    async roster(session_id: string): Promise<RosterEntry[]> {
      const { data, error } = await sb.rpc("session_roster", { p_session: session_id }); fail(error);
      return (data ?? []).map((r: Record<string, unknown>) => ({ person_id: r.person_id as string, name: r.name as string, birth_year: r.birth_year as number | null, role: r.role as Role, present: r.present as boolean | null, via_punch: !!r.via_punch,
        absence: r.absence_id ? { id: r.absence_id as string, session_id, person_id: r.person_id as string, reason: r.reason as string | null, note: r.note as string | null } : null }));
    },
    async saveAttendance(session_id: string, entries: { person_id: string; present: boolean }[]) {
      const { error } = await sb.from("attendance").upsert(entries.map((e) => ({ session_id, ...e })), { onConflict: "session_id,person_id" }); fail(error);
    },
    async createTeam(i: TeamInput & { name: string }): Promise<Team> {
      const { data, error } = await sb.from("team").insert({ school_id: await schoolId(), ...i, parents_see_video: i.parents_see_video ?? (i.category === "mini" || i.category === "kids") }).select("*").single(); fail(error); return data as Team;
    },
    async updateTeam(id: string, patch: TeamInput) { const { error } = await sb.from("team").update(patch).eq("id", id); fail(error); },
    async listMembers(): Promise<Member[]> {
      const { data: persons, error } = await sb.from("person").select("*").neq("status", "rejected").order("first_name"); fail(error);
      const { data: ms } = await sb.from("membership").select("person_id,team_id,role");
      const { data: gs } = await sb.from("guardian").select("parent_id,child_id");
      const P = (persons ?? []) as Person[]; const M = (ms ?? []) as Membership[]; const G = gs ?? [];
      return P.map((p) => ({ ...p, memberships: M.filter((m) => m.person_id === p.id), children: P.filter((c) => G.some((g) => g.parent_id === p.id && g.child_id === c.id)), parents: P.filter((c) => G.some((g) => g.child_id === p.id && g.parent_id === c.id)) }));
    },
    async setMemberships(pid: string, ms: { team_id: string; role: Role }[]) {
      const { error } = await sb.from("membership").delete().eq("person_id", pid); fail(error);
      if (ms.length) { const { error: e2 } = await sb.from("membership").insert(ms.map((m) => ({ person_id: pid, ...m }))); fail(e2); }
    },
    async setPersonStatus(pid: string, status: PersonStatus) { const { error } = await sb.from("person").update({ status }).eq("id", pid); fail(error); },
    async setAdmin(pid: string, isAdmin: boolean) { const { error } = await sb.from("person").update({ is_admin: isAdmin }).eq("id", pid); fail(error); },
    async staffList(): Promise<Person[]> {
      const { data: ms } = await sb.from("membership").select("person_id").neq("role", "dancer");
      const ids = Array.from(new Set((ms ?? []).map((m) => m.person_id as string)));
      const { data, error } = await sb.from("person").select("*").eq("status", "approved").or(`is_admin.eq.true${ids.length ? `,id.in.(${ids.join(",")})` : ""}`).order("first_name"); fail(error); return (data ?? []) as Person[];
    },
    async grantChildLogin(childId: string, email: string) { const { error } = await sb.rpc("grant_child_login", { p_child: childId, p_email: email }); fail(error); },
    async revokeChildLogin(childId: string) { const { error } = await sb.rpc("revoke_child_login", { p_child: childId }); fail(error); },
  };
}
