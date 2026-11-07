import React, { Fragment, useCallback, useEffect, useState } from "react";
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
import { catalogUrl } from "../lib/catalog";
import { EmblemRow } from "../components/Emblems";
import { EventSheet } from "./Events";
import { addDays, dateLabel, hm, startOfDay } from "../lib/time";
import { boxOf, homeOrder, isHidden, useAppearance } from "@/core/appearance";
import { CustomBoxCard } from "../admin/Customize";

/** Home, laid out like the approved demo: next event as a photo hero, messages that need you, your (child's) week with absence buttons, open payments. */
export function Home() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const viewing = useAuth((s) => s.viewing)!;
  const setTab = useNav((s) => s.setTab);
  const appearance = useAppearance((s) => s.a);
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
  const [openEvent, setOpenEvent] = useState<Event | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const load = useCallback(async () => {
    const from = startOfDay(new Date()), to = addDays(from, 7);
    const [s, b, ev, ms, o, c] = await Promise.all([api.listSessions(from.toISOString(), to.toISOString()), api.listBookings(from.toISOString(), addDays(from, isAdmin ? 30 : 7).toISOString()).catch(() => [] as Booking[]), api.listEvents(), api.listMilestones(), api.listOrders(), api.listPunchCards()]);
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

  /* "Din uge": everything the viewed person (or I, as staff) has the next 7 days – trainings, teams I train, competitions/events, my room bookings. */
  type WeekItem = { key: string; at: string; end?: string | null; kind: "training" | "staff" | "event" | "booking"; title: string; sub: string; who?: string; off?: boolean; session?: Session; event?: Event };
  const weekEnd = addDays(startOfDay(new Date()), 7);
  const familyIds = viewing.isChild ? [viewing.personId] : [me.person.id, ...me.children.map((c) => c.id)];
  const familyTeams = (pid: string) => new Set(me.memberships.filter((m) => m.person_id === pid && m.role === "dancer").map((m) => m.team_id));
  const nameOf = (pid: string) => (pid === me.person.id ? null : me.children.find((c) => c.id === pid)?.first_name ?? null);
  const week: WeekItem[] = [];
  for (const s of sessions) {
    const mineStaff = !viewing.isChild && (s.trainer_id === me.person.id || s.substitute_id === me.person.id || s.assistant_id === me.person.id);
    if (mineStaff) week.push({ key: "st" + s.id, at: s.starts_at, end: s.ends_at, kind: "staff", title: s.title ?? s.team_name ?? "", sub: `${s.room_name ?? ""}${s.substitute_id === me.person.id ? " · " + t("session.sub") : ""}`, off: s.cancelled, session: s });
    for (const pid of familyIds) if (s.team_id && familyTeams(pid).has(s.team_id) && !(mineStaff && pid === me.person.id)) { const a = absences.find((x) => x.session_id === s.id && x.person_id === pid); week.push({ key: "tr" + s.id + pid, at: s.starts_at, end: s.ends_at, kind: "training", title: s.team_name ?? "", sub: `${s.room_name ?? ""} · ${s.substitute_name ?? s.trainer_name ?? ""}${a ? " · " + t("session.absenceSentChip") : ""}`, who: nameOf(pid) ?? undefined, off: s.cancelled, session: s }); }
  }
  for (const e of events) if (new Date(e.starts_at) < weekEnd && (!e.team_ids.length || e.team_ids.some((id) => myTeamIds.has(id)) || isAdmin)) week.push({ key: "ev" + e.id, at: e.starts_at, end: e.ends_at, kind: "event", title: e.title, sub: `${e.place ?? t(`events.kind.${e.kind}`)}${e.meet_time ? " · " + t("events.meet") + " " + e.meet_time : ""}`, event: e });
  for (const b of bookings) if (b.person_id === me.person.id && b.status !== "rejected" && new Date(b.starts_at) < weekEnd) week.push({ key: "bk" + b.id, at: b.starts_at, end: b.ends_at, kind: "booking", title: b.title, sub: `${b.room_name}${b.status === "pending" ? " · " + t("rooms.pending") : ""}` });
  week.sort((a, b) => a.at.localeCompare(b.at));
  const weekDays = [...new Set(week.map((w) => new Date(w.at).toDateString()))];
  const KIND_CHIP: Record<WeekItem["kind"], string> = { training: "week.training", staff: "week.youTrain", event: "week.event", booking: "week.booking" };

  const SECTIONS: Record<string, () => React.ReactNode> = {
    hero: () => (<>
      {hero && (
        <button className="hero tap photo kb" data-testid="hero" data-tour="hero" onClick={() => setOpenEvent(hero)}><span className="bg warm" style={{ backgroundImage: `url(${catalogUrl(hero.image_key) ?? catalogUrl(appearance.images?.hero) ?? artFor(hero.id)})` }} />
          <div><div className="eyebrow">{daysTo === 0 ? t("home.today") : t("home.inDays", { n: daysTo })}</div><h2 className="display">{hero.title}</h2>
            <div className="small muted">{dateLabel(hero.starts_at)}{hero.place ? ` · ${hero.place}` : ""}{hero.team_names?.length ? ` · ${hero.team_names.join(", ")}` : ""}</div></div>
        </button>
      )}
    </>),
    stats: () => (<>
      {isAdmin && (
        <div className="kv">
          <div className="card"><div className="n">{sessions.filter((s) => new Date(s.starts_at).toDateString() === today && !s.cancelled).length}</div><div className="tiny">{t("home.trainingsToday")}</div></div>
          <div className="card"><div className="n">{todayAbs.length}</div><div className="tiny">{t("home.absencesToday")}</div></div>
          <div className="card"><div className="n">{bookings.filter((b) => b.status === "pending").length}</div><div className="tiny">{t("home.bookingsPending")}</div></div>
          <div className="card"><div className="n">{subWanted.length}</div><div className="tiny">{t("home.subsWanted")}</div></div>
        </div>
      )}
    </>),
    messages: () => (<>
      <MessageBanner toast={say} />
    </>),
    subs: () => (<>
      {subWanted.length > 0 && isStaff && (
        <div className="card" style={{ borderColor: "var(--gold3)" }}>
          <div className="eyebrow">{t("home.subsWanted")}</div>
          {subWanted.map((s) => <button key={s.id} className="item" onClick={() => setOpen(s)}><span className="time">{dateLabel(s.starts_at)} {hm(s.starts_at)}</span><span className="grow">{s.team_name}</span><span className="gold">›</span></button>)}
        </div>
      )}
    </>),
    yourDay: () => (<>
      {isStaff && !isAdmin && staffToday.length > 0 && (
        <div className="sec"><h2>{t("home.yourDay")}</h2>
          <div className="card list">{staffToday.map((s) => <button key={s.id} className="item" onClick={() => setOpen(s)}><span className="time">{hm(s.starts_at)}</span><span className="grow">{s.team_name}<div className="tiny">{s.room_name}{s.lesson_plan ? " · " + t("session.planShort") : ""}</div></span><span className="gold">›</span></button>)}</div>
        </div>
      )}
    </>),
    studio: () => (<>
      {isAdmin && studio.length > 0 && (
        <div className="sec" data-tour="week"><div className="row between"><h2>{studioToday ? t("home.todayInStudio") : t("home.nextInStudio")}</h2><button className="linklike small" onClick={() => setTab("rooms")}>{t("home.fullSchedule")}</button></div>
          <div className="card list" data-testid="studio-today">
            {studio.map((s) => <button key={s.id} className={"item" + (s.cancelled ? " off" : "")} onClick={() => setOpen(s)}><span className="time">{studioToday ? hm(s.starts_at) : <>{dateLabel(s.starts_at)}<br />{hm(s.starts_at)}</>}</span><span className="grow">{s.title ?? s.team_name}<div className="tiny">{s.room_name}{s.trainer_name ? ` · ${s.substitute_name ?? s.trainer_name}` : ""}{s.cancelled ? " · " + t("session.cancelled") : ""}</div></span><span className="gold">›</span></button>)}
          </div>
        </div>
      )}
    </>),
    upcoming: () => (<>
      {upcoming.length > 1 && (
        <div className="sec"><div className="row between"><h2>{t("home.upcoming")}</h2><button className="linklike small" onClick={() => setTab("events")}>{t("home.fullSchedule")}</button></div>
          <div className="card list">{upcoming.map((e) => <button key={e.id} className="item" onClick={() => setOpenEvent(e)}><span className="time">{dateLabel(e.starts_at)}</span><span className="grow">{e.title}<div className="tiny">{e.place ?? t(`events.kind.${e.kind}`)}{e.team_names?.length ? ` · ${e.team_names.slice(0, 3).join(", ")}${e.team_names.length > 3 ? " …" : ""}` : ""}</div></span><span className="gold">›</span></button>)}</div>
        </div>
      )}
    </>),
    teampick: () => (<>
      {(!isAdmin || teamIds.size > 0) && <TeamPicker />}
    </>),
    week: () => (<>
      {(week.length > 0 || teamIds.size > 0) && (
        <div className="sec" data-tour="week" data-testid="your-week"><div className="row between"><h2>{hat ? t("home.childsWeek", { name: hat.first_name }) : t("home.yourWeek")}</h2><button className="linklike small" onClick={() => setTab("rooms")}>{t("home.fullSchedule")}</button></div>
          <div className="card list weeklist">
            {weekDays.map((d) => { const items = week.filter((w) => new Date(w.at).toDateString() === d); const isToday = d === today; return (
              <div key={d} className="weekday">
                <div className={"eyebrow" + (isToday ? " gold" : "")}>{isToday ? t("home.today") + " · " : ""}{dateLabel(items[0].at)}</div>
                {items.map((w) => (
                  <button key={w.key} className={"item" + (w.off ? " off" : "")} data-kind={w.kind} onClick={() => (w.session ? setOpen(w.session) : w.event ? setOpenEvent(w.event) : setTab("rooms"))}>
                    <span className="time">{hm(w.at)}{w.end ? <><br /><span className="tiny">{hm(w.end)}</span></> : null}</span>
                    <span className="grow">{w.title}{w.who ? <span className="chip small" style={{ marginLeft: 6 }}>{w.who}</span> : null}<div className="tiny">{w.sub}{w.off ? " · " + t("session.cancelled") : ""}</div></span>
                    <span className={"chip small " + w.kind}>{t(KIND_CHIP[w.kind])}</span>
                  </button>))}
              </div>); })}
            {!week.length && <p className="muted">{t("home.noTrainings")}</p>}
          </div>
        </div>
      )}
    </>),
    payments: () => (<>
      {openPay.length > 0 && (
        <div className="sec"><h2>{t("home.payments")}</h2><div className="card list">
          {openPay.map((p) => <button key={p.id} className="item" onClick={() => setTab("more")}><span className="grow">{p.label}<div className="tiny">{p.sub}</div></span><span className="gold">{p.amount} kr.</span></button>)}
        </div></div>
      )}
    </>),
    badges: () => (<>
      {badges.some((b) => b.person_id === viewing.personId) && (
        <div className="sec"><h2>{hat ? t("badges.childs", { name: hat.first_name }) : t("badges.yours")}</h2><EmblemRow badges={badges.filter((b) => b.person_id === viewing.personId)} /></div>
      )}
    </>),
    milestones: () => (<>
      {myMilestones.length > 0 && (
        <div className="sec"><h2>{hat ? t("home.childsMilestones", { name: hat.first_name }) : t("home.yourMilestones")}</h2><div className="chips">{myMilestones.map((m) => <span key={m.id} className="chip gold">{m.title}</span>)}</div></div>
      )}
    </>),
  };
  const order = homeOrder(appearance).filter((k) => !isHidden(appearance, k));

  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{isAdmin ? t("home.hiAdmin", { name: me.person.first_name }) : t("home.hi", { name: me.person.first_name })}</h1><TopRight /></header>

      {order.map((k) => { const box = boxOf(appearance, k); return <Fragment key={k}>{box ? <CustomBoxCard box={box} onTab={(tab) => setTab(tab as Parameters<typeof setTab>[0])} /> : SECTIONS[k]?.()}</Fragment>; })}

      {openEvent && <EventSheet event={openEvent} staff={isStaff} onClose={() => { setOpenEvent(null); void load(); }} onChanged={() => void load()} toast={say} />}
      {open && <SessionSheet session={open} absences={absences} onClose={() => setOpen(null)} onChanged={() => void load()} toast={say} />}
      <Toast msg={toast} />
    </section>
  );
}
