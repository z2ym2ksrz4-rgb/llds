export type Role = "dancer" | "trainer" | "assistant";
export type PersonStatus = "pending" | "approved" | "rejected" | "inactive";
export type TeamCategory = "mini" | "kids" | "junior" | "adult" | "mixed";

export type Person = {
  id: string;
  school_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birth_year: number | null;
  status: PersonStatus;
  is_admin: boolean;
  photo_consent: boolean | null;
  wished_roles: string[];
  wished_teams: string | null;
  supervised_by: string | null;
  created_at: string;
};

export type Team = {
  id: string;
  name: string;
  style: string | null;
  category: TeamCategory;
  level: string | null;
  closed: boolean;
  parents_see_video: boolean;
  punch_card_open: boolean;
  color: string | null;
  sort: number;
};

export type Membership = { person_id: string; team_id: string; role: Role };

export type Me = {
  person: Person;
  children: Person[];
  memberships: Membership[]; // for me and my children
  teams: Team[];             // teams visible to me
};

export type SignUpInput = {
  firstName: string;
  lastName: string;
  phone: string;
  birthYear: number | null;
  roles: ("parent" | "dancer" | "trainer" | "assistant")[];
  wishedTeams: string;
  children: { firstName: string; birthYear: number }[];
};

export type PendingPerson = Person & { children: Person[] };

export interface Api {
  /** auth */
  sessionEmail(): Promise<string | null>;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  onAuthChange(cb: () => void): () => void;
  /** me */
  getMe(): Promise<Me | null>; // null = signed in but no person yet
  signUp(input: SignUpInput): Promise<void>;
  /** admin */
  listPending(): Promise<PendingPerson[]>;
  listTeams(): Promise<Team[]>;
  approve(personId: string, memberships: { team_id: string; role: Role }[], isAdmin?: boolean): Promise<void>;
  reject(personId: string): Promise<void>;
}

/* ---------------- phase 2: schedule, rooms, bookings, absence, attendance ---------------- */
export type Room = { id: string; name: string; sort: number };

export type Session = {
  id: string;
  team_id: string | null;
  team_name: string | null;
  room_id: string | null;
  room_name: string | null;
  title: string | null;
  starts_at: string; // ISO
  ends_at: string;
  trainer_id: string | null;
  trainer_name: string | null;
  substitute_id: string | null;
  substitute_name: string | null;
  lesson_plan: string | null;
  lesson_plan_read_at: string | null;
  cancelled: boolean;
  cancel_note: string | null;
  weekly_rule_id: string | null;
  substitute_wanted: boolean;
};

export type SessionInput = {
  team_id: string | null;
  room_id: string | null;
  title?: string | null;
  starts_at: string;
  ends_at: string;
  trainer_id?: string | null;
  repeatWeeklyUntil?: string | null; // ISO date → generates one session per week incl. the first
};

export type Booking = {
  id: string; room_id: string; room_name: string; person_id: string; person_name: string;
  title: string; starts_at: string; ends_at: string; status: "pending" | "approved" | "rejected";
};

export type Absence = { id: string; session_id: string; person_id: string; reason: string | null; note: string | null };

export type RosterEntry = { person_id: string; name: string; birth_year: number | null; role: Role; present: boolean | null; absence: Absence | null; via_punch: boolean };

export type TeamInput = Partial<Pick<Team, "name" | "style" | "category" | "level" | "closed" | "parents_see_video" | "punch_card_open" | "color">> & { max_dancers?: number | null; visibility?: "public" | "private"; archived?: boolean };

export type Member = Person & { memberships: Membership[]; children: Person[]; parents: Person[] };

export interface Api {
  /* rooms & schedule */
  listRooms(): Promise<Room[]>;
  listSessions(fromIso: string, toIso: string): Promise<Session[]>;
  createSession(input: SessionInput): Promise<void>;
  updateSession(id: string, patch: Partial<SessionInput> & { lesson_plan?: string | null; cancelled?: boolean; cancel_note?: string | null; substitute_wanted?: boolean; substitute_id?: string | null; lesson_plan_read_at?: string | null }, scope?: "one" | "future"): Promise<void>;
  deleteSession(id: string, scope?: "one" | "future"): Promise<void>;
  /* bookings */
  listBookings(fromIso: string, toIso: string): Promise<Booking[]>;
  createBooking(input: { room_id: string; title: string; starts_at: string; ends_at: string; person_id: string }): Promise<Booking>;
  setBookingStatus(id: string, status: Booking["status"]): Promise<void>;
  deleteBooking(id: string): Promise<void>;
  /* absence & attendance */
  listAbsences(sessionIds: string[]): Promise<Absence[]>;
  reportAbsence(sessionId: string, personId: string, reason: string | null, note: string | null): Promise<void>;
  withdrawAbsence(sessionId: string, personId: string): Promise<void>;
  roster(sessionId: string): Promise<RosterEntry[]>;
  saveAttendance(sessionId: string, entries: { person_id: string; present: boolean }[]): Promise<void>;
  /* teams & members (admin/staff) */
  createTeam(input: TeamInput & { name: string }): Promise<Team>;
  updateTeam(id: string, patch: TeamInput): Promise<void>;
  listMembers(): Promise<Member[]>;
  setMemberships(personId: string, memberships: { team_id: string; role: Role }[]): Promise<void>;
  setPersonStatus(personId: string, status: PersonStatus): Promise<void>;
  staffList(): Promise<Person[]>; // trainers + assistants + admins (for trainer/substitute pickers)
  /* supervised child login */
  grantChildLogin(childId: string, email: string): Promise<void>;
  revokeChildLogin(childId: string): Promise<void>;
}
