import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Channel, type Comment, type Post } from "@/core/api";
import { useAuth } from "@/core/auth";
import { ImagePicker } from "./ImagePicker";
import { catalogUrl } from "../lib/catalog";
import { Sheet } from "./Sheet";
import { ago } from "../lib/time";

/** Team room / school channel / trainer channel. Line asked for one feed with a channel picker. */
export function Feed({ teamId, channels, toast, limit }: { teamId: string | null; channels: Channel[]; toast: (m: string) => void; limit?: number }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const isAdmin = me.person.is_admin;
  const isStaff = isAdmin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer");
  const [channel, setChannel] = useState<Channel>(channels[0]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [open, setOpen] = useState<Post | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const load = useCallback(async () => { setPosts(await api.listPosts(channel, teamId)); }, [channel, teamId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!channels.includes(channel)) setChannel(channels[0]); }, [channels, channel]);
  const canPost = channel === "team" ? !!teamId : channel === "school" ? isAdmin : isStaff;
  const staffHere = isAdmin || (channel === "team" && teamId != null && me.memberships.some((m) => m.person_id === me.person.id && m.team_id === teamId && m.role !== "dancer"));
  const shown = limit ? posts.slice(0, limit) : posts;

  return (
    <div className="feed" data-testid="feed">
      {channels.length > 1 && (
        <div className="chips" style={{ marginBottom: 10 }}>
          {channels.map((c) => <button key={c} className={"chip" + (channel === c ? " on" : "")} onClick={() => setChannel(c)}>{t(`feed.channel.${c}`)}</button>)}
        </div>
      )}
      {canPost && <Composer teamId={channel === "team" ? teamId : null} channel={channel} isStaff={isStaff} isAdmin={isAdmin} onPosted={() => { void load(); toast(t("feed.posted")); }} />}
      {shown.map((p) => <PostCard key={p.id} post={p} mod={staffHere} onOpen={() => setOpen(p)} onImage={setLightbox} onChanged={() => void load()} toast={toast} />)}
      {!posts.length && <p className="muted small">{t("feed.empty")}</p>}
      {open && <CommentSheet post={open} mod={staffHere} onClose={() => { setOpen(null); void load(); }} toast={toast} />}
      {lightbox && <div className="lightbox" onClick={() => setLightbox(null)}><img src={lightbox} alt="" /></div>}
    </div>
  );
}

