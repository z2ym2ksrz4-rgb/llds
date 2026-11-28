import { SiteTrainers } from "./SiteTrainers";
import { TEAM_THEMES } from "../lib/art";
import { Closures } from "./Closures";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Booking, type Member, type Message, type Order, type Product, type PunchCard, type PunchCardType, type Report, type Session, type Team, type TeamInput } from "@/core/api";
import { Events } from "../screens/Events";
import { ImportPhotos } from "./ImportPhotos";
import { Customize } from "./Customize";
import { PaymentsAdmin } from "../screens/Payments";
import { CatalogAdmin } from "./Catalog";
import { MessageComposer, MessageSheet } from "../components/Messages";
import { ago, isoDate, loc } from "../lib/time";
import { AdminUsers } from "./Users";
import { ImportMembers } from "./ImportMembers";
import { MemberSheet } from "./MemberSheet";
import { Sheet, Toast } from "../components/Sheet";
import { useNav } from "@/core/nav";
import { useAuth } from "@/core/auth";
import { useBadges } from "@/core/badges";
import { SessionEditor } from "../components/SessionSheet";
import { ImagePicker } from "../components/ImagePicker";
import { Website } from "./Website";
import { InsightsPage } from "./Insights";
import { AuditionAdmin } from "../screens/Audition";
import type { AuditionCandidate } from "@/core/api";
import { CATALOG } from "../lib/catalog";
import { addDays, DAY_LONG, hm, mondayOf, startOfDay } from "../lib/time";

type Page = "menu" | "importmembers" | "users" | "members" | "teams" | "season" | "bookings" | "messages" | "reports" | "events" | "shop" | "punch" | "import" | "catalog" | "customize" | "website" | "trainers" | "payments" | "insights" | "auditions";
const CATS = ["mini", "kids", "junior", "adult", "mixed"] as const;

/** what the search on the Admin menu hands to the page it opens (Members reads it once as its starting filter) */
const adminQuery = { q: "" };
/** Admin menu search: menu items, people and teams by name – a tap opens the right page with the name filled in. */
function AdminSearch({ q, menu, onPage }: { q: string; menu: { k: Page; label: string }[]; onPage: (p: Page, query?: string) => void }) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]); const [teams, setTeams] = useState<Team[]>([]);
  useEffect(() => { void api.listMembers().then(setMembers).catch(() => setMembers([])); void api.listTeams().then(setTeams).catch(() => setTeams([])); }, []);
  const low = q.toLowerCase(); const has = (x: string) => x.toLowerCase().includes(low);
  const pages = menu.filter((m) => has(m.label)); const people = members.filter((m) => has(`${m.first_name} ${m.last_name}`) || has(m.email ?? "")).slice(0, 8); const tms = teams.filter((x) => has(x.name)).slice(0, 6);
  if (!pages.length && !people.length && !tms.length) return <p className="muted small" data-testid="admin-search-none">{t("admin.searchNone")}</p>;
  return (
    <div className="card list" data-testid="admin-search-results" style={{ marginBottom: 12 }}>
      {pages.map((m) => <button key={"p" + m.k} type="button" className="item" onClick={() => onPage(m.k)}><span className="grow">{m.label}<div className="tiny">{t("admin.searchPage")}</div></span><span className="gold">›</span></button>)}
      {people.map((m) => <button key={m.id} type="button" className="item" data-testid="admin-search-person" onClick={() => onPage("members", `${m.first_name} ${m.last_name}`.trim())}><span className="grow">{m.first_name} {m.last_name}<div className="tiny">{t("admin.searchPerson")}{m.email ? ` · ${m.email}` : ""}</div></span><span className="gold">›</span></button>)}
      {tms.map((x) => <button key={x.id} type="button" className="item" onClick={() => onPage("teams")}><span className="grow">{x.name}<div className="tiny">{t("admin.searchTeam")}</div></span><span className="gold">›</span></button>)}
    </div>);
}

