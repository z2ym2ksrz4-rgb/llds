import React, { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { HeroMedia, isSitePhoto } from "../components/PhotoHero";
import { useTranslation } from "react-i18next";
import { api, type Absence, type Booking, type Event, type Milestone, type PersonBadge, type Order, type PunchCard, type Session } from "@/core/api";
import { useAuth } from "@/core/auth";
import { useNav } from "@/core/nav";
import { useBadges } from "@/core/badges";
import { TeamPicker } from "../components/TeamPicker";
import { SessionSheet } from "../components/SessionSheet";
import { Toast } from "../components/Sheet";
import { MessageBanner } from "../components/Messages";
import { TeamCarousel } from "../components/TeamCarousel";
import { TopRight } from "../components/ProfileMenu";
import { artFor, focusStyle } from "../lib/art";
import { useScene } from "../components/Scene";
import { Empty } from "../components/Empty";
import { catalogUrl } from "../lib/catalog";
import { EventSheet } from "./Events";
import { addDays, dateLabel, DAY_LONG, DAY_SHORT, hm, loc, startOfDay } from "../lib/time";
import { boxOf, homeOrder, isHidden, useAppearance } from "@/core/appearance";
import { resolveImage } from "../lib/catalog";
import { TrophyShelf } from "../components/Emblems";
import { ScrollList } from "../components/ScrollList";
import { CustomBoxCard } from "../admin/Customize";
import { JoinTeam, MyPayments } from "./Payments";
import { AuditionCards } from "./Audition";

/** Home, laid out like the approved demo: next event as a photo hero, messages that need you, your (child's) week with absence buttons, open payments. */
export function Home() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const viewing = useAuth((s) => s.viewing)!;
  const selectedTeamId = useAuth((s) => s.teamId);
  const [moreOpen, setMoreOpen] = useState<boolean>(() => { try { return localStorage.getItem("llds_home_more") === "1"; } catch { return false; } });
  const toggleMore = () => setMoreOpen((o) => { try { localStorage.setItem("llds_home_more", o ? "0" : "1"); } catch { /* ignore */ } return !o; });
  const [weekAll, setWeekAll] = useState(false);
  const [signupsOpen, setSignupsOpen] = useState(true);
  useEffect(() => { void api.signupsOpen().then(setSignupsOpen).catch(() => setSignupsOpen(true)); }, []);
  const setTab = useNav((s) => s.setTab);
  const appearance = useAppearance((s) => s.a);
  const isAdmin = me.person.is_admin;
  const isStaff = isAdmin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer");
  const childLogin = !!me.person.supervised_by;   // a child with its own login: no money anywhere – the parents handle it in their app
  const [sessions, setSessions] = useState<Session[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [badges, setBadges] = useState<PersonBadge[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cards, setCards] = useState<PunchCard[]>([]);
  const adminCounts = useBadges((b) => b.admin);
  const openAdmin = useNav((n) => n.openAdmin);
  const [open, setOpen] = useState<Session | null>(null);
  const [openEvent, setOpenEvent] = useState<Event | null>(null);
  const [join, setJoin] = useState(false);
  const [selDay, setSelDay] = useState<string | null>(null);   // week strip: tapped day folds its programme out
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const load = useCallback(async () => {
    const from = startOfDay(new Date()), to = addDays(from, 14);   // 14 days so "vikar søges" shows in time; the week view itself cuts at 7
    const [s, b, ev, ms, o, c] = await Promise.all([api.listSessions(from.toISOString(), to.toISOString()), api.listBookings(from.toISOString(), addDays(from, isAdmin ? 30 : 7).toISOString()).catch(() => [] as Booking[]), api.listEvents(), api.listMilestones(), api.listOrders(), api.listPunchCards()]);
    void api.settleAttendance().catch(() => 0).then(() => api.listPersonBadges()).then(setBadges).catch(() => setBadges([]));
    setSessions(s); setBookings(b); setEvents(ev); setMilestones(ms); setOrders(o); setCards(c);
    setAbsences(await api.listAbsences(s.map((x) => x.id)));
  }, [isAdmin]);
  useEffect(() => { void load(); }, [load, viewing.personId]);

  const teamId = useAuth((s) => s.teamId);
  const teamIds = new Set(me.memberships.filter((m) => m.person_id === viewing.personId).map((m) => m.team_id));
  const today = new Date().toDateString();
  const runsSession = (s: Session) => s.trainer_id === me.person.id || s.substitute_id === me.person.id || s.assistant_id === me.person.id || (!!s.team_id && me.memberships.some((m) => m.person_id === me.person.id && m.team_id === s.team_id && m.role !== "dancer"));
  const staffTodayAll = sessions.filter((s) => runsSession(s) && new Date(s.starts_at).toDateString() === today).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const trainerCards = isStaff && !isAdmin && !viewing.isChild && staffTodayAll.length > 0;
  const subWanted = sessions.filter((s) => s.substitute_wanted && !s.substitute_id && !s.cancelled);
  const hat = viewing.isChild ? me.children.find((c) => c.id === viewing.personId) : null;
  const todayAbs = absences.filter((a) => sessions.some((s) => s.id === a.session_id && new Date(s.starts_at).toDateString() === today));
  const myTeamIds = new Set(me.memberships.map((m) => m.team_id));
  const hero = events.find((e) => !e.team_ids.length || e.team_ids.some((id) => myTeamIds.has(id))) ?? events[0];
  const familyIds = viewing.isChild ? [viewing.personId] : [me.person.id, ...me.children.map((c) => c.id)];
  // shop/punch-card payments the viewed household still has to PAY (claimed ones wait for Line, not for them); admins' RLS sees everyone's, so filter here
  const openPay = [...orders.filter((o) => o.status === "awaiting_payment" && !o.claimed_paid_at && familyIds.includes(o.person_id)).map((o) => ({ id: o.id, label: `${t("shop.title")} #${o.number}`, sub: t("shop.status.awaiting_payment"), amount: o.total_dkk })),
    ...cards.filter((c) => c.status === "awaiting_payment" && !c.claimed_paid_at && familyIds.includes(c.person_id)).map((c) => ({ id: c.id, label: c.type_name, sub: t("punch.status.awaiting_payment"), amount: c.price_dkk }))];
  const myMilestones = milestones.filter((m) => m.person_id === viewing.personId);
  const todaysAll = sessions.filter((s) => new Date(s.starts_at).toDateString() === today);
  const nextDay = sessions.find((s) => new Date(s.starts_at) > new Date())?.starts_at;
  const studioToday = todaysAll.length > 0;
  const studio = (studioToday ? todaysAll : nextDay ? sessions.filter((s) => new Date(s.starts_at).toDateString() === new Date(nextDay).toDateString()) : []).slice(0, 12);
  const upcoming = events;

  /* "Din uge": everything the viewed person (or I, as staff) has the next 7 days – trainings, teams I train, competitions/events, my room bookings. */
  type WeekItem = { key: string; at: string; end?: string | null; kind: "training" | "staff" | "event" | "booking"; title: string; sub: string; who?: string; off?: boolean; session?: Session; event?: Event };
  const weekEnd = addDays(startOfDay(new Date()), 7);
  const familyTeams = (pid: string) => new Set(me.memberships.filter((m) => m.person_id === pid && m.role === "dancer").map((m) => m.team_id));
  const nameOf = (pid: string) => (pid === me.person.id ? null : me.children.find((c) => c.id === pid)?.first_name ?? null);
  const week: WeekItem[] = [];
  for (const s of sessions) {
    if (new Date(s.starts_at) >= weekEnd) continue;
    if (trainerCards && runsSession(s) && new Date(s.starts_at).toDateString() === today) continue;   // shown as "I dag"-cards above
    // I run this training if I am set on it – or I am trainer/assistant on the team (the session's trainer field is only an override)
    const staffOnTeam = !!s.team_id && me.memberships.some((m) => m.person_id === me.person.id && m.team_id === s.team_id && m.role !== "dancer");
    const mineStaff = !viewing.isChild && (s.trainer_id === me.person.id || s.substitute_id === me.person.id || s.assistant_id === me.person.id || staffOnTeam);
    if (mineStaff) week.push({ key: "st" + s.id, at: s.starts_at, end: s.ends_at, kind: "staff", title: s.title ?? s.team_name ?? "", sub: `${s.room_name ?? ""}${s.substitute_id === me.person.id ? " · " + t("session.sub") : ""}`, off: s.cancelled, session: s });
    for (const pid of familyIds) if (s.team_id && familyTeams(pid).has(s.team_id) && !(mineStaff && pid === me.person.id)) { const a = absences.find((x) => x.session_id === s.id && x.person_id === pid); week.push({ key: "tr" + s.id + pid, at: s.starts_at, end: s.ends_at, kind: "training", title: s.team_name ?? "", sub: `${s.room_name ?? ""} · ${s.substitute_name ?? s.trainer_name ?? ""}${a ? " · " + t("session.absenceSentChip") : ""}`, who: nameOf(pid) ?? undefined, off: s.cancelled, session: s }); }
  }
  for (const e of events) if (new Date(e.starts_at) < weekEnd && (!e.team_ids.length || e.team_ids.some((id) => myTeamIds.has(id)))) week.push({ key: "ev" + e.id, at: e.starts_at, end: e.ends_at, kind: "event", title: e.title, sub: `${e.place ?? t(`events.kind.${e.kind}`)}${e.meet_time ? " · " + t("events.meet") + " " + e.meet_time : ""}`, event: e });
  for (const b of bookings) if (b.person_id === me.person.id && b.status !== "rejected" && new Date(b.starts_at) < weekEnd) week.push({ key: "bk" + b.id, at: b.starts_at, end: b.ends_at, kind: "booking", title: b.title, sub: `${b.room_name}${b.status === "pending" ? " · " + t("rooms.pending") : ""}` });
  week.sort((a, b) => a.at.localeCompare(b.at));
  const weekDays = [...new Set(week.map((w) => new Date(w.at).toDateString()))];
  const nowMs = Date.now();
  const tomorrow = addDays(startOfDay(new Date()), 1).toDateString();
  const nextItem = week.find((w) => !w.off && (new Date(w.end ?? w.at).getTime() > nowMs)) ?? null;
  const rel = (iso: string) => { const d = new Date(iso); const diff = d.getTime() - nowMs; const min = Math.round(diff / 60000); if (min < 1) return t("home.today"); if (min < 60) return t("home.inMin", { n: min }); if (d.toDateString() === today) return t("home.inHours", { h: Math.floor(min / 60), m: min % 60 }); if (d.toDateString() === addDays(startOfDay(new Date()), 1).toDateString()) return `${t("home.tomorrow")} ${hm(iso)}`; return `${dateLabel(iso)} ${hm(iso)}`; };
  const teamById = (id?: string | null) => me.teams.find((x) => x.id === id);
  const KIND_CHIP: Record<WeekItem["kind"], string> = { training: "week.training", staff: "week.youTrain", event: "week.event", booking: "week.booking" };

  /* hero image: the viewed person's own team photo (Line's) → next event's image → school default → art */
  const selTeam = selectedTeamId ? me.teams.find((x) => x.id === selectedTeamId && (teamIds.has(x.id) || me.person.is_admin)) : undefined;   // the team chosen in the picker – follows the hat (own team / child's team)
  const firstTeam = selTeam ?? me.teams.find((x) => teamIds.has(x.id));
  const ownPhoto = firstTeam && /^https?:/.test(firstTeam.cover_url ?? "") ? firstTeam.cover_url : firstTeam?.photos?.[0] ?? (firstTeam && /^https?:/.test(firstTeam.about_url ?? "") ? firstTeam.about_url : null);
  const heroImg = resolveImage(ownPhoto) ?? catalogUrl(hero?.image_key) ?? catalogUrl(appearance.images?.hero) ?? artFor(viewing.personId, ["group", "trails", "studio"]);
  const heroFocus = resolveImage(ownPhoto) ? firstTeam?.focus : catalogUrl(hero?.image_key) ? hero?.focus : null;
  const nextTeam = teamById(nextItem?.session?.team_id);
  const nextImg = nextItem?.session?.team_id ? ((resolveImage(nextTeam?.cover_url) === heroImg ? resolveImage(nextTeam?.photos?.find((u) => resolveImage(u) !== heroImg) ?? null) ?? resolveImage(nextTeam?.about_url) : null) ?? resolveImage(nextTeam?.cover_url) ?? artFor(nextItem.session.team_id, ["group", "studio"])) : nextItem?.event ? (catalogUrl(nextItem.event.image_key) ?? artFor(nextItem.event.id)) : null;
  const nextFocus = nextItem?.session?.team_id ? (nextImg === resolveImage(nextTeam?.cover_url) ? nextTeam?.focus : null) : nextItem?.event?.focus;
  useScene(heroImg);
  const hour = new Date().getHours(); const tone = hour < 10 ? "morning" : hour < 17 ? "day" : "evening";
  const greeting = t(`home.greet.${tone}`, { name: me.person.first_name }); // always the logged-in person – the child's name goes on the sections below
  const heroRef = useRef<HTMLDivElement>(null);
  useEffect(() => { // parallax only with a mouse (pointer:fine) – on touch devices the per-frame style writes stutter; the hero then just scrolls with the page
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0; const on = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const el = heroRef.current; if (!el) return; const y = Math.min(window.scrollY, 600); el.style.setProperty("--py", `${Math.round(y * 0.35)}px`); el.style.setProperty("--fade", String(Math.max(0, 1 - y / 320))); }); };
    addEventListener("scroll", on, { passive: true }); return () => { removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);
  const strip = Array.from({ length: 7 }, (_, i) => addDays(startOfDay(new Date()), i));
  const dateLine = new Date().toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long" });
  const SECTIONS: Record<string, () => React.ReactNode> = {
    hero: () => (<>
      <div ref={heroRef} className={"homehero tone-" + tone + (isSitePhoto(heroImg) && !heroFocus ? " photo" : "")} data-testid="hero" data-tour="hero">
        <div className={"homehero-media" + (isSitePhoto(heroImg) && !heroFocus ? " photo" : "")}><HeroMedia src={heroImg} focus={heroFocus} /></div>
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
          { n: bookings.filter((b) => b.status === "approved" && new Date(b.starts_at).toDateString() === today).length, label: t("home.bookingsToday"), go: () => setTab("rooms") },
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
        <div className="card list" style={{ borderColor: "var(--gold3)" }} data-testid="subs-wanted">
          <div className="eyebrow" style={{ padding: "4px 0 2px" }}>{t("home.subsWanted")}</div>
          {subWanted.map((s) => <button key={s.id} className="item" onClick={() => setOpen(s)}><span className="time">{dateLabel(s.starts_at)} {hm(s.starts_at)}</span><span className="grow">{s.team_name}</span><span className="gold">›</span></button>)}
        </div>
      )}
    </>),
    yourDay: () => (<>
      {isStaff && !isAdmin && !viewing.isChild && staffTodayAll.length > 0 && (
        <div className="sec" data-testid="trainer-today"><h2>{t("home.yourDay")}</h2>
          <div className="todaycards">{staffTodayAll.map((s) => { const abs = absences.filter((a) => a.session_id === s.id).length; const done = new Date(s.ends_at) < new Date(); return (
            <div key={s.id} className={"card todaycard" + (s.cancelled ? " off" : "")} data-testid="today-card">
              <button type="button" className="todaycard-main" onClick={() => setOpen(s)}><span className="time">{hm(s.starts_at)}<br /><span className="tiny">{hm(s.ends_at)}</span></span><span className="grow"><b>{s.title ?? s.team_name}</b><div className="tiny">{s.room_name}{s.substitute_id === me.person.id ? " · " + t("session.sub") : ""}{s.cancelled ? " · " + t("session.cancelled") : ""}</div></span></button>
              {!s.cancelled && <div className="todaycard-actions">
                <span className={"chip small" + (abs ? " rose" : "")}>{t("home.absCount", { count: abs })}</span>
                <button type="button" className={"chip small" + (s.lesson_plan ? " sage" : " gold")} onClick={() => setOpen(s)}>{s.lesson_plan ? t("session.planShort") + " ✓" : t("session.writePlan")}</button>
                {done && <button type="button" className="chip small" onClick={() => setOpen(s)}>{t("session.attendance")}</button>}
              </div>}
            </div>); })}</div>
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
    adminTodo: () => (<>
      {isAdmin && !viewing.isChild && (() => { const c = adminCounts; const rows: [string, number, string][] = [["users", c.pending, "pending"], ["payments", c.payments, "payments"], ["bookings", c.bookings, "bookings"], ["season", c.subs, "subs"], ["reports", c.reports, "reports"], ["shop", c.orders, "orders"], ["punch", c.cards, "cards"], ["auditions", c.auditions, "auditions"]]; const todos = rows.filter(([, n]) => n > 0); return (
        <div className="sec" data-testid="admin-todo"><h2>{t("home.adminTodo")}</h2>
          <div className="card todorow">{todos.length ? todos.map(([page, n, key]) => <button key={page} type="button" className="todochip" onClick={() => openAdmin(page)}><b>{n}</b><span>{t(`todo.${key}`, { count: n }).replace(/^\d+\s*/, "")}</span></button>) : <span className="small muted">{t("admin.nothingTodo")}</span>}</div>
        </div>); })()}
    </>),
    studioHead: () => (<>
      {isAdmin && <div className="sec studiohead" data-testid="studio-head"><div className="eyebrow gold">{t("home.studioEyebrow")}</div><h2 className="display">{t("home.studioTitle")}</h2><p className="tiny muted" style={{ margin: 0 }}>{t("home.studioSub")}</p></div>}
    </>),
    upcoming: () => (<>
      {upcoming.length > 0 && (
        <div className="sec"><h2>{t("home.upcoming")}</h2>
          <div className="evgrid" data-testid="upcoming">{upcoming.slice(0, 4).map((e) => { const d = new Date(e.starts_at); return (
            <button key={e.id} className="evtile" onClick={() => setOpenEvent(e)} style={focusStyle(e.focus, { backgroundImage: `url(${catalogUrl(e.image_key) ?? artFor(e.id)})` })}>
              <span className="stamp"><b>{d.getDate()}</b><small>{d.toLocaleDateString(loc(), { month: "short" }).replace(".", "")}</small></span>
              <span className="evtile-text"><span className="eyebrow">{t(`events.kind.${e.kind}`)}{e.team_names?.length ? ` · ${e.team_names.slice(0, 2).join(", ")}${e.team_names.length > 2 ? " …" : ""}` : ""}</span><b className="display">{e.title}</b><span className="tiny">{e.place ?? ""}</span></span>
              {e.mySignups ? <span className="chip small ok">{t("events.signedUp")}</span> : null}
            </button>); })}</div>
          {upcoming.length > 4 && <button className="linklike small" onClick={() => setTab("events")}>{t("home.allEvents")} ›</button>}
        </div>
      )}
    </>),
    next: () => (<>
      {nextItem && nextImg && (
        <div className="nextcard" data-testid="next-card" role="button" tabIndex={0} onClick={() => (nextItem.session ? setOpen(nextItem.session) : nextItem.event ? setOpenEvent(nextItem.event) : setTab("rooms"))} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (nextItem.session ? setOpen(nextItem.session) : nextItem.event ? setOpenEvent(nextItem.event) : setTab("rooms")); } }}>
          <span className="bg" style={focusStyle(nextFocus, { backgroundImage: `url(${nextImg})` })} />
          <span className="nextcard-top"><span className="eyebrow gold">{nextItem.kind === "training" ? (nextItem.who ? t("home.nextFor", { name: nextItem.who }) : t("home.nextYours")) : nextItem.kind === "staff" ? t("home.nextYouTrain") : `${t("home.nextUp")} · ${t(KIND_CHIP[nextItem.kind])}`}</span><span className="chip small glass">{rel(nextItem.at)}</span></span>
          <span className="nextcard-text"><b className="display">{nextItem.title}</b><span className="small">{hm(nextItem.at)}{nextItem.end ? `–${hm(nextItem.end)}` : ""} · {nextItem.sub}{nextItem.session?.substitute_name || nextItem.session?.trainer_name ? ` · ${nextItem.session.substitute_name ?? nextItem.session.trainer_name}` : ""}{nextItem.who ? ` · ${nextItem.who}` : ""}</span></span>
          {/* one visible action: what the person most likely wants to do with this training/event */}
          <span className="nextcard-actions">
            {nextItem.kind === "training" && nextItem.session && <button type="button" className="ghost small" data-testid="next-action" onClick={(e) => { e.stopPropagation(); setOpen(nextItem.session!); }}>{nextItem.who ? t("session.reportAbsenceFor", { name: nextItem.who }) : t("session.reportAbsence")}</button>}
            {nextItem.kind === "staff" && nextItem.session && <button type="button" className="ghost small" data-testid="next-action" onClick={(e) => { e.stopPropagation(); setOpen(nextItem.session!); }}>{nextItem.session.lesson_plan ? t("session.planShort") : t("session.writePlan")}</button>}
            {nextItem.kind === "event" && nextItem.event && <button type="button" className="ghost small" data-testid="next-action" onClick={(e) => { e.stopPropagation(); setOpenEvent(nextItem.event!); }}>{nextItem.event.mySignups ? t("events.on") : t("events.signUp")}</button>}
          </span>
        </div>
      )}
    </>),
    teampick: () => (<>
      {(!isAdmin || me.teams.length > 0) && <TeamPicker />}
      {!me.person.supervised_by && signupsOpen && <button type="button" className="linklike small home-join" data-testid="home-join" onClick={() => setJoin(true)}>+ {t("pay.join")}</button>}
      {/* week strip: the dots follow the team chosen above – its trainings and events */}
      {(!isAdmin || teamIds.size > 0) && <div className="weekstrip" data-testid="weekstrip">
        {strip.map((d) => { const key = d.toDateString(); const n = week.filter((w) => new Date(w.at).toDateString() === key).length || sessions.filter((x) => x.team_id === teamId && !x.cancelled && new Date(x.starts_at).toDateString() === key).length; return <button type="button" key={key} className={"d" + (key === today ? " today" : "") + (n ? " has" : "") + (selDay === key ? " sel" : "")} onClick={() => setSelDay(selDay === key ? null : key)} aria-pressed={selDay === key} aria-label={`${DAY_LONG[(d.getDay() + 6) % 7]} ${d.getDate()}. · ${n ? t("home.stripHas", { count: n }) : t("home.stripNone")}`} title={n ? t("home.stripHas", { count: n }) : t("home.stripNone")}><small>{DAY_SHORT[(d.getDay() + 6) % 7]}</small><b>{d.getDate()}</b><i /></button>; })}
      </div>}
      {selDay && (() => { const items = week.filter((w) => new Date(w.at).toDateString() === selDay); return (
        <div className="daypanel list" data-testid="day-panel">
          <div className="eyebrow gold">{dateLabel(items[0]?.at ?? new Date(selDay).toISOString())}</div>
          {items.map((w) => <button key={w.key} className={"item" + (w.off ? " off" : "")} data-kind={w.kind} onClick={() => (w.session ? setOpen(w.session) : w.event ? setOpenEvent(w.event) : setTab("rooms"))}><span className="time">{hm(w.at)}</span><span className="grow">{w.title}{w.who ? <span className="chip small" style={{ marginLeft: 6 }}>{w.who}</span> : null}<div className="tiny">{w.sub}</div></span><span className={"chip small " + w.kind}>{t(KIND_CHIP[w.kind])}</span></button>)}
          {!items.length && <Empty symbol="◷" text={t("home.dayNothing")} />}
        </div>); })()}
    </>),
    week: () => (<>
      {(week.length > 0 || teamIds.size > 0) && (
        <div className="sec" data-tour="week" data-testid="your-week"><h2>{hat ? t("home.childsWeek", { name: hat.first_name }) : t("home.yourWeek")}</h2>
          <ScrollList className="weeklist">
            {weekDays.filter((d) => weekAll || d === today || d === tomorrow).map((d) => { const items = week.filter((w) => new Date(w.at).toDateString() === d); const isToday = d === today; return (
              <div key={d} className="weekday">
                <div className={"eyebrow" + (isToday ? " gold" : "")}>{isToday ? t("home.today") + " · " : ""}{dateLabel(items[0].at)}</div>
                {items.map((w) => (
                  <button key={w.key} className={"item" + (w.off ? " off" : "")} data-kind={w.kind} onClick={() => (w.session ? setOpen(w.session) : w.event ? setOpenEvent(w.event) : setTab("rooms"))}>
                    <span className="time">{hm(w.at)}{w.end ? <><br /><span className="tiny">{hm(w.end)}</span></> : null}</span>
                    {(w.session?.substitute_name || w.session?.trainer_name) && <span className="avatar small" aria-hidden>{(w.session.substitute_name ?? w.session.trainer_name ?? "?")[0]}</span>}
                    <span className="grow">{w.title}{w.who ? <span className="chip small" style={{ marginLeft: 6 }}>{w.who}</span> : null}<div className="tiny">{w.sub}{w.off ? " · " + t("session.cancelled") : ""}</div></span>
                    <span className={"chip small " + w.kind}>{t(KIND_CHIP[w.kind])}</span>
                  </button>))}
              </div>); })}
            {!week.length && <Empty symbol="◷" text={t("home.noTrainings")} />}
            {!weekAll && week.some((w) => { const d = new Date(w.at).toDateString(); return d !== today && d !== tomorrow; }) && (
              <button type="button" className="linklike small" data-testid="week-more" onClick={() => setWeekAll(true)}>{t("home.restOfWeek", { count: week.filter((w) => { const d = new Date(w.at).toDateString(); return d !== today && d !== tomorrow; }).length })} ›</button>)}
            {week.length > 0 && !week.some((w) => w.at.slice(0, 10) === new Date().toISOString().slice(0, 10)) && !weekAll && <p className="tiny muted" style={{ margin: "6px 0 0" }}>{t("home.nothingToday")}</p>}
          </ScrollList>
        </div>
      )}
    </>),
    audition: () => <AuditionCards />,
    payments: () => childLogin ? null : (<>
      <MyPayments embedded />
      {openPay.length > 0 && (
        <button type="button" className="card paysum" data-testid="shop-pay-line" onClick={() => setTab("shop")}>
          <span className="dot rose" aria-hidden /><span className="grow"><b>{t("home.shopPayLine", { count: openPay.length })}</b><span className="tiny muted"> · {openPay.reduce((n, p) => n + p.amount, 0)} kr. · {openPay.map((p) => p.label).join(", ")}</span></span><span className="gold">›</span>
        </button>
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
  let order = homeOrder(appearance).filter((k) => !isHidden(appearance, k));
  if (isAdmin) { // the studio block is Line's "what happens today" – it goes right under the next-card instead of at the bottom
    // Line's day first: to-dos, studio numbers, what happens in the studio – then her personal content
    const studioKeys = ["studioHead", "adminTodo", "stats", "studio"]; const rest = order.filter((k) => !studioKeys.includes(k)); const at = (rest.indexOf("teampick") + 1) || (rest.indexOf("hero") + 1) || 1;
    order = [...rest.slice(0, at), ...studioKeys.filter((k) => order.includes(k) || k === "adminTodo"), ...rest.slice(at)];
  }
  const FOLD = new Set(["gallery", "badges", "upcoming"]);   // nice-to-have content lives under one "Mere" fold – the first screen stays about now
  const main = order.filter((k) => !FOLD.has(k)); const folded = order.filter((k) => FOLD.has(k));
  const renderKey = (k: string) => { const box = boxOf(appearance, k); return <Fragment key={k}>{box ? <CustomBoxCard box={box} onTab={(tab) => setTab(tab as Parameters<typeof setTab>[0])} /> : SECTIONS[k]?.()}</Fragment>; };

  return (
    <section className="screen home">

      {main.map(renderKey)}
      {folded.length > 0 && (
        <div className={"sec home-more" + (moreOpen ? " open" : "")} data-testid="home-more">
          <button type="button" className="home-more-head" onClick={toggleMore} aria-expanded={moreOpen}><h2>{t("home.more")}</h2><span className="tiny muted">{t("home.moreSub")}</span><span className="caret" aria-hidden>{moreOpen ? "⌃" : "⌄"}</span></button>
          {moreOpen && <div className="home-more-body">{folded.map(renderKey)}</div>}
        </div>
      )}

      {join && <JoinTeam onClose={() => { setJoin(false); void load(); }} toast={say} />}
      {openEvent && <EventSheet event={openEvent} staff={isStaff} onClose={() => { setOpenEvent(null); void load(); }} onChanged={() => void load()} toast={say} />}
      {open && <SessionSheet session={open} absences={absences} onClose={() => setOpen(null)} onChanged={() => void load()} toast={say} />}
      <Toast msg={toast} />
    </section>
  );
}
