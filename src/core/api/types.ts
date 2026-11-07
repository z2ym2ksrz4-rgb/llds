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
  birth_date?: string | null;   // yyyy-mm-dd; birth_year is derived from it
  status: PersonStatus;
  is_admin: boolean;
  photo_consent: boolean | null;
  wished_roles: string[];
  wished_teams: string | null;
  supervised_by: string | null;
  notify_prefs?: NotifyPrefs | null;  // {on, kinds:{message:false,…}} – missing kind = on
  created_at: string;
};

/** Notification preferences: master switch + per kind. A kind that is not listed is on. */
export type NotifyPrefs = { on?: boolean; kinds?: Record<string, boolean>; asked?: boolean };

/** Admin-customised look of the app (Admin → Tilpas appen). Stored on school.appearance; readable without login (login image). */
export type CustomBox = { id: string; title: string; body: string; image?: string | null; link?: string | null; linkLabel?: string | null; tab?: string | null };
export type Appearance = {
  home?: string[];           // order of Home sections (keys from HOME_SECTIONS plus "box:<id>"); unknown keys appended in default order
  hidden?: string[];         // section keys hidden for everyone
  boxes?: CustomBox[];
  images?: { login?: string | null; hero?: string | null };  // catalog key or URL
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
  visibility?: "public" | "private";
  description?: string | null;
  cover_path?: string | null;
  cover_url?: string | null;
  alt_url?: string | null;      // the raw cover_url when a real cover_path photo overrides it – shown as a mood image on the team page
  price?: string | null;
  years?: string | null;
  day_time?: string | null;
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
  birthDate: string | null;     // yyyy-mm-dd
  roles: ("parent" | "dancer" | "trainer" | "assistant")[];
  wishedTeams: string;
  children: { firstName: string; birthYear: number; birthDate: string }[];
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
  updateNotifyPrefs(prefs: NotifyPrefs): Promise<void>;
  getAppearance(): Promise<Appearance>;      // works before login (anon)
  saveAppearance(a: Appearance): Promise<void>; // admin
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
  assistant_id?: string | null;
  assistant_name?: string | null;
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
  assistant_id?: string | null;
  repeatWeeklyUntil?: string | null; // ISO date → generates one session per week incl. the first
};

export type Booking = {
  id: string; room_id: string; room_name: string; person_id: string; person_name: string;
  title: string; starts_at: string; ends_at: string; status: "pending" | "approved" | "rejected";
};

export type Absence = { id: string; session_id: string; person_id: string; reason: string | null; note: string | null };

export type RosterEntry = { person_id: string; name: string; birth_year: number | null; role: Role; present: boolean | null; absence: Absence | null; via_punch: boolean };

export type TeamInput = Partial<Pick<Team, "name" | "style" | "category" | "level" | "closed" | "parents_see_video" | "punch_card_open" | "color" | "description" | "cover_url">> & { max_dancers?: number | null; visibility?: "public" | "private"; archived?: boolean };

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
  setAdmin(personId: string, isAdmin: boolean): Promise<void>;
  staffList(): Promise<Person[]>; // trainers + assistants + admins (for trainer/substitute pickers)
  /* supervised child login */
  grantChildLogin(childId: string, email: string): Promise<void>;
  revokeChildLogin(childId: string): Promise<void>;
}

/* ---------------- phase 3: team rooms, messages, folders, video, notes ---------------- */
export type Channel = "team" | "school" | "trainers";
export type MediaRef = { path: string; kind: "image" | "video"; url?: string };

export type Post = {
  id: string; team_id: string | null; team_name: string | null; channel: Channel;
  author_id: string; author_name: string; body: string; media: MediaRef[];
  official: boolean; visibility: "private" | "public"; hidden: boolean; created_at: string; comment_count: number;
};
export type Comment = { id: string; post_id: string; author_id: string; author_name: string; body: string; hidden: boolean; created_at: string };
export type Report = {
  id: string; post_id: string | null; comment_id: string | null; reporter_name: string; reason: string | null;
  excerpt: string; author_name: string; team_id: string | null; hidden: boolean; resolved_at: string | null; created_at: string;
};
export type Audience = { all?: boolean; teams?: string[] };
export type Message = { id: string; author_name: string; title: string; body: string; audience: Audience; needs: "read" | "accept"; created_at: string; acted_at: string | null };
export type MessageStatus = { person_id: string; name: string; acted_at: string | null };

