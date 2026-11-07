import type { SupabaseClient } from "@supabase/supabase-js";
import type { Audience, Channel, Comment, Folder, Formation, FormationSet, Frame, Marker, TeamDancer, MediaItem, MediaRef, Message, MessageStatus, Note, Post, Report, TeamStaff, Thread, ThreadMessage, Video } from "./types";
import { downscaleImage } from "./image";

type Fail = (e: { message: string } | null) => void;
const BUCKET = "media";
const SIGN_TTL = 60 * 60; // 1 h; the app re-lists on every open

/** Phase-3 half of the Supabase API: posts/comments/reports, messages + receipts, folders/media, videos, notes. */
export function supabaseSocial(sb: SupabaseClient, fail: Fail, schoolId: () => Promise<string>, myPersonId: () => Promise<string | null>, schoolSlug: string) {
  const uid = () => crypto.randomUUID();
  const ext = (f: File) => (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");

  /** Signed URLs for private storage paths, in one round trip. */
  async function sign(paths: string[]): Promise<Record<string, string>> {
    const uniq = Array.from(new Set(paths.filter(Boolean)));
    if (!uniq.length) return {};
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(uniq, SIGN_TTL);
    const out: Record<string, string> = {};
    for (const r of data ?? []) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
    return out;
  }
  async function upload(path: string, file: File | Blob, contentType?: string) {
    const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: contentType ?? (file as File).type, upsert: false });
    fail(error);
  }

  return {
    async listPosts(channel: Channel, teamId?: string | null): Promise<Post[]> {
      let q = sb.from("post_view").select("*").eq("channel", channel).order("created_at", { ascending: false }).limit(100);
      if (channel === "team" && teamId) q = q.eq("team_id", teamId);
      const { data, error } = await q; fail(error);
      const rows = (data ?? []) as (Post & { media: MediaRef[] })[];
      const urls = await sign(rows.flatMap((p) => (p.media ?? []).map((m) => m.path)));
      return rows.map((p) => ({ ...p, media: (p.media ?? []).map((m) => ({ ...m, url: urls[m.path] })), comment_count: Number(p.comment_count ?? 0) }));
    },
    async createPost(i: { team_id: string | null; channel: Channel; body: string; files: File[]; official?: boolean; visibility?: "private" | "public" }) {
      const sid = await schoolId(); const pid = await myPersonId();
      const media: MediaRef[] = [];
      for (const f of i.files) {
        const isVideo = f.type.startsWith("video/");
        const path = `${schoolSlug}/posts/${i.team_id ?? "school"}/${uid()}.${isVideo ? ext(f) : "jpg"}`;
        if (isVideo) await upload(path, f); else await upload(path, await downscaleImage(f, 1600), "image/jpeg");
        media.push({ path, kind: isVideo ? "video" : "image" });
      }
      const { error } = await sb.from("post").insert({ school_id: sid, team_id: i.team_id, channel: i.channel, author_id: pid, body: i.body, media, official: !!i.official, visibility: i.visibility ?? "private" }); fail(error);
    },
    async updatePost(id: string, patch: { hidden?: boolean; official?: boolean; visibility?: "private" | "public"; body?: string }) { const { error } = await sb.from("post").update(patch).eq("id", id); fail(error); },
    async deletePost(id: string) { const { error } = await sb.from("post").delete().eq("id", id); fail(error); },
    async listComments(postId: string): Promise<Comment[]> { const { data, error } = await sb.from("comment_view").select("*").eq("post_id", postId).order("created_at"); fail(error); return (data ?? []) as Comment[]; },
    async addComment(postId: string, body: string) { const { error } = await sb.from("comment").insert({ post_id: postId, author_id: await myPersonId(), body }); fail(error); },
    async setCommentHidden(id: string, hidden: boolean) { const { error } = await sb.from("comment").update({ hidden }).eq("id", id); fail(error); },
    async report(target: { post_id?: string; comment_id?: string }, reason: string | null) {
      const { error } = await sb.from("report").insert({ school_id: await schoolId(), reporter_id: await myPersonId(), post_id: target.post_id ?? null, comment_id: target.comment_id ?? null, reason }); fail(error);
    },
    async listReports(): Promise<Report[]> { const { data, error } = await sb.from("report_view").select("*").order("created_at", { ascending: false }); fail(error); return (data ?? []) as Report[]; },
    async resolveReport(id: string, action: "hide" | "keep") {
      const { data: r } = await sb.from("report").select("post_id,comment_id").eq("id", id).single();
      if (action === "hide" && r?.post_id) { const { error } = await sb.from("post").update({ hidden: true }).eq("id", r.post_id); fail(error); }
      if (action === "hide" && r?.comment_id) { const { error } = await sb.from("comment").update({ hidden: true }).eq("id", r.comment_id); fail(error); }
      const { error } = await sb.from("report").update({ resolved_at: new Date().toISOString() }).eq("id", id); fail(error);
    },

    async listMessages(): Promise<Message[]> { const { data, error } = await sb.from("message_view").select("*").order("created_at", { ascending: false }).limit(50); fail(error); return (data ?? []) as Message[]; },
    async sendMessage(i: { title: string; body: string; audience: Audience; needs: "read" | "accept" }) {
      const { error } = await sb.from("message").insert({ school_id: await schoolId(), author_id: await myPersonId(), ...i }); fail(error);
    },
    async ackMessage(id: string) { const { error } = await sb.from("message_receipt").upsert({ message_id: id, person_id: await myPersonId() }, { onConflict: "message_id,person_id" }); fail(error); },
    async messageStatus(id: string): Promise<MessageStatus[]> { const { data, error } = await sb.rpc("message_status", { p_message: id }); fail(error); return (data ?? []) as MessageStatus[]; },

    async teamStaff(teamId: string) { const { data, error } = await sb.rpc("team_staff", { p_team: teamId }); fail(error); return (data ?? []) as TeamStaff[]; },
    async listThreads() { const { data, error } = await sb.from("thread_view").select("*").order("last_at", { ascending: false }).limit(100); fail(error); return (data ?? []) as Thread[]; },
    async createThread(i: { team_id: string | null; subject: string; body: string; participant_ids: string[] }) {
      const me = await myPersonId(); const ids = Array.from(new Set([me!, ...i.participant_ids]));
      const { data, error } = await sb.from("thread").insert({ school_id: await schoolId(), team_id: i.team_id, subject: i.subject, created_by: me, participants: ids }).select("id").single(); fail(error);
      const { error: e2 } = await sb.from("thread_message").insert({ thread_id: data!.id, sender_id: me, body: i.body }); fail(e2);
      const { data: t, error: e3 } = await sb.from("thread_view").select("*").eq("id", data!.id).single(); fail(e3); return t as Thread;
    },
    async listThreadMessages(threadId: string) { const { data, error } = await sb.from("thread_message_view").select("*").eq("thread_id", threadId).order("created_at"); fail(error); return (data ?? []) as ThreadMessage[]; },
    async replyThread(threadId: string, body: string) { const { error } = await sb.from("thread_message").insert({ thread_id: threadId, sender_id: await myPersonId(), body }); fail(error); },
    async markThreadRead(threadId: string) { const { error } = await sb.from("thread_read").upsert({ thread_id: threadId, person_id: await myPersonId(), read_at: new Date().toISOString() }, { onConflict: "thread_id,person_id" }); fail(error); },

    async listFolders(teamId: string): Promise<Folder[]> {
      const { data, error } = await sb.from("folder_view").select("*").eq("team_id", teamId).order("created_at"); fail(error);
      const rows = (data ?? []) as Folder[]; const urls = await sign(rows.map((f) => f.cover_path ?? ""));
      return rows.map((f) => ({ ...f, media_count: Number(f.media_count ?? 0), cover_url: f.cover_path ? urls[f.cover_path] ?? null : null }));
    },
    async createFolder(teamId: string, name: string, staffOnly: boolean) { const { error } = await sb.from("folder").insert({ school_id: await schoolId(), team_id: teamId, name, staff_only: staffOnly }); fail(error); },
    async listMedia(folderId: string): Promise<MediaItem[]> {
      const { data, error } = await sb.from("media_view").select("*").eq("folder_id", folderId).order("sort").order("created_at", { ascending: false }); fail(error);
      const rows = (data ?? []) as MediaItem[]; const urls = await sign(rows.map((m) => m.storage_path));
      return rows.map((m) => ({ ...m, url: urls[m.storage_path] ?? "" }));
    },
    async setMediaOrder(folderId: string, ids: string[]) { for (let i = 0; i < ids.length; i++) { const { error } = await sb.from("media").update({ sort: i }).eq("id", ids[i]).eq("folder_id", folderId); fail(error); } },
    async setTeamCover(teamId: string, storagePath: string | null) { const { error } = await sb.from("team").update({ cover_path: storagePath }).eq("id", teamId); fail(error); },
    async uploadMedia(folderId: string, files: File[]) {
      const pid = await myPersonId();
      for (const f of files) {
        const isVideo = f.type.startsWith("video/");
        const path = `${schoolSlug}/folders/${folderId}/${uid()}.${isVideo ? ext(f) : "jpg"}`;
        if (isVideo) await upload(path, f); else await upload(path, await downscaleImage(f, 1600), "image/jpeg");
        const { error } = await sb.from("media").insert({ folder_id: folderId, uploader_id: pid, storage_path: path, kind: isVideo ? "video" : "image" }); fail(error);
      }
    },
    async deleteMedia(id: string) {
      const { data: m } = await sb.from("media").select("storage_path").eq("id", id).single();
      const { error } = await sb.from("media").delete().eq("id", id); fail(error);
      if (m?.storage_path) await sb.storage.from(BUCKET).remove([m.storage_path]);
    },

    async listVideos(teamId: string): Promise<Video[]> {
      const { data, error } = await sb.from("video_view").select("*").eq("team_id", teamId).order("created_at", { ascending: false }); fail(error);
      const rows = (data ?? []) as Video[]; const urls = await sign(rows.map((v) => v.storage_path));
      return rows.map((v) => ({ ...v, url: urls[v.storage_path] ?? "", formations: (v.formations ?? []) as Formation[] }));
    },
    async uploadVideo(teamId: string, title: string, file: File, notes?: string | null) {
      const path = `${schoolSlug}/videos/${teamId}/${uid()}.${ext(file)}`;
      await upload(path, file);
      const { error } = await sb.from("video").insert({ team_id: teamId, uploader_id: await myPersonId(), title, storage_path: path, notes: notes || null }); fail(error);
    },
    async updateVideo(id: string, patch: { title?: string; formations?: Formation[]; notes?: string | null }) { const { error } = await sb.from("video").update(patch).eq("id", id); fail(error); },
    async deleteVideo(id: string) {
      const { data: v } = await sb.from("video").select("storage_path").eq("id", id).single();
      const { error } = await sb.from("video").delete().eq("id", id); fail(error);
      if (v?.storage_path) await sb.storage.from(BUCKET).remove([v.storage_path]);
    },

    async listFeed(): Promise<Post[]> {
      const { data, error } = await sb.from("post_view").select("*").in("channel", ["team", "school"]).eq("hidden", false).order("created_at", { ascending: false }).limit(60); fail(error);
      const rows = (data ?? []) as (Post & { media: MediaRef[] })[]; const urls = await sign(rows.flatMap((p) => (p.media ?? []).map((m) => m.path)));
      return rows.map((p) => ({ ...p, media: (p.media ?? []).map((m) => ({ ...m, url: urls[m.path] })), comment_count: Number(p.comment_count ?? 0) }));
    },
    async listResults(teamId?: string) {
      let q = sb.from("result").select("*, team:team_id(name)").order("held_on", { ascending: false }); if (teamId) q = q.eq("team_id", teamId);
      const { data, error } = await q; fail(error);
      return (data ?? []).map((r: Record<string, unknown>) => ({ id: r.id as string, team_id: r.team_id as string | null, team_name: (r.team as { name: string } | null)?.name ?? null, event_title: r.event_title as string, placed: r.placed as string, held_on: r.held_on as string, visibility: r.visibility as "private" | "public" }));
    },
    async addResult(i: { team_id: string | null; event_title: string; placed: string; held_on: string; visibility: "private" | "public" }) { const { error } = await sb.from("result").insert({ ...i, school_id: await schoolId() }); fail(error); },
    async deleteResult(id: string) { const { error } = await sb.from("result").delete().eq("id", id); fail(error); },
    async listFormationSets(teamId: string) { const { data, error } = await sb.from("formation_set").select("*").eq("team_id", teamId).order("updated_at", { ascending: false }); fail(error); return (data ?? []) as FormationSet[]; },
    async createFormationSet(teamId: string, title: string) { const { data, error } = await sb.from("formation_set").insert({ team_id: teamId, title, created_by: await myPersonId(), frames: [] }).select("*").single(); fail(error); return data as FormationSet; },
    async saveFormationSet(id: string, patch: { title?: string; frames?: Frame[]; markers?: Marker[] }) { const { error } = await sb.from("formation_set").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id); fail(error); },
    async deleteFormationSet(id: string) { const { error } = await sb.from("formation_set").delete().eq("id", id); fail(error); },
    async teamDancers(teamId: string) { const { data, error } = await sb.rpc("team_dancers", { p_team: teamId }); fail(error); return (data ?? []) as TeamDancer[]; },
    async teamStats(teamId: string) {
      const [v, f, m, fs] = await Promise.all([sb.from("video").select("formations").eq("team_id", teamId), sb.from("folder_view").select("media_count").eq("team_id", teamId), sb.from("membership").select("person_id").eq("team_id", teamId).eq("role", "dancer"), sb.from("formation_set").select("id").eq("team_id", teamId)]);
      return { videos: (v.data ?? []).length, formations: (fs.data ?? []).length, media: (f.data ?? []).reduce((n, x) => n + Number(x.media_count ?? 0), 0), dancers: (m.data ?? []).length };
    },
    async importTeamImage(teamId: string, folderName: string, file: Blob, fileName: string, asCover: boolean) {
      const sid = await schoolId(); const pid = await myPersonId();
      let { data: folder } = await sb.from("folder").select("id").eq("team_id", teamId).eq("name", folderName).maybeSingle();
      if (!folder) { const { data, error } = await sb.from("folder").insert({ school_id: sid, team_id: teamId, name: folderName }).select("id").single(); fail(error); folder = data; }
      const path = `${schoolSlug}/folders/${folder!.id}/${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: ue } = await sb.storage.from(BUCKET).upload(path, file, { contentType: "image/jpeg", upsert: true }); fail(ue);
      const { error } = await sb.from("media").upsert({ folder_id: folder!.id, uploader_id: pid, storage_path: path, kind: "image" }, { onConflict: "storage_path", ignoreDuplicates: true }); fail(error);
      if (asCover) {
        const cover = `${schoolSlug}/teams/${teamId}/cover.jpg`;
        const { error: ce } = await sb.storage.from(BUCKET).upload(cover, file, { contentType: "image/jpeg", upsert: true }); fail(ce);
        const { error: te } = await sb.from("team").update({ cover_path: cover }).eq("id", teamId); fail(te);
      }
    },
    async listNotes(teamId: string, dancerId?: string): Promise<Note[]> {
      let q = sb.from("note_view").select("*").eq("team_id", teamId).order("created_at", { ascending: false });
      if (dancerId) q = q.eq("dancer_id", dancerId);
      const { data, error } = await q; fail(error); return (data ?? []) as Note[];
    },
    async addNote(teamId: string, dancerId: string, body: string) { const { error } = await sb.from("note").insert({ team_id: teamId, dancer_id: dancerId, author_id: await myPersonId(), body }); fail(error); },
    async deleteNote(id: string) { const { error } = await sb.from("note").delete().eq("id", id); fail(error); },
  };
}
