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