export type Folder = { id: string; team_id: string; name: string; staff_only: boolean; media_count: number; cover_path: string | null; cover_url?: string | null; created_at: string };
export type MediaItem = { id: string; folder_id: string; uploader_id: string; uploader_name: string; storage_path: string; kind: "image" | "video"; url: string; created_at: string; sort?: number };
export type Formation = { label: string; positions: { initials: string; x: number; y: number }[] };
export type Video = { id: string; team_id: string; uploader_id: string; uploader_name: string; title: string; storage_path: string; url: string; duration_s: number | null; formations: Formation[]; created_at: string };
export type Note = { id: string; team_id: string; dancer_id: string; dancer_name: string; author_id: string; author_name: string; body: string; created_at: string };

export interface Api {
  /* posts */
  listPosts(channel: Channel, teamId?: string | null): Promise<Post[]>;
  createPost(input: { team_id: string | null; channel: Channel; body: string; files: File[]; official?: boolean; visibility?: "private" | "public" }): Promise<void>;
  updatePost(id: string, patch: { hidden?: boolean; official?: boolean; visibility?: "private" | "public"; body?: string }): Promise<void>;
  deletePost(id: string): Promise<void>;
  listComments(postId: string): Promise<Comment[]>;
  addComment(postId: string, body: string): Promise<void>;
  setCommentHidden(id: string, hidden: boolean): Promise<void>;
  report(target: { post_id?: string; comment_id?: string }, reason: string | null): Promise<void>;
  listReports(): Promise<Report[]>;
  resolveReport(id: string, action: "hide" | "keep"): Promise<void>;
  /* official messages */
  listMessages(): Promise<Message[]>;
  sendMessage(input: { title: string; body: string; audience: Audience; needs: "read" | "accept" }): Promise<void>;
  ackMessage(id: string): Promise<void>;
  messageStatus(id: string): Promise<MessageStatus[]>;
  /* folders & media */
  listFolders(teamId: string): Promise<Folder[]>;
  createFolder(teamId: string, name: string, staffOnly: boolean): Promise<void>;
  listMedia(folderId: string): Promise<MediaItem[]>;
  uploadMedia(folderId: string, files: File[]): Promise<void>;
  deleteMedia(id: string): Promise<void>;
  /** staff: order of images in a folder (ids in display order) */
  setMediaOrder(folderId: string, ids: string[]): Promise<void>;
  /** staff: make a folder image the team's front photo (null = back to automatic) */
  setTeamCover(teamId: string, storagePath: string | null): Promise<void>;
  /* choreography */
  listVideos(teamId: string): Promise<Video[]>;
  uploadVideo(teamId: string, title: string, file: File): Promise<void>;
  updateVideo(id: string, patch: { title?: string; formations?: Formation[] }): Promise<void>;
  deleteVideo(id: string): Promise<void>;
  /* trainer notes */
  listNotes(teamId: string, dancerId?: string): Promise<Note[]>;
  addNote(teamId: string, dancerId: string, body: string): Promise<void>;
  deleteNote(id: string): Promise<void>;
}

/* ---------------- phase 4: events, shop, punch cards, milestones, notifications ---------------- */
export type EventKind = "competition" | "show" | "workshop" | "social";
export type Event = {
  image_key?: string | null;        // catalogue image (public/art/catalog) chosen by the admin; null = automatic
  id: string; title: string; kind: EventKind; starts_at: string; ends_at: string | null; place: string | null; meet_time: string | null;
  team_ids: string[]; team_names: string[] | null; plan: { time: string; text: string }[]; pack_list: string[]; info: string | null;
  signup_deadline: string | null; price_dkk: number | null; visibility: "private" | "public"; signups: number; created_at: string; mySignups?: number;
};
export type EventInput = Omit<Event, "id" | "signups" | "team_names" | "created_at" | "mySignups">;
export type EventSignup = { event_id: string; person_id: string; person_name: string; team_name: string | null; paid: boolean; created_at: string };

export type Product = { id: string; name: string; price_dkk: number; sizes: string[]; stock: number | null; image_path: string | null; image_url?: string | null; visibility: "private" | "public"; active: boolean };
export type OrderLine = { product_id: string; name: string; size: string | null; qty: number; price_dkk: number };
export type Order = { id: string; person_id: string; person_name: string; number: number; lines: OrderLine[]; total_dkk: number; status: "awaiting_payment" | "paid" | "delivered" | "cancelled"; claimed_paid_at: string | null; created_at: string };

export type PunchCardType = { id: string; name: string; punches: number; valid_days: number; price_dkk: number; active: boolean };
export type PunchCard = { id: string; type_id: string; type_name: string; person_id: string; person_name: string; punches_total: number; punches_left: number; used: number; expires_on: string; status: "awaiting_payment" | "active" | "expired"; claimed_paid_at: string | null; price_dkk: number; created_at: string };

