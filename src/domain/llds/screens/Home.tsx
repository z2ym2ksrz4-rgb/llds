import React, { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Absence, type Booking, type Event, type Milestone, type PersonBadge, type Order, type PunchCard, type Session } from "@/core/api";
import { useAuth } from "@/core/auth";
import { useNav } from "@/core/nav";
import { TeamPicker } from "../components/TeamPicker";
import { SessionSheet } from "../components/SessionSheet";
import { Toast } from "../components/Sheet";
import { MessageBanner } from "../components/Messages";
import { TeamCarousel } from "../components/TeamCarousel";
import { TopRight } from "../components/ProfileMenu";
import { artFor } from "../lib/art";
import { catalogUrl } from "../lib/catalog";
import { EventSheet } from "./Events";
import { addDays, dateLabel, DAY_SHORT, hm, startOfDay } from "../lib/time";
import { boxOf, homeOrder, isHidden, useAppearance } from "@/core/appearance";
import { resolveImage } from "../lib/catalog";
import { TrophyShelf } from "../components/Emblems";
import { ScrollList } from "../components/ScrollList";
import { CustomBoxCard } from "../admin/Customize";
import { MyPayments } from "./Payments";

/** Home, laid out like the approved demo: next event as a photo hero, messages that need you, your (child's) week with absence buttons, open payments. */
export function Home() {
  const { t, i18n } = useTranslation();
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
  const [adminOpen, setAdminOpen] = useState({ orders: 0, cards: 0 });
  const openAdmin = useNav((n) => n.openAdmin);
  const [open, setOpen] = useState<Session | null>(null);
  const [openEvent, setOpenEvent] = useState<Event | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const load = useCallback(async () => {
    const from = startOfDay(new Date()), to = addDays(from, 7);
    const [s, b, ev, ms, o, c] = await Promise.all([api.listSessions(from.toISOString(), to.toISOString()), api.listBookings(from.toISOString(), addDays(from, isAdmin ? 30 : 7).toISOString()).catch(() => [] as Booking[]), api.listEvents(), api.listMilestones(), api.listOrders(), api.listPunchCards()]);
    void api.settleAttendance().catch(() => 0).then(() => api.listPersonBadges()).then(setBadges).catch(() => setBadges([]));
    setSessions(s); setBookings(b); setEvents(ev); setMilestones(ms); setOrders(o); setCards(c);
    if (isAdmin) { const [ao, ac] = await Promise.all([api.listOrders(true).catch(() => [] as Order[]), api.listPunchCards(true).catch(() => [] as PunchCard[])]); setAdminOpen({ orders: ao.filter((x) => x.status === "awaiting_payment" || x.status === "paid").length, cards: ac.filter((x) => x.status === "awaiting_payment").length }); } setAbsences(await api.listAbsences(s.map((x) => x.id)));
  }, [isAdmin]);
  useEffect(() => { void load(); }, [load, viewing.personId]);

  const teamId = useAuth((s) => s.teamId);
  const teamIds = new Set(me.memberships.filter((m) => m.person_id === viewing.personId).map((m) => m.team_id));
  const today = new Date().toDateString();
  const staffToday = sessions.filter((s) => (s.trainer_id === me.person.id || s.substitute_id === me.person.id) && new Date(s.starts_at).toDateString() === today);
  const subWanted = sessions.filter((s) => s.substitute_wanted && !s.substitute_id && !s.cancelled);
  const hat = viewing.isChild ? me.children.find((c) => c.id === viewing.personId) : null;
  const todayAbs = absences.filter((a) => sessions.some((s) => s.id === a.session_id && new Date(s.starts_at).toDateString() === today));
  const myTeamIds = new Set(me.memberships.map((m) => m.team_id));
  const hero = events.find((e) => !e.team_ids.length || e.team_ids.some((id) => myTeamIds.has(id))) ?? events[0];
  const openPay = [...orders.filter((o) => o.status === "awaiting_payment").map((o) => ({ id: o.id, label: `${t("shop.title")} #${o.number}`, sub: o.claimed_paid_at ? t("shop.status.claimed") : t("shop.status.awaiting_payment"), amount: o.total_dkk })),
    ...cards.filter((c) => c.status === "awaiting_payment").map((c) => ({ id: c.id, label: c.type_name, sub: c.claimed_paid_at ? t("punch.status.claimed") : t("punch.status.awaiting_payment"), amount: c.price_dkk }))];
  const myMilestones = milestones.filter((m) => m.person_id === viewing.personId);
  const todaysAll = sessions.filter((s) => new Date(s.starts_at).toDateString() === today);
  const nextDay = sessions.find((s) => new Date(s.starts_at) > new Date())?.starts_at;
  const studioToday = todaysAll.length > 0;
  const studio = (studioToday ? todaysAll : nextDay ? sessions.filter((s) => new Date(s.starts_at).toDateString() === new Date(nextDay).toDateString()) : []).slice(0, 12);
  const upcoming = events;

  /* "Din uge": everything the viewed person (or I, as staff) has the next 7 days – trainings, teams I train, competitions/events, my room bookings. */
  type WeekItem = { key: string; at: string; end?: string | null; kind: "training" | "staff" | "event" | "booking"; title: string; sub: string; who?: string; off?: boolean; session?: Session; event?: Event };
  const weekEnd = addDays(startOfDay(new Date()), 7);
  const familyIds = viewing.isChild ? [viewing.personId] : [me.person.id, ...me.children.map((c) => c.id)];
  const familyTeams = (pid: string) => new Set(me.memberships.filter((m) => m.person_id === pid && m.role === "dancer").map((m) => m.team_id));
  const nameOf = (pid: string) => (pid === me.person.id ? null : me.children.find((c) => c.id === pid)?.first_name ?? null);
  const week: WeekItem[] = [];
  for (const s of sessions) {
    // I run this training if I am set on it – or I am trainer/assistant on the team (the session's trainer field is only an override)
    const staffOnTeam = !!s.team_id && me.memberships.some((m) => m.person_id === me.person.id && m.team_id === s.team_id && m.role !== "dancer");
    const mineStaff = !viewing.isChild && (s.trainer_id === me.person.id || s.substitute_id === me.person.id || s.assistant_id === me.person.id || staffOnTeam);
    if (mineStaff) week.push({ key: "st" + s.id, at: s.starts_at, end: s.ends_at, kind: "staff", title: s.title ?? s.team_name ?? "", sub: `${s.room_name ?? ""}${s.substitute_id === me.person.id ? " · " + t("session.sub") : ""}`, off: s.cancelled, session: s });
    for (const pid of familyIds) if (s.team_id && familyTeams(pid).has(s.team_id) && !(mineStaff && pid === me.person.id)) { const a = absences.find((x) => x.session_id === s.id && x.person_id === pid); week.push({ key: "tr" + s.id + pid, at: s.starts_at, end: s.ends_at, kind: "training", title: s.team_name ?? "", sub: `${s.room_name ?? ""} · ${s.substitute_name ?? s.trainer_name ?? ""}${a ? " · " + t("session.absenceSentChip") : ""}`, who: nameOf(pid) ?? undefined, off: s.cancelled, session: s }); }
  }
  for (const e of events) if (new Date(e.starts_at) < weekEnd && (!e.team_ids.length || e.team_ids.some((id) => myTeamIds.has(id)) || isAdmin)) week.push({ key: "ev" + e.id, at: e.starts_at, end: e.ends_at, kind: "event", title: e.title, sub: `${e.place ?? t(`events.kind.${e.kind}`)}${e.meet_time ? " · " + t("events.meet") + " " + e.meet_time : ""}`, event: e });
  for (const b of bookings) if (b.person_id === me.person.id && b.status !== "rejected" && new Date(b.starts_at) < weekEnd) week.push({ key: "bk" + b.id, at: b.starts_at, end: b.ends_at, kind: "booking", title: b.title, sub: `${b.room_name}${b.status === "pending" ? " · " + t("rooms.pending") : ""}` });
  week.sort((a, b) => a.at.localeCompare(b.at));
  const weekDays = [...new Set(week.map((w) => new Date(w.at).toDateString()))];
  const KIND_CHIP: Record<WeekItem["kind"], string> = { training: "week.training", staff: "week.youTrain", event: "week.event", booking: "week.booking" };

  /* hero image: the viewed person's own team photo (Line's) → next event's image → school default → art */
  const firstTeam = me.teams.find((x) => teamIds.has(x.id));
  const ownPhoto = firstTeam && /^https?:/.test(firstTeam.cover_url ?? "") ? firstTeam.cover_url : firstTeam?.photos?.[0] ?? null;
  const heroImg = resolveImage(ownPhoto) ?? catalogUrl(hero?.image_key) ?? catalogUrl(appearance.images?.hero) ?? artFor(viewing.personId, ["group", "trails", "studio"]);
  const hour = new Date().getHours(); const tone = hour < 10 ? "morning" : hour < 17 ? "day" : "evening";
  const greeting = t(`home.greet.${tone}`, { name: me.person.first_name }); // always the logged-in person – the child's name goes on the sections below
  const heroRef = useRef<HTMLDivElement>(null);
  useEffect(() => { // parallax: image moves slower than the page, text fades
    let raf = 0; const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const el = heroRef.current; if (!el) return; const y = window.scrollY; el.style.setProperty("--py", `${y * 0.35}px`); el.style.setProperty("--fade", String(Math.max(0, 1 - y / 320))); }); };
    addEventListener("scroll", on, { passive: true }); return () => { removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);
  const strip = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));
  const dateLine = new Date().toLocaleDateString(i18n.language === "en" ? "en-GB" : "da-DK", { weekday: "long", day: "numeric", month: "long" });
  const SECTIONS: Record<string, () => React.ReactNode> = {
    hero: () => (<>
      <div ref={heroRef} className={"homehero tone-" + tone} data-testid="hero" data-tour="hero">
        <div className="homehero-media"><span className="bg" style={{ backgroundImage: `url(${heroImg})` }} /></div>
        <div className="homehero-top"><TopRight /></div>
        <div className="homehero-text">
          <div className="eyebrow">{dateLine}</div>
          <h1 className="display">{greeting}</h1>
        </div>
      </div>
    </>),
    gallery: () => <TeamCarousel />,
    stats: () => (<>
      {isAdmin && (() => { const tiles: { n: number; label: string; go: () => void; testId?: string }[] = [
          { n: sessions.filter((s) => new Date(s.starts_at).toDateString() === today && !s.cancelled).length, label: t("home.trainingsToday"), go: () => setTab("rooms") },
          { n: todayAbs.length, label: t("home.absencesToday"), go: () => setTab("rooms") },
          { n: bookings.filter((b) => b.status === "pending").length, label: t("home.bookingsPending"), go: () => openAdmin("bookings") },
          { n: subWanted.length, label: t("home.subsWanted"), go: () => openAdmin("season") },
          { n: adminOpen.orders, label: t("home.openOrders"), go: () => openAdmin("shop"), testId: "tile-orders" },
          { n: adminOpen.cards, label: t("home.cardsWaiting"), go: () => openAdmin("punch"), testId: "tile-cards" },
        ]; return (
        <div className="sec" data-testid="statline"><h2>{t("home.overview")}</h2>
          <div className="card tiles6" data-testid="adminline">{tiles.map((x, i) => <button key={i} type="button" className={"tile6" + (x.n ? " hot" : "")} onClick={x.go} data-testid={x.testId}><b>{x.n}</b><span>{x.label}</span></button>)}</div>
        </div>); })()}
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
        <div className="sec" data-tour="week"><h2>{studioToday ? t("home.todayInStudio") : t("home.nextInStudio")}</h2>
          <ScrollList testId="studio-today">
            {studio.map((s) => <button key={s.id} className={"item" + (s.cancelled ? " off" : "")} onClick={() => setOpen(s)}><span className="time">{studioToday ? hm(s.starts_at) : <>{dateLabel(s.starts_at)}<br />{hm(s.starts_at)}</>}</span><span className="grow">{s.title ?? s.team_name}<div className="tiny">{s.room_name}{s.trainer_name ? ` · ${s.substitute_name ?? s.trainer_name}` : ""}{s.cancelled ? " · " + t("session.cancelled") : ""}</div></span><span className="gold">›</span></button>)}
          </ScrollList>
        </div>
      )}
    </>),
    upcoming: () => (<>
      {upcoming.length > 0 && (
        <div className="sec"><h2>{t("home.upcoming")}</h2>
          <ScrollList testId="upcoming">{upcoming.map((e) => <button key={e.id} className="item" onClick={() => setOpenEvent(e)}><span className="time">{dateLabel(e.starts_at)}</span><span className="grow">{e.title}<div className="tiny">{e.place ?? t(`events.kind.${e.kind}`)}{e.team_names?.length ? ` · ${e.team_names.slice(0, 3).join(", ")}${e.team_names.length > 3 ? " …" : ""}` : ""}</div></span><span className="gold">›</span></button>)}</ScrollList>
        </div>
      )}
    </>),
    teampick: () => (<>
      {(!isAdmin || teamIds.size > 0) && <TeamPicker />}
      {/* week strip: the dots follow the team chosen above – its trainings and events */}
      <div className="weekstrip" aria-hidden="true" data-testid="weekstrip">
        {strip.map((d) => { const key = d.toDateString(); const n = sessions.filter((x) => x.team_id === teamId && !x.cancelled && new Date(x.starts_at).toDateString() === key).length + events.filter((e) => new Date(e.starts_at).toDateString() === key && (!e.team_ids.length || (teamId ? e.team_ids.includes(teamId) : false))).length; return <span key={key} className={"d" + (key === today ? " today" : "") + (n ? " has" : "")}><small>{DAY_SHORT[(d.getDay() + 6) % 7]}</small><b>{d.getDate()}</b><i /></span>; })}
      </div>
    </>),
    week: () => (<>
      {(week.length > 0 || teamIds.size > 0) && (
        <div className="sec" data-tour="week" data-testid="your-week"><h2>{hat ? t("home.childsWeek", { name: hat.first_name }) : t("home.yourWeek")}</h2>
          <ScrollList className="weeklist">
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
          </ScrollList>
        </div>
      )}
    </>),
    payments: () => (<>
      <MyPayments embedded />
      {openPay.length > 0 && (
        <div className="sec"><h2>{t("home.payments")}</h2><ScrollList>
          {openPay.map((p) => <button key={p.id} className="item" onClick={() => setTab("more")}><span className="grow">{p.label}<div className="tiny">{p.sub}</div></span><span className="gold">{p.amount} kr.</span></button>)}
        </ScrollList></div>
      )}
    </>),
    badges: () => (<>
      {(badges.some((b) => b.person_id === viewing.personId) || myMilestones.length > 0) && (
        <div className="sec"><h2>{hat ? t("home.childsShelf", { name: hat.first_name }) : t("home.yourShelf")}</h2>
          <TrophyShelf badges={badges.filter((b) => b.person_id === viewing.personId)} milestones={myMilestones} />
        </div>
      )}
    </>),
    milestones: () => null,
  };
  const order = homeOrder(appearance).filter((k) => !isHidden(appearance, k));

  return (
    <section className="screen home">

      {order.map((k) => { const box = boxOf(appearance, k); return <Fragment key={k}>{box ? <CustomBoxCard box={box} onTab={(tab) => setTab(tab as Parameters<typeof setTab>[0])} /> : SECTIONS[k]?.()}</Fragment>; })}

      {openEvent && <EventSheet event={openEvent} staff={isStaff} onClose={() => { setOpenEvent(null); void load(); }} onChanged={() => void load()} toast={say} />}
      {open && <SessionSheet session={open} absences={absences} onClose={() => setOpen(null)} onChanged={() => void load()} toast={say} />}
      <Toast msg={toast} />
    </section>
  );
}