/** Admin: the one place Line runs the school from. Everything else in the app reads what she sets here. */
export function Admin() {
  const { t } = useTranslation();
  const [page, setPage] = useState<Page>(() => (useNav.getState().takeAdminPage() as Page | null) ?? "menu");
  useEffect(() => { const f = (e: Event) => { if ((e as CustomEvent).detail === "admin") setPage("menu"); }; window.addEventListener("llds:tab-again", f); return () => window.removeEventListener("llds:tab-again", f); }, []);   // tapping Admin again = back to the Admin menu
  const adminPage = useNav((n) => n.adminPage);
  useEffect(() => { const p = useNav.getState().takeAdminPage(); if (p) setPage(p as Page); }, [adminPage]);
  const [find, setFind] = useState("");
  const counts = useBadges((b) => b.admin); const refreshBadges = useBadges((b) => b.refresh);
  useEffect(() => { void refreshBadges(); }, [page, refreshBadges]); // every return to the menu re-counts
  if (page === "users") return <Back onBack={() => setPage("menu")}><AdminUsers /></Back>;
  if (page === "importmembers") return <Back onBack={() => setPage("menu")}><ImportMembers /></Back>;
  if (page === "members") return <Back onBack={() => setPage("menu")}><Members /></Back>;
  if (page === "teams") return <Back onBack={() => setPage("menu")}><Teams /></Back>;
  if (page === "season") return <Back onBack={() => setPage("menu")}><Season /></Back>;
  if (page === "bookings") return <Back onBack={() => setPage("menu")}><Bookings /></Back>;
  if (page === "messages") return <Back onBack={() => setPage("menu")}><Messages /></Back>;
  if (page === "reports") return <Back onBack={() => setPage("menu")}><Reports /></Back>;
  if (page === "events") return <Back onBack={() => setPage("menu")}><Events admin /></Back>;
  if (page === "shop") return <Back onBack={() => setPage("menu")}><ShopAdmin /></Back>;
  if (page === "punch") return <Back onBack={() => setPage("menu")}><PunchAdmin /></Back>;
  if (page === "import") return <Back onBack={() => setPage("menu")}><ImportPhotos /></Back>;
  if (page === "catalog") return <Back onBack={() => setPage("menu")}><CatalogAdmin /></Back>;
  if (page === "customize") return <Back onBack={() => setPage("menu")}><Customize /></Back>;
  if (page === "website") return <Back onBack={() => setPage("menu")}><Website /></Back>;
  if (page === "trainers") return <Back onBack={() => setPage("menu")}><SiteTrainers /></Back>;
  if (page === "insights") return <Back onBack={() => setPage("menu")}><InsightsPage /></Back>;
  if (page === "auditions") return <Back onBack={() => setPage("menu")}><AuditionsOverview /></Back>;
  if (page === "payments") return <Back onBack={() => setPage("menu")}><PaymentsAdmin /></Back>;
  const todo = (n: number, key: string, sub: string) => (n ? t(`todo.${key}`, { count: n }) : sub);
  const item = (k: Page, label: string, sub: string, n = 0): [Page, string, string, number] => [k, label, sub, n];
  const groups: { key: string; items: [Page, string, string, number][] }[] = [
    { key: "people", items: [item("users", t("admin.users"), todo(counts.pending, "pending", t("admin.usersSub")), counts.pending), item("members", t("admin.members"), t("admin.membersSub")), item("importmembers", t("import.title"), t("import.sub")), item("teams", t("admin.teams"), t("admin.teamsSub"))] },
    { key: "program", items: [item("season", t("admin.season"), todo(counts.subs, "subs", t("admin.seasonSub")), counts.subs), item("bookings", t("admin.bookings"), todo(counts.bookings, "bookings", t("admin.bookingsSub")), counts.bookings), item("events", t("events.title"), t("admin.eventsSub")), item("auditions", t("audition.adminTitle"), todo(counts.auditions, "auditions", t("audition.adminSub")), counts.auditions)] },
    { key: "comms", items: [item("messages", t("admin.messages"), t("admin.messagesSub")), item("reports", t("admin.reports"), todo(counts.reports, "reports", t("admin.reportsSub")), counts.reports), item("customize", t("customize.title"), t("customize.sub")), item("website", t("website.title"), t("website.sub")), item("trainers", t("siteTrainers.menu"), t("siteTrainers.menuSub")), item("catalog", t("catalog.adminTitle"), t("catalog.adminSub"))] },
    { key: "money", items: [item("payments", t("pay.adminTitle"), todo(counts.payments, "payments", t("pay.adminSub")), counts.payments), item("shop", t("admin.shop"), todo(counts.orders, "orders", t("admin.shopSub")), counts.orders), item("punch", t("punch.title"), todo(counts.cards, "cards", t("admin.punchSub")), counts.cards)] },
    { key: "insight", items: [item("insights", t("insights.title"), t("insights.sub"))] },   // "Importér billeder" was a one-off for Line's photo pack – still reachable via openAdmin("import")
  ];
  const todos = groups.flatMap((g) => g.items).filter(([, , , n]) => n > 0);
  return (
    <section className="screen adminhome">
      <header className="topbar"><h1 className="display">{t("nav.admin")}</h1></header>
      <input type="search" value={find} placeholder={t("admin.searchPh")} data-testid="admin-search" onChange={(e) => setFind(e.target.value)} style={{ marginBottom: 10 }} />
      {find.trim().length >= 2 && <AdminSearch q={find.trim()} onPage={(pg, query) => { adminQuery.q = query ?? ""; setPage(pg); }} menu={groups.flatMap((g) => g.items).map(([k, label]) => ({ k, label }))} />}
      {/* to-dos first: what needs Line right now, one row of chips */}
      <div className="card todorow" data-testid="admin-todos">
        {todos.length ? todos.map(([k, , sub, n]) => <button key={k} type="button" className="todochip" onClick={() => setPage(k)}><b>{n}</b><span>{sub.replace(/^\d+\s*/, "")}</span></button>) : <span className="small muted">{t("admin.nothingTodo")}</span>}
      </div>
      <div className="admingroups">
        {groups.map((g) => (
          <div className="sec" key={g.key}><h2>{t(`adminGroup.${g.key}`)}</h2>
            <div className="card list">
              {g.items.map(([k, label, sub, n]) => <button key={k} className="item" data-testid={`admin-${k}`} onClick={() => setPage(k)}><span className="grow">{label}<div className={"tiny" + (n > 0 ? " todo" : "")}>{sub}</div></span>{n > 0 && <span className="chip warn small">{n}</span>}<span className="gold">›</span></button>)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
function Back({ onBack, children }: { onBack: () => void; children: React.ReactNode }) { const { t } = useTranslation(); return <div><button className="linklike" onClick={onBack}>‹ {t("nav.admin")}</button>{children}</div>; }

/* ---------------- Members: everyone approved, their teams/roles, child logins, deactivate ---------------- */
function Members() {
  const { t } = useTranslation();
  const [all, setAll] = useState<Member[]>([]); const [teams, setTeams] = useState<Team[]>([]); const [q, setQ] = useState(() => { const x = adminQuery.q; adminQuery.q = ""; return x; }); const [open, setOpen] = useState<Member | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => { const [m, tm] = await Promise.all([api.listMembers(), api.listTeams()]); setAll(m.filter((p) => p.status === "approved")); setTeams(tm); }, []);
  useEffect(() => { void load(); }, [load]);
  type Filter = "all" | "dancers" | "parents" | "staff" | "nologin";
  const [filter, setFilter] = useState<Filter>("all");
  const pred = (f: Filter, p: Member) => f === "all" ? true : f === "dancers" ? p.memberships.some((m) => m.role === "dancer") : f === "parents" ? p.children.length > 0 : f === "staff" ? p.memberships.some((m) => m.role === "trainer" || m.role === "assistant") : !p.user_id;
  const match = (p: Member) => pred(filter, p);
  const list = all.filter((p) => match(p) && `${p.first_name} ${p.last_name} ${p.email ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("admin.members")} · {all.length}</h1></header>
      <input id="mq" placeholder={t("admin.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips scrollx" data-testid="member-filters">{(["all", "dancers", "parents", "staff", "nologin"] as Filter[]).map((f) => <button key={f} type="button" className={"chip" + (filter === f ? " on" : "")} aria-pressed={filter === f} onClick={() => setFilter(f)}>{t(`admin.filter.${f}`)}{f !== "all" ? ` · ${all.filter((p) => pred(f, p)).length}` : ""}</button>)}</div>
      <div className="card list">
        {list.map((p) => <button key={p.id} className="item" onClick={() => setOpen(p)}><span className="avatar">{p.first_name[0]}</span><span className="grow">{p.first_name} {p.last_name}{p.is_admin ? <span className="chip gold small" style={{ marginLeft: 6 }}>Admin</span> : ""}
          <div className="tiny rolechips">{[p.memberships.some((m) => m.role === "dancer") ? t("roles.dancer") : null, p.children.length ? t("admin.parentOf", { names: p.children.map((c) => c.first_name).join(", ") }) : null, p.memberships.some((m) => m.role === "trainer") ? t("roles.trainer") : null, p.memberships.some((m) => m.role === "assistant") ? t("roles.assistant") : null].filter(Boolean).map((x, i) => <span key={i} className="rc">✓ {x}</span>)}{!p.memberships.length && !p.children.length && <span className="rc off">{t("admin.noTeams")}</span>}</div></span><span className="gold">›</span></button>)}
      </div>
      {open && <MemberSheet key={open.id} member={all.find((m) => m.id === open.id) ?? open} all={all} teams={teams} onClose={() => setOpen(null)} onChanged={() => { void load(); }} onOpen={(m) => setOpen(m)} toast={say} />}
      <Toast msg={toast} />
    </section>
  );
}

/* ---------------- Teams: create/edit, flags Line controls ---------------- */
function Teams() {
  const { t } = useTranslation();
  const [teams, setTeams] = useState<Team[]>([]); const [open, setOpen] = useState<Team | "new" | null>(null);
  const [openAll, setOpenAll] = useState(true);
  const load = useCallback(async () => { setTeams(await api.listTeams()); setOpenAll(await api.signupsOpen().catch(() => true)); }, []);
  useEffect(() => { void load(); }, [load]);
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("admin.teams")} · {teams.length}</h1><button className="ghost small" onClick={() => setOpen("new")}>+ {t("admin.newTeam")}</button></header>
      <label className="toggle card" data-testid="signups-open-all"><span>{t("admin.signupsOpenAll")}<div className="tiny">{t("admin.signupsOpenAllHint")}</div></span><input type="checkbox" checked={openAll} onChange={async (e) => { setOpenAll(e.target.checked); await api.setSignupsOpen(e.target.checked); }} /></label>
      {CATS.map((c) => { const list = teams.filter((x) => x.category === c); return list.length ? (
        <div className="sec" key={c}><div className="eyebrow">{t(`category.${c}`)}</div><div className="card list">
          {list.map((x) => <button key={x.id} className="item" onClick={() => setOpen(x)}><span className="grow">{x.name}<div className="tiny">{x.style} · {x.level}{x.closed ? " · " + t("team.closed") : ""}{x.signup_open === false ? " · " + t("admin.signupClosedChip") : ""}{x.parents_see_video ? " · " + t("admin.parentsSeeVideo") : ""}{x.punch_card_open ? " · " + t("team.punchOpen") : ""}</div></span><span className="gold">›</span></button>)}
        </div></div>) : null; })}
      {open && <TeamEditor team={open === "new" ? null : open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void load(); void useAuth.getState().refresh(); }} />}   /* refresh me.teams too – the team page reads covers from there */
    </section>
  );
}
function TeamEditor({ team, onClose, onSaved }: { team: Team | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [f, setF] = useState<TeamInput & { name: string }>({ name: team?.name ?? "", style: team?.style ?? "Showdance", category: team?.category ?? "junior", level: team?.level ?? "", audition_open: team?.audition_open ?? false, color: team?.color ?? null, closed: team?.closed ?? false, parents_see_video: team?.parents_see_video ?? false, punch_card_open: team?.punch_card_open ?? false, visibility: team?.visibility ?? "public", description: team?.description ?? "", cover_url: team?.cover_url && !/supabase|token=/.test(team.cover_url) ? team.cover_url : null, about_url: team?.about_url ?? null, focus: team?.focus ?? null, admission: team?.admission ?? (team?.closed ? "audition" : "open"), admission_note: team?.admission_note ?? "", price_full: team?.price_full ?? null, price_half: team?.price_half ?? null, price_signup: team?.price_signup ?? null, price_note: team?.price_note ?? "", installments_allowed: team?.installments_allowed ?? true, signup_open: team?.signup_open ?? true });
  const toRef = (v: string | null | undefined) => v?.startsWith("art/catalog/") ? v.replace("art/catalog/", "").replace(/\.\w+$/, "") : v?.startsWith("http") ? v : null;
  const fromRef = (k: string | null) => !k ? null : k.startsWith("http") ? k : `art/catalog/${CATALOG.find((c) => c.key === k)?.file}`;
  const ownPhotos = [...new Set([team?.cover_url, team?.alt_url, ...(team?.photos ?? [])].filter((u): u is string => !!u && u.startsWith("http") && !/supabase|token=/.test(u)))];
  const Toggle = ({ k, label, hint }: { k: "closed" | "parents_see_video" | "punch_card_open" | "signup_open" | "audition_open"; label: string; hint: string }) => <label className="toggle"><span>{label}<div className="tiny">{hint}</div></span><input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /></label>;
  return (
    <Sheet onClose={onClose} eyebrow={team ? t("common.edit") : t("admin.newTeam")} title={f.name || t("admin.team")}>
      <label className="field"><span>{t("admin.teamName")}</span><input id="tm-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="grid2">
        <label className="field"><span>{t("admin.style")}</span><input value={f.style ?? ""} onChange={(e) => setF({ ...f, style: e.target.value })} /></label>
        <label className="field"><span>{t("admin.level")}</span><input value={f.level ?? ""} onChange={(e) => setF({ ...f, level: e.target.value })} /></label>
      </div>
      <div className="field"><span>{t("admin.category")}</span><div className="chips">{CATS.map((c) => <button key={c} className={"chip" + (f.category === c ? " on" : "")} onClick={() => setF({ ...f, category: c, parents_see_video: c === "mini" || c === "kids" ? true : f.parents_see_video })}>{t(`category.${c}`)}</button>)}</div></div>
      <div className="field"><span>{t("admin.prices")}</span>
        <div className="grid2">
          <label className="field"><span>{t("pay.plan.full")} (kr.)</span><input type="number" inputMode="numeric" value={f.price_full ?? ""} data-testid="tm-price-full" onChange={(e) => setF({ ...f, price_full: e.target.value ? Number(e.target.value) : null })} /></label>
          <label className="field"><span>{t("pay.plan.half")} (kr.)</span><input type="number" inputMode="numeric" value={f.price_half ?? ""} onChange={(e) => setF({ ...f, price_half: e.target.value ? Number(e.target.value) : null })} /></label>
          <label className="field"><span>{t("admin.priceSignup")}</span><input type="number" inputMode="numeric" value={f.price_signup ?? ""} onChange={(e) => setF({ ...f, price_signup: e.target.value ? Number(e.target.value) : null })} /></label>
          <label className="toggle"><span>{t("admin.installments")}<div className="tiny">{t("admin.installmentsHint")}</div></span><input type="checkbox" checked={f.installments_allowed !== false} onChange={(e) => setF({ ...f, installments_allowed: e.target.checked })} /></label>
        </div>
        <input value={f.price_note ?? ""} placeholder={t("admin.priceNotePh")} onChange={(e) => setF({ ...f, price_note: e.target.value })} />
        <div className="tiny">{t("admin.pricesHint")}</div>
      </div>
      <div className="field"><span>{t("admin.theme")}</span>
        <div className="themes" data-testid="team-theme">
          <button type="button" className={"theme auto" + (!f.color ? " on" : "")} data-testid="theme-auto" onClick={() => setF({ ...f, color: null })}><i />{t("admin.themeAuto")}</button>
          {TEAM_THEMES.map((th) => <button type="button" key={th.key} className={"theme" + (f.color?.toLowerCase() === th.accent ? " on" : "")} data-testid={`theme-${th.key}`} style={{ "--sw": th.accent, "--sw2": th.text } as React.CSSProperties} onClick={() => setF({ ...f, color: th.accent })}><i />{t(`admin.themes.${th.key}`)}</button>)}
        </div>
        <div className="tiny">{t("admin.themeHint")}</div>
      </div>
      <div className="field"><span>{t("admin.admission")}</span>
        <div className="chips" data-testid="admission">{(["open", "tryout", "audition"] as const).map((a) => <button key={a} className={"chip" + (f.admission === a ? " on" : "")} onClick={() => setF({ ...f, admission: a, closed: a === "audition" })}>{t(`admin.admissionKind.${a}`)}</button>)}</div>
        <div className="tiny">{t(`admin.admissionHint.${f.admission ?? "open"}`)}</div>
        {f.admission !== "open" && <input style={{ marginTop: 6 }} value={f.admission_note ?? ""} placeholder={t("admin.admissionNotePh")} onChange={(e) => setF({ ...f, admission_note: e.target.value })} />}
      </div>
      <Toggle k="parents_see_video" label={t("admin.parentsSeeVideo")} hint={t("admin.parentsSeeVideoHint")} />
      <Toggle k="punch_card_open" label={t("team.punchOpen")} hint={t("admin.punchHint")} />
      <Toggle k="signup_open" label={t("admin.signupOpenTeam")} hint={t("admin.signupOpenTeamHint")} />
      {f.admission === "audition" && <Toggle k="audition_open" label={t("admin.auditionOpen")} hint={t("admin.auditionOpenHint")} />}
      <label className="toggle"><span>{t("admin.teamPublic")}<div className="tiny">{t("admin.teamPublicHint")}</div></span><input type="checkbox" checked={f.visibility === "public"} onChange={(e) => setF({ ...f, visibility: e.target.checked ? "public" : "private" })} /></label>
      <ImagePicker tag="team" label={t("admin.teamHeroImage")} own={ownPhotos} value={toRef(f.cover_url)} onChange={(k) => setF({ ...f, cover_url: fromRef(k), focus: null })} focus={f.focus ?? null} onFocus={(fc) => setF({ ...f, focus: fc })} />
      <ImagePicker tag="team" label={t("admin.teamAboutImage")} own={ownPhotos} value={toRef(f.about_url)} onChange={(k) => setF({ ...f, about_url: fromRef(k) })} />
      {(f.photos ?? team?.photos ?? []).length > 0 && <div className="field"><span>{t("admin.teamPhotos")}</span><div className="tiny muted">{t("admin.teamPhotosHint")}</div>
        <div className="imgpick">{(f.photos ?? team?.photos ?? []).map((u) => <button key={u} type="button" className="ip" style={{ backgroundImage: `url(${u})` }} onClick={() => setF({ ...f, photos: (f.photos ?? team?.photos ?? []).filter((x) => x !== u), cover_url: f.cover_url === u ? null : f.cover_url, about_url: f.about_url === u ? null : f.about_url })} aria-label={t("common.remove")} data-testid="team-photo-remove"><small>×</small></button>)}</div></div>}
      <label className="field"><span>{t("admin.teamDescription")}</span><textarea rows={3} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder={t("admin.teamDescriptionPh")} /></label>
      <div className="row"><button className="cta grow" disabled={!f.name.trim()} onClick={async () => { if (team) await api.updateTeam(team.id, f); else await api.createTeam(f); onSaved(); }}>{t("common.save")}</button>
        {team && <button className="ghost danger" onClick={async () => { await api.updateTeam(team.id, { archived: true }); onSaved(); }}>{t("admin.archive")}</button>}</div>
    </Sheet>
  );
}

/* ---------------- Season: the weekly plan per room, generated from sessions this week ---------------- */
function Season() {
  const { t } = useTranslation();
  const [week, setWeek] = useState(mondayOf(new Date()));
  const [sessions, setSessions] = useState<Session[]>([]); const [open, setOpen] = useState<Session | "new" | null>(null);
  const [hint, setHint] = useState(false); const [closures, setClosures] = useState(false);
  const [moveTo, setMoveTo] = useState<{ date: string } | null>(null); const [dragId, setDragId] = useState<string | null>(null); const [over, setOver] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => setSessions(await api.listSessions(week.toISOString(), addDays(week, 7).toISOString())), [week]);
  useEffect(() => { void load(); }, [load]);
  const rooms = Array.from(new Set(sessions.map((s) => s.room_name ?? "?")));
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("admin.season")}</h1><div className="row" style={{ gap: 6 }}><button type="button" className={"ghost small info" + (hint ? " on" : "")} aria-label={t("common.help")} aria-expanded={hint} onClick={() => setHint((v) => !v)}>ⓘ</button><button className="ghost small" data-testid="season-closures" onClick={() => setClosures(true)}>{t("closures.title")}</button><button className="ghost small" onClick={() => setOpen("new")}>+ {t("session.training")}</button></div></header>
      {closures && <Closures onClose={() => setClosures(false)} onChanged={() => void load()} />}
      <div className="row between small muted"><button className="linklike" onClick={() => setWeek(addDays(week, -7))}>‹</button><span>{t("admin.week")} {weekNo(week)} · {week.toLocaleDateString(loc(), { day: "numeric", month: "short" })}</span><button className="linklike" onClick={() => setWeek(addDays(week, 7))}>›</button></div>
      {hint && <p className="small muted hintbox">{t("admin.seasonHint")} {t("admin.seasonDragHint")}</p>}
      {rooms.map((room) => (
        <div className="sec" key={room}><div className="eyebrow">{room}</div>
          <div className="week">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => { const day = addDays(week, d); const list = sessions.filter((s) => s.room_name === room && new Date(s.starts_at).toDateString() === day.toDateString()); return list.length || d < 5 ? (
              <div className={"col" + (over === room + d ? " over" : "")} key={d} onDragOver={(e) => { if (dragId) { e.preventDefault(); setOver(room + d); } }} onDragLeave={() => setOver(null)}
                onDrop={(e) => { e.preventDefault(); setOver(null); const s = sessions.find((x) => x.id === dragId); setDragId(null); if (!s) return; if (new Date(s.starts_at).toDateString() === day.toDateString()) return; setMoveTo({ date: isoDate(day) }); setOpen(s); }}>
                <h4>{DAY_LONG[d].slice(0, 3)}</h4>{list.map((s) => <button key={s.id} className={"blk" + (s.cancelled ? " off" : "") + (dragId === s.id ? " dragging" : "")} draggable onDragStart={(e) => { setDragId(s.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDragId(null); setOver(null); }} onClick={() => { setMoveTo(null); setOpen(s); }}><b>{s.title ?? s.team_name}</b>{hm(s.starts_at)}–{hm(s.ends_at)}</button>)}</div>) : null; })}
          </div>
        </div>
      ))}
      {open === "new" && <SessionEditor defaults={{ date: week, room_id: "", start: "16:00" }} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void load(); }} toast={say} />}
      {open && open !== "new" && <SessionEditor key={open.id + (moveTo?.date ?? "")} session={open} moveTo={moveTo ?? undefined} onClose={() => { setOpen(null); setMoveTo(null); }} onSaved={() => { setOpen(null); setMoveTo(null); void load(); }} toast={say} />}
      <Toast msg={toast} />
    </section>
  );
}
function weekNo(d: Date) { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return Math.ceil(((x.getTime() - y0.getTime()) / 864e5 + 1) / 7); }

/* ---------------- Bookings awaiting approval ---------------- */
function Bookings() {
  const { t } = useTranslation();
  const [list, setList] = useState<Booking[]>([]);
  const load = useCallback(async () => { const from = startOfDay(new Date()); setList((await api.listBookings(from.toISOString(), addDays(from, 90).toISOString())).filter((b) => b.status !== "rejected")); }, []);
  useEffect(() => { void load(); }, [load]);
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("admin.bookings")}</h1></header>
      <div className="card list">
        {list.map((b) => <div key={b.id} className="item actrow"><span className="time">{new Date(b.starts_at).toLocaleDateString(loc(), { weekday: "short", day: "numeric", month: "short" })}<br />{hm(b.starts_at)}</span><span className="grow">{b.title}<div className="tiny">{b.room_name} · {b.person_name}</div></span>
          {b.status === "pending" ? <div className="payacts"><button className="small" onClick={async () => { await api.setBookingStatus(b.id, "approved"); void load(); }}>{t("admin.approve")}</button><button className="ghost small danger" onClick={async () => { await api.setBookingStatus(b.id, "rejected"); void load(); }}>{t("admin.reject")}</button></div> : <span className="chip ok small">{t("rooms.status.approved")}</span>}</div>)}
        {!list.length && <p className="muted">{t("admin.noBookings")}</p>}
      </div>
    </section>
  );
}

/* ---------------- Messages: official messages with read/accept receipts ---------------- */
function Messages() {
  const { t } = useTranslation();
  const [list, setList] = useState<Message[]>([]); const [teams, setTeams] = useState<Team[]>([]); const [open, setOpen] = useState<Message | null>(null); const [compose, setCompose] = useState(false);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => { const [m, tm] = await Promise.all([api.listMessages(), api.listTeams()]); setList(m); setTeams(tm); }, []);
  useEffect(() => { void load(); }, [load]);
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("admin.messages")}</h1><button className="ghost small" id="admin-new-msg" onClick={() => setCompose(true)}>+ {t("msg.new")}</button></header>
      <p className="small muted">{t("admin.messagesIntro")}</p>
      <div className="card list">
        {list.map((m) => <button key={m.id} className="item" onClick={() => setOpen(m)} data-testid="admin-msg"><span className="grow">{m.title}<div className="tiny">{ago(m.created_at)} · {m.audience.all ? t("msg.everyone") : (m.audience.teams ?? []).map((id) => teams.find((x) => x.id === id)?.name ?? "?").join(", ")} · {t(`msg.needsOpt.${m.needs}`)}</div></span><span className="gold">›</span></button>)}
        {!list.length && <p className="muted">{t("msg.none")}</p>}
      </div>
      {open && <MessageSheet message={open} onClose={() => { setOpen(null); void load(); }} toast={say} />}
      {compose && <MessageComposer teams={teams} onClose={() => { setCompose(false); void load(); }} toast={say} />}
      <Toast msg={toast} />
    </section>
  );
}

/* ---------------- Reports: moderation queue (Apple 1.2: act within 24 h) ---------------- */
function Reports() {
  const { t } = useTranslation();
  const [list, setList] = useState<Report[]>([]); const [teams, setTeams] = useState<Team[]>([]);
  const load = useCallback(async () => { const [r, tm] = await Promise.all([api.listReports(), api.listTeams()]); setList(r); setTeams(tm); }, []);
  useEffect(() => { void load(); }, [load]);
  const openOnes = list.filter((r) => !r.resolved_at), done = list.filter((r) => r.resolved_at);
  const Row = ({ r }: { r: Report }) => (
    <div className="card" data-testid="report">
      <div className="row between"><span className="tiny">{r.reporter_name} {t("admin.reported")} {r.author_name} · {ago(r.created_at)}{r.team_id ? ` · ${teams.find((x) => x.id === r.team_id)?.name ?? ""}` : ""}</span>{r.hidden && <span className="chip warn small">{t("feed.hiddenChip")}</span>}</div>
      <p className="small" style={{ margin: 0, whiteSpace: "pre-wrap" }}>“{r.excerpt}”</p>
      {r.reason && <p className="tiny" style={{ margin: 0 }}>{t("admin.reason")}: {r.reason}</p>}
      {!r.resolved_at && <div className="row"><button className="small" onClick={async () => { await api.resolveReport(r.id, "hide"); void load(); }}>{t("admin.hideContent")}</button><button className="ghost small" onClick={async () => { await api.resolveReport(r.id, "keep"); void load(); }}>{t("admin.keepContent")}</button></div>}
    </div>
  );
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("admin.reports")}</h1></header>
      <p className="small muted">{t("admin.reportsIntro")}</p>
      {openOnes.map((r) => <Row key={r.id} r={r} />)}
      {!openOnes.length && <p className="muted">{t("admin.noReports")}</p>}
      {done.length > 0 && <div className="sec"><h2>{t("admin.resolved")}</h2>{done.map((r) => <Row key={r.id} r={r} />)}</div>}
    </section>
  );
}

/* ---------------- Shop admin: products + orders ---------------- */
function ShopAdmin() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]); const [orders, setOrders] = useState<Order[]>([]); const [edit, setEdit] = useState<Product | "new" | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => { const [p, o] = await Promise.all([api.listProducts(true), api.listOrders(true)]); setProducts(p); setOrders(o); }, []);
  useEffect(() => { void load(); }, [load]);
  // open = not yet handed over (awaiting payment OR paid). Two independent ticks: "Betalt" (Line confirmed the money in her books) and "Udleveret" (moves the order down).
  const open = orders.filter((o) => o.status === "awaiting_payment" || o.status === "paid"), rest = orders.filter((o) => o.status !== "awaiting_payment" && o.status !== "paid");
  const OrderRow = ({ o }: { o: Order }) => {
    const isOpen = o.status === "awaiting_payment" || o.status === "paid"; const paid = o.status === "paid";
    return (
      <div className={"item orderrow" + (isOpen ? "" : " done")} data-testid="admin-order"><span className="grow">#{o.number} · {o.person_name}<div className="tiny">{o.lines.map((l) => `${l.qty}× ${l.name}${l.size ? ` (${l.size})` : ""}`).join(", ")} · {o.total_dkk} kr. · {ago(o.created_at)}{o.claimed_paid_at && o.status === "awaiting_payment" ? ` · ${t("shop.status.claimed")}` : ""}</div></span>
        {isOpen ? <div className="ticks">
          <button type="button" className={"tick" + (paid ? " on" : "")} role="checkbox" aria-checked={paid} onClick={async () => { await api.setOrderStatus(o.id, paid ? "awaiting_payment" : "paid"); void load(); }} data-testid="tick-paid"><span className="box">{paid ? "✓" : ""}</span>{t("admin.markPaid")}</button>
          <button type="button" className="tick" role="checkbox" aria-checked={false} disabled={!paid} title={!paid ? t("admin.deliverNeedsPaid") : undefined} onClick={async () => { await api.setOrderStatus(o.id, "delivered"); void load(); }} data-testid="tick-delivered"><span className="box" /> {t("admin.markDelivered")}</button>
          <button type="button" className="ghost small danger" aria-label={t("shop.status.cancelled")} onClick={async () => { await api.setOrderStatus(o.id, "cancelled"); void load(); }}>×</button>
        </div> : <span className={"chip small" + (o.status === "delivered" ? " ok" : "")}>{t(`shop.status.${o.status}`)}</span>}</div>
    );
  };
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("admin.shop")}</h1><button className="ghost small" id="product-new" onClick={() => setEdit("new")}>+ {t("admin.newProduct")}</button></header>
      <div className="sec"><h2>{t("admin.ordersOpen")} · {open.length}</h2><div className="card list">{open.map((o) => <OrderRow key={o.id} o={o} />)}{!open.length && <p className="muted">{t("admin.noOrders")}</p>}</div></div>
      <div className="sec"><h2>{t("admin.products")}</h2><div className="card list">{products.map((p) => <button key={p.id} className={"item" + (p.active ? "" : " off")} onClick={() => setEdit(p)}><span className="grow">{p.name}<div className="tiny">{p.price_dkk} kr. · {p.sizes.join("/") || t("admin.oneSize")}{p.stock != null ? ` · ${t("admin.stock")}: ${p.stock}` : ""}{p.visibility === "public" ? ` · ${t("feed.publicChip")}` : ""}</div></span><span className="gold">›</span></button>)}</div></div>
      {rest.length > 0 && <div className="sec"><h2>{t("admin.ordersDone")}</h2><div className="card list">{rest.slice(0, 30).map((o) => <OrderRow key={o.id} o={o} />)}</div></div>}
      {edit && <ProductEditor product={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); say(t("common.saved")); }} />}
      <Toast msg={toast} />
    </section>
  );
}
/** Size presets exactly as the shop at lldancestudio.dk uses them – toggle a whole set, then fine-tune in the text field. */
const SIZE_SETS: [string, string[]][] = [
  ["Voksen XXS–XXL", ["XXS", "XS", "S", "M", "L", "XL", "XXL"]],
  ["Voksen XS–L", ["XS", "S", "M", "L"]],
  ["Børn 5–13 år", ["5-6 år", "7-8 år", "9-11 år", "12-13 år"]],
  ["Børn 4–10 år", ["4-6 år", "6-8 år", "8-10 år"]],
  ["Børn cm", ["90-100", "110-120"]],
  ["Baby", ["12-18 mdr.", "18-24 mdr.", "2 år"]],
  ["One size", []],
];
function ProductEditor({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [f, setF] = useState({ name: product?.name ?? "", price: product?.price_dkk?.toString() ?? "", sizes: product?.sizes.join(", ") ?? "", stock: product?.stock?.toString() ?? "", active: product?.active ?? true, pub: product?.visibility === "public", image: null as File | null, imageUrl: product?.image_path?.startsWith("http") ? product.image_path : "" });
  return (
    <Sheet onClose={onClose} eyebrow={t("admin.shop")} title={product ? t("common.edit") : t("admin.newProduct")}>
      <label className="field"><span>{t("admin.productName")}</span><input id="pr-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="grid2"><label className="field"><span>{t("admin.price")}</span><input id="pr-price" type="number" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label><label className="field"><span>{t("admin.stock")}</span><input type="number" inputMode="numeric" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} placeholder="∞" /></label></div>
      <div className="field"><span>{t("admin.sizeTypes")}</span>
        <div className="chips">{SIZE_SETS.map(([label, list]) => { const cur = f.sizes.split(",").map((x) => x.trim()).filter(Boolean); const on = list.every((x) => cur.includes(x)); return <button key={label} className={"chip" + (on ? " on" : "")} onClick={() => { const next = on ? cur.filter((x) => !list.includes(x)) : [...cur, ...list.filter((x) => !cur.includes(x))]; setF({ ...f, sizes: next.join(", ") }); }}>{label}</button>; })}</div>
        <div className="tiny">{t("admin.sizeTypesHint")}</div>
      </div>
      <label className="field"><span>{t("admin.sizes")}</span><input value={f.sizes} onChange={(e) => setF({ ...f, sizes: e.target.value })} placeholder="XS, S, M, L" /></label>
      <label className="field"><span>{t("admin.imageUrl")}</span><input value={f.imageUrl} onChange={(e) => setF({ ...f, imageUrl: e.target.value })} placeholder="https://…" /></label>
      <label className="field"><span>{t("admin.image")}</span><input type="file" accept="image/*" onChange={(e) => setF({ ...f, image: e.target.files?.[0] ?? null })} /></label>
      <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />{t("admin.productActive")}</label>
      <label className="check"><input type="checkbox" checked={f.pub} onChange={(e) => setF({ ...f, pub: e.target.checked })} />{t("admin.productPublic")}</label>
      <button className="cta" id="pr-save" disabled={!f.name.trim() || !f.price} onClick={async () => { await api.saveProduct({ name: f.name.trim(), price_dkk: Number(f.price), sizes: f.sizes.split(",").map((x) => x.trim()).filter(Boolean), stock: f.stock ? Number(f.stock) : null, image_path: f.imageUrl.trim() ? f.imageUrl.trim() : (product?.image_path?.startsWith("http") ? null : product?.image_path ?? null), visibility: f.pub ? "public" : "private", active: f.active, image: f.image }, product?.id); onSaved(); }}>{t("common.save")}</button>
    </Sheet>
  );
}

/* ---------------- Punch cards admin: types + activation ---------------- */
function PunchAdmin() {
  const { t } = useTranslation();
  const [types, setTypes] = useState<PunchCardType[]>([]); const [cards, setCards] = useState<PunchCard[]>([]); const [edit, setEdit] = useState<PunchCardType | "new" | null>(null);
  const [f, setF] = useState({ name: "", punches: "10", valid_days: "365", price: "" });
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };
  const load = useCallback(async () => { const [ty, c] = await Promise.all([api.listPunchCardTypes(), api.listPunchCards(true)]); setTypes(ty); setCards(c); }, []);
  useEffect(() => { void load(); }, [load]);
  const waiting = cards.filter((c) => c.status === "awaiting_payment"), active = cards.filter((c) => c.status === "active");
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("punch.title")}</h1><button className="ghost small" onClick={() => { setF({ name: "", punches: "10", valid_days: "365", price: "" }); setEdit("new"); }}>+ {t("admin.newType")}</button></header>
      <div className="sec"><h2>{t("admin.cardsWaiting")} · {waiting.length}</h2><div className="card list">
        {waiting.map((c) => <div key={c.id} className="item" data-testid="admin-card"><span className="grow">{c.person_name}<div className="tiny">{c.type_name} · {c.price_dkk} kr. · {ago(c.created_at)}{c.claimed_paid_at ? ` · ${t("punch.status.claimed")}` : ` · ${t("punch.status.awaiting_payment")}`}</div></span><button className="small" onClick={async () => { try { await api.activatePunchCard(c.id); say(t("admin.cardActivated", { name: c.person_name })); } catch (x) { say(t("common.error") + ": " + String((x as Error).message ?? x)); } void load(); }}>{t("admin.activate")}</button></div>)}
        {!waiting.length && <p className="muted">{t("admin.noCards")}</p>}</div></div>
      <div className="sec"><h2>{t("admin.cardsActive")} · {active.length}</h2><div className="card list">{active.map((c) => <div key={c.id} className="item"><span className="grow">{c.person_name}<div className="tiny">{c.type_name} · {t("punch.left", { n: c.punches_left, total: c.punches_total })} · {t("punch.validUntil")} {new Date(c.expires_on).toLocaleDateString(loc())}</div></span></div>)}</div></div>
      <div className="sec"><h2>{t("admin.cardTypes")}</h2><div className="card list">{types.map((ty) => <button key={ty.id} className={"item" + (ty.active ? "" : " off")} onClick={() => { setF({ name: ty.name, punches: String(ty.punches), valid_days: String(ty.valid_days), price: String(ty.price_dkk) }); setEdit(ty); }}><span className="grow">{ty.name}<div className="tiny">{ty.punches} {t("punch.punches")} · {ty.valid_days} {t("admin.days")} · {ty.price_dkk} kr.</div></span><span className="gold">›</span></button>)}</div></div>
      <p className="tiny">{t("admin.punchHint")}</p>
      {edit && (
        <Sheet onClose={() => setEdit(null)} eyebrow={t("punch.title")} title={edit === "new" ? t("admin.newType") : t("common.edit")}>
          <label className="field"><span>{t("admin.productName")}</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <div className="grid2"><label className="field"><span>{t("punch.punches")}</span><input type="number" value={f.punches} onChange={(e) => setF({ ...f, punches: e.target.value })} /></label><label className="field"><span>{t("admin.validDays")}</span><input type="number" value={f.valid_days} onChange={(e) => setF({ ...f, valid_days: e.target.value })} /></label></div>
          <label className="field"><span>{t("admin.price")}</span><input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>
          <div className="row"><button className="cta grow" disabled={!f.name.trim() || !f.price} onClick={async () => { await api.savePunchCardType({ name: f.name.trim(), punches: Number(f.punches), valid_days: Number(f.valid_days), price_dkk: Number(f.price), active: true }, edit === "new" ? undefined : edit.id); setEdit(null); void load(); }}>{t("common.save")}</button>
            {edit !== "new" && <button className="ghost danger" onClick={async () => { await api.savePunchCardType({ name: edit.name, punches: edit.punches, valid_days: edit.valid_days, price_dkk: edit.price_dkk, active: !edit.active }, edit.id); setEdit(null); void load(); }}>{edit.active ? t("admin.deactivate") : t("admin.activate")}</button>}</div>
        </Sheet>
      )}
      <Toast msg={toast} />
    </section>
  );
}

/** Admin → Auditions: every audition team with candidate counts; opens the trainer module for a team. */
function AuditionsOverview() {
  const { t } = useTranslation();
  const [teams, setTeams] = useState<Team[]>([]); const [cands, setCands] = useState<AuditionCandidate[]>([]); const [open, setOpen] = useState<Team | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => { const [ts, cs] = await Promise.all([api.listTeams(), api.listAuditionCandidates().catch(() => [] as AuditionCandidate[])]); setTeams(ts.filter((x) => x.admission === "audition")); setCands(cs); }, []);
  useEffect(() => { void load(); }, [load]);
  if (open) return <><AuditionAdmin team={open} onBack={() => { setOpen(null); void load(); }} toast={say} /><Toast msg={toast} /></>;
  const n = (tid: string, st?: string[]) => cands.filter((c) => c.team_id === tid && (!st || st.includes(c.status))).length;
  return (
    <section className="screen" data-testid="auditions-overview">
      <header className="topbar"><h1 className="display">{t("audition.adminTitle")}</h1></header>
      <p className="muted small">{t("audition.adminOverviewIntro")}</p>
      <div className="card list">
        {teams.map((x) => <button key={x.id} className="item" onClick={() => setOpen(x)} data-testid="audition-team"><span className="grow">{x.name}<div className="tiny">{t("audition.counts", { applied: n(x.id, ["applied", "invited"]), selected: n(x.id, ["selected"]), waitlist: n(x.id, ["waitlist"]), declined: n(x.id, ["declined"]), accepted: n(x.id, ["accepted"]) })}{x.audition_open && !x.audition_sent_at ? " · " + t("audition.noBriefShort") : ""}</div></span><span className={"chip small" + (x.audition_open ? " ok" : "")} role="switch" aria-checked={!!x.audition_open} data-testid="audition-open-toggle" onClick={async (e) => { e.stopPropagation(); await api.updateTeam(x.id, { audition_open: !x.audition_open }); void load(); }}>{x.audition_open ? t("audition.open") : t("audition.closed")}</span><span className="gold">›</span></button>)}
        {!teams.length && <p className="muted">{t("audition.noTeams")}</p>}
      </div>
      <Toast msg={toast} />
    </section>
  );
}
