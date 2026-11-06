import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Member, type Absence, type Person, type Session, type Team, type Room } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Sheet } from "./Sheet";
import { dateLabel, hm, SEASON_END, isoDate } from "../lib/time";

const REASONS = ["sick", "school", "injury", "holiday", "other"] as const;

/** One training, with everything a dancer/parent/trainer/admin can do with it. */
export function SessionSheet({ session, absences, onClose, onChanged, toast }: { session: Session; absences: Absence[]; onClose: () => void; onChanged: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const viewing = useAuth((s) => s.viewing)!;
  const isAdmin = useAuth((s) => s.isAdmin)();
  const staffOf = me.person.is_admin || (session.team_id != null && me.memberships.some((m) => m.person_id === me.person.id && m.team_id === session.team_id && m.role !== "dancer"));
  const trainerOf = me.person.is_admin || (session.team_id != null && me.memberships.some((m) => m.person_id === me.person.id && m.team_id === session.team_id && m.role === "trainer"));
  const isSub = session.substitute_id === me.person.id;
  const canAttend = staffOf || isSub;
  const isStaffAnywhere = me.person.is_admin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer");
  const dancerHere = session.team_id != null && me.memberships.some((m) => m.person_id === viewing.personId && m.team_id === session.team_id && m.role === "dancer");
  const myAbsence = absences.find((a) => a.session_id === session.id && a.person_id === viewing.personId);
  const [mode, setMode] = useState<"view" | "absence" | "edit" | "cancel" | "attendance" | "plan">("view");
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const hatName = viewing.isChild ? me.children.find((c) => c.id === viewing.personId)?.first_name : null;
  const past = new Date(session.ends_at) < new Date();

  const sendAbsence = async () => { setBusy(true); try { await api.reportAbsence(session.id, viewing.personId, reason || null, note || null); toast(t("session.absenceSent", { trainer: session.trainer_name ?? "" })); onChanged(); onClose(); } finally { setBusy(false); } };
  const withdraw = async () => { setBusy(true); try { await api.withdrawAbsence(session.id, viewing.personId); toast(t("session.absenceWithdrawn")); onChanged(); onClose(); } finally { setBusy(false); } };
  const wantSub = async () => { await api.updateSession(session.id, { substitute_wanted: true }); toast(t("session.subRequested")); onChanged(); onClose(); };
  const takeSub = async () => { await api.updateSession(session.id, { substitute_id: me.person.id, substitute_wanted: false }); toast(t("session.subTaken")); onChanged(); onClose(); };
  const markRead = async () => { await api.updateSession(session.id, { lesson_plan_read_at: new Date().toISOString() }); onChanged(); };

  if (mode === "edit") return <SessionEditor session={session} onClose={() => setMode("view")} onSaved={() => { onChanged(); onClose(); }} toast={toast} />;
  if (mode === "attendance") return <AttendanceSheet session={session} onClose={() => { onChanged(); onClose(); }} toast={toast} />;

  return (
    <Sheet onClose={onClose} eyebrow={session.cancelled ? t("session.cancelled") : t("session.training")} title={session.title ?? session.team_name ?? ""}>
      <div className="chips">
        <span className="chip">{dateLabel(session.starts_at)} {hm(session.starts_at)}–{hm(session.ends_at)}</span>
        {session.room_name && <span className="chip">{session.room_name}</span>}
        {session.substitute_name ? <span className="chip gold">{t("session.sub")}: {session.substitute_name}</span> : session.trainer_name && <span className="chip">{session.trainer_name}</span>}{session.assistant_name && <span className="chip">{t("roles.assistant")}: {session.assistant_name}</span>}
        {session.substitute_wanted && !session.substitute_id && <span className="chip warn">{t("session.subWanted")}</span>}
      </div>
      {session.cancelled && session.cancel_note && <p className="small muted">{session.cancel_note}</p>}

      {/* lesson plan (vikar-overlevering) */}
      {canAttend && (mode === "plan" ? (
        <LessonPlan session={session} onClose={() => setMode("view")} onSaved={() => { onChanged(); setMode("view"); }} />
      ) : (
        <div className="card" style={{ margin: 0 }}>
          <div className="row between"><span className="eyebrow">{t("session.plan")}</span>{trainerOf && <button className="linklike" onClick={() => setMode("plan")}>{session.lesson_plan ? t("common.edit") : t("session.writePlan")}</button>}</div>
          {session.lesson_plan ? <p className="small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{session.lesson_plan}</p> : <p className="tiny" style={{ margin: 0 }}>{t("session.noPlan")}</p>}
          {isSub && session.lesson_plan && !session.lesson_plan_read_at && <button className="ghost small" onClick={() => void markRead()}>{t("session.markRead")}</button>}
          {session.lesson_plan_read_at && <span className="tiny">{t("session.planRead")}</span>}
        </div>
      ))}

      {/* absence */}
      {dancerHere && !session.cancelled && !past && mode === "view" && (myAbsence
        ? <div className="row between"><span className="chip warn">{t("session.absenceSentChip")}{myAbsence.reason ? ` · ${t(`absence.${myAbsence.reason}`)}` : ""}</span><button className="linklike" onClick={() => void withdraw()}>{t("session.withdraw")}</button></div>
        : <button className="ghost" onClick={() => setMode("absence")}>{hatName ? t("session.reportAbsenceFor", { name: hatName }) : t("session.reportAbsence")}</button>)}
      {mode === "absence" && (
        <div className="stack">
          <div className="field"><span>{t("session.reason")}</span><div className="chips">{REASONS.map((r) => <button key={r} className={"chip" + (reason === r ? " on" : "")} onClick={() => setReason(r)}>{t(`absence.${r}`)}</button>)}</div></div>
          <label className="field"><span>{t("session.noteToTrainer")}</span><textarea id="absNote" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <p className="tiny">{viewing.isChild ? t("session.absenceCopyChild") : t("session.absenceCopyParent")}</p>
          <button className="cta" disabled={busy} onClick={() => void sendAbsence()}>{t("session.sendAbsence")}</button>
        </div>
      )}

      {/* staff actions */}
      {mode === "view" && canAttend && !session.cancelled && <button className="ghost" onClick={() => setMode("attendance")}>{t("session.attendance")}</button>}
      {mode === "view" && trainerOf && !session.cancelled && !past && (
        <div className="row">
          <button className="ghost grow" onClick={() => setMode("edit")}>{t("common.edit")}</button>
          {!session.substitute_id && !session.substitute_wanted && <button className="ghost grow" onClick={() => void wantSub()}>{t("session.askSub")}</button>}
          <button className="ghost danger" onClick={() => setMode("cancel")}>{t("session.cancel")}</button>
        </div>
      )}
      {mode === "view" && isStaffAnywhere && session.substitute_wanted && !session.substitute_id && session.trainer_id !== me.person.id && (
        <button className="cta" onClick={() => void takeSub()}>{t("session.takeSub")}</button>
      )}
      {mode === "cancel" && (
        <div className="stack">
          <p className="small muted">{t("session.cancelInfo", { room: session.room_name ?? "" })}</p>
          <textarea id="cancelNote" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("session.cancelPh")} />
          <button className="cta" onClick={async () => { await api.updateSession(session.id, { cancelled: true, cancel_note: note || null }); toast(t("session.cancelledToast")); onChanged(); onClose(); }}>{t("session.cancelConfirm")}</button>
          <button className="linklike" onClick={() => setMode("view")}>{t("common.back")}</button>
        </div>
      )}
      {mode === "view" && isAdmin && session.cancelled && <button className="ghost" onClick={async () => { await api.updateSession(session.id, { cancelled: false, cancel_note: null }); onChanged(); onClose(); }}>{t("session.uncancel")}</button>}
    </Sheet>
  );
}

function LessonPlan({ session, onClose, onSaved }: { session: Session; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState(session.lesson_plan ?? "");
  return (
    <div className="stack">
      <div className="eyebrow">{t("session.plan")}</div>
      <textarea id="plan" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("session.planPh")} />
      <div className="row"><button className="cta grow" onClick={async () => { await api.updateSession(session.id, { lesson_plan: text || null, lesson_plan_read_at: null }); onSaved(); }}>{t("common.save")}</button><button className="ghost" onClick={onClose}>{t("common.cancel")}</button></div>
    </div>
  );
}

/** Attendance list for one session: roster of the team's dancers, absences marked, tap to toggle. */
export function AttendanceSheet({ session, onClose, toast }: { session: Session; onClose: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.roster>> | null>(null);
  const [state, setState] = useState<Record<string, boolean>>({});
  useEffect(() => { void api.roster(session.id).then((r) => { setRows(r); setState(Object.fromEntries(r.map((x) => [x.person_id, x.present ?? !x.absence]))); }); }, [session.id]);
  const present = Object.values(state).filter(Boolean).length;
  return (
    <Sheet onClose={onClose} eyebrow={t("session.attendance")} title={session.team_name ?? ""}>
      <div className="small muted">{dateLabel(session.starts_at)} {hm(session.starts_at)} · {present}/{rows?.length ?? 0} {t("session.present")}</div>
      <div className="list">
        {rows?.map((r) => (
          <button key={r.person_id} className="item" onClick={() => setState({ ...state, [r.person_id]: !state[r.person_id] })}>
            <span className={"check" + (state[r.person_id] ? " on" : "")}>{state[r.person_id] ? "✓" : ""}</span>
            <span className="grow">{r.name}{r.absence && <span className="chip warn small" style={{ marginLeft: 8 }}>{t("session.absenceSentChip")}{r.absence.reason ? `: ${t(`absence.${r.absence.reason}`)}` : ""}</span>}{r.via_punch && <span className="chip small" style={{ marginLeft: 8 }}>{t("session.punch")}</span>}</span>
          </button>
        ))}
        {rows && !rows.length && <p className="muted">{t("session.noRoster")}</p>}
      </div>
      <button className="cta" disabled={!rows} onClick={async () => { await api.saveAttendance(session.id, Object.entries(state).map(([person_id, present]) => ({ person_id, present }))); toast(t("session.attendanceSaved")); onClose(); }}>{t("session.saveAttendance")}</button>
    </Sheet>
  );
}

/** Create/edit a training. Admin and trainers of the team. Repeat weekly generates the whole season. */
export function SessionEditor({ session, defaults, onClose, onSaved, toast }: { session?: Session; defaults?: { date: Date; room_id: string; start: string }; onClose: () => void; onSaved: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const isAdmin = me.person.is_admin;
  const [teams, setTeams] = useState<Team[]>([]); const [rooms, setRooms] = useState<Room[]>([]); const [staff, setStaff] = useState<Person[]>([]); const [members, setMembers] = useState<Member[]>([]);
  const myTrainerTeams = me.memberships.filter((m) => m.person_id === me.person.id && m.role === "trainer").map((m) => m.team_id);
  const s0 = session ? new Date(session.starts_at) : defaults!.date;
  const [f, setF] = useState({
    team_id: session?.team_id ?? "", room_id: session?.room_id ?? defaults?.room_id ?? "", title: session?.title ?? "",
    date: isoDate(s0), until: SEASON_END, start: session ? hm(session.starts_at) : defaults!.start, end: session ? hm(session.ends_at) : addMin(defaults!.start, 60),
    trainer_id: session?.trainer_id ?? (isAdmin ? "" : me.person.id), assistant_id: session?.assistant_id ?? "", repeat: !session, scope: "one" as "one" | "future",
  });
  const [editStaff, setEditStaff] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void Promise.all([api.listTeams(), api.listRooms(), api.staffList(), api.listMembers()]).then(([tm, r, st, mb]) => { setTeams(isAdmin ? tm : tm.filter((x) => myTrainerTeams.includes(x.id))); setRooms(r); setStaff(st); setMembers(mb); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /** the team's own trainer + assistant follow the team automatically; "Skift" overrides for this training */
  const teamStaff = (teamId: string) => {
    const tr = members.find((m) => m.memberships.some((x) => x.team_id === teamId && x.role === "trainer"));
    const as = members.find((m) => m.memberships.some((x) => x.team_id === teamId && x.role === "assistant"));
    return { trainer_id: tr?.id ?? "", assistant_id: as?.id ?? "" };
  };
  const pickTeam = (teamId: string) => { const ts = teamId ? teamStaff(teamId) : { trainer_id: f.trainer_id, assistant_id: "" }; setF({ ...f, team_id: teamId, trainer_id: ts.trainer_id || (isAdmin ? "" : me.person.id), assistant_id: ts.assistant_id }); setEditStaff(false); };
  const nameOf = (id: string) => { const p = staff.find((x) => x.id === id); return p ? `${p.first_name} ${p.last_name}` : null; };
  const save = async () => {
    setErr(null);
    const starts_at = new Date(`${f.date}T${f.start}:00`).toISOString(), ends_at = new Date(`${f.date}T${f.end}:00`).toISOString();
    if (ends_at <= starts_at) { setErr(t("session.badTime")); return; }
    if (!session && f.repeat && f.until < f.date) { setErr(t("session.badUntil")); return; }
    // clash check in the same room
    const day0 = new Date(f.date); const next = new Date(day0); next.setDate(next.getDate() + 1);
    const [ss, bs] = await Promise.all([api.listSessions(day0.toISOString(), next.toISOString()), api.listBookings(day0.toISOString(), next.toISOString())]);
    const clash = ss.find((x) => x.room_id === f.room_id && x.id !== session?.id && !x.cancelled && x.starts_at < ends_at && starts_at < x.ends_at) || bs.find((x) => x.room_id === f.room_id && x.status !== "rejected" && x.starts_at < ends_at && starts_at < x.ends_at);
    if (clash) { setErr(t("session.clash", { what: ("team_name" in clash ? clash.team_name : clash.title) ?? "", from: hm(clash.starts_at), to: hm(clash.ends_at) })); return; }
    const payload = { team_id: f.team_id || null, room_id: f.room_id || null, title: f.title || null, starts_at, ends_at, trainer_id: f.trainer_id || null, assistant_id: f.assistant_id || null };
    if (session) await api.updateSession(session.id, payload, f.scope); else await api.createSession({ ...payload, repeatWeeklyUntil: f.repeat ? f.until : null });
    toast(session ? t("session.saved") : t("session.created")); onSaved();
  };
  return (
    <Sheet onClose={onClose} eyebrow={session ? t("common.edit") : t("session.new")} title={f.title || teams.find((x) => x.id === f.team_id)?.name || t("session.training")}>
      <label className="field"><span>{t("session.team")}</span>
        <select id="se-team" value={f.team_id} onChange={(e) => pickTeam(e.target.value)}><option value="">{t("session.noTeam")}</option>{teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      {!f.team_id && <label className="field"><span>{t("session.title")}</span><input id="se-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t("session.titlePh")} /></label>}
      <label className="field"><span>{t("session.room")}</span><select id="se-room" value={f.room_id} onChange={(e) => setF({ ...f, room_id: e.target.value })}>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>

      <label className="field"><span>{session || !f.repeat ? t("session.date") : t("session.startDate")}</span><input id="se-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
      {!session && f.repeat && <label className="field"><span>{t("session.endDate")}</span><input id="se-until" type="date" value={f.until} min={f.date} onChange={(e) => setF({ ...f, until: e.target.value })} /></label>}
      <div className="grid2">
        <label className="field"><span>{t("session.start")}</span><input id="se-start" type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
        <label className="field"><span>{t("session.end")}</span><input id="se-end" type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
      </div>
      {!session ? (
        <label className="check" data-testid="se-repeat"><input type="checkbox" checked={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.checked })} /> {t("session.repeatWeekly")}<span className="tiny" style={{ marginLeft: 6 }}>{f.repeat ? t("session.repeatHint", { date: new Date(f.until).toLocaleDateString("da-DK", { day: "numeric", month: "short" }) }) : t("session.once")}</span></label>
      ) : session.weekly_rule_id && (
        <div className="field"><span>{t("session.applyTo")}</span><div className="chips"><button className={"chip" + (f.scope === "one" ? " on" : "")} onClick={() => setF({ ...f, scope: "one" })}>{t("session.onlyThis")}</button><button className={"chip" + (f.scope === "future" ? " on" : "")} onClick={() => setF({ ...f, scope: "future" })}>{t("session.thisAndFuture")}</button></div></div>
      )}

      <div className="card" style={{ padding: 12 }} data-testid="se-staff">
        {!editStaff ? (
          <div className="row between"><div><div className="tiny">{t("session.trainer")}</div><div>{nameOf(f.trainer_id) ?? <span className="muted">–</span>}</div>{(f.assistant_id || f.team_id) && <><div className="tiny" style={{ marginTop: 6 }}>{t("roles.assistant")}</div><div>{nameOf(f.assistant_id) ?? <span className="muted">–</span>}</div></>}</div><button className="ghost small" onClick={() => setEditStaff(true)} data-testid="se-change-staff">{t("session.changeStaff")}</button></div>
        ) : (
          <>
            <label className="field"><span>{t("session.trainer")}</span><select id="se-trainer" value={f.trainer_id} onChange={(e) => setF({ ...f, trainer_id: e.target.value })}><option value="">–</option>{staff.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></label>
            <label className="field"><span>{t("roles.assistant")}</span><select id="se-assistant" value={f.assistant_id} onChange={(e) => setF({ ...f, assistant_id: e.target.value })}><option value="">–</option>{staff.filter((p) => p.id !== f.trainer_id).map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></label>
            {f.team_id && <button className="linklike small" onClick={() => { const ts = teamStaff(f.team_id); setF({ ...f, ...ts }); setEditStaff(false); }}>{t("session.useTeamStaff")}</button>}
          </>
        )}
      </div>
      <p className="tiny">{t("session.autoBook")}</p>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="row"><button className="cta grow" disabled={!f.room_id || (!f.team_id && !f.title)} onClick={() => void save()}>{session ? t("common.save") : t("session.create")}</button>
        {session && <button className="ghost danger" onClick={async () => { await api.deleteSession(session.id, f.scope); toast(t("session.deleted")); onSaved(); }}>{t("common.delete")}</button>}</div>
    </Sheet>
  );
}
function addMin(hmStr: string, n: number) { const [h, m] = hmStr.split(":").map(Number); const d = new Date(2000, 0, 1, h, m + n); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
