import type { MessageComment, Audience, Channel, Comment, Folder, Formation, FormationSet, Frame, Marker, TeamDancer, MediaItem, MediaRef, Membership, Message, MessageStatus, Note, Person, Post, Report, Team, TeamStaff, Thread, ThreadMessage, Video } from "./types";
import { downscaleImage, fileToDataUrl } from "./image";

/** Phase-3 half of the mock. Binary media lives in memory only (data/object URLs), so it is gone after a reload. */
export type SocialState = {
  results?: { id: string; team_id: string | null; event_title: string; placed: string; held_on: string; visibility: "private" | "public" }[];
  posts: Post[]; comments: Comment[]; reports: Report[]; messages: Message[]; receipts: { message_id: string; person_id: string; acted_at: string }[]; msgComments?: MessageComment[];
  folders: Folder[]; media: MediaItem[]; videos: Video[]; notes: Note[];
  threads?: Thread[]; threadMsgs?: ThreadMessage[]; threadReads?: { thread_id: string; person_id: string; read_at: string }[];
  formationSets?: FormationSet[];
};
const id = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const urls = new Map<string, string>(); // storage_path → data/object URL (not persisted)

export function seedSocial(teams: Team[], persons: Person[]): SocialState {
  const axis = teams.find((t) => t.name === "The AXIS")!; const line = persons.find((p) => p.id === "p-line")!; const maja = persons.find((p) => p.id === "p-maja")!;
  const h = (n: number) => new Date(Date.now() - n * 36e5).toISOString();
  const posts: Post[] = [
    { id: "post-1", team_id: axis.id, team_name: axis.name, channel: "team", author_id: line.id, author_name: `${line.first_name} ${line.last_name}`, body: "Husk: sort tøj og hår i knold til gennemløbet på torsdag. Vi filmer hele nummeret, så I kan øve hjemme 💛", media: [], official: true, visibility: "private", hidden: false, created_at: h(5), comment_count: 1 },
    { id: "post-2", team_id: axis.id, team_name: axis.name, channel: "team", author_id: "p-alma", author_name: "Alma Nielsen", body: "Er der nogen der har set min sorte hættetrøje? Lå i Lille Sal i tirsdags.", media: [], official: false, visibility: "private", hidden: false, created_at: h(26), comment_count: 0 },
    { id: "post-3", team_id: null, team_name: null, channel: "school", author_id: line.id, author_name: `${line.first_name} ${line.last_name}`, body: "Velkommen til sæson 26/27! Studiet er lukket i uge 42 (efterårsferie). Første træning efter ferien er mandag 19. oktober.", media: [], official: true, visibility: "public", hidden: false, created_at: h(80), comment_count: 0 },
    { id: "post-4", team_id: null, team_name: null, channel: "trainers", author_id: maja.id, author_name: `${maja.first_name} ${maja.last_name}`, body: "Kan nogen tage Hip Hop Mini på mandag kl. 16.50? Jeg har tandlæge.", media: [], official: false, visibility: "private", hidden: false, created_at: h(9), comment_count: 0 },
  ];
  const comments: Comment[] = [{ id: "c-1", post_id: "post-1", author_id: "p-freja", author_name: "Freja Therkildsen", body: "Fedt! Må vi se videoen bagefter?", hidden: false, created_at: h(4) }];
  const messages: Message[] = [
    { id: "msg-1", author_name: `${line.first_name} ${line.last_name}`, title: "DM 2026 – tilmelding og egenbetaling", body: "Vi stiller op med The AXIS og Apexion til DM 2026 i Vejle 14.–15. marts. Egenbetaling 450 kr. pr. danser dækker startgebyr og bus. Tilmeld senest 1. december ved at acceptere denne besked.", audience: { teams: [axis.id, teams.find((t) => t.name === "Apexion")!.id] }, needs: "accept", created_at: h(30), acted_at: null },
    { id: "msg-2", author_name: `${line.first_name} ${line.last_name}`, title: "Nye regler for brug af salene", body: "Solo-bookinger skal fra nu af godkendes i appen. Husk at lukke og slukke, når I er sidst ude.", audience: { all: true }, needs: "read", created_at: h(100), acted_at: null },
  ];
  const folders: Folder[] = [
    { id: "f-1", team_id: axis.id, name: "Holdbilleder 25/26", staff_only: false, media_count: 0, cover_path: null, created_at: h(200) },
    { id: "f-2", team_id: axis.id, name: "DM 2026", staff_only: false, media_count: 0, cover_path: null, created_at: h(50) },
    { id: "f-3", team_id: axis.id, name: "Trænernoter & musik", staff_only: true, media_count: 0, cover_path: null, created_at: h(40) },
  ];
  const videos: Video[] = [{ id: "v-1", team_id: axis.id, uploader_id: line.id, uploader_name: `${line.first_name} ${line.last_name}`, title: "DM-nummer – fuld gennemgang (uden video i demo)", storage_path: "", url: "", duration_s: 154, created_at: h(60),
    formations: [{ label: "Intro", positions: [{ initials: "FT", x: 0.3, y: 0.4 }, { initials: "AN", x: 0.7, y: 0.4 }, { initials: "LL", x: 0.5, y: 0.7 }] }, { label: "Omkvæd", positions: [{ initials: "FT", x: 0.2, y: 0.3 }, { initials: "AN", x: 0.5, y: 0.3 }, { initials: "LL", x: 0.8, y: 0.3 }] }] }];
  const notes: Note[] = [{ id: "n-1", team_id: axis.id, dancer_id: "p-freja", dancer_name: "Freja Therkildsen", author_id: line.id, author_name: `${line.first_name} ${line.last_name}`, body: "Arbejder på spagat – stor fremgang siden august. Husk at rose for musikalitet.", created_at: h(70) }];
  return { posts, comments, reports: [], messages, receipts: [], folders, media: [], videos, notes, results: [{ id: "res-1", team_id: axis.id, event_title: "DM Showdance – finale", placed: "2. plads 🥈", held_on: "2026-05-09", visibility: "public" }, { id: "res-2", team_id: axis.id, event_title: "Nordic Dance Championship", placed: "1. plads 🥇", held_on: "2026-03-14", visibility: "public" }] };
}

