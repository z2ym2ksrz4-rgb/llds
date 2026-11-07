import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type FormationSet, type Frame, type Spot, type TeamDancer } from "@/core/api";
import { Sheet } from "../components/Sheet";

/** Formation tool: a plan per dance with a series of frames; each frame shows where every dancer stands (dot with initials).
 * Trainers drag dots, add frames, label them with the count/time; the team plays the sequence. Saves automatically. */
const uid = () => Math.random().toString(36).slice(2, 9);
const COLORS = ["#e6c87a", "#8fb4ff", "#ff9ab0", "#9be7b5", "#ffb86b", "#c9a2ff", "#7fe0e0", "#f4f1ea"];
const colorOf = (key: string) => { let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };

export function Formations({ teamId, teamName, staff, onBack, toast }: { teamId: string; teamName: string; staff: boolean; onBack: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const [sets, setSets] = useState<FormationSet[]>([]);
  const [open, setOpen] = useState<FormationSet | null>(null);
  const [naming, setNaming] = useState(false); const [title, setTitle] = useState("");
  const load = useCallback(async () => { const s = await api.listFormationSets(teamId); setSets(s); setOpen((o) => (o ? s.find((x) => x.id === o.id) ?? null : null)); }, [teamId]);
  useEffect(() => { void load(); }, [load]);
  if (open) return <FormationEditor set={open} teamId={teamId} staff={staff} onBack={() => { setOpen(null); void load(); }} toast={toast} />;
  return (
    <section className="screen">
      <button className="linklike" onClick={onBack}>‹ {teamName}</button>
      <header className="topbar"><h1 className="display">{t("form.title")}</h1>{staff && <button className="ghost small" data-testid="form-new" onClick={() => { setTitle(""); setNaming(true); }}>+ {t("form.new")}</button>}</header>
      <p className="small muted" style={{ marginTop: 0 }}>{staff ? t("form.introStaff") : t("form.intro")}</p>
      <div className="card list">
        {sets.map((s) => <button key={s.id} className="item" onClick={() => setOpen(s)} data-testid="form-set"><span className="avatar small">◆</span><span className="grow">{s.title}<div className="tiny">{t("form.framesN", { n: s.frames.length })} · {new Date(s.updated_at).toLocaleDateString("da-DK")}</div></span><span className="gold">›</span></button>)}
        {!sets.length && <p className="muted">{t("form.empty")}</p>}
      </div>
      {naming && (
        <Sheet onClose={() => setNaming(false)} eyebrow={teamName} title={t("form.new")}>
          <label className="field"><span>{t("form.name")}</span><input value={title} placeholder={t("form.namePh")} onChange={(e) => setTitle(e.target.value)} data-testid="form-title" autoFocus /></label>
          <button className="cta" disabled={!title.trim()} data-testid="form-create" onClick={async () => { const s = await api.createFormationSet(teamId, title.trim()); setNaming(false); await load(); setOpen(s); }}>{t("common.create")}</button>
        </Sheet>
      )}
    </section>
  );
}

function FormationEditor({ set, teamId, staff, onBack, toast }: { set: FormationSet; teamId: string; staff: boolean; onBack: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const [frames, setFrames] = useState<Frame[]>(set.frames.length ? set.frames : []);
  const [i, setI] = useState(0);
  const [dancers, setDancers] = useState<TeamDancer[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [editLabel, setEditLabel] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<number>(0);
  const dirty = useRef(false);
  useEffect(() => { void api.teamDancers(teamId).then(setDancers).catch(() => setDancers([])); }, [teamId]);
  const frame = frames[i];
  const custom = (label: string, name: string): Spot => ({ key: "c-" + uid(), label, name, x: 0.5, y: 0.5 });

  // autosave (debounced) – staff only
  const commit = (next: Frame[]) => { setFrames(next); if (!staff) return; dirty.current = true; window.clearTimeout(saveTimer.current); saveTimer.current = window.setTimeout(() => { void api.saveFormationSet(set.id, { frames: next }).then(() => { dirty.current = false; }).catch((e) => toast((e as Error).message)); }, 600); };
  useEffect(() => () => { if (dirty.current && staff) void api.saveFormationSet(set.id, { frames }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addFrame = () => { const base = frame ? frame.positions.map((p) => ({ ...p })) : dancers.slice(0, 12).map((d, k) => ({ key: d.person_id, label: d.initials, name: d.name, x: 0.15 + (k % 4) * 0.23, y: 0.3 + Math.floor(k / 4) * 0.25 })); const f: Frame = { id: uid(), label: t("form.frameN", { n: frames.length + 1 }), at: null, positions: base }; const next = [...frames.slice(0, i + 1), f, ...frames.slice(i + 1)]; commit(next); setI(frames.length ? i + 1 : 0); };
  const delFrame = () => { if (!frame) return; const next = frames.filter((_, k) => k !== i); commit(next); setI(Math.max(0, i - 1)); };
  const moveFrame = (d: -1 | 1) => { const j = i + d; if (j < 0 || j >= frames.length) return; const next = [...frames]; [next[i], next[j]] = [next[j], next[i]]; commit(next); setI(j); };
  const updFrame = (patch: Partial<Frame>) => commit(frames.map((f, k) => (k === i ? { ...f, ...patch } : f)));
  const setPos = (key: string, x: number, y: number) => updFrame({ positions: frame.positions.map((p) => (p.key === key ? { ...p, x: Math.min(0.97, Math.max(0.03, x)), y: Math.min(0.95, Math.max(0.05, y)) } : p)) });
  const addDancer = (d: TeamDancer) => { if (!frame) return; if (frame.positions.some((p) => p.key === d.person_id)) { setSel(d.person_id); return; } updFrame({ positions: [...frame.positions, { key: d.person_id, label: d.initials, name: d.name, x: 0.5, y: 0.5 }] }); setSel(d.person_id); };
  const removeSel = () => { if (!sel || !frame) return; updFrame({ positions: frame.positions.filter((p) => p.key !== sel) }); setSel(null); };

  // drag with pointer events (touch + mouse)
  const drag = useRef<{ key: string } | null>(null);
  const toXY = (e: React.PointerEvent) => { const r = stage.current!.getBoundingClientRect(); let x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height; if (mirror) x = 1 - x; return { x, y }; };
  const onDown = (e: React.PointerEvent, key: string) => { if (!staff || playing) return; e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { key }; setSel(key); };
  const onMove = (e: React.PointerEvent) => { if (!drag.current) return; const { x, y } = toXY(e); setPos(drag.current.key, x, y); };
  const onUp = () => { drag.current = null; };

  // playback: step through frames; CSS transition animates the dots
  useEffect(() => { if (!playing) return; const tm = setInterval(() => setI((k) => (k + 1) % Math.max(1, frames.length)), 1800); return () => clearInterval(tm); }, [playing, frames.length]);

  const fmtAt = frame?.at ? ` · ${frame.at}` : "";
  return (
    <section className="screen formations">
      <button className="linklike" onClick={onBack}>‹ {t("form.title")}</button>
      <header className="topbar"><h1 className="display">{set.title}</h1>
        <div className="row" style={{ gap: 6 }}>
          <button className={"ghost small" + (mirror ? " on" : "")} onClick={() => setMirror(!mirror)} title={t("form.mirrorHint")}>{mirror ? t("form.viewAudience") : t("form.viewDancer")}</button>
          {frames.length > 1 && <button className={"small" + (playing ? " on" : "")} data-testid="form-play" onClick={() => setPlaying(!playing)}>{playing ? "■ " + t("form.stop") : "▶ " + t("form.play")}</button>}
        </div>
      </header>

      {frame ? (
        <>
          <div className="row between" style={{ marginBottom: 6 }}>
            {editLabel && staff ? (
              <div className="row" style={{ gap: 6, flex: 1 }}><input value={frame.label} onChange={(e) => updFrame({ label: e.target.value })} data-testid="frame-label" /><input value={frame.at ?? ""} placeholder={t("form.atPh")} style={{ maxWidth: 110 }} onChange={(e) => updFrame({ at: e.target.value || null })} data-testid="frame-at" /><button className="small" onClick={() => setEditLabel(false)}>{t("common.ok")}</button></div>
            ) : (
              <button className="linklike-none frame-title" onClick={() => staff && setEditLabel(true)} data-testid="frame-title"><span className="eyebrow">{t("form.frameOf", { i: i + 1, n: frames.length })}</span><strong>{frame.label}{fmtAt}</strong></button>
            )}
          </div>
          <div ref={stage} className={"fstage" + (staff ? " editing" : "") + (mirror ? " mirror" : "")} data-testid="fstage" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={(e) => { if (e.target === stage.current) setSel(null); }}>
            <div className="grid" aria-hidden="true" />
            <div className="fback">{t("form.back")}</div><div className="ffront">{t("form.front")}</div>
            {frame.positions.map((p) => (
              <div key={p.key} className={"fdot" + (sel === p.key ? " sel" : "")} style={{ left: `${(mirror ? 1 - p.x : p.x) * 100}%`, top: `${p.y * 100}%`, background: colorOf(p.key) }} title={p.name} data-testid="fdot" onPointerDown={(e) => onDown(e, p.key)} onClick={(e) => { e.stopPropagation(); setSel(p.key); }}>{p.label}</div>
            ))}
          </div>
          {sel && frame.positions.find((p) => p.key === sel) && <div className="row between small" style={{ marginTop: 6 }}><span><span className="fdot inline" style={{ background: colorOf(sel) }}>{frame.positions.find((p) => p.key === sel)!.label}</span> {frame.positions.find((p) => p.key === sel)!.name}</span>{staff && <button className="linklike small danger" onClick={removeSel}>{t("form.removeFromFrame")}</button>}</div>}
        </>
      ) : (
        <div className="card"><p className="muted" style={{ margin: 0 }}>{staff ? t("form.noFramesStaff") : t("form.noFrames")}</p></div>
      )}

      {/* frame strip */}
      <div className="fstrip" data-testid="fstrip">
        {frames.map((f, k) => (
          <button key={f.id} className={"fthumb" + (k === i ? " on" : "")} onClick={() => { setI(k); setPlaying(false); }} data-testid="fthumb">
            <div className="mini">{f.positions.map((p) => <i key={p.key} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, background: colorOf(p.key) }} />)}</div>
            <span>{k + 1}</span>
          </button>
        ))}
        {staff && <button className="fthumb add" onClick={addFrame} data-testid="frame-add"><div className="mini">+</div><span>{t("form.addFrame")}</span></button>}
      </div>
      {staff && frame && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <button className="ghost small" onClick={() => moveFrame(-1)} disabled={i === 0}>← {t("form.moveFrame")}</button>
          <button className="ghost small" onClick={() => moveFrame(1)} disabled={i >= frames.length - 1}>{t("form.moveFrame")} →</button>
          <button className="ghost small" onClick={() => { const f: Frame = { ...frame, id: uid(), label: frame.label + " ✦", positions: frame.positions.map((p) => ({ ...p })) }; commit([...frames.slice(0, i + 1), f, ...frames.slice(i + 1)]); setI(i + 1); }}>{t("form.duplicate")}</button>
          <button className="ghost small danger" onClick={delFrame} data-testid="frame-del">{t("form.deleteFrame")}</button>
        </div>
      )}

      {staff && frame && (
        <div className="sec"><h2>{t("form.dancers")}</h2>
          <div className="chips" data-testid="form-roster">
            {dancers.map((d) => { const onStage = frame.positions.some((p) => p.key === d.person_id); return <button key={d.person_id} className={"chip" + (onStage ? " on" : "")} onClick={() => addDancer(d)} data-testid="form-dancer"><span className="fdot inline" style={{ background: colorOf(d.person_id) }}>{d.initials}</span> {d.name.split(" ")[0]}</button>; })}
            <button className="chip" onClick={() => { const label = prompt(t("form.customLabel")); if (label) { const s = custom(label.slice(0, 3).toUpperCase(), label); updFrame({ positions: [...frame.positions, s] }); setSel(s.key); } }}>+ {t("form.custom")}</button>
          </div>
          <p className="tiny">{t("form.hint")}</p>
        </div>
      )}
      {staff && <button className="linklike small danger" style={{ alignSelf: "flex-start", marginTop: 10 }} onClick={async () => { if (confirm(t("form.deleteSetSure", { title: set.title }))) { await api.deleteFormationSet(set.id); onBack(); } }}>{t("form.deleteSet")}</button>}
    </section>
  );
}
