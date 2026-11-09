import { shiftOccurrence } from "./schedule-util";
import type { Absence, Booking, Member, Membership, Person, PersonStatus, Role, Room, RosterEntry, Session, SessionInput, Team, TeamInput } from "./types";

/** Phase-2 half of the mock. Seeds this week's schedule from the season plan (Mon–Thu, two rooms). */
export type SchedState = {
  rooms: Room[]; sessions: Session[]; bookings: Booking[]; absences: Absence[];
  attendance: { session_id: string; person_id: string; present: boolean; via_punch?: boolean }[];
};
const id = () => Math.random().toString(36).slice(2, 10);
export const ROOMS: Room[] = [{ id: "room-S", name: "Store Sal", sort: 0 }, { id: "room-L", name: "Lille Sal", sort: 1 }];

// [weekday 1=Mon, room, start, end, team name, trainer]
const PLAN: [number, "S" | "L", string, string, string, string][] = [
  [1, "S", "15:30", "16:30", "Teknik New Age", "Line"], [1, "S", "16:30", "17:15", "Spring & Tumbling Børn", "Maja"], [1, "S", "17:20", "18:20", "Teknik Børn Showdance", "Line"],
  [1, "S", "18:25", "19:10", "Hip Hop Junior & Voksen Begynder", "Maja"], [1, "S", "19:10", "20:10", "Control", "Line"],
  [1, "L", "16:00", "16:45", "Mini Cuties", "Sofie"], [1, "L", "16:50", "17:35", "Hip Hop Mini", "Maja"], [1, "L", "17:40", "18:25", "Shining Stars", "Sofie"],
  [1, "L", "18:30", "19:15", "Contemporary Begynder", "Sofie"], [1, "L", "19:20", "20:05", "Contemporary Elite", "Line"], [1, "L", "20:10", "20:55", "Hip Hop Junior & Voksen Elite", "Maja"],
  [2, "S", "15:40", "16:40", "Mini Angels", "Line"], [2, "S", "16:45", "18:30", "The AXIS", "Line"], [2, "S", "18:30", "19:15", "Styrketræning Junior & Voksen", "Maja"], [2, "S", "19:15", "20:45", "Apexion", "Line"],
  [2, "L", "15:45", "16:30", "Disco Dance", "Sofie"], [2, "L", "16:35", "17:35", "Satellite Stars", "Sofie"], [2, "L", "17:40", "18:25", "Hip Hop Børn", "Maja"], [2, "L", "18:35", "19:20", "Division", "Sofie"], [2, "L", "19:25", "20:10", "Hit Fit Dance tirsdag", "Maja"],
  [3, "S", "15:30", "16:45", "New Age", "Line"], [3, "S", "16:45", "17:15", "Mini Stjernetrin", "Sofie"], [3, "S", "17:15", "18:15", "Disco", "Line"], [3, "S", "18:15", "19:15", "Disco Slow", "Line"], [3, "S", "19:55", "21:15", "Airy", "Line"],
  [3, "L", "15:45", "16:45", "Sky Stars", "Sofie"], [3, "L", "16:50", "17:35", "Styrketræning Børn", "Maja"], [3, "L", "17:40", "18:40", "Empire", "Sofie"], [3, "L", "20:20", "21:05", "Hit Fit Dance onsdag", "Maja"],
  [4, "S", "15:45", "16:30", "Mini Magic", "Sofie"], [4, "S", "16:35", "17:20", "Spring & Tumbling Mini", "Maja"], [4, "S", "17:25", "18:10", "Smidighed & Acro", "Maja"], [4, "S", "18:15", "19:00", "Spring & Tumbling Junior & Voksen", "Maja"],
  [4, "S", "19:05", "20:10", "Teknik Empire & Control", "Line"], [4, "S", "19:55", "21:10", "Teknik Apexion & Airy", "Line"],
  [4, "L", "16:35", "17:20", "Danse Stjerner", "Sofie"], [4, "L", "17:25", "18:10", "Ballet Mini", "Sofie"], [4, "L", "19:05", "19:50", "Ballet", "Sofie"],
];

