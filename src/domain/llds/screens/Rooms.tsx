import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Absence, type Booking, type Room, type Session } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Sheet, Toast } from "../components/Sheet";
import { SessionSheet, SessionEditor } from "../components/SessionSheet";
import { addDays, dayLabel, DAY_LONG, hm, mondayOf, sameDay, startOfDay, atTime, overlaps } from "../lib/time";
import { useAppearance } from "@/core/appearance";
import { catalogUrl } from "../lib/catalog";
import { art, teamAccent } from "../lib/art";

const HOURS = Array.from({ length: 14 }, (_, i) => 9 + i); // 09–22

/** "Sale": day picker, both rooms side by side, trainings + bookings, tap a free slot to book. */
export function Rooms() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const viewing = useAuth((s) => s.viewing)!;
  const isAdmin = me.person.is_admin;
  const isStaff = isAdmin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer");
  const isTrainer = isAdmin || me.memberships.some((m) => m.person_id === me.person.id && m.role === "trainer");
  const [day, setDay] = useState(startOfDay(new Date()));
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [open, setOpen] = useState<{ kind: "session"; s: Session } | { kind: "booking"; b: Booking } | { kind: "book"; room_id: string; start: string } | { kind: "new"; room_id: string; start: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const week = mondayOf(day);
  const [weekSessions, setWeekSessions] = useState<Session[]>([]);   // for the dots in the day picker
  const bgImg = useAppearance((a) => catalogUrl(a.a.images?.hero)) ?? art("studio");
  const myTeamIds = new Set(me.memberships.filter((m) => m.person_id === viewing.personId || m.person_id === me.person.id).map((m) => m.team_id));
  const accentOf = (teamId: string | null) => { const tm = teamId ? me.teams.find((x) => x.id === teamId) : null; return tm ? teamAccent(tm) : {}; };
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());
  useEffect(() => { const i = setInterval(() => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()), 60_000); return () => clearInterval(i); }, []);
  useEffect(() => { void api.listSessions(week.toISOString(), addDays(week, 7).toISOString()).then(setWeekSessions).catch(() => setWeekSessions([])); }, [week.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    const from = day.toISOString(), to = addDays(day, 1).toISOString();
    const [r, s, b] = await Promise.all([api.listRooms(), api.listSessions(from, to), api.listBookings(from, to)]);
    setRooms(r); setSessions(s); setBookings(b); setAbsences(await api.listAbsences(s.map((x) => x.id)));
  }, [day]);
  useEffect(() => { void load(); }, [load]);

  const slotTop = (iso: string) => { const d = new Date(iso); return ((d.getHours() - 9) * 60 + d.getMinutes()) / 60 * 48; };
  const slotH = (a: string, b: string) => Math.max(22, (new Date(b).getTime() - new Date(a).getTime()) / 36e5 * 48 - 2);
  const mine = (s: Session) => s.team_id != null && me.memberships.some((m) => m.person_id === viewing.personId && m.team_id === s.team_id);

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = (15 - 9) * 48; }, [day.getTime()]); // default to the afternoon where the regular trainings are
  return (
    <section className="screen rooms">
      <div className="rooms-bg" aria-hidden="true" style={{ backgroundImage: `url(${bgImg})` }} />
      <header className="topbar"><h1 className="display">{t("nav.rooms")}</h1>{isTrainer && <button className="ghost small" onClick={() => setOpen({ kind: "new", room_id: rooms[0]?.id ?? "", start: "16:00" })}>+ {t("session.training")}</button>}</header>
      <div className="days">
        {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((d) => (
          <button key={d.toISOString()} className={"day" + (sameDay(d, day) ? " on" : "") + (sameDay(d, new Date()) ? " today" : "")} onClick={() => setDay(d)}><span>{dayLabel(d).split(" ")[0]}</span><b>{d.getDate()}</b><i className={weekSessions.some((x) => sameDay(new Date(x.starts_at), d) && x.team_id && myTeamIds.has(x.team_id)) ? "mine" : weekSessions.some((x) => sameDay(new Date(x.starts_at), d)) ? "any" : ""} /></button>
        ))}
      </div>
      <div className="row between small muted"><button className="linklike" onClick={() => setDay(addDays(day, -7))}>‹ {t("rooms.prevWeek")}</button><button className="linklike" onClick={() => setDay(startOfDay(new Date()))}>{t("rooms.today")}</button><button className="linklike" onClick={() => setDay(addDays(day, 7))}>{t("rooms.nextWeek")} ›</button></div>

      <div className="dayhead"><h2 className="display">{DAY_LONG[(day.getDay() + 6) % 7]} {day.getDate()}. {day.toLocaleDateString("da-DK", { month: "long" })}</h2><span className="small muted">{t("rooms.countLine", { n: sessions.filter((x) => !x.cancelled).length, b: bookings.filter((x) => x.status !== "rejected").length })}</span></div>
      <div className="cal calhead" style={{ gridTemplateColumns: `44px repeat(${rooms.length}, 1fr)` }}>
        <div />{rooms.map((r) => <div key={r.id} className="h">{r.name}</div>)}
      </div>
      <div className="calwrap" ref={scroller} data-testid="calwrap">
      <div className="cal" style={{ gridTemplateColumns: `44px repeat(${rooms.length}, 1fr)` }}>
        <div className="hours">{HOURS.map((h) => <div key={h} className="t">{h}.00</div>)}</div>
        {rooms.map((r) => (
          <div key={r.id} className="col" style={{ height: HOURS.length * 48 }}>
            {sameDay(day, new Date()) && nowMin >= 9 * 60 && nowMin <= 23 * 60 && <div className="nowline" style={{ top: (nowMin - 9 * 60) / 60 * 48 }} />}
            {HOURS.map((h) => <button key={h} className="free" style={{ top: (h - 9) * 48 }} aria-label={`${r.name} ${h}:00`} onClick={() => setOpen({ kind: "book", room_id: r.id, start: `${String(h).padStart(2, "0")}:00` })} />)}
            {sessions.filter((s) => s.room_id === r.id).map((s) => (
              <button key={s.id} className={"ev" + (mine(s) ? " mine" : "") + (s.cancelled ? " off" : "")} style={{ top: slotTop(s.starts_at), height: slotH(s.starts_at, s.ends_at), ...accentOf(s.team_id) }} onClick={() => setOpen({ kind: "session", s })}>
                <b>{s.title ?? s.team_name}</b><small>{hm(s.starts_at)}–{hm(s.ends_at)}{s.substitute_wanted && !s.substitute_id ? " · " + t("session.subWanted") : ""}</small>
              </button>
            ))}
            {bookings.filter((b) => b.room_id === r.id && b.status !== "rejected").map((b) => (
              <button key={b.id} className={"ev booking" + (b.status === "pending" ? " pending" : "")} style={{ top: slotTop(b.starts_at), height: slotH(b.starts_at, b.ends_at) }} onClick={() => setOpen({ kind: "booking", b })}>
                <b>{b.title}</b><small>{hm(b.starts_at)}–{hm(b.ends_at)}{b.status === "pending" ? " · " + t("rooms.pending") : ""}</small>
              </button>
            ))}
          </div>
        ))}
      </div>
      <p className="tiny">{t("rooms.legend")}</p>
      </div>

      {open?.kind === "session" && <SessionSheet session={open.s} absences={absences} onClose={() => setOpen(null)} onChanged={() => void load()} toast={say} />}
      {open?.kind === "new" && <SessionEditor defaults={{ date: day, room_id: open.room_id, start: open.start }} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void load(); }} toast={say} />}
      {open?.kind === "book" && <BookSheet day={day} rooms={rooms} room_id={open.room_id} start={open.start} sessions={sessions} bookings={bookings} isStaff={isStaff} isTrainer={isTrainer}
        onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void load(); }} onTraining={() => setOpen({ kind: "new", room_id: open.room_id, start: open.start })} toast={say} />}
      {open?.kind === "booking" && (
        <Sheet onClose={() => setOpen(null)} eyebrow={t("rooms.booking")} title={open.b.title}>
          <div className="chips"><span className="chip">{dayLabel(new Date(open.b.starts_at))} {hm(open.b.starts_at)}–{hm(open.b.ends_at)}</span><span className="chip">{open.b.room_name}</span><span className={"chip" + (open.b.status === "pending" ? " warn" : " ok")}>{t(`rooms.status.${open.b.status}`)} · {open.b.person_name}</span></div>
          {isAdmin && open.b.status === "pending" && <div className="row"><button className="cta grow" onClick={async () => { await api.setBookingStatus(open.b.id, "approved"); say(t("rooms.approved")); setOpen(null); void load(); }}>{t("admin.approve")}</button><button className="ghost danger" onClick={async () => { await api.setBookingStatus(open.b.id, "rejected"); setOpen(null); void load(); }}>{t("admin.reject")}</button></div>}
          {(isAdmin || open.b.person_id === me.person.id || me.children.some((c) => c.id === open.b.person_id)) && <button className="ghost danger" onClick={async () => { await api.deleteBooking(open.b.id); say(t("rooms.deleted")); setOpen(null); void load(); }}>{t("rooms.deleteBooking")}</button>}
        </Sheet>
      )}
      <Toast msg={toast} />
    </section>
  );
}

