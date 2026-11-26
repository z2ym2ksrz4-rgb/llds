import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { eventsFor } from "../lib/events";
import { api, type Absence, type Booking, type Event, type Room, type Session } from "@/core/api";
import { EventSheet } from "./Events";
import { catalogUrl as catUrl } from "../lib/catalog";
import { artFor } from "../lib/art";
import { useAuth } from "@/core/auth";
import { useNav } from "@/core/nav";
import { TabNews } from "../components/TabNews";
import { Sheet, Toast } from "../components/Sheet";
import { SessionSheet, SessionEditor } from "../components/SessionSheet";
import { addDays, atTime, DAY_LONG, dayLabel, hm, loc, mondayOf, overlaps, sameDay, startOfDay } from "../lib/time";
import { useAppearance } from "@/core/appearance";
import { catalogUrl } from "../lib/catalog";
import { art } from "../lib/art";

const HOURS = Array.from({ length: 14 }, (_, i) => 9 + i); // 09–22

type LaneItem = { id: string; a: string; b: string; s?: Session; bk?: Booking };
/** Same-room overlaps are laid out side by side (clusters of overlapping items share the lane width). */
function packLane(items: LaneItem[]): { item: LaneItem; col: number; cols: number }[] {
  const sorted = [...items].sort((x, y) => +new Date(x.a) - +new Date(y.a) || +new Date(x.b) - +new Date(y.b));
  const out: { item: LaneItem; col: number; cols: number }[] = [];
  let cluster: { item: LaneItem; col: number; cols: number }[] = []; let colEnds: number[] = []; let clusterEnd = -Infinity;
  const flush = () => { const n = colEnds.length || 1; for (const c of cluster) c.cols = n; out.push(...cluster); cluster = []; colEnds = []; clusterEnd = -Infinity; };
  for (const it of sorted) {
    const a = +new Date(it.a), b = +new Date(it.b);
    if (a >= clusterEnd && cluster.length) flush();
    let col = colEnds.findIndex((e) => e <= a); if (col < 0) { col = colEnds.length; colEnds.push(b); } else colEnds[col] = b;
    cluster.push({ item: it, col, cols: 1 }); clusterEnd = Math.max(clusterEnd, b);
  }
  flush(); return out;
}