export function mondayOf(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
const at = (base: Date, weekday: number, hm: string) => { const d = new Date(base); d.setDate(d.getDate() + weekday - 1); const [h, m] = hm.split(":").map(Number); d.setHours(h, m, 0, 0); return d.toISOString(); };

export function seedSchedule(teams: Team[], staff: Person[]): SchedState {
  const mon = mondayOf(new Date());
  const sessions: Session[] = [];
  for (let w = -1; w <= 4; w++) {
    const base = new Date(mon); base.setDate(base.getDate() + 7 * w);
    for (const [wd, room, s, e, teamName, trainer] of PLAN) {
      const team = teams.find((t) => t.name === teamName); const tr = staff.find((p) => p.first_name === trainer);
      sessions.push({ id: "s-" + id(), team_id: team?.id ?? null, team_name: teamName, room_id: "room-" + room, room_name: room === "S" ? "Store Sal" : "Lille Sal", title: null,
        starts_at: at(base, wd, s), ends_at: at(base, wd, e), trainer_id: tr?.id ?? null, trainer_name: tr?.first_name ?? trainer, substitute_id: null, substitute_name: null,
        lesson_plan: null, lesson_plan_read_at: null, cancelled: false, cancel_note: null, weekly_rule_id: "rule-" + teamName.replace(/\W/g, "") + wd, substitute_wanted: false });
    }
  }
  const fri = at(mon, 5, "16:00"), friEnd = at(mon, 5, "18:00");
  const bookings: Booking[] = [{ id: "b-1", room_id: "room-S", room_name: "Store Sal", person_id: "p-freja", person_name: "Freja Therkildsen", title: "Solo – Freja", starts_at: fri, ends_at: friEnd, status: "pending" }];
  return { rooms: ROOMS, sessions, bookings, absences: [], attendance: [] };
}

export function scheduleOps(get: () => { S: SchedState; persons: Person[]; memberships: Membership[]; guardians: { parent_id: string; child_id: string }[]; teams: Team[]; me: () => Person | null; save: () => void; emit: () => void; notify: (pid: string, kind: string, title: string, body: string | null, ref?: Record<string, string>) => void; punchFor: (teamId: string | null, personId: string, sessionId: string) => boolean; awardAuto: (pid: string) => void }) {
  const family = (pid: string) => [pid, ...get().guardians.filter((x) => x.child_id === pid).map((x) => x.parent_id)];
  const names = (pid: string | null) => { const p = get().persons.find((x) => x.id === pid); return p ? `${p.first_name} ${p.last_name}` : null; };
  return {
    async listRooms() { return get().S.rooms; },
    async getSession(id: string) { return get().S.sessions.find((s) => s.id === id) ?? null; },
    async listSessions(from: string, to: string) { return get().S.sessions.filter((s) => s.starts_at >= from && s.starts_at < to).sort((a, b) => a.starts_at.localeCompare(b.starts_at)); },
    async createSession(i: SessionInput) {
      const g = get(); const team = g.teams.find((t) => t.id === i.team_id); const room = g.S.rooms.find((r) => r.id === i.room_id);
      const rule = i.repeatWeeklyUntil ? "rule-" + id() : null; let s = new Date(i.starts_at), e = new Date(i.ends_at);
      const until = i.repeatWeeklyUntil ? new Date(i.repeatWeeklyUntil) : s;
      while (s <= until) {
        g.S.sessions.push({ id: "s-" + id(), team_id: i.team_id, team_name: team?.name ?? null, room_id: i.room_id, room_name: room?.name ?? null, title: i.title ?? null, starts_at: s.toISOString(), ends_at: e.toISOString(),
          trainer_id: i.trainer_id ?? null, trainer_name: names(i.trainer_id ?? null)?.split(" ")[0] ?? null, assistant_id: i.assistant_id ?? null, assistant_name: names(i.assistant_id ?? null)?.split(" ")[0] ?? null, substitute_id: null, substitute_name: null, lesson_plan: null, lesson_plan_read_at: null, cancelled: false, cancel_note: null, weekly_rule_id: rule, substitute_wanted: false });
        s = new Date(s.getTime() + 7 * 864e5); e = new Date(e.getTime() + 7 * 864e5);
      }
      g.save(); g.emit();
    },
    async updateSession(sid: string, patch: Record<string, unknown>, scope: "one" | "future" = "one", opts: { skipIds?: string[] } = {}) {
      const g = get(); const s0 = g.S.sessions.find((s) => s.id === sid); if (!s0) return;
      const orig = { starts_at: s0.starts_at, ends_at: s0.ends_at };
      const targets = (scope === "future" && s0.weekly_rule_id ? g.S.sessions.filter((s) => s.weekly_rule_id === s0.weekly_rule_id && s.starts_at >= s0.starts_at) : [s0]).filter((s) => !opts.skipIds?.includes(s.id));
      for (const s of targets) {
        const p = { ...patch } as Partial<Session> & { starts_at?: string; ends_at?: string };
        if (scope === "future" && patch.starts_at && patch.ends_at && s !== s0) Object.assign(p, shiftOccurrence(s.starts_at, s.ends_at, orig.starts_at, patch.starts_at as string, patch.ends_at as string)); // same weekday shift + new time
        const wasSub = s.substitute_wanted, wasCancelled = s.cancelled;
        Object.assign(s, p);
        if (patch.substitute_wanted && !wasSub) for (const st of g.persons.filter((x) => x.status === "approved" && (x.is_admin || g.memberships.some((m) => m.person_id === x.id && m.role !== "dancer")) && x.id !== s.trainer_id)) g.notify(st.id, "substitute", "Vikar søges", `${s.team_name ?? ""} · ${new Date(s.starts_at).toLocaleString("da-DK", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`, { session_id: s.id });
        if (patch.cancelled && !wasCancelled && s.team_id) for (const m of g.memberships.filter((x) => x.team_id === s.team_id)) for (const pid of family(m.person_id)) if (g.persons.find((x) => x.id === pid)?.user_id) g.notify(pid, "session", "Træning aflyst", `${s.team_name ?? ""} · ${new Date(s.starts_at).toLocaleDateString("da-DK")}${s.cancel_note ? " · " + s.cancel_note : ""}`, { session_id: s.id });
        if ("team_id" in patch) s.team_name = g.teams.find((t) => t.id === patch.team_id)?.name ?? null;
        if ("trainer_id" in patch) s.trainer_name = names(patch.trainer_id as string | null)?.split(" ")[0] ?? null;
        if ("assistant_id" in patch) s.assistant_name = names(patch.assistant_id as string | null)?.split(" ")[0] ?? null;
        if ("room_id" in patch) s.room_name = g.S.rooms.find((r) => r.id === patch.room_id)?.name ?? null;
        if ("trainer_id" in patch) s.trainer_name = names(patch.trainer_id as string | null)?.split(" ")[0] ?? null;
        if ("substitute_id" in patch) s.substitute_name = names(patch.substitute_id as string | null)?.split(" ")[0] ?? null;
      }
      g.save(); g.emit();
    },
    async deleteSession(sid: string, scope: "one" | "future" = "one") {
      const g = get(); const s0 = g.S.sessions.find((s) => s.id === sid); if (!s0) return;
      g.S.sessions = g.S.sessions.filter((s) => !(s.id === sid || (scope === "future" && s0.weekly_rule_id && s.weekly_rule_id === s0.weekly_rule_id && s.starts_at >= s0.starts_at)));
      g.save(); g.emit();
    },
    async listBookings(from: string, to: string) { return get().S.bookings.filter((b) => b.starts_at >= from && b.starts_at < to); },
    async createBooking({ force_pending, ...i }: { room_id: string; title: string; starts_at: string; ends_at: string; person_id: string; force_pending?: boolean }) {
      const g = get(); const who = g.persons.find((p) => p.id === i.person_id); const staff = !force_pending && (who?.is_admin || g.memberships.some((m) => m.person_id === i.person_id && m.role !== "dancer"));
      const b: Booking = { id: "b-" + id(), ...i, room_name: g.S.rooms.find((r) => r.id === i.room_id)?.name ?? "", person_name: names(i.person_id) ?? "", status: staff ? "approved" : "pending" };
      g.S.bookings.push(b); g.save(); g.emit(); return b;
    },
    async setBookingStatus(bid: string, status: Booking["status"]) { const g = get(); const b = g.S.bookings.find((x) => x.id === bid); if (b && b.status !== status) { b.status = status; for (const pid of family(b.person_id)) g.notify(pid, "booking", status === "approved" ? "Booking godkendt" : "Booking afvist", `${b.title} · ${b.room_name}`, { booking_id: b.id }); } g.save(); g.emit(); },
    async deleteBooking(bid: string) { const g = get(); g.S.bookings = g.S.bookings.filter((b) => b.id !== bid); g.save(); g.emit(); },
    async listAbsences(ids: string[]) { return get().S.absences.filter((a) => ids.includes(a.session_id)); },
    async reportAbsence(session_id: string, person_id: string, reason: string | null, note: string | null) {
      const g = get(); g.S.absences = g.S.absences.filter((a) => !(a.session_id === session_id && a.person_id === person_id));
      g.S.absences.push({ id: "a-" + id(), session_id, person_id, reason, note }); g.save(); g.emit();
    },
    async withdrawAbsence(session_id: string, person_id: string) { const g = get(); g.S.absences = g.S.absences.filter((a) => !(a.session_id === session_id && a.person_id === person_id)); g.save(); g.emit(); },
    async roster(session_id: string): Promise<RosterEntry[]> {
      const g = get(); const s = g.S.sessions.find((x) => x.id === session_id); if (!s?.team_id) return [];
      return g.memberships.filter((m) => m.team_id === s.team_id && m.role === "dancer").map((m) => {
        const p = g.persons.find((x) => x.id === m.person_id)!; const a = g.S.attendance.find((x) => x.session_id === session_id && x.person_id === p.id);
        return { person_id: p.id, name: `${p.first_name} ${p.last_name}`, birth_year: p.birth_year, role: m.role, present: a ? a.present : null, absence: g.S.absences.find((x) => x.session_id === session_id && x.person_id === p.id) ?? null, via_punch: !!a?.via_punch };
      }).filter((r) => g.persons.find((p) => p.id === r.person_id)?.status === "approved");
    },
    async settleAttendance() {
      const g = get(); const cut = Date.now() - 3600e3; let n = 0;
      for (const s of g.S.sessions) {
        if (!s.team_id || s.cancelled || new Date(s.ends_at).getTime() > cut) continue;
        const team = g.teams.find((t) => t.id === s.team_id); if (!team || team.punch_card_open) continue;
        for (const m of g.memberships.filter((m) => m.team_id === s.team_id && m.role === "dancer")) {
          if (g.S.attendance.some((a) => a.session_id === s.id && a.person_id === m.person_id) || g.S.absences.some((a) => a.session_id === s.id && a.person_id === m.person_id)) continue;
          g.S.attendance.push({ session_id: s.id, person_id: m.person_id, present: true, via_punch: false }); g.awardAuto(m.person_id); n++;
        }
      }
      if (n) { g.save(); g.emit(); } return n;
    },
    async saveAttendance(session_id: string, entries: { person_id: string; present: boolean }[]) {
      const g = get(); const s = g.S.sessions.find((x) => x.id === session_id);
      g.S.attendance = g.S.attendance.filter((a) => a.session_id !== session_id).concat(entries.map((e) => ({ session_id, ...e, via_punch: e.present && g.punchFor(s?.team_id ?? null, e.person_id, session_id) }))); for (const e of entries) g.awardAuto(e.person_id); g.save(); g.emit();
    },
    async createTeam(i: TeamInput & { name: string }) {
      const g = get(); const t: Team = { id: "team-" + id(), name: i.name, style: i.style ?? null, category: i.category ?? "mixed", level: i.level ?? null, closed: !!i.closed, parents_see_video: i.parents_see_video ?? (i.category === "mini" || i.category === "kids"), punch_card_open: !!i.punch_card_open, color: i.color ?? null, sort: g.teams.length };
      g.teams.push(t); g.save(); g.emit(); return t;
    },
    async updateTeam(tid: string, patch: TeamInput) { const g = get(); const t = g.teams.find((x) => x.id === tid); if (t) Object.assign(t, patch); g.save(); g.emit(); },
    async setTeamGallery(tid: string, refs: string[]) { const g = get(); const t = g.teams.find((x) => x.id === tid); if (t) t.gallery = refs; g.save(); g.emit(); },
    async listMembers(): Promise<Member[]> {
      const g = get();
      return g.persons.filter((p) => p.status !== "rejected").map((p) => ({ ...p, memberships: g.memberships.filter((m) => m.person_id === p.id),
        children: g.persons.filter((c) => g.guardians.some((x) => x.parent_id === p.id && x.child_id === c.id)), parents: g.persons.filter((c) => g.guardians.some((x) => x.child_id === p.id && x.parent_id === c.id)) }));
    },
    async setMemberships(pid: string, ms: { team_id: string; role: Role }[]) { const g = get(); g.memberships = g.memberships.filter((m) => m.person_id !== pid).concat(ms.map((m) => ({ person_id: pid, ...m }))); g.save(); g.emit(); },
    async setGuardians(parentId: string, childIds: string[]) { const g = get(); g.guardians = g.guardians.filter((x) => x.parent_id !== parentId).concat(childIds.map((child_id) => ({ parent_id: parentId, child_id }))); g.save(); g.emit(); },
    async createChild(i: { parent_id: string; first_name: string; last_name: string; birth_date: string | null; team_ids: string[] }) {
      const g = get(); const parent = g.persons.find((x) => x.id === i.parent_id)!; const cid = "p-" + id();
      g.persons.push({ ...parent, id: cid, user_id: null, email: null, phone: null, first_name: i.first_name.trim(), last_name: i.last_name.trim(), birth_date: i.birth_date || null, birth_year: i.birth_date ? Number(i.birth_date.slice(0, 4)) : null, status: "approved", is_admin: false, supervised_by: null, wished_roles: ["dancer"], wished_teams: null, source: "admin" } as Person);
      g.guardians.push({ parent_id: i.parent_id, child_id: cid });
      for (const team_id of i.team_ids) g.memberships.push({ person_id: cid, team_id, role: "dancer" });
      g.save(); g.emit(); return cid;
    },
    async uploadAvatar(pid: string, file: File) { const g = get(); const p = g.persons.find((x) => x.id === pid); const url = URL.createObjectURL(file); if (p) { p.photo_path = "mock/" + pid; p.photo_url = url; } g.save(); g.emit(); return "mock/" + pid; },
    async updatePerson(pid: string, patch: { first_name?: string; last_name?: string; birth_date?: string | null; phone?: string | null; bio?: string | null; photo_path?: string | null }) { const g = get(); const p = g.persons.find((x) => x.id === pid); if (p) { Object.assign(p, patch); if ("birth_date" in patch) p.birth_year = patch.birth_date ? Number(patch.birth_date.slice(0, 4)) : null; } g.save(); g.emit(); },
    async setPersonStatus(pid: string, status: PersonStatus) { const g = get(); const p = g.persons.find((x) => x.id === pid); if (p) p.status = status; g.save(); g.emit(); },
    async setAdmin(pid: string, isAdmin: boolean) { const g = get(); const p = g.persons.find((x) => x.id === pid); if (p) p.is_admin = isAdmin; g.save(); g.emit(); },
    async staffList() { const g = get(); return g.persons.filter((p) => p.status === "approved" && (p.is_admin || g.memberships.some((m) => m.person_id === p.id && m.role !== "dancer"))); },
    async grantChildLogin(cid: string, email: string) {
      const g = get(); const c = g.persons.find((x) => x.id === cid); if (!c) return;
      if (((c.birth_date ? Math.floor((Date.now() - new Date(c.birth_date).getTime()) / 31557600000) : c.birth_year ? new Date().getFullYear() - c.birth_year : 99)) < 10) throw new Error("Barnet skal være mindst 10 år");
      c.email = email.toLowerCase(); c.user_id = "u-" + id(); c.supervised_by = g.me()?.id ?? null; g.save(); g.emit();
    },
    async revokeChildLogin(cid: string) { const g = get(); const c = g.persons.find((x) => x.id === cid); if (c) { c.email = null; c.user_id = null; c.supervised_by = null; } g.save(); g.emit(); },
  };
}
