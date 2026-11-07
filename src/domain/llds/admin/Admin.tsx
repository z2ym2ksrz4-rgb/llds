import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Booking, type Member, type Message, type Order, type Product, type PunchCard, type PunchCardType, type Report, type Session, type Team, type TeamInput } from "@/core/api";
import { Events } from "../screens/Events";
import { ImportPhotos } from "./ImportPhotos";
import { Customize } from "./Customize";
import { PaymentsAdmin } from "../screens/Payments";
import { CatalogAdmin } from "./Catalog";
import { MessageComposer, MessageSheet } from "../components/Messages";
import { ago } from "../lib/time";
import { AdminUsers } from "./Users";
import { MemberSheet } from "./MemberSheet";
import { Sheet, Toast } from "../components/Sheet";
import { SessionEditor } from "../components/SessionSheet";
import { ImagePicker } from "../components/ImagePicker";
import { CATALOG } from "../lib/catalog";
import { addDays, DAY_LONG, hm, mondayOf, startOfDay } from "../lib/time";

type Page = "menu" | "users" | "members" | "teams" | "season" | "bookings" | "messages" | "reports" | "events" | "shop" | "punch" | "import" | "catalog" | "customize" | "payments";
const CATS = ["mini", "kids", "junior", "adult", "mixed"] as const;

/** Admin: the one place Line runs the school from. Everything else in the app reads what she sets here. */
export function Admin() {
  const { t } = useTranslation();
  const [page, setPage] = useState<Page>("menu");
  const [counts, setCounts] = useState({ pending: 0, bookings: 0, subs: 0, reports: 0, orders: 0, cards: 0 });
  useEffect(() => { void (async () => {
    const from = startOfDay(new Date());
    const [p, b, s, r, o, c] = await Promise.all([api.listPending(), api.listBookings(from.toISOString(), addDays(from, 60).toISOString()), api.listSessions(from.toISOString(), addDays(from, 14).toISOString()), api.listReports(), api.listOrders(true), api.listPunchCards(true)]);
    setCounts({ pending: p.length, bookings: b.filter((x) => x.status === "pending").length, subs: s.filter((x) => x.substitute_wanted && !x.substitute_id).length, reports: r.filter((x) => !x.resolved_at).length, orders: o.filter((x) => x.status === "awaiting_payment" && x.claimed_paid_at).length, cards: c.filter((x) => x.status === "awaiting_payment" && x.claimed_paid_at).length });
  })(); }, [page]);
  if (page === "users") return <Back onBack={() => setPage("menu")}><AdminUsers /></Back>;
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
  if (page === "payments") return <Back onBack={() => setPage("menu")}><PaymentsAdmin /></Back>;
  const items: [Page, string, string, number][] = [
    ["users", t("admin.users"), t("admin.usersSub"), counts.pending], ["members", t("admin.members"), t("admin.membersSub"), 0], ["teams", t("admin.teams"), t("admin.teamsSub"), 0],
    ["season", t("admin.season"), t("admin.seasonSub"), counts.subs], ["bookings", t("admin.bookings"), t("admin.bookingsSub"), counts.bookings],
    ["messages", t("admin.messages"), t("admin.messagesSub"), 0], ["reports", t("admin.reports"), t("admin.reportsSub"), counts.reports],
    ["events", t("events.title"), t("admin.eventsSub"), 0], ["shop", t("admin.shop"), t("admin.shopSub"), counts.orders], ["punch", t("punch.title"), t("admin.punchSub"), counts.cards],
    ["catalog", t("catalog.adminTitle"), t("catalog.adminSub"), 0],
    ["payments", t("pay.adminTitle"), t("pay.adminSub"), 0],
    ["customize", t("customize.title"), t("customize.sub"), 0],
    ["import", t("admin.importPhotos"), t("admin.importSub"), 0],
  ];
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("nav.admin")}</h1></header>
      <div className="card list">
        {items.map(([k, label, sub, n]) => <button key={k} className="item" onClick={() => setPage(k)}><span className="grow">{label}<div className="tiny">{sub}</div></span>{n > 0 && <span className="chip warn small">{n}</span>}<span className="gold">›</span></button>)}
      </div>
      <p className="tiny">{t("admin.phase4note")}</p>
    </section>
  );
}
function Back({ onBack, children }: { onBack: () => void; children: React.ReactNode }) { const { t } = useTranslation(); return <div><button className="linklike" onClick={onBack}>‹ {t("nav.admin")}</button>{children}</div>; }

