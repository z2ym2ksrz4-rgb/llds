import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Absence, type Booking, type Session } from "@/core/api";
import { useAuth } from "@/core/auth";
import { TeamPicker } from "../components/TeamPicker";
import { SessionSheet } from "../components/SessionSheet";
import { Toast } from "../components/Sheet";
import { addDays, dateLabel, hm, startOfDay } from "../lib/time";

/** Home: "Din uge" for the hat you wear; trainers see their day; admin sees today's numbers. */
export function Home() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const viewing = useAuth((s) => s.viewing)!;
  const isAdmin = me.person.is_admin;
  const isStaff = isAdmin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [open, setOpen] = useState<Session | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const load = useCallback(async () => {
    const from = startOfDay(new Date()), to = addDays(from, 7);
    const [s, b] = await Promise.all([api.listSessions(from.toISOString(), to.toISOString()), isAdmin ? api.listBookings(from.toISOString(), addDays(from, 30).toISOString()) : Promise.resolve([])]);
    setSessions(s); setBookings(b); setAbsences(await api.listAbsences(s.map((x) => x.id)));
  }, [isAdmin]);
  useEffect(() => { void load(); }, [load, viewing.personId]);

  const teamIds = new Set(me.memberships.filter((m) => m.person_id === viewing.personId).map((m) => m.team_id));
  const myWeek = sessions.filter((s) => s.team_id && teamIds.has(s.team_id));
  const staffToday = sessions.filter((s) => (s.trainer_id === me.person.id || s.substitute_id === me.person.id || (isAdmin && new Date(s.starts_at).toDateString() === new Date().toDateString())) && new Date(s.starts_at).toDateString() === new Date().toDateString());
  const subWanted = sessions.filter((s) => s.substitute_wanted && !s.substitute_id && !s.cancelled);
  const hat = viewing.isChild ? me.children.find((c) => c.id === viewing.personId) : null;
  const myAbs = (s: Session) => absences.find((a) => a.session_id === s.id && a.person_id === viewing.personId);
  const todayAbs = absences.filter((a) => sessions.some((s) => s.id === a.session_id && new Date(s.starts_at).toDateString() === new Date().toDateString()));

  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{isAdmin ? t("home.hiAdmin", { name: me.person.first_name }) : t("home.hi", { name: me.person.first_name })}</h1><span className="avatar">{me.person.first_name[0]}{me.person.last_name[0] ?? ""}</span></header>

      {isAdmin && (
        <div className="kv">
          <div className="card"><div className="n">{sessions.filter((s) => new Date(s.starts_at).toDateString() === new Date().toDateString() && !s.cancelled).length}</div><div className="tiny">{t("home.trainingsToday")}</div></div>
          <div className="card"><div className="n">{todayAbs.length}</div><div className="tiny">{t("home.absencesToday")}</div></div>
          <div className="card"><div className="n">{bookings.filter((b) => b.status === "pending").length}</div><div className="tiny">{t("home.bookingsPending")}</div></div>
          <div className="card"><div className="n">{subWanted.length}</div><div className="tiny">{t("home.subsWanted")}</div></div>
        </div>
      )}

      {subWanted.length > 0 && isStaff && (
        <div className="card" style={{ borderColor: "var(--gold3)" }}>
          <div className="eyebrow">{t("home.subsWanted")}</div>
          {subWanted.map((s) => <button key={s.id} className="item" onClick={() => setOpen(s)}><span className="time">{dateLabel(s.starts_at)} {hm(s.starts_at)}</span><span className="grow">{s.team_name}</span><span className="gold">›</span></button>)}
        </div>
      )}

      {isStaff && !isAdmin && staffToday.length > 0 && (
        <div className="sec"><h2>{t("home.yourDay")}</h2>
          <div className="card list">{staffToday.map((s) => <button key={s.id} className="item" onClick={() => setOpen(s)}><span className="time">{hm(s.starts_at)}</span><span className="grow">{s.team_name}<div className="tiny">{s.room_name}{s.lesson_plan ? " · " + t("session.planShort") : ""}</div></span><span className="gold">›</span></button>)}</div>
        </div>
      )}

      {(!isAdmin || teamIds.size > 0) && <TeamPicker />}
      {teamIds.size > 0 && (
        <div className="sec"><div className="row between"><h2>{hat ? t("home.childsWeek", { name: hat.first_name }) : t("home.yourWeek")}</h2></div>
          <div className="card list">
            {myWeek.map((s) => { const a = myAbs(s); return (
              <button key={s.id} className={"item" + (s.cancelled ? " off" : "")} onClick={() => setOpen(s)}>
                <span className="time">{dateLabel(s.starts_at)}<br />{hm(s.starts_at)}</span>
                <span className="grow">{s.team_name}<div className="tiny">{s.room_name} · {s.substitute_name ?? s.trainer_name}{s.cancelled ? " · " + t("session.cancelled") : ""}</div></span>
                {a ? <span className="chip warn small">{t("session.absenceSentChip")}</span> : !s.cancelled && <span className="tiny">{t("home.tapAbsence")}</span>}
              </button>); })}
            {!myWeek.length && <p className="muted">{t("home.noTrainings")}</p>}
          </div>
        </div>
      )}
      {!teamIds.size && !isAdmin && <div className="card"><p className="muted">{t("team.noneYet")}</p></div>}

      {open && <SessionSheet session={open} absences={absences} onClose={() => setOpen(null)} onChanged={() => void load()} toast={say} />}
      <Toast msg={toast} />
    </section>
  );
}
