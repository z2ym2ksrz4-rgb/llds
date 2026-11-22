import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type AuditionCandidate, type AuditionStatus, type Event, type Team } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Sheet, Toast } from "../components/Sheet";
import { PaySheet } from "../components/Pay";
import { ScrollList } from "../components/ScrollList";
import { dateLabel, hm } from "../lib/time";
import { PlanChips, type Plan } from "./Payments";

const SCORE_KEYS = ["technique", "expression", "potential"] as const;
const total = (c: AuditionCandidate) => SCORE_KEYS.reduce((n, k) => n + (c.scores?.[k] ?? 0), 0);

/** Trainer/admin module for one audition team: brief (video + requirements + event) → send to applicants; score candidates 1–5 in the hall;
 *  decide (udtaget / venteliste / ikke denne gang) and send results. Built for a phone in the hall: big chips, sort by score. */
export function AuditionAdmin({ team, onBack, toast }: { team: Team; onBack: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const [cands, setCands] = useState<AuditionCandidate[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [video, setVideo] = useState(team.audition_video_url ?? "");
  const [text, setText] = useState(team.audition_text ?? "");
  const [eventId, setEventId] = useState(team.audition_event_id ?? "");
  const [sentAt, setSentAt] = useState(team.audition_sent_at ?? null);
  const [briefOpen, setBriefOpen] = useState(!team.audition_sent_at);
  const [open, setOpen] = useState<AuditionCandidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<"name" | "score">("name");
  const [confirmRound, setConfirmRound] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => { const [c, e] = await Promise.all([api.listAuditionCandidates(team.id), api.listEvents().catch(() => [] as Event[])]); setCands(c); setEvents(e); }, [team.id]);
  useEffect(() => { void load(); }, [load]);
  const saveBrief = async () => { await api.auditionSetBrief(team.id, video.trim() || null, text.trim() || null, eventId || null); toast(t("audition.briefSaved")); };
  const sendBrief = async () => { setBusy(true); try { await api.auditionSetBrief(team.id, video.trim() || null, text.trim() || null, eventId || null); const n = await api.auditionSendBrief(team.id); setSentAt(new Date().toISOString()); toast(t("audition.briefSent", { n })); setBriefOpen(false); await load(); } finally { setBusy(false); } };
  const sendResults = async () => { setBusy(true); try { const n = await api.auditionSendResults(team.id); toast(t("audition.resultsSent", { n })); await load(); } finally { setBusy(false); } };
  const upload = async (f: File | null) => { if (!f) return; setBusy(true); try { setVideo(await api.uploadAuditionVideo(team.id, f)); toast(t("audition.videoUploaded")); } finally { setBusy(false); } };
  const counts = (st: AuditionStatus) => cands.filter((c) => c.status === st).length;
  const pendingResults = cands.filter((c) => ["selected", "waitlist", "declined"].includes(c.status) && !c.results_sent_at).length;
  const list = [...cands].sort((a, b) => sort === "score" ? total(b) - total(a) : a.person_name.localeCompare(b.person_name));
  const ev = events.find((e) => e.id === eventId);
  return (
    <section className="screen" data-testid="audition-admin">
      <button className="linklike" onClick={onBack}>‹ {team.name}</button>
      <header className="topbar"><h1 className="display">{t("audition.title")}</h1></header>
      <p className="muted small">{t("audition.adminIntro")}</p>

      <div className="sec"><div className="row between"><h2>{t("audition.brief")}</h2><button className="linklike small" onClick={() => setBriefOpen((o) => !o)}>{briefOpen ? t("common.close") : t("common.edit")}</button></div>
        {!briefOpen && <div className="card"><div className="small">{text ? text.slice(0, 160) + (text.length > 160 ? "…" : "") : <span className="muted">{t("audition.noBrief")}</span>}</div><div className="tiny" style={{ marginTop: 6 }}>{video ? "🎬 " + t("audition.videoSet") : t("audition.noVideo")}{ev ? ` · ${dateLabel(ev.starts_at)} ${hm(ev.starts_at)}` : ""}{sentAt ? ` · ${t("audition.sentAt", { when: dateLabel(sentAt) })}` : ""}</div></div>}
        {briefOpen && (
          <div className="card">
            <label className="field"><span>{t("audition.text")}</span><textarea rows={6} value={text} placeholder={t("audition.textPh")} data-testid="audition-text" onChange={(e) => setText(e.target.value)} /></label>
            <div className="field"><span>{t("audition.video")}</span>
              <div className="row" style={{ gap: 8 }}><button type="button" className="ghost small" disabled={busy} onClick={() => fileRef.current?.click()} data-testid="audition-upload">{busy ? "…" : t("audition.uploadVideo")}</button><span className="tiny muted">{t("audition.or")}</span></div>
              <input type="url" placeholder="https://…" value={video} data-testid="audition-video" onChange={(e) => setVideo(e.target.value)} />
              <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => { void upload(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              {video && <video src={video} controls playsInline style={{ width: "100%", borderRadius: 12, marginTop: 8, background: "#000" }} />}
            </div>
            <label className="field"><span>{t("audition.event")}</span>
              <select value={eventId} data-testid="audition-event" onChange={(e) => setEventId(e.target.value)}><option value="">{t("audition.noEvent")}</option>{events.map((e) => <option key={e.id} value={e.id}>{dateLabel(e.starts_at)} · {e.title}</option>)}</select>
              <div className="tiny muted">{t("audition.eventHint")}</div></label>
            <div className="row" style={{ gap: 8 }}>
              <button className="ghost grow" onClick={() => void saveBrief()}>{t("common.save")}</button>
              <button className="cta grow" disabled={busy || !(text.trim() || video.trim())} data-testid="audition-send-brief" onClick={() => void sendBrief()}>{t(sentAt ? "audition.sendBriefAgain" : "audition.sendBrief", { n: counts("applied") + counts("invited") })}</button>
            </div>
          </div>
        )}
      </div>

      <div className="sec"><div className="row between"><h2>{t("audition.candidates")} · {cands.length}</h2>
          <div className="seg2"><button className={sort === "name" ? "on" : ""} onClick={() => setSort("name")}>{t("audition.sortName")}</button><button className={sort === "score" ? "on" : ""} onClick={() => setSort("score")}>{t("audition.sortScore")}</button></div></div>
        <p className="tiny muted" style={{ marginTop: 0 }}>{t("audition.counts", { applied: counts("applied") + counts("invited"), selected: counts("selected"), waitlist: counts("waitlist"), declined: counts("declined"), accepted: counts("accepted") })}</p>
        <div className="card list" data-testid="audition-list">
          {list.map((c) => <button key={c.id} className="item" onClick={() => setOpen(c)} data-testid="audition-cand"><span className="avatar">{c.person_name[0]}</span>
            <span className="grow">{c.person_name}{c.birth_year ? <span className="tiny"> · {c.birth_year}</span> : null}<div className="tiny">{total(c) ? `${total(c)}/15 · ` : ""}{c.note ? c.note.slice(0, 40) : ""}</div></span>
            <span className={"chip small " + (c.status === "selected" || c.status === "accepted" ? "ok" : c.status === "declined" || c.status === "withdrawn" ? "" : c.status === "waitlist" ? "pend" : "warn")}>{t(`audition.status.${c.status}`)}</span></button>)}
          {!cands.length && <p className="muted">{t("audition.noCandidates")}</p>}
        </div>
        <button className="cta" style={{ marginTop: 10 }} disabled={busy || !pendingResults} data-testid="audition-send-results" onClick={() => void sendResults()}>{t("audition.sendResults", { n: pendingResults })}</button>
        <p className="tiny muted">{t("audition.sendResultsHint")}</p>
      </div>

      <div className="sec"><h2>{t("audition.newRound")}</h2>
        <p className="tiny muted" style={{ marginTop: 0 }}>{t("audition.newRoundHint")}</p>
        {!confirmRound ? <button className="ghost" data-testid="audition-new-round" onClick={() => setConfirmRound(true)}>{t("audition.newRoundBtn")}</button>
          : <div className="card" style={{ borderColor: "#7a3b3b" }}><strong>{t("audition.newRoundSure", { n: cands.length })}</strong><div className="row" style={{ gap: 8, marginTop: 8 }}><button className="ghost danger small" data-testid="audition-new-round-yes" onClick={async () => { setBusy(true); try { await api.auditionNewRound(team.id); setVideo(""); setText(""); setEventId(""); setSentAt(null); setBriefOpen(true); setConfirmRound(false); toast(t("audition.newRoundDone")); await load(); } finally { setBusy(false); } }}>{t("audition.newRoundBtn")}</button><button className="ghost small" onClick={() => setConfirmRound(false)}>{t("common.cancel")}</button></div></div>}
      </div>

      {open && <CandidateSheet cand={open} onClose={() => setOpen(null)} onSaved={async () => { await load(); }} />}
    </section>
  );
}

function CandidateSheet({ cand, onClose, onSaved }: { cand: AuditionCandidate; onClose: () => void; onSaved: () => Promise<void> }) {
  const { t } = useTranslation();
  const [scores, setScores] = useState<Record<string, number>>({ ...(cand.scores ?? {}) });
  const [note, setNote] = useState(cand.note ?? "");
  const [status, setStatus] = useState<AuditionStatus>(cand.status);
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); try { await api.auditionDecide(cand.id, status !== cand.status ? status : null, scores, note); await onSaved(); onClose(); } finally { setBusy(false); } };
  const sum = SCORE_KEYS.reduce((n, k) => n + (scores[k] ?? 0), 0);
  return (
    <Sheet onClose={onClose} eyebrow={cand.team_name} title={cand.person_name}>
      {SCORE_KEYS.map((k) => <div key={k} className="field"><span>{t(`audition.score.${k}`)}</span>
        <div className="chips" data-testid={`score-${k}`}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={"chip" + (scores[k] === n ? " on" : "")} style={{ minWidth: 44, justifyContent: "center" }} onClick={() => setScores({ ...scores, [k]: scores[k] === n ? 0 : n })}>{n}</button>)}</div></div>)}
      <div className="tiny">{t("audition.total", { n: sum })}</div>
      <label className="field"><span>{t("audition.note")}</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("audition.notePh")} /></label>
      <div className="field"><span>{t("audition.decision")}</span>
        <div className="chips" data-testid="audition-decision">{(["selected", "waitlist", "declined"] as AuditionStatus[]).map((s) => <button key={s} type="button" className={"chip" + (status === s ? " on" : "")} onClick={() => setStatus(s)}>{t(`audition.status.${s}`)}</button>)}
          {["applied", "invited"].includes(status) ? null : <button type="button" className="chip" onClick={() => setStatus(cand.audition_sent_at ? "invited" : "applied")}>{t("audition.undecided")}</button>}</div>
        <div className="tiny muted">{t("audition.decisionHint")}</div></div>
      <button className="cta" disabled={busy} data-testid="audition-save" onClick={() => void save()}>{t("common.save")}</button>
    </Sheet>
  );
}