/* ---------------- Members: everyone approved, their teams/roles, child logins, deactivate ---------------- */
function Members() {
  const { t } = useTranslation();
  const [all, setAll] = useState<Member[]>([]); const [teams, setTeams] = useState<Team[]>([]); const [q, setQ] = useState(""); const [open, setOpen] = useState<Member | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => { const [m, tm] = await Promise.all([api.listMembers(), api.listTeams()]); setAll(m.filter((p) => p.status === "approved")); setTeams(tm); }, []);
  useEffect(() => { void load(); }, [load]);
  const list = all.filter((p) => `${p.first_name} ${p.last_name} ${p.email ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("admin.members")} · {all.length}</h1></header>
      <input id="mq" placeholder={t("admin.search")} value={q} onChange={(e) => setQ(e.target.value)} />
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
  const load = useCallback(async () => setTeams(await api.listTeams()), []);
  useEffect(() => { void load(); }, [load]);
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("admin.teams")} · {teams.length}</h1><button className="ghost small" onClick={() => setOpen("new")}>+ {t("admin.newTeam")}</button></header>
      {CATS.map((c) => { const list = teams.filter((x) => x.category === c); return list.length ? (
        <div className="sec" key={c}><div className="eyebrow">{t(`category.${c}`)}</div><div className="card list">
          {list.map((x) => <button key={x.id} className="item" onClick={() => setOpen(x)}><span className="grow">{x.name}<div className="tiny">{x.style} · {x.level}{x.closed ? " · " + t("team.closed") : ""}{x.parents_see_video ? " · " + t("admin.parentsSeeVideo") : ""}{x.punch_card_open ? " · " + t("team.punchOpen") : ""}</div></span><span className="gold">›</span></button>)}
        </div></div>) : null; })}
      {open && <TeamEditor team={open === "new" ? null : open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void load(); }} />}
    </section>
  );
}
function TeamEditor({ team, onClose, onSaved }: { team: Team | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [f, setF] = useState<TeamInput & { name: string }>({ name: team?.name ?? "", style: team?.style ?? "Showdance", category: team?.category ?? "junior", level: team?.level ?? "", closed: team?.closed ?? false, parents_see_video: team?.parents_see_video ?? false, punch_card_open: team?.punch_card_open ?? false, visibility: team?.visibility ?? "public", description: team?.description ?? "", cover_url: team?.cover_url ?? null, admission: team?.admission ?? (team?.closed ? "audition" : "open"), admission_note: team?.admission_note ?? "", price_full: team?.price_full ?? null, price_half: team?.price_half ?? null, price_signup: team?.price_signup ?? null, price_note: team?.price_note ?? "", installments_allowed: team?.installments_allowed ?? true });
  const Toggle = ({ k, label, hint }: { k: "closed" | "parents_see_video" | "punch_card_open"; label: string; hint: string }) => <label className="toggle"><span>{label}<div className="tiny">{hint}</div></span><input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /></label>;
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
      <div className="field"><span>{t("admin.admission")}</span>
        <div className="chips" data-testid="admission">{(["open", "tryout", "audition"] as const).map((a) => <button key={a} className={"chip" + (f.admission === a ? " on" : "")} onClick={() => setF({ ...f, admission: a, closed: a === "audition" })}>{t(`admin.admissionKind.${a}`)}</button>)}</div>
        <div className="tiny">{t(`admin.admissionHint.${f.admission ?? "open"}`)}</div>
        {f.admission !== "open" && <input style={{ marginTop: 6 }} value={f.admission_note ?? ""} placeholder={t("admin.admissionNotePh")} onChange={(e) => setF({ ...f, admission_note: e.target.value })} />}
      </div>
      <Toggle k="parents_see_video" label={t("admin.parentsSeeVideo")} hint={t("admin.parentsSeeVideoHint")} />
      <Toggle k="punch_card_open" label={t("team.punchOpen")} hint={t("admin.punchHint")} />
      <label className="toggle"><span>{t("admin.teamPublic")}<div className="tiny">{t("admin.teamPublicHint")}</div></span><input type="checkbox" checked={f.visibility === "public"} onChange={(e) => setF({ ...f, visibility: e.target.checked ? "public" : "private" })} /></label>
      <ImagePicker tag="team" value={f.cover_url?.startsWith("art/catalog/") ? f.cover_url.replace("art/catalog/", "").replace(/\.\w+$/, "") : f.cover_url?.startsWith("http") && f.cover_url !== team?.cover_url ? f.cover_url : null} onChange={(k) => setF({ ...f, cover_url: !k ? (team?.cover_url?.startsWith("art/catalog/") ? null : team?.cover_url ?? null) : k.startsWith("http") ? k : `art/catalog/${CATALOG.find((c) => c.key === k)?.file}` })} />
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
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => setSessions(await api.listSessions(week.toISOString(), addDays(week, 7).toISOString())), [week]);
  useEffect(() => { void load(); }, [load]);
  const rooms = Array.from(new Set(sessions.map((s) => s.room_name ?? "?")));
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("admin.season")}</h1><button className="ghost small" onClick={() => setOpen("new")}>+ {t("session.training")}</button></header>
      <div className="row between small muted"><button className="linklike" onClick={() => setWeek(addDays(week, -7))}>‹</button><span>{t("admin.week")} {weekNo(week)} · {week.toLocaleDateString("da-DK", { day: "numeric", month: "short" })}</span><button className="linklike" onClick={() => setWeek(addDays(week, 7))}>›</button></div>
      <p className="tiny">{t("admin.seasonHint")}</p>
      {rooms.map((room) => (
        <div className="sec" key={room}><div className="eyebrow">{room}</div>
          <div className="week">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => { const day = addDays(week, d); const list = sessions.filter((s) => s.room_name === room && new Date(s.starts_at).toDateString() === day.toDateString()); return list.length || d < 5 ? (
              <div className="col" key={d}><h4>{DAY_LONG[d].slice(0, 3)}</h4>{list.map((s) => <button key={s.id} className={"blk" + (s.cancelled ? " off" : "")} onClick={() => setOpen(s)}><b>{s.title ?? s.team_name}</b>{hm(s.starts_at)}–{hm(s.ends_at)}</button>)}</div>) : null; })}
          </div>
        </div>
      ))}
      {open === "new" && <SessionEditor defaults={{ date: week, room_id: "", start: "16:00" }} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void load(); }} toast={say} />}
      {open && open !== "new" && <SessionEditor session={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); void load(); }} toast={say} />}
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
        {list.map((b) => <div key={b.id} className="item"><span className="time">{new Date(b.starts_at).toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" })}<br />{hm(b.starts_at)}</span><span className="grow">{b.title}<div className="tiny">{b.room_name} · {b.person_name}</div></span>
          {b.status === "pending" ? <div className="row"><button className="small" onClick={async () => { await api.setBookingStatus(b.id, "approved"); void load(); }}>{t("admin.approve")}</button><button className="ghost small danger" onClick={async () => { await api.setBookingStatus(b.id, "rejected"); void load(); }}>{t("admin.reject")}</button></div> : <span className="chip ok small">{t("rooms.status.approved")}</span>}</div>)}
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
  const open = orders.filter((o) => o.status === "awaiting_payment"), rest = orders.filter((o) => o.status !== "awaiting_payment");
  const OrderRow = ({ o }: { o: Order }) => (
    <div className="item" data-testid="admin-order"><span className="grow">#{o.number} · {o.person_name}<div className="tiny">{o.lines.map((l) => `${l.qty}× ${l.name}${l.size ? ` (${l.size})` : ""}`).join(", ")} · {o.total_dkk} kr. · {ago(o.created_at)}{o.claimed_paid_at && o.status === "awaiting_payment" ? ` · ${t("shop.status.claimed")}` : ""}</div></span>
      {o.status === "awaiting_payment" ? <div className="row"><button className="small" onClick={async () => { await api.setOrderStatus(o.id, "paid"); void load(); }}>{t("admin.markPaid")}</button><button className="ghost small danger" onClick={async () => { await api.setOrderStatus(o.id, "cancelled"); void load(); }}>×</button></div>
        : o.status === "paid" ? <button className="ghost small" onClick={async () => { await api.setOrderStatus(o.id, "delivered"); void load(); }}>{t("admin.markDelivered")}</button> : <span className="chip small ok">{t(`shop.status.${o.status}`)}</span>}</div>
  );
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
  const load = useCallback(async () => { const [ty, c] = await Promise.all([api.listPunchCardTypes(), api.listPunchCards(true)]); setTypes(ty); setCards(c); }, []);
  useEffect(() => { void load(); }, [load]);
  const waiting = cards.filter((c) => c.status === "awaiting_payment"), active = cards.filter((c) => c.status === "active");
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("punch.title")}</h1><button className="ghost small" onClick={() => { setF({ name: "", punches: "10", valid_days: "365", price: "" }); setEdit("new"); }}>+ {t("admin.newType")}</button></header>
      <div className="sec"><h2>{t("admin.cardsWaiting")} · {waiting.length}</h2><div className="card list">
        {waiting.map((c) => <div key={c.id} className="item" data-testid="admin-card"><span className="grow">{c.person_name}<div className="tiny">{c.type_name} · {c.price_dkk} kr. · {ago(c.created_at)}{c.claimed_paid_at ? ` · ${t("punch.status.claimed")}` : ` · ${t("punch.status.awaiting_payment")}`}</div></span><button className="small" onClick={async () => { await api.activatePunchCard(c.id); void load(); }}>{t("admin.activate")}</button></div>)}
        {!waiting.length && <p className="muted">{t("admin.noCards")}</p>}</div></div>
      <div className="sec"><h2>{t("admin.cardsActive")} · {active.length}</h2><div className="card list">{active.map((c) => <div key={c.id} className="item"><span className="grow">{c.person_name}<div className="tiny">{c.type_name} · {t("punch.left", { n: c.punches_left, total: c.punches_total })} · {t("punch.validUntil")} {new Date(c.expires_on).toLocaleDateString("da-DK")}</div></span></div>)}</div></div>
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
    </section>
  );
}