export function socialOps(get: () => { X: SocialState; notify: (pid: string, kind: string, title: string, body: string | null, ref?: Record<string, string>) => void; persons: Person[]; memberships: Membership[]; guardians: { parent_id: string; child_id: string }[]; teams: Team[]; me: () => Person | null; save: () => void; emit: () => void }) {
  const name = (p: Person | null | undefined) => (p ? `${p.first_name} ${p.last_name}` : "");
  const meName = () => name(get().me());
  const isStaff = () => { const g = get(); const me = g.me(); return !!me && (me.is_admin || g.memberships.some((m) => m.person_id === me.id && m.role !== "dancer")); };
  const myPeople = () => { const g = get(); const me = g.me(); if (!me) return []; return [me.id, ...g.guardians.filter((x) => x.parent_id === me.id).map((x) => x.child_id)]; };
  const myTeamIds = () => { const g = get(); const ids = myPeople(); return new Set(g.memberships.filter((m) => ids.includes(m.person_id)).map((m) => m.team_id)); };
  const staffOf = (teamId: string | null) => { const g = get(); const me = g.me(); return !!me && (me.is_admin || (teamId != null && g.memberships.some((m) => m.person_id === me.id && m.team_id === teamId && m.role !== "dancer"))); };
  const withUrls = (m: MediaRef[]) => m.map((x) => ({ ...x, url: urls.get(x.path) ?? x.url }));
  const store = async (path: string, f: File) => { urls.set(path, f.type.startsWith("video/") ? URL.createObjectURL(f) : await fileToDataUrl(await downscaleImage(f, 1200, 0.8))); };

  const pname = (pid: string) => name(get().persons.find((p) => p.id === pid));
  const threadOf = (t: Thread): Thread => { const g = get(); const me = g.me()!; const ms = (g.X.threadMsgs ?? []).filter((m) => m.thread_id === t.id).sort((a, b) => a.created_at.localeCompare(b.created_at)); const last = ms[ms.length - 1]; const r = (g.X.threadReads ?? []).find((x) => x.thread_id === t.id && x.person_id === me.id);
    return { ...t, participant_names: t.participants.map(pname).sort(), created_by_name: pname(t.created_by), last_body: last?.body ?? null, last_sender_name: last ? pname(last.sender_id) : null, message_count: ms.length, unread: !r || r.read_at < t.last_at }; };
  const postMsg = (threadId: string, body: string) => { const g = get(); const me = g.me()!; const t = g.X.threads!.find((x) => x.id === threadId)!; const at = now();
    (g.X.threadMsgs ??= []).push({ id: "tm-" + id(), thread_id: threadId, sender_id: me.id, sender_name: name(me), body, created_at: at }); t.last_at = at;
    g.X.threadReads = (g.X.threadReads ?? []).filter((x) => !(x.thread_id === threadId && x.person_id === me.id)).concat({ thread_id: threadId, person_id: me.id, read_at: at });
    for (const pid of t.participants) if (pid !== me.id) g.notify(pid, "message", `${name(me)}: ${t.subject}`, body.slice(0, 120), { thread_id: threadId }); };

  return {
    async listFormationSets(teamId: string): Promise<FormationSet[]> { return (get().X.formationSets ?? []).filter((f) => f.team_id === teamId).sort((a, b) => b.updated_at.localeCompare(a.updated_at)); },
    async createFormationSet(teamId: string, title: string): Promise<FormationSet> { const g = get(); const f: FormationSet = { id: "fs-" + id(), team_id: teamId, title, created_by: g.me()!.id, frames: [], created_at: now(), updated_at: now() }; (g.X.formationSets ??= []).push(f); g.save(); g.emit(); return f; },
    async saveFormationSet(fid: string, patch: { title?: string; frames?: Frame[]; markers?: Marker[] }) { const g = get(); const f = (g.X.formationSets ?? []).find((x) => x.id === fid); if (f) Object.assign(f, patch, { updated_at: now() }); g.save(); g.emit(); },
    async deleteFormationSet(fid: string) { const g = get(); g.X.formationSets = (g.X.formationSets ?? []).filter((x) => x.id !== fid); g.save(); g.emit(); },
    async teamDancers(teamId: string): Promise<TeamDancer[]> { const g = get(); return g.memberships.filter((m) => m.team_id === teamId && m.role === "dancer").map((m) => g.persons.find((p) => p.id === m.person_id)).filter((p): p is Person => !!p && p.status === "approved").map((p) => ({ person_id: p.id, name: name(p), initials: (p.first_name[0] + (p.last_name[0] ?? "")).toUpperCase() })); },
    async teamStaff(teamId: string): Promise<TeamStaff[]> {
      const g = get(); const out: TeamStaff[] = [];
      for (const m of g.memberships.filter((m) => m.team_id === teamId && m.role !== "dancer")) { const p = g.persons.find((x) => x.id === m.person_id); if (p && p.status === "approved") out.push({ person_id: p.id, name: name(p), role: m.role as "trainer" | "assistant", is_admin: p.is_admin }); }
      for (const p of g.persons.filter((p) => p.is_admin && p.status === "approved")) if (!out.some((x) => x.person_id === p.id)) out.push({ person_id: p.id, name: name(p), role: "admin", is_admin: true });
      return out;
    },
    async listThreads(): Promise<Thread[]> { const g = get(); const me = g.me()!; return (g.X.threads ?? []).filter((t) => t.participants.includes(me.id)).map(threadOf).sort((a, b) => b.last_at.localeCompare(a.last_at)); },
    async createThread(i: { team_id: string | null; subject: string; body: string; participant_ids: string[] }): Promise<Thread> {
      const g = get(); const me = g.me()!; const t: Thread = { id: "th-" + id(), team_id: i.team_id, subject: i.subject, created_by: me.id, created_by_name: name(me), participants: Array.from(new Set([me.id, ...i.participant_ids])), participant_names: [], last_body: null, last_sender_name: null, message_count: 0, unread: false, created_at: now(), last_at: now() };
      (g.X.threads ??= []).push(t); postMsg(t.id, i.body); g.save(); g.emit(); return threadOf(t);
    },
    async listThreadMessages(threadId: string): Promise<ThreadMessage[]> { return (get().X.threadMsgs ?? []).filter((m) => m.thread_id === threadId).sort((a, b) => a.created_at.localeCompare(b.created_at)); },
    async replyThread(threadId: string, body: string) { postMsg(threadId, body); get().save(); get().emit(); },
    async markThreadRead(threadId: string) { const g = get(); const me = g.me()!; g.X.threadReads = (g.X.threadReads ?? []).filter((x) => !(x.thread_id === threadId && x.person_id === me.id)).concat({ thread_id: threadId, person_id: me.id, read_at: now() }); g.save(); g.emit(); },

    async listPosts(channel: Channel, teamId?: string | null): Promise<Post[]> {
      const g = get(); const admin = !!g.me()?.is_admin;
      return g.X.posts.filter((p) => p.channel === channel && (channel !== "team" || p.team_id === teamId) && (!p.hidden || admin || staffOf(p.team_id)))
        .filter(() => channel !== "trainers" || isStaff())
        .map((p) => ({ ...p, media: withUrls(p.media), comment_count: g.X.comments.filter((c) => c.post_id === p.id && !c.hidden).length }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async createPost(i: { team_id: string | null; channel: Channel; body: string; files: File[]; official?: boolean; visibility?: "private" | "public" }) {
      const g = get(); const me = g.me()!; const media: MediaRef[] = [];
      if (me.supervised_by && i.files.length) throw new Error("Børneprofiler kan ikke lægge billeder op");
      for (const f of i.files) { const path = `mock/posts/${id()}`; await store(path, f); media.push({ path, kind: f.type.startsWith("video/") ? "video" : "image" }); }
      g.X.posts.push({ id: "post-" + id(), team_id: i.team_id, team_name: g.teams.find((t) => t.id === i.team_id)?.name ?? null, channel: i.channel, author_id: me.id, author_name: name(me), body: i.body, media, official: !!i.official, visibility: i.visibility ?? "private", hidden: false, created_at: now(), comment_count: 0 });
      g.save(); g.emit();
    },
    async updatePost(pid: string, patch: Partial<Post>) { const g = get(); const p = g.X.posts.find((x) => x.id === pid); if (p) Object.assign(p, patch); g.save(); g.emit(); },
    async deletePost(pid: string) { const g = get(); g.X.posts = g.X.posts.filter((p) => p.id !== pid); g.X.comments = g.X.comments.filter((c) => c.post_id !== pid); g.save(); g.emit(); },
    async listComments(postId: string): Promise<Comment[]> { const admin = !!get().me()?.is_admin; return get().X.comments.filter((c) => c.post_id === postId && (!c.hidden || admin)); },
    async addComment(postId: string, body: string) { const g = get(); const me = g.me()!; g.X.comments.push({ id: "c-" + id(), post_id: postId, author_id: me.id, author_name: name(me), body, hidden: false, created_at: now() }); g.save(); g.emit(); },
    async setCommentHidden(cid: string, hidden: boolean) { const g = get(); const c = g.X.comments.find((x) => x.id === cid); if (c) c.hidden = hidden; g.save(); g.emit(); },
    async report(target: { post_id?: string; comment_id?: string }, reason: string | null) {
      const g = get(); const p = target.post_id ? g.X.posts.find((x) => x.id === target.post_id) : null; const c = target.comment_id ? g.X.comments.find((x) => x.id === target.comment_id) : null;
      g.X.reports.push({ id: "r-" + id(), post_id: target.post_id ?? null, comment_id: target.comment_id ?? null, reporter_name: meName(), reason, excerpt: p?.body ?? c?.body ?? "", author_name: p?.author_name ?? c?.author_name ?? "", team_id: p?.team_id ?? (c ? g.X.posts.find((x) => x.id === c.post_id)?.team_id ?? null : null), hidden: false, resolved_at: null, created_at: now() });
      g.save(); g.emit();
    },
    async listReports(): Promise<Report[]> { const g = get(); return g.X.reports.map((r) => ({ ...r, hidden: !!(r.post_id ? g.X.posts.find((p) => p.id === r.post_id)?.hidden : g.X.comments.find((c) => c.id === r.comment_id)?.hidden) })).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async resolveReport(rid: string, action: "hide" | "keep") {
      const g = get(); const r = g.X.reports.find((x) => x.id === rid); if (!r) return;
      if (action === "hide") { const p = g.X.posts.find((x) => x.id === r.post_id); if (p) p.hidden = true; const c = g.X.comments.find((x) => x.id === r.comment_id); if (c) c.hidden = true; }
      r.resolved_at = now(); g.save(); g.emit();
    },

    async listMessages(): Promise<Message[]> {
      const g = get(); const me = g.me()!; const mine = myTeamIds();
      return g.X.messages.filter((m) => me.is_admin || m.audience.all || (m.audience.teams ?? []).some((t) => mine.has(t)))
        .map((m) => ({ ...m, acted_at: g.X.receipts.find((r) => r.message_id === m.id && r.person_id === me.id)?.acted_at ?? null }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async sendMessage(i: { title: string; body: string; audience: Audience; needs: "read" | "accept" }) {
      const g = get(); const m: Message = { id: "msg-" + id(), author_name: meName(), ...i, created_at: now(), acted_at: null }; g.X.messages.push(m);
      const set = new Set(i.audience.teams ?? []);
      for (const p of g.persons) if (p.user_id && p.status === "approved" && (i.audience.all || g.memberships.some((mm) => mm.person_id === p.id && set.has(mm.team_id)) || g.guardians.some((gd) => gd.parent_id === p.id && g.memberships.some((mm) => mm.person_id === gd.child_id && set.has(mm.team_id))))) g.notify(p.id, "message", i.title, i.body.slice(0, 120), { message_id: m.id });
      g.save(); g.emit();
    },
    async ackMessage(mid: string) { const g = get(); const me = g.me()!; if (!g.X.receipts.some((r) => r.message_id === mid && r.person_id === me.id)) g.X.receipts.push({ message_id: mid, person_id: me.id, acted_at: now() }); g.save(); g.emit(); },
    async listMessageComments(mid: string): Promise<MessageComment[]> { return (get().X.msgComments ?? []).filter((c) => c.message_id === mid); },
    async addMessageComment(mid: string, body: string) { const g = get(); const me = g.me()!; (g.X.msgComments ??= []).push({ id: "mc-" + id(), message_id: mid, author_id: me.id, author_name: name(me), body, created_at: now() }); g.save(); g.emit(); },
    async deleteMessageComment(cid: string) { const g = get(); g.X.msgComments = (g.X.msgComments ?? []).filter((c) => c.id !== cid); g.save(); g.emit(); },
    async messageStatus(mid: string): Promise<MessageStatus[]> {
      const g = get(); const m = g.X.messages.find((x) => x.id === mid); if (!m) return [];
      const teamSet = new Set(m.audience.teams ?? []);
      return g.persons.filter((p) => p.status === "approved" && p.user_id && (m.audience.all || g.memberships.some((mm) => mm.person_id === p.id && teamSet.has(mm.team_id)) || g.guardians.some((gd) => gd.parent_id === p.id && g.memberships.some((mm) => mm.person_id === gd.child_id && teamSet.has(mm.team_id)))))
        .map((p) => ({ person_id: p.id, name: name(p), acted_at: g.X.receipts.find((r) => r.message_id === mid && r.person_id === p.id)?.acted_at ?? null }))
        .sort((a, b) => (a.acted_at ? 1 : 0) - (b.acted_at ? 1 : 0) || a.name.localeCompare(b.name));
    },

    async listFolders(teamId: string): Promise<Folder[]> {
      const g = get(); return g.X.folders.filter((f) => f.team_id === teamId && (!f.staff_only || staffOf(teamId))).map((f) => { const ms = g.X.media.filter((m) => m.folder_id === f.id); const cover = ms.find((m) => m.kind === "image"); return { ...f, media_count: ms.length, cover_path: cover?.storage_path ?? null, cover_url: cover ? urls.get(cover.storage_path) ?? null : null }; });
    },
    async createFolder(teamId: string, nm: string, staffOnly: boolean) { const g = get(); g.X.folders.push({ id: "f-" + id(), team_id: teamId, name: nm, staff_only: staffOnly, media_count: 0, cover_path: null, created_at: now() }); g.save(); g.emit(); },
    async listMedia(folderId: string): Promise<MediaItem[]> { return get().X.media.filter((m) => m.folder_id === folderId).map((m) => ({ ...m, url: urls.get(m.storage_path) ?? "" })).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || b.created_at.localeCompare(a.created_at)); },
    async setMediaOrder(folderId: string, ids: string[]) { const g = get(); for (const m of g.X.media) if (m.folder_id === folderId) { const i = ids.indexOf(m.id); if (i >= 0) m.sort = i; } g.save(); g.emit(); },
    async setTeamCover(teamId: string, storagePath: string | null) { const g = get(); const t = g.teams.find((x) => x.id === teamId); if (t) { t.cover_path = storagePath; t.cover_url = storagePath ? urls.get(storagePath) ?? null : null; } g.save(); g.emit(); },
    async uploadMedia(folderId: string, files: File[]) {
      const g = get(); const me = g.me()!; if (me.supervised_by) throw new Error("Børneprofiler kan ikke lægge billeder op");
      for (const f of files) { const path = `mock/folders/${folderId}/${id()}`; await store(path, f); g.X.media.push({ id: "m-" + id(), folder_id: folderId, uploader_id: me.id, uploader_name: name(me), storage_path: path, kind: f.type.startsWith("video/") ? "video" : "image", url: "", created_at: now() }); }
      g.save(); g.emit();
    },
    async deleteMedia(mid: string) { const g = get(); g.X.media = g.X.media.filter((m) => m.id !== mid); g.save(); g.emit(); },

    async listVideos(teamId: string): Promise<Video[]> {
      const g = get(); const me = g.me()!; const team = g.teams.find((t) => t.id === teamId);
      const dancerHere = g.memberships.some((m) => m.person_id === me.id && m.team_id === teamId);
      const parentOk = g.guardians.some((gd) => gd.parent_id === me.id && g.memberships.some((m) => m.person_id === gd.child_id && m.team_id === teamId) && (team?.parents_see_video || (() => { const c = g.persons.find((p) => p.id === gd.child_id); return !!c?.birth_year && new Date().getFullYear() - c.birth_year < 13; })()));
      if (!(staffOf(teamId) || dancerHere || parentOk)) return [];
      return g.X.videos.filter((v) => v.team_id === teamId).map((v) => ({ ...v, url: urls.get(v.storage_path) ?? "" }));
    },
    async uploadVideo(teamId: string, title: string, file: File, notes?: string | null) { const g = get(); const me = g.me()!; const path = `mock/videos/${id()}`; await store(path, file); g.X.videos.push({ id: "v-" + id(), team_id: teamId, uploader_id: me.id, uploader_name: name(me), title, storage_path: path, url: "", duration_s: null, formations: [], notes: notes || null, created_at: now() }); g.save(); g.emit(); },
    async updateVideo(vid: string, patch: { title?: string; formations?: Formation[] }) { const g = get(); const v = g.X.videos.find((x) => x.id === vid); if (v) Object.assign(v, patch); g.save(); g.emit(); },
    async deleteVideo(vid: string) { const g = get(); g.X.videos = g.X.videos.filter((v) => v.id !== vid); g.save(); g.emit(); },

    async listFeed(): Promise<Post[]> {
      const g = get(); const mine = myTeamIds(); const admin = !!g.me()?.is_admin;
      return g.X.posts.filter((p) => !p.hidden && (p.channel === "school" || (p.channel === "team" && p.team_id && (mine.has(p.team_id) || admin || staffOf(p.team_id)))))
        .map((p) => ({ ...p, media: withUrls(p.media), comment_count: g.X.comments.filter((c) => c.post_id === p.id && !c.hidden).length })).sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async listResults(teamId?: string) { const g = get(); return (g.X.results ?? []).filter((r) => !teamId || r.team_id === teamId).map((r) => ({ ...r, team_name: g.teams.find((t) => t.id === r.team_id)?.name ?? null })).sort((a, b) => b.held_on.localeCompare(a.held_on)); },
    async addResult(i: { team_id: string | null; event_title: string; placed: string; held_on: string; visibility: "private" | "public" }) { const g = get(); (g.X.results ??= []).push({ id: "res-" + id(), ...i }); g.save(); g.emit(); },
    async deleteResult(rid: string) { const g = get(); g.X.results = (g.X.results ?? []).filter((r) => r.id !== rid); g.save(); g.emit(); },
    async teamStats(teamId: string) { const g = get(); const vids = g.X.videos.filter((v) => v.team_id === teamId); const folders = g.X.folders.filter((f) => f.team_id === teamId).map((f) => f.id); return { videos: vids.length, formations: (g.X.formationSets ?? []).filter((f) => f.team_id === teamId).length, media: g.X.media.filter((m) => folders.includes(m.folder_id)).length, dancers: g.memberships.filter((m) => m.team_id === teamId && m.role === "dancer").length }; },
    async importTeamImage(teamId: string, folderName: string, file: Blob, fileName: string, asCover: boolean) {
      const g = get(); const me = g.me()!; let f = g.X.folders.find((x) => x.team_id === teamId && x.name === folderName);
      if (!f) { f = { id: "f-" + id(), team_id: teamId, name: folderName, staff_only: false, media_count: 0, cover_path: null, created_at: now() }; g.X.folders.push(f); }
      const path = `mock/folders/${f.id}/${fileName}`; urls.set(path, await fileToDataUrl(await downscaleImage(file as File, 1200, 0.8)));
      g.X.media.push({ id: "m-" + id(), folder_id: f.id, uploader_id: me.id, uploader_name: name(me), storage_path: path, kind: "image", url: "", created_at: now() });
      if (asCover) { const t = g.teams.find((x) => x.id === teamId); if (t) { t.cover_path = path; t.cover_url = urls.get(path); } }
      g.save(); g.emit();
    },
    async listNotes(teamId: string, dancerId?: string): Promise<Note[]> { const g = get(); return g.X.notes.filter((n) => n.team_id === teamId && (!dancerId || n.dancer_id === dancerId) && staffOf(teamId)).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
    async addNote(teamId: string, dancerId: string, body: string) { const g = get(); const me = g.me()!; g.X.notes.push({ id: "n-" + id(), team_id: teamId, dancer_id: dancerId, dancer_name: name(g.persons.find((p) => p.id === dancerId)), author_id: me.id, author_name: name(me), body, created_at: now() }); g.save(); g.emit(); },
    async deleteNote(nid: string) { const g = get(); g.X.notes = g.X.notes.filter((n) => n.id !== nid); g.save(); g.emit(); },
  };
}
