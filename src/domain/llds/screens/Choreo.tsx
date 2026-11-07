import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Formation, type Member, type Video } from "@/core/api";
import { Sheet } from "../components/Sheet";
import { ago } from "../lib/time";

/** Choreography: videos with ½ tempo, mirror and A–B loop, plus formations drawn on a stage. Staff upload and edit. */
export function Choreo({ teamId, staff, onBack, toast, mode = "choreo" }: { teamId: string; staff: boolean; onBack: () => void; toast: (m: string) => void; mode?: "choreo" | "formations" }) {
  const { t } = useTranslation();
  const [videos, setVideos] = useState<Video[]>([]);
  const [open, setOpen] = useState<Video | null>(null);
  const [adding, setAdding] = useState(false);
  const load = useCallback(async () => { const v = await api.listVideos(teamId); setVideos(v); setOpen((o) => (o ? v.find((x) => x.id === o.id) ?? null : null)); }, [teamId]);
  useEffect(() => { void load(); }, [load]);
  const shown = mode === "formations" ? videos.filter((v) => v.formations.length > 0 || staff) : videos;
  if (open) return <VideoView video={open} teamId={teamId} staff={staff} initialTab={mode === "formations" ? "formations" : undefined} backLabel={mode === "formations" ? t("choreo.formations") : t("team.choreo")} onBack={() => { setOpen(null); void load(); }} onChanged={() => void load()} toast={toast} />;
  return (
    <section className="screen">
      <button className="linklike" onClick={onBack}>‹ {t("team.myTeam")}</button>
      <header className="topbar"><h1 className="display">{mode === "formations" ? t("choreo.formations") : t("team.choreo")}</h1>{staff && mode === "choreo" && <button className="ghost small" onClick={() => setAdding(true)}>+ {t("choreo.upload")}</button>}</header>
      {mode === "formations" && <p className="small muted" style={{ marginTop: 0 }}>{t("choreo.formationsIntro")}</p>}
      <div className="card list">
        {shown.map((v) => <button key={v.id} className="item" onClick={() => setOpen(v)} data-testid="video"><span className="avatar small">▶</span><span className="grow">{v.title}<div className="tiny">{v.uploader_name} · {ago(v.created_at)}{v.formations.length ? ` · ${t("choreo.formationsN", { n: v.formations.length })}` : ""}</div></span><span className="gold">›</span></button>)}
        {!shown.length && <p className="muted">{mode === "formations" ? t("choreo.noFormations") : t("choreo.empty")}</p>}
      </div>
      <p className="tiny">{t("choreo.privacy")}</p>
      {adding && <UploadSheet teamId={teamId} onClose={() => setAdding(false)} onDone={() => { setAdding(false); void load(); }} toast={toast} />}
    </section>
  );
}