export type Milestone = { id: string; person_id: string; person_name: string; title: string; reached_on: string | null; team_id: string | null; team_name: string | null; given_by_name: string | null; created_at: string };
export type Notification = { id: string; person_id: string; kind: string; title: string; body: string | null; ref: Record<string, string>; read_at: string | null; created_at: string };

export interface Api {
  /* events */
  listEvents(includePast?: boolean): Promise<Event[]>;
  saveEvent(input: EventInput, id?: string): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  listSignups(eventId: string): Promise<EventSignup[]>;
  signUp_(eventId: string, personId: string, on: boolean): Promise<void>;
  setSignupPaid(eventId: string, personId: string, paid: boolean): Promise<void>;
  /* shop */
  listProducts(all?: boolean): Promise<Product[]>;
  saveProduct(input: Omit<Product, "id" | "image_url"> & { image?: File | null }, id?: string): Promise<void>;
  listOrders(all?: boolean): Promise<Order[]>;
  createOrder(personId: string, lines: OrderLine[]): Promise<Order>;
  claimPaid(orderId: string): Promise<void>;
  setOrderStatus(orderId: string, status: Order["status"]): Promise<void>;
  /* punch cards */
  listPunchCardTypes(): Promise<PunchCardType[]>;
  savePunchCardType(input: Omit<PunchCardType, "id">, id?: string): Promise<void>;
  listPunchCards(all?: boolean): Promise<PunchCard[]>;
  buyPunchCard(typeId: string, personId: string): Promise<PunchCard>;
  claimPunchCardPaid(cardId: string): Promise<void>;
  activatePunchCard(cardId: string): Promise<void>;
  /* milestones */
  listMilestones(personId?: string): Promise<Milestone[]>;
  giveMilestone(personId: string, title: string, teamId: string | null): Promise<void>;
  deleteMilestone(id: string): Promise<void>;
  /* notifications */
  listNotifications(): Promise<Notification[]>;
  markNotificationsRead(ids?: string[]): Promise<void>;
  savePushToken(token: string, platform: "ios" | "android" | "web"): Promise<void>;
}

/* ---------------- visual pass: combined feed, results, team covers ---------------- */
export type Result = { id: string; team_id: string | null; team_name: string | null; event_title: string; placed: string; held_on: string; visibility: "private" | "public" };
export interface Api {
  listFeed(): Promise<Post[]>;                       // my teams' rooms + the school channel, newest first
  listResults(teamId?: string): Promise<Result[]>;
  addResult(input: Omit<Result, "id" | "team_name">): Promise<void>;
  deleteResult(id: string): Promise<void>;
  /** counts for the team tiles */
  teamStats(teamId: string): Promise<{ videos: number; media: number; formations: number; dancers: number }>;
}

/* ---------------- admin: bulk photo import ---------------- */
export interface Api {
  /** Upload one image into a team folder (creates the folder by name if missing); optionally set it as the team cover. */
  importTeamImage(teamId: string, folderName: string, file: Blob, fileName: string, asCover: boolean): Promise<void>;
}

/* ---------------- emblems (badges) ---------------- */
export type Badge = { id: string; key: string; name: string; emoji: string; description: string | null; kind: "auto" | "manual"; monthly: boolean; sort: number };
export type PersonBadge = { id: string; person_id: string; person_name: string; key: string; name: string; emoji: string; description: string | null; kind: "auto" | "manual"; team_id: string | null; team_name: string | null; period: string | null; note: string | null; given_by_name: string | null; created_at: string };
export interface Api {
  listBadges(): Promise<Badge[]>;
  /** awards: for one person, or for a whole team (latest first); no args = my people */
  listPersonBadges(filter?: { personId?: string; teamId?: string }): Promise<PersonBadge[]>;
  giveBadge(personId: string, badgeId: string, teamId: string | null, note?: string): Promise<void>;
  removeBadge(id: string): Promise<void>;
}

/* ---------------- image catalogue (admin uploads, in folders) ---------------- */
export type CatalogEntry = { id: string; folder: string; title: string | null; url: string; created_at: string };
export interface Api {
  listCatalog(): Promise<CatalogEntry[]>;
  uploadCatalog(files: File[], folder: string): Promise<CatalogEntry[]>;
  renameCatalogFolder(from: string, to: string): Promise<void>;
  deleteCatalog(id: string): Promise<void>;
}