/** "Sale": day picker, both rooms side by side, trainings + bookings, tap a free slot to book. */
export function Rooms() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const viewing = useAuth((s) => s.viewing)!;
  const isAdmin = me.person.is_admin;
  const isStaff = isAdmin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer");
  const isTrainer = isAdmin || me.memberships.some((m) => m.person_id === me.person.id && m.role === "trainer");
  const [day, setDay] = useState(startOfDay(new Date()));
  const [view, setViewRaw] = useState<"list" | "grid">(() => { try { const v = localStorage.getItem("llds_cal_view"); if (v === "list" || v === "grid") return v; } catch { /* ignore */ } return typeof window !== "undefined" && window.innerWidth < 640 ? "list" : "grid"; });
  const setView = (v: "list" | "grid") => { setViewRaw(v); try { localStorage.setItem("llds_cal_view", v); } catch { /* ignore */ } };
  const [scope, setScope] = useState<"mine" | "all" | null>(null);   // null = not chosen yet → people with teams start on their own, staff/admin on all
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [open, setOpen] = useState<{ kind: "session"; s: Session } | { kind: "booking"; b: Booking } | { kind: "book"; room_id: string; start: string } | { kind: "new"; room_id: string; start: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const week = mondayOf(day);
  const [weekSessions, setWeekSessions] = useState<Session[]>([]);   // for the dots in the day picker
  const takeRef = useNav((s) => s.takeRef); const pendingRef = useNav((s) => s.pendingRef);
  useEffect(() => { // opened from a notification: jump to the training's day and open it
    const sid = takeRef("session_id"); if (!sid) return;
    void api.getSession(sid).then((sess) => { if (sess) { setDay(startOfDay(new Date(sess.starts_at))); setOpen({ kind: "session", s: sess }); } });
  }, [pendingRef]); // eslint-disable-line react-hooks/exhaustive-deps
  const [events, setEvents] = useState<Event[]>([]);                   // events live in the calendar automatically – created, moved or deleted in Admin → Events
  const [openEvent, setOpenEvent] = useState<Event | null>(null);
  useEffect(() => { void api.listEvents(true).then((ev) => setEvents(eventsFor(ev, me, viewing))).catch(() => setEvents([])); }, [day.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const dayEvents = events.filter((e) => sameDay(new Date(e.starts_at), day));
  const bgImg = useAppearance((a) => catalogUrl(a.a.images?.hero)) ?? art("studio");
  const myTeamIds = new Set(me.memberships.filter((m) => m.person_id === viewing.personId || m.person_id === me.person.id).map((m) => m.team_id));
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
  const hasMine = !isAdmin && [...myTeamIds].length > 0; const sc: "mine" | "all" = scope ?? (hasMine && !isStaff ? "mine" : "all");
  const mineOrChild = (x: Session) => x.team_id != null && (myTeamIds.has(x.team_id) || me.memberships.some((m) => m.team_id === x.team_id && me.children.some((c) => c.id === m.person_id)));
  const shown = sc === "mine" && hasMine ? sessions.filter(mineOrChild) : sessions;
  const mine = (s: Session) => s.team_id != null && me.memberships.some((m) => m.person_id === viewing.personId && m.team_id === s.team_id);
  const canBook = !me.person.supervised_by;   // everyone approved may book (solo/duo) – bookings by dancers/parents await approval; child logins ask their parents
  const isoWeek = (d: Date) => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - n); const y = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return Math.ceil(((x.getTime() - y.getTime()) / 864e5 + 1) / 7); };

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = (15 - 9) * 48; }, [day.getTime()]); // default to the afternoon where the regular trainings are
  return (
    <section className="screen rooms">
      <div className="rooms-bg" aria-hidden="true" style={{ backgroundImage: `url(${bgImg})` }} />
      <TabNews tab="rooms" />
      <header className="topbar"><h1 className="display">{t("nav.rooms")}</h1><div className="row" style={{ gap: 6 }}>{canBook && <button className="small" data-testid="book-room" onClick={() => { const h = Math.min(21, Math.max(9, new Date().getHours() + 1)); setOpen({ kind: "book", room_id: rooms[0]?.id ?? "", start: `${String(h).padStart(2, "0")}:00` }); }}>{t("rooms.book")}</button>}{isTrainer && <button className="ghost small" onClick={() => setOpen({ kind: "new", room_id: rooms[0]?.id ?? "", start: "16:00" })}>+ {t("session.training")}</button>}</div></header>
      <div className="weeknav2"><button type="button" className="wkbtn" aria-label={t("rooms.prevWeek")} onClick={() => setDay(addDays(day, -7))}>‹</button><span className="small muted">{t("rooms.weekLabel", { n: isoWeek(week), from: `${week.getDate()}. ${week.toLocaleDateString(loc(), { month: "short" }).replace(".", "")}`, to: `${addDays(week, 6).getDate()}. ${addDays(week, 6).toLocaleDateString(loc(), { month: "short" }).replace(".", "")}` })}</span>{!sameDay(day, new Date()) && <button type="button" className="wkbtn today" onClick={() => setDay(startOfDay(new Date()))}>{t("rooms.today")}</button>}<button type="button" className="wkbtn" aria-label={t("rooms.nextWeek")} onClick={() => setDay(addDays(day, 7))}>›</button></div>
      <div className="days">
        {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((d) => (
          <button key={d.toISOString()} className={"day" + (sameDay(d, day) ? " on" : "") + (sameDay(d, new Date()) ? " today" : "")} onClick={() => setDay(d)}><span>{dayLabel(d).split(" ")[0]}</span><b>{d.getDate()}</b><i className={weekSessions.some((x) => sameDay(new Date(x.starts_at), d) && x.team_id && myTeamIds.has(x.team_id)) ? "mine" : weekSessions.some((x) => sameDay(new Date(x.starts_at), d)) ? "any" : ""} />{events.some((e) => sameDay(new Date(e.starts_at), d)) && <em className="evdot" aria-label="event">★</em>}</button>
        ))}
      </div>

      <div className="dayhead"><h2 className="display">{DAY_LONG[(day.getDay() + 6) % 7]} {day.getDate()}{loc() === "da-DK" ? "." : ""} {day.toLocaleDateString(loc(), { month: "long" })}</h2><span className="small muted">{t("rooms.countLine", { n: sessions.filter((x) => !x.cancelled).length, b: bookings.filter((x) => x.status !== "rejected").length })}</span></div>
      {dayEvents.length > 0 && <div className="evstrip" data-testid="day-events">{dayEvents.map((e) => <button key={e.id} className="evcard-mini" style={{ backgroundImage: `url(${catUrl(e.image_key) ?? artFor(e.id)})` }} onClick={() => setOpenEvent(e)}><span className="eyebrow">{t(`events.kind.${e.kind}`)} · {hm(e.starts_at)}{e.ends_at ? `–${hm(e.ends_at)}` : ""}</span><b>{e.title}</b>{e.place && <small>{e.place}</small>}</button>)}</div>}
      <div className="calctl" data-testid="cal-controls">
        {hasMine && <div className="seg2" role="tablist"><button type="button" className={sc === "mine" ? "on" : ""} data-testid="cal-mine" onClick={() => setScope("mine")}>{t("rooms.scopeMine")}</button><button type="button" className={sc === "all" ? "on" : ""} data-testid="cal-all" onClick={() => setScope("all")}>{t("rooms.scopeAll")}</button></div>}
        <div className="seg2" role="tablist"><button type="button" className={view === "list" ? "on" : ""} data-testid="cal-list" onClick={() => setView("list")}>{t("rooms.viewList")}</button><button type="button" className={view === "grid" ? "on" : ""} data-testid="cal-grid" onClick={() => setView("grid")}>{t("rooms.viewGrid")}</button></div>
      </div>
      {view === "list" && <div className="card list callist" data-testid="cal-listview">
        {[...shown.map((x) => ({ at: x.starts_at, k: "s" as const, x })), ...bookings.filter((x) => x.status !== "rejected" && (sc === "all" || x.person_id === viewing.personId || x.person_id === me.person.id || me.children.some((c) => c.id === x.person_id))).map((x) => ({ at: x.starts_at, k: "b" as const, x }))].sort((a, b) => a.at.localeCompare(b.at)).map((r) => r.k === "s"
          ? <button type="button" key={"s" + r.x.id} className={"item" + (r.x.cancelled ? " off" : "")} data-testid="cal-row" onClick={() => setOpen({ kind: "session", s: r.x })}><span className="when"><b>{hm(r.x.starts_at)}</b><small>{hm(r.x.ends_at)}</small></span><span className="grow">{r.x.team_name ?? r.x.title ?? t("rooms.training")}<div className="tiny">{[r.x.room_name, r.x.trainer_name].filter(Boolean).join(" · ")}</div></span>{r.x.cancelled ? <span className="tag cx">{t("rooms.cancelled")}</span> : r.x.moved ? <span className="tag mv">{t("rooms.moved")}</span> : mine(r.x) ? <span className="chip small gold">{t("rooms.yours")}</span> : null}<span className="gold">›</span></button>
          : <button type="button" key={"b" + r.x.id} className="item" data-testid="cal-row" onClick={() => setOpen({ kind: "booking", b: r.x })}><span className="when"><b>{hm(r.x.starts_at)}</b><small>{hm(r.x.ends_at)}</small></span><span className="grow">{r.x.title}<div className="tiny">{[r.x.room_name, t("rooms.booking")].filter(Boolean).join(" · ")}{r.x.status === "pending" ? " · " + t("rooms.pending") : ""}</div></span><span className="gold">›</span></button>)}
        {!shown.length && <p className="muted small" style={{ margin: 0 }}>{sc === "mine" ? t("rooms.noneMine") : t("rooms.noneDay")}</p>}
      </div>}
      {view === "grid" && <>
      <div className="cal calhead" style={{ gridTemplateColumns: `44px repeat(${rooms.length}, 1fr)` }}>
        <div />{rooms.map((r) => <div key={r.id} className="h">{r.name}</div>)}
      </div>
      <div className="calwrap" ref={scroller} data-testid="calwrap">
      <div className="cal" style={{ gridTemplateColumns: `44px repeat(${rooms.length}, 1fr)` }}>
        <div className="hours">{HOURS.map((h) => <div key={h} className="t">{h}.00</div>)}</div>
        {rooms.map((r, ri) => (
          <div key={r.id} className="col" style={{ height: HOURS.length * 48 }}>
            {sameDay(day, new Date()) && nowMin >= 9 * 60 && nowMin <= 23 * 60 && <div className="nowline" style={{ top: (nowMin - 9 * 60) / 60 * 48 }} />}
            {HOURS.map((h) => <button key={h} className={"free" + (canBook ? " can" : "")} style={{ top: (h - 9) * 48 }} aria-label={`${t("rooms.bookAt", { room: r.name, h })}`} title={t("rooms.bookAt", { room: r.name, h })} onClick={() => setOpen({ kind: "book", room_id: r.id, start: `${String(h).padStart(2, "0")}:00` })}>{null}</button>)}
            {(() => { const lane = packLane([
                ...shown.filter((s) => s.room_id === r.id).map((s) => ({ id: "s" + s.id, a: s.starts_at, b: s.ends_at, s })),
                ...bookings.filter((b) => b.room_id === r.id && b.status !== "rejected").map((b) => ({ id: "b" + b.id, a: b.starts_at, b: b.ends_at, bk: b })),
              ]); return lane.map(({ item, col, cols }) => {
                const pos = { top: slotTop(item.a), height: slotH(item.a, item.b), left: `calc(${(col / cols) * 100}% + 3px)`, width: `calc(${100 / cols}% - 6px)` };
                if (item.s) { const s = item.s; return (
                  <button key={item.id} className={"ev l" + ri + (mine(s) ? " mine" : isStaff ? "" : " other") + (s.cancelled ? " off cx" : s.moved ? " mv" : "")} style={pos} onClick={() => setOpen({ kind: "session", s })}>
                    <b>{s.title ?? s.team_name}</b><small>{hm(s.starts_at)}–{hm(s.ends_at)}{s.substitute_wanted && !s.substitute_id ? " · " + t("session.subWanted") : ""}{s.cancelled ? <i className="tag cx">{t("rooms.cancelled")}</i> : s.moved ? <i className="tag mv">{t("rooms.moved")}</i> : null}</small>
                  </button>); }
                const b = item.bk!; return (
                  <button key={item.id} className={"ev booking" + (b.status === "pending" ? " pending" : "")} style={pos} onClick={() => setOpen({ kind: "booking", b })}>
                    <b>{b.title}</b><small>{hm(b.starts_at)}–{hm(b.ends_at)}{b.status === "pending" ? " · " + t("rooms.pending") : ""}</small>
                  </button>); }); })()}
          </div>
        ))}
      </div>
      <div className="callegend" aria-hidden><span className="lg l0">{rooms[0]?.name}</span>{rooms[1] && <span className="lg l1">{rooms[1].name}</span>}<span className="lg cx">{t("rooms.cancelled")}</span><span className="lg mv">{t("rooms.moved")}</span></div>
      {canBook && <p className="tiny muted" style={{ margin: "6px 0 0" }}>{t("rooms.legendShort")}</p>}
      </div>
      </>}

      {openEvent && <EventSheet event={openEvent} staff={isStaff} onClose={() => setOpenEvent(null)} onChanged={() => void api.listEvents(true).then(setEvents)} toast={say} />}
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
  const [f, setF] = useState({ room_id, start, dur: 45, title: `Solo – ${who}` });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setErr(null);
    if (!f.title.trim()) { setErr(t("rooms.purposeRequired")); return; }
    const s = atTime(day, f.start); const e = new Date(s.getTime() + f.dur * 6e4);
    const sI = s.toISOString(), eI = e.toISOString();
    if (sessions.some((x) => x.room_id === f.room_id && !x.cancelled && overlaps(sI, eI, x.starts_at, x.ends_at)) || bookings.some((x) => x.room_id === f.room_id && x.status !== "rejected" && overlaps(sI, eI, x.starts_at, x.ends_at))) { setErr(t("rooms.taken")); return; }
    setBusy(true);
    try {
      const b = await api.createBooking({ room_id: f.room_id, title: f.title.trim(), starts_at: sI, ends_at: eI, person_id: viewing.personId, force_pending: !!viewAs && !me.person.is_admin && !me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer") });
      toast(b.status === "approved" ? t("rooms.booked", { room: b.room_name }) : t("rooms.sentForApproval")); onSaved();
    } catch (x) { setErr(t("common.error") + ": " + String((x as Error).message ?? x)); }
    finally { setBusy(false); }
  };
  return (
    <Sheet onClose={onClose} eyebrow={t("rooms.bookRoom")} title={t("rooms.newBooking")}>
      {isTrainer && <button className="ghost" onClick={onTraining}>{t("rooms.createTrainingInstead")}</button>}
      <div className="field"><span>{t("session.room")}</span><div className="chips">{rooms.map((r) => <button key={r.id} className={"chip" + (f.room_id === r.id ? " on" : "")} onClick={() => setF({ ...f, room_id: r.id })}>{r.name}</button>)}</div></div>
      <div className="grid2">
        <label className="field"><span>{t("session.start")}</span><input id="bk-start" type="time" step={900} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
        <div className="field"><span>{t("rooms.duration")}</span><div className="chips">{[45, 90, 135, 180].map((d) => <button key={d} className={"chip" + (f.dur === d ? " on" : "")} onClick={() => setF({ ...f, dur: d })}>{d} min</button>)}</div></div>
      </div>
      <label className="field"><span>{t("rooms.purpose")}</span><input id="bk-title" required value={f.title} placeholder={t("rooms.purposePh")} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <p className="tiny">{isStaff ? t("rooms.staffBooks") : t("rooms.needsApproval")}</p>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="cta" disabled={busy || !f.title.trim()} onClick={() => void save()}>{isStaff ? t("rooms.book") : t("rooms.sendForApproval")}</button>
    </Sheet>
  );
}