function UploadSheet({ teamId, onClose, onDone, toast }: { teamId: string; onClose: () => void; onDone: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [notes, setNotes] = useState("");
  return (
    <Sheet onClose={onClose} eyebrow={t("team.choreo")} title={t("choreo.upload")}>
      <label className="field"><span>{t("choreo.title")}</span><input id="video-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("choreo.titlePh")} /></label>
      <label className="field"><span>{t("choreo.file")}</span><input id="video-file" type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      <label className="field"><span>{t("choreo.notes")}</span><textarea id="video-notes" rows={3} value={notes} placeholder={t("choreo.notesPh")} onChange={(e) => setNotes(e.target.value)} /></label>
      <p className="tiny">{t("choreo.uploadHint")}</p>
      <button className="cta" disabled={busy || !title.trim() || !file} onClick={async () => { setBusy(true); try { await api.uploadVideo(teamId, title.trim(), file!, notes.trim() || null); toast(t("choreo.uploaded")); onDone(); } catch (e) { toast((e as Error).message); } finally { setBusy(false); } }}>{busy ? t("choreo.uploading") : t("choreo.uploadBtn")}</button>
    </Sheet>
  );
}

function VideoView({ video, teamId, staff, onBack, onChanged, toast, initialTab, backLabel }: { video: Video; teamId: string; staff: boolean; onBack: () => void; onChanged: () => void; toast: (m: string) => void; initialTab?: "video" | "formations"; backLabel?: string }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLVideoElement>(null);
  const [rate, setRate] = useState(1);
  const [mirror, setMirror] = useState(false);
  const [a, setA] = useState<number | null>(null);
  const [b, setB] = useState<number | null>(null);
  const [tab, setTab] = useState<"video" | "formations">(initialTab ?? (video.url ? "video" : "formations"));
  const [bpm, setBpm] = useState(120);
  useEffect(() => { if (ref.current) ref.current.playbackRate = rate; }, [rate]);
  const onTime = () => { const v = ref.current; if (v && a != null && b != null && b > a && (v.currentTime >= b || v.currentTime < a - 0.3)) { v.currentTime = a; if (v.paused) void v.play().catch(() => undefined); } };
  const eight = () => { const v = ref.current; if (!v) return; const s = Math.max(0, v.currentTime); const len = 8 * 60 / bpm; setA(s); setB(Math.min(v.duration || s + len, s + len)); v.currentTime = s; if (v.paused) void v.play().catch(() => undefined); };
  const cur = () => ref.current?.currentTime ?? 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return (
    <section className="screen">
      <button className="linklike" onClick={onBack}>‹ {backLabel ?? t("team.choreo")}</button>
      <header className="topbar"><h1 className="display">{video.title}</h1>{staff && <button className="ghost small danger" onClick={async () => { await api.deleteVideo(video.id); toast(t("feed.deleted")); onBack(); }}>{t("common.delete")}</button>}</header>
      <div className="chips" style={{ marginBottom: 10 }}>
        <button className={"chip" + (tab === "video" ? " on" : "")} onClick={() => setTab("video")}>{t("choreo.video")}</button>
        <button className={"chip" + (tab === "formations" ? " on" : "")} onClick={() => setTab("formations")}>{t("choreo.formations")}</button>
      </div>
      {tab === "video" && (video.url ? (
        <>
          <video ref={ref} src={video.url} controls playsInline className={"choreo-video" + (mirror ? " mirror" : "")} onTimeUpdate={onTime} onLoadedMetadata={() => { if (ref.current) ref.current.playbackRate = rate; }} />
          <div className="field"><span>{t("choreo.tempo")}</span><div className="chips">{[0.5, 0.75, 1].map((r) => <button key={r} className={"chip" + (rate === r ? " on" : "")} onClick={() => setRate(r)}>{r === 1 ? t("choreo.fullTempo") : `${r * 100} %`}</button>)}<button className={"chip" + (mirror ? " on" : "")} onClick={() => setMirror(!mirror)}>{t("choreo.mirror")}</button></div></div>
          <div className="field"><span>{t("choreo.loop")}</span><div className="chips">
            <button className={"chip" + (a != null ? " on" : "")} onClick={() => setA(cur())}>A {a != null ? fmt(a) : ""}</button>
            <button className={"chip" + (b != null ? " on" : "")} onClick={() => setB(cur())}>B {b != null ? fmt(b) : ""}</button>
            <button className="chip" onClick={eight}>{t("choreo.eightCount")}</button><select className="chip" value={bpm} onChange={(e) => setBpm(Number(e.target.value))} aria-label="BPM">{[90, 100, 110, 120, 128, 130, 140, 150].map((x) => <option key={x} value={x}>{x} BPM</option>)}</select>
            {(a != null || b != null) && <button className="chip" onClick={() => { setA(null); setB(null); }}>{t("choreo.clearLoop")}</button>}
          </div><p className="tiny">{t("choreo.loopHint")}</p></div>
        </>
      ) : <p className="muted">{t("choreo.noFile")}</p>)}
      <VideoNotes video={video} staff={staff} onChanged={onChanged} toast={toast} />
      {tab === "formations" && <Formations video={video} teamId={teamId} staff={staff} onChanged={onChanged} toast={toast} />}
    </section>
  );
}

function Formations({ video, teamId, staff, onChanged, toast }: { video: Video; teamId: string; staff: boolean; onChanged: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const [fs, setFs] = useState<Formation[]>(video.formations);
  const [i, setI] = useState(0);
  const [edit, setEdit] = useState(false);
  const [dancers, setDancers] = useState<string[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { setFs(video.formations); setI((x) => Math.min(x, Math.max(0, video.formations.length - 1))); }, [video]);
  useEffect(() => { if (!staff) return; void (async () => { const ms: Member[] = await api.listMembers(); setDancers(ms.filter((m) => m.memberships.some((x) => x.team_id === teamId && x.role === "dancer")).map((m) => (m.first_name[0] + (m.last_name[0] ?? "")).toUpperCase())); })(); }, [staff, teamId]);
  const f = fs[i];
  const place = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!edit || !sel || !f) return;
    const r = e.currentTarget.getBoundingClientRect(); const x = Math.round(((e.clientX - r.left) / r.width) * 100) / 100, y = Math.round(((e.clientY - r.top) / r.height) * 100) / 100;
    const next = fs.map((ff, j) => j !== i ? ff : { ...ff, positions: [...ff.positions.filter((p) => p.initials !== sel), { initials: sel, x, y }] }); setFs(next);
  };
  const save = async () => { await api.updateVideo(video.id, { formations: fs }); setEdit(false); toast(t("common.saved")); onChanged(); };
  const used = new Set(f?.positions.map((p) => p.initials));
  return (
    <div className="stack">
      {fs.length > 0 && <div className="chips">{fs.map((ff, j) => <button key={j} className={"chip" + (j === i ? " on" : "")} onClick={() => setI(j)}>{ff.label}</button>)}</div>}
      {f ? (
        <div className={"stage" + (edit ? " editing" : "")} onClick={place} data-testid="stage">
          <span className="stage-front">{t("choreo.front")}</span>
          {f.positions.map((p) => <span key={p.initials} className={"dot" + (sel === p.initials ? " sel" : "")} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} onClick={(e) => { if (edit) { e.stopPropagation(); setSel(p.initials); } }}>{p.initials}</span>)}
        </div>
      ) : <p className="muted">{t("choreo.noFormations")}</p>}
      {staff && !edit && <button className="ghost small" onClick={() => setEdit(true)}>{fs.length ? t("choreo.editFormations") : t("choreo.addFormation")}</button>}
      {staff && edit && (
        <div className="card" style={{ margin: 0 }}>
          <div className="row"><input placeholder={t("choreo.formationName")} value={f?.label ?? ""} onChange={(e) => setFs(fs.map((ff, j) => j === i ? { ...ff, label: e.target.value } : ff))} disabled={!f} />
            <button className="ghost small" onClick={() => { setFs([...fs, { label: `${t("choreo.formation")} ${fs.length + 1}`, positions: [] }]); setI(fs.length); }}>+ {t("choreo.formation")}</button>
            {f && <button className="ghost small danger" onClick={() => { const n = fs.filter((_, j) => j !== i); setFs(n); setI(Math.max(0, i - 1)); }}>×</button>}</div>
          <div className="eyebrow">{t("choreo.pickDancer")}</div>
          <div className="chips">{dancers.map((d) => <button key={d} className={"chip small" + (sel === d ? " on" : used.has(d) ? " ok" : "")} onClick={() => setSel(d)}>{d}</button>)}
            {sel && used.has(sel) && <button className="chip small warn" onClick={() => setFs(fs.map((ff, j) => j === i ? { ...ff, positions: ff.positions.filter((p) => p.initials !== sel) } : ff))}>{t("choreo.removeFromStage")}</button>}</div>
          <p className="tiny">{t("choreo.editHint")}</p>
          <div className="row"><button className="small" onClick={() => void save()}>{t("common.save")}</button><button className="ghost small" onClick={() => { setFs(video.formations); setEdit(false); }}>{t("common.cancel")}</button></div>
        </div>
      )}
    </div>
  );
}

