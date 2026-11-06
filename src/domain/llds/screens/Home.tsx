import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Absence, type Booking, type Event, type Milestone, type PersonBadge, type Order, type PunchCard, type Session } from "@/core/api";
import { useAuth } from "@/core/auth";
import { useNav } from "@/core/nav";
import { TeamPicker } from "../components/TeamPicker";
import { SessionSheet } from "../components/SessionSheet";
import { Toast } from "../components/Sheet";
import { MessageBanner } from "../components/Messages";
import { TopRight } from "../components/ProfileMenu";
import { artFor } from "../lib/art";
import { EmblemRow } from "../components/Emblems";
import { addDays, dateLabel, hm, startOfDay } from "../lib/time";

/** Home, laid out like the approved demo: next event as a photo hero, messages that need you, your (child's) week with absence buttons, open payments. */
export function Home() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const viewing = useAuth((s) => s.viewing)!;
  const setTab = useNav((s) => s.setTab);
  const isAdmin = me.person.is_admin;
  const isStaff = isAdmin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [badges, setBadges] = useState<PersonBadge[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cards, setCards] = useState<PunchCard[]>([]);
  const [open, setOpen] = useState<Session | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const load = useCallback(async () => {
    const from = startOfDay(new Date()), to = addDays(from, 7);
    const [s, b, ev, ms, o, c] = await Promise.all([api.listSessions(from.toISOString(), to.toISOString()), isAdmin ? api.listBookings(from.toISOString(), addDays(from, 30).toISOString()) : Promise.resolve([]), api.listEvents(), api.listMilestones(), api.listOrders(), api.listPunchCards()]);
    void api.listPersonBadges().then(setBadges).catch(() => setBadges([]));
    setSessions(s); setBookings(b); setEvents(ev); setMilestones(ms); setOrders(o); setCards(c); setAbsences(await api.listAbsences(s.map((x) => x.id)));
  }, [isAdmin]);
  useEffect(() => { void load(); }, [load, viewing.personId]);

  const teamIds = new Set(me.memberships.filter((m) => m.person_id === viewing.personId).map((m) => m.team_id));
  const myWeek = sessions.filter((s) => s.team_id && teamIds.has(s.team_id));
  const today = new Date().toDateString();
  const staffToday = sessions.filter((s) => (s.trainer_id === me.person.id || s.substitute_id === me.person.id) && new Date(s.starts_at).toDateString() === today);
  const subWanted = sessions.filter((s) => s.substitute_wanted && !s.substitute_id && !s.cancelled);
  const hat = viewing.isChild ? me.children.find((c) => c.id === viewing.personId) : null;
  const myAbs = (s: Session) => absences.find((a) => a.session_id === s.id && a.person_id === viewing.personId);
  const todayAbs = absences.filter((a) => sessions.some((s) => s.id === a.session_id && new Date(s.starts_at).toDateString() === today));
  const myTeamIds = new Set(me.memberships.map((m) => m.team_id));
  const hero = events.find((e) => !e.team_ids.length || e.team_ids.some((id) => myTeamIds.has(id))) ?? events[0];
  const daysTo = hero ? Math.max(0, Math.round((new Date(hero.starts_at).getTime() - Date.now()) / 864e5)) : 0;
  const openPay = [...orders.filter((o) => o.status === "awaiting_payment").map((o) => ({ id: o.id, label: `${t("shop.title")} #${o.number}`, sub: o.claimed_paid_at ? t("shop.status.claimed") : t("shop.status.awaiting_payment"), amount: o.total_dkk })),
    ...cards.filter((c) => c.status === "awaiting_payment").map((c) => ({ id: c.id, label: c.type_name, sub: c.claimed_paid_at ? t("punch.status.claimed") : t("punch.status.awaiting_payment"), amount: c.price_dkk }))];
  const myMilestones = milestones.filter((m) => m.person_id === viewing.personId);
  const todaysAll = sessions.filter((s) => new Date(s.starts_at).toDateString() === today);
  const nextDay = sessions.find((s) => new Date(s.starts_at) > new Date())?.starts_at;
  const studioToday = todaysAll.length > 0;
  const studio = (studioToday ? todaysAll : nextDay ? sessions.filter((s) => new Date(s.starts_at).toDateString() === new Date(nextDay).toDateString()) : []).slice(0, 12);
  const upcoming = events.filter((e) => e.id !== hero?.id).slice(0, 4);

  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{isAdmin ? t("home.hiAdmin", { name: me.person.first_name }) : t("home.hi", { name: me.person.first_name })}</h1><TopRight /></header>

      {hero && (
        <button className="hero tap photo" data-testid="hero" onClick={() => setTab("events")} style={{ backgroundImage: `url(${artFor(hero.id)})` }}>
          <div><div className="eyebrow">{daysTo === 0 ? t("home.today") : t("home.inDays", { n: daysTo })}</div><h2 className="display">{hero.title}</h2>
            <div className="small muted">{dateLabel(hero.starts_at)}{hero.place ? ` · ${hero.place}` : ""}{hero.team_names?.length ? ` · ${hero.team_names.join(", ")}` : ""}</div></div>
        </button>
      )}

      {isAdmin && (
        <div className="kv">
          <div className="card"><div className="n">{sessions.filter((s) => new Date(s.starts_at).toDateString() === today && !s.cancelled).length}</div><div className="tiny">{t("home.trainingsToday")}</div></div>
          <div className="card"><div className="n">{todayAbs.length}</div><div className="tiny">{t("home.absencesToday")}</div></div>
          <div className="card"><div className="n">{bookings.filter((b) => b.status === "pending").length}</div><div className="tiny">{t("home.bookingsPending")}</div></div>
          <div className="card"><div className="n">{subWanted.length}</div><div className="tiny">{t("home.subsWanted")}</div></div>
        </div>
      )}

      <MessageBanner toast={say} />

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

      {isAdmin && studio.length > 0 && (
        <div className="sec"><div className="row between"><h2>{studioToday ? t("home.todayInStudio") : t("home.nextInStudio")}</h2><button className="linklike small" onClick={() => setTab("rooms")}>{t("home.fullSchedule")}</button></div>
          <div className="card list" data-testid="studio-today">
            {studio.map((s) => <button key={s.id} className={"item" + (s.cancelled ? " off" : "")} onClick={() => setOpen(s)}><span className="time">{studioToday ? hm(s.starts_at) : <>{dateLabel(s.starts_at)}<br />{hm(s.starts_at)}</>}</span><span className="grow">{s.title ?? s.team_name}<div className="tiny">{s.room_name}{s.trainer_name ? ` · ${s.substitute_name ?? s.trainer_name}` : ""}{s.cancelled ? " · " + t("session.cancelled") : ""}</div></span><span className="gold">›</span></button>)}
          </div>
        </div>
      )}
      {upcoming.length > 1 && (
        <div className="sec"><div className="row between"><h2>{t("home.upcoming")}</h2><button className="linklike small" onClick={() => setTab("events")}>{t("home.fullSchedule")}</button></div>
          <div className="card list">{upcoming.map((e) => <button key={e.id} className="item" onClick={() => setTab("events")}><span className="time">{dateLabel(e.starts_at)}</span><span className="grow">{e.title}<div className="tiny">{e.place ?? t(`events.kind.${e.kind}`)}{e.team_names?.length ? ` · ${e.team_names.slice(0, 3).join(", ")}${e.team_names.length > 3 ? " …" : ""}` : ""}</div></span><span className="gold">›</span></button>)}</div>
        </div>
      )}
      {(!isAdmin || teamIds.size > 0) && <TeamPicker />}
      {teamIds.size > 0 && (
        <div className="sec"><div className="row between"><h2>{hat ? t("home.childsWeek", { name: hat.first_name }) : t("home.yourWeek")}</h2><button className="linklike small" onClick={() => setTab("rooms")}>{t("home.fullSchedule")}</button></div>
          <div className="card list">
            {myWeek.map((s) => { const a = myAbs(s); const past = new Date(s.ends_at) < new Date(); return (
              <div key={s.id} className={"item" + (s.cancelled ? " off" : "")}>
                <button className="grow row linklike-none" onClick={() => setOpen(s)} style={{ textAlign: "left", background: "none", padding: 0, color: "inherit", fontWeight: 300, fontSize: "1rem", gap: 12 }}>
                  <span className="time">{dateLabel(s.starts_at)}<br />{hm(s.starts_at)}</span>
                  <span className="grow">{s.team_name}<div className="tiny">{s.room_name} · {s.substitute_name ?? s.trainer_name}{s.cancelled ? " · " + t("session.cancelled") : ""}</div></span>
                </button>
                {a ? <span className="chip warn small">{t("session.absenceSentChip")}</span> : !s.cancelled && !past && <button className="ghost small" onClick={() => setOpen(s)}>{t("session.absenceBtn")}</button>}
              </div>); })}
            {!myWeek.length && <p className="muted">{t("home.noTrainings")}</p>}
          </div>
        </div>
      )}
      {!teamIds.size && !isAdmin && <div className="card"><p className="muted">{t("team.noneYet")}</p></div>}

      {openPay.length > 0 && (
        <div className="sec"><h2>{t("home.payments")}</h2><div className="card list">
          {openPay.map((p) => <button key={p.id} className="item" onClick={() => setTab("more")}><span className="grow">{p.label}<div className="tiny">{p.sub}</div></span><span className="gold">{p.amount} kr.</span></button>)}
        </div></div>
      )}

      {badges.some((b) => b.person_id === viewing.personId) && (
        <div className="sec"><h2>{hat ? t("badges.childs", { name: hat.first_name }) : t("badges.yours")}</h2><EmblemRow badges={badges.filter((b) => b.person_id === viewing.personId)} /></div>
      )}
      {myMilestones.length > 0 && (
        <div className="sec"><h2>{hat ? t("home.childsMilestones", { name: hat.first_name }) : t("home.yourMilestones")}</h2><div className="chips">{myMilestones.map((m) => <span key={m.id} className="chip gold">{m.title}</span>)}</div></div>
      )}

      {open && <SessionSheet session={open} absences={absences} onClose={() => setOpen(null)} onChanged={() => void load()} toast={say} />}
      <Toast msg={toast} />
    </section>
  );
}