function BookSheet({ day, rooms, room_id, start, sessions, bookings, isStaff, isTrainer, onClose, onSaved, onTraining, toast }: {
  day: Date; rooms: Room[]; room_id: string; start: string; sessions: Session[]; bookings: Booking[]; isStaff: boolean; isTrainer: boolean; onClose: () => void; onSaved: () => void; onTraining: () => void; toast: (m: string) => void;
}) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!; const viewing = useAuth((s) => s.viewing)!; const viewAs = useAuth((s) => s.viewAs);
  const who = viewing.isChild ? me.children.find((c) => c.id === viewing.personId)?.first_name : me.person.first_name;
  const [f, setF] = useState({ room_id, start, dur: 60, title: `Solo – ${who}` });
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const s = atTime(day, f.start); const e = new Date(s.getTime() + f.dur * 6e4);
    const sI = s.toISOString(), eI = e.toISOString();
    if (sessions.some((x) => x.room_id === f.room_id && !x.cancelled && overlaps(sI, eI, x.starts_at, x.ends_at)) || bookings.some((x) => x.room_id === f.room_id && x.status !== "rejected" && overlaps(sI, eI, x.starts_at, x.ends_at))) { setErr(t("rooms.taken")); return; }
    const b = await api.createBooking({ room_id: f.room_id, title: f.title || t("rooms.booking"), starts_at: sI, ends_at: eI, person_id: viewing.personId, force_pending: !!viewAs && !["admin", "trainer", "assistant"].includes(viewAs) });
    toast(b.status === "approved" ? t("rooms.booked", { room: b.room_name }) : t("rooms.sentForApproval")); onSaved();
  };
  return (
    <Sheet onClose={onClose} eyebrow={t("rooms.bookRoom")} title={t("rooms.newBooking")}>
      {isTrainer && <button className="ghost" onClick={onTraining}>{t("rooms.createTrainingInstead")}</button>}
      <div className="field"><span>{t("session.room")}</span><div className="chips">{rooms.map((r) => <button key={r.id} className={"chip" + (f.room_id === r.id ? " on" : "")} onClick={() => setF({ ...f, room_id: r.id })}>{r.name}</button>)}</div></div>
      <div className="grid2">
        <label className="field"><span>{t("session.start")}</span><input id="bk-start" type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
        <div className="field"><span>{t("rooms.duration")}</span><div className="chips">{[30, 60, 90, 120].map((d) => <button key={d} className={"chip" + (f.dur === d ? " on" : "")} onClick={() => setF({ ...f, dur: d })}>{d} min</button>)}</div></div>
      </div>
      <label className="field"><span>{t("rooms.purpose")}</span><input id="bk-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <p className="tiny">{isStaff ? t("rooms.staffBooks") : t("rooms.needsApproval")}</p>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="cta" onClick={() => void save()}>{isStaff ? t("rooms.book") : t("rooms.sendForApproval")}</button>
    </Sheet>
  );
}