/** Notes on this video – counts, cues, what to practise. Trainers write; dancers and parents read. */
function VideoNotes({ video, staff, onChanged, toast }: { video: Video; staff: boolean; onChanged: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const [edit, setEdit] = useState(false); const [text, setText] = useState(video.notes ?? "");
  useEffect(() => { setText(video.notes ?? ""); }, [video.id, video.notes]);
  const save = async () => { await api.updateVideo(video.id, { notes: text.trim() || null }); setEdit(false); toast(t("common.saved")); onChanged(); };
  if (!staff && !video.notes) return null;
  return (
    <div className="card" data-testid="video-notes"><div className="row between"><div className="eyebrow">{t("choreo.notes")}</div>{staff && !edit && <button className="linklike small" onClick={() => setEdit(true)}>{video.notes ? t("common.edit") : t("choreo.addNotes")}</button>}</div>
      {edit ? (<><textarea rows={4} value={text} placeholder={t("choreo.notesPh")} onChange={(e) => setText(e.target.value)} data-testid="video-notes-input" /><div className="row" style={{ gap: 8 }}><button className="cta small" onClick={() => void save()}>{t("common.save")}</button><button className="ghost small" onClick={() => { setEdit(false); setText(video.notes ?? ""); }}>{t("common.cancel")}</button></div></>)
        : <p className="small" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{video.notes}</p>}
    </div>
  );
}