function Composer({ teamId, channel, isStaff, isAdmin, onPosted }: { teamId: string | null; channel: Channel; isStaff: boolean; isAdmin: boolean; onPosted: () => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pickImg, setPickImg] = useState(false);
  const addCatalog = async (key: string | null) => { if (!key) return; const url = catalogUrl(key)!; const blob = await (await fetch(url)).blob(); setFiles([...files, new File([blob], `${key}.jpg`, { type: blob.type || "image/jpeg" })]); setPickImg(false); };
  const [official, setOfficial] = useState(channel === "school");
  const [pub, setPub] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supervised = !!me.person.supervised_by;
  const post = async () => {
    setBusy(true); setErr(null);
    try { await api.createPost({ team_id: teamId, channel, body: body.trim(), files, official: isStaff && official, visibility: isAdmin && pub ? "public" : "private" }); setBody(""); setFiles([]); onPosted(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="card composer">
      <textarea id="post-body" rows={2} placeholder={t(channel === "trainers" ? "feed.placeholderTrainers" : "feed.placeholder")} value={body} onChange={(e) => setBody(e.target.value)} />
      {pickImg && <ImagePicker tag="post" value={null} onChange={(k) => void addCatalog(k)} allowNone={false} />}
      {files.length > 0 && <div className="thumbs">{files.map((f, i) => <span key={i} className="chip small">{f.type.startsWith("video/") ? "🎬" : "🖼"} {f.name.slice(0, 18)} <button className="linklike" onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button></span>)}</div>}
      <div className="row between">
        <div className="row">
          {!supervised && <><button className="ghost small" onClick={() => fileRef.current?.click()}>📷 {t("feed.addPhoto")}</button>
            {isStaff && <button className="ghost small" onClick={() => setPickImg(!pickImg)} data-testid="pick-catalog">✦ {t("catalog.title")}</button>}
            <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} /></>}
          {isStaff && channel !== "trainers" && <label className="check small"><input type="checkbox" checked={official} onChange={(e) => setOfficial(e.target.checked)} />{t("feed.official")}</label>}
          {isAdmin && channel === "school" && <label className="check small"><input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />{t("feed.public")}</label>}
        </div>
        <button className="small" id="post-send" disabled={busy || (!body.trim() && !files.length)} onClick={() => void post()}>{t("feed.post")}</button>
      </div>
      {err && <p className="error small" role="alert">{err}</p>}
      {!isStaff && <p className="tiny">{t("feed.rules")}</p>}
    </div>
  );
}

/** A plain list of posts (used by the Social "Alle" feed); moderation per post's own team. */
export function PostList({ posts, onChanged, toast }: { posts: Post[]; onChanged: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const [open, setOpen] = useState<Post | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const modOf = (p: Post) => me.person.is_admin || (p.team_id != null && me.memberships.some((m) => m.person_id === me.person.id && m.team_id === p.team_id && m.role !== "dancer"));
  return (
    <div className="feed" data-testid="feed">
      {posts.map((p) => <PostCard key={p.id} post={p} mod={modOf(p)} onOpen={() => setOpen(p)} onImage={setLightbox} onChanged={onChanged} toast={toast} />)}
      {!posts.length && <p className="muted small">{t("feed.empty")}</p>}
      {open && <CommentSheet post={open} mod={modOf(open)} onClose={() => { setOpen(null); onChanged(); }} toast={toast} />}
      {lightbox && <div className="lightbox" onClick={() => setLightbox(null)}><img src={lightbox} alt="" /></div>}
    </div>
  );
}

function PostCard({ post, mod, onOpen, onImage, onChanged, toast }: { post: Post; mod: boolean; onOpen: () => void; onImage: (url: string) => void; onChanged: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const own = post.author_id === me.person.id;
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const imgs = post.media.filter((m) => m.kind === "image" && m.url);
  const vids = post.media.filter((m) => m.kind === "video" && m.url);
  return (
    <article className={"card post" + (post.hidden ? " hidden-post" : "")} data-testid="post">
      <div className="row between">
        <div className="row"><span className="avatar small">{post.author_name[0]}</span><div><div className="small">{post.author_name}{post.official && <span className="chip gold small" style={{ marginLeft: 6 }}>{t("feed.officialChip")}</span>}{post.visibility === "public" && <span className="chip small" style={{ marginLeft: 6 }}>{t("feed.publicChip")}</span>}{post.hidden && <span className="chip warn small" style={{ marginLeft: 6 }}>{t("feed.hiddenChip")}</span>}</div><div className="tiny">{ago(post.created_at)} · {post.channel === "school" ? t("feed.channel.school") : post.channel === "trainers" ? t("feed.channel.trainers") : post.team_name ?? ""}</div></div></div>
        <button className="ghost small" aria-label={t("feed.more")} onClick={() => setMenu(!menu)}>···</button>
      </div>
      {menu && (
        <div className="chips">
          {!own && <button className="chip" onClick={() => { setMenu(false); setReporting(true); }}>{t("feed.report")}</button>}
          {(own || mod) && <button className="chip" onClick={async () => { await api.deletePost(post.id); toast(t("feed.deleted")); onChanged(); }}>{t("common.delete")}</button>}
          {mod && !own && <button className="chip" onClick={async () => { await api.updatePost(post.id, { hidden: !post.hidden }); onChanged(); }}>{post.hidden ? t("feed.unhide") : t("feed.hide")}</button>}
          {mod && <button className="chip" onClick={async () => { await api.updatePost(post.id, { official: !post.official }); onChanged(); }}>{post.official ? t("feed.unofficial") : t("feed.makeOfficial")}</button>}
        </div>
      )}
      {reporting && (
        <div className="stack" style={{ gap: 8 }}>
          <input placeholder={t("feed.reportWhy")} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="row"><button className="small" onClick={async () => { await api.report({ post_id: post.id }, reason || null); setReporting(false); toast(t("feed.reported")); }}>{t("feed.sendReport")}</button><button className="ghost small" onClick={() => setReporting(false)}>{t("common.cancel")}</button></div>
        </div>
      )}
      {post.body && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{post.body}</p>}
      {imgs.length > 0 && <div className={"media-grid n" + Math.min(imgs.length, 3)}>{imgs.map((m) => <button key={m.path} className="media" onClick={() => onImage(m.url!)}><img src={m.url} alt="" loading="lazy" /></button>)}</div>}
      {vids.map((m) => <video key={m.path} src={m.url} controls playsInline className="post-video" />)}
      <button className="linklike small" onClick={onOpen}>{post.comment_count ? t("feed.comments", { n: post.comment_count }) : t("feed.comment")}</button>
    </article>
  );
}

function CommentSheet({ post, mod, onClose, toast }: { post: Post; mod: boolean; onClose: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const [list, setList] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const load = useCallback(async () => setList(await api.listComments(post.id)), [post.id]);
  useEffect(() => { void load(); }, [load]);
  const send = async () => { if (!body.trim()) return; await api.addComment(post.id, body.trim()); setBody(""); void load(); };
  return (
    <Sheet onClose={onClose} eyebrow={post.author_name} title={t("feed.commentsTitle")}>
      <p className="small muted" style={{ whiteSpace: "pre-wrap" }}>{post.body}</p>
      <div className="list">
        {list.map((c) => <div key={c.id} className={"item" + (c.hidden ? " off" : "")} data-testid="comment"><span className="avatar small">{c.author_name[0]}</span><span className="grow"><span className="small">{c.author_name} <span className="tiny">{ago(c.created_at)}</span></span><div>{c.body}</div></span>
          {(mod || c.author_id === me.person.id) && <button className="linklike tiny" onClick={async () => { await api.setCommentHidden(c.id, !c.hidden); void load(); }}>{c.hidden ? t("feed.unhide") : t("feed.hide")}</button>}
          {c.author_id !== me.person.id && !mod && <button className="linklike tiny" onClick={async () => { await api.report({ comment_id: c.id }, null); toast(t("feed.reported")); }}>{t("feed.report")}</button>}</div>)}
        {!list.length && <p className="tiny">{t("feed.noComments")}</p>}
      </div>
      <div className="row"><input id="comment-body" placeholder={t("feed.writeComment")} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} /><button className="small" id="comment-send" onClick={() => void send()}>{t("feed.send")}</button></div>
    </Sheet>
  );
}