/** Home → "Audition": the person's (and children's) candidacies – status, the brief (video + requirements), the date, and Accept/Decline when selected. */
export function AuditionCards() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const [cands, setCands] = useState<AuditionCandidate[]>([]);
  const [accepting, setAccepting] = useState<AuditionCandidate | null>(null);
  const [plan, setPlan] = useState<Plan>("full");
  const [pay, setPay] = useState<{ id: string; reference: string; amount: number; title: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const [teams, setTeams] = useState<Team[]>([]);
  const load = useCallback(async () => { setCands((await api.listAuditionCandidates().catch(() => [])).filter((c) => c.status !== "withdrawn")); }, []);
  useEffect(() => { void load(); const f = () => void load(); addEventListener("llds:audition", f); return () => removeEventListener("llds:audition", f); }, [load]);
  useEffect(() => { if (accepting) void api.listTeams().then(setTeams); }, [accepting]);
  if (!cands.length) return null;
  const who = (pid: string) => (pid === me.person.id ? null : me.children.find((c) => c.id === pid)?.first_name ?? null);
  const respond = async (c: AuditionCandidate, accept: boolean) => {
    const r = await api.auditionRespond(c.id, accept, plan);
    if (!accept) { say(t("audition.declinedToast")); setAccepting(null); await load(); return; }
    if (r.id && r.amount_dkk != null) setPay({ id: r.id, reference: (r.installments ?? 1) > 1 ? `${r.reference} rate 1/${r.installments}` : r.reference!, amount: (r.installments ?? 1) > 1 ? r.per_rate_dkk ?? r.amount_dkk : r.amount_dkk, title: r.team ?? c.team_name });
    else say(t("audition.acceptedToast"));
    setAccepting(null); await load();
  };
  const team = accepting ? teams.find((x) => x.id === accepting.team_id) : null;
  return (
    <div className="sec" data-testid="audition-cards"><h2>{t("audition.title")}</h2>
      <ScrollList>
        {cands.map((c) => (
          <div key={c.id} className="item" style={{ alignItems: "flex-start", flexDirection: "column", gap: 6 }} data-testid="audition-card">
            <div className="row between" style={{ width: "100%" }}><strong>{c.team_name}{who(c.person_id) ? <span className="chip small" style={{ marginLeft: 6 }}>{who(c.person_id)}</span> : null}</strong>
              <span className={"chip small " + (c.status === "selected" || c.status === "accepted" ? "ok" : c.status === "declined" ? "" : c.status === "waitlist" ? "pend" : "warn")}>{t(`audition.mine.${c.status}`)}</span></div>
            <div className="small muted">{t(`audition.mineBody.${c.status}`)}</div>
            {c.audition_sent_at && (c.status === "invited" || c.status === "selected" || c.status === "waitlist") && (<>
              {c.audition_at && <div className="small">📅 {dateLabel(c.audition_at)} {hm(c.audition_at)}{c.audition_place ? ` · ${c.audition_place}` : ""}</div>}
              {c.audition_text && <div className="small" style={{ whiteSpace: "pre-wrap" }}>{c.audition_text}</div>}
              {c.audition_video_url && <video src={c.audition_video_url} controls playsInline preload="metadata" style={{ width: "100%", borderRadius: 12, background: "#000" }} data-testid="audition-brief-video" />}
            </>)}
            {c.status === "selected" && <div className="row" style={{ gap: 8 }}><button className="cta small" data-testid="audition-accept" onClick={() => setAccepting(c)}>{t("audition.accept")}</button><button className="ghost small" onClick={() => void respond(c, false)}>{t("audition.decline")}</button></div>}
          </div>))}
      </ScrollList>
      {accepting && team && (
        <Sheet onClose={() => setAccepting(null)} eyebrow={t("audition.acceptEyebrow")} title={team.name}>
          <p className="small" style={{ margin: 0 }}>{t("audition.acceptIntro", { name: accepting.person_name })}</p>
          {team.price_full ? <div className="field"><span>{t("pay.planLabel")}</span><PlanChips team={team} plan={plan} setPlan={setPlan} /></div> : <p className="small muted">{team.price_note}</p>}
          <button className="cta" data-testid="audition-accept-confirm" onClick={() => void respond(accepting, true)}>{t("audition.acceptConfirm")}</button>
        </Sheet>
      )}
      {pay && <PaySheet amount={pay.amount} reference={pay.reference} title={pay.title} onClose={() => setPay(null)} onPaid={async () => { await api.claimPaymentPaid(pay.id); say(t("pay.claimed")); setPay(null); }} />}
      <Toast msg={toast} />
    </div>
  );
}
