import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Booking, type Member, type Message, type Report, type Role, type Session, type Team, type TeamInput } from "@/core/api";
import { MessageComposer, MessageSheet } from "../components/Messages";
import { ago } from "../lib/time";
import { AdminUsers } from "./Users";
import { Sheet, Toast } from "../components/Sheet";
import { SessionEditor } from "../components/SessionSheet";
import { addDays, DAY_LONG, hm, mondayOf, startOfDay } from "../lib/time";

type Page = "menu" | "users" | "members" | "teams" | "season" | "bookings" | "messages" | "reports";
const CATS = ["mini", "kids", "junior", "adult", "mixed"] as const;

/** Admin: the one place Line runs the school from. Everything else in the app reads what she sets here. */
export function Admin() {
  const { t } = useTranslation();
  const [page, setPage] = useState<Page>("menu");
  const [counts, setCounts] = useState({ pending: 0, bookings: 0, subs: 0, reports: 0 });
  useEffect(() => { void (async () => {
    const from = startOfDay(new Date());
    const [p, b, s, r] = await Promise.all([api.listPending(), api.listBookings(from.toISOString(), addDays(from, 60).toISOString()), api.listSessions(from.toISOString(), addDays(from, 14).toISOString()), api.listReports()]);
    setCounts({ pending: p.length, bookings: b.filter((x) => x.status === "pending").length, subs: s.filter((x) => x.substitute_wanted && !x.substitute_id).length, reports: r.filter((x) => !x.resolved_at).length });
  })(); }, [page]);
  if (page === "users") return <Back onBack={() => setPage("menu")}><AdminUsers /></Back>;
  if (page === "members") return <Back onBack={() => setPage("menu")}><Members /></Back>;
  if (page === "teams") return <Back onBack={() => setPage("menu")}><Teams /></Back>;
  if (page === "season") return <Back onBack={() => setPage("menu")}><Season /></Back>;
  if (page === "bookings") return <Back onBack={() => setPage("menu")}><Bookings /></Back>;
  if (page === "messages") return <Back onBack={() => setPage("menu")}><Messages /></Back>;
  if (page === "reports") return <Back onBack={() => setPage("menu")}><Reports /></Back>;
  const items: [Page, string, string, number][] = [
    ["users", t("admin.users"), t("admin.usersSub"), counts.pending], ["members", t("admin.members"), t("admin.membersSub"), 0], ["teams", t("admin.teams"), t("admin.teamsSub"), 0],
    ["season", t("admin.season"), t("admin.seasonSub"), counts.subs], ["bookings", t("admin.bookings"), t("admin.bookingsSub"), counts.bookings],
    ["messages", t("admin.messages"), t("admin.messagesSub"), 0], ["reports", t("admin.reports"), t("admin.reportsSub"), counts.reports],
  ];
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("nav.admin")}</h1></header>
      <div className="card list">
        {items.map(([k, label, sub, n]) => <button key={k} className="item" onClick={() => setPage(k)}><span className="grow">{label}<div className="tiny">{sub}</div></span>{n > 0 && <span className="chip warn small">{n}</span>}<span className="gold">›</span></button>)}
      </div>
      <p className="tiny">{t("admin.phase3note")}</p>
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
          <div className="tiny">{p.memberships.map((m) => `${teams.find((x) => x.id === m.team_id)?.name ?? "?"} (${t(`roles.${m.role}`)})`).join(" · ") || (p.children.length ? t("admin.parentOf", { names: p.children.map((c) => c.first_name).join(", ") }) : t("admin.noTeams"))}</div></span><span className="gold">›</span></button>)}
      </div>
      {open && <MemberSheet member={open} teams={teams} onClose={() => setOpen(null)} onChanged={() => { void load(); }} toast={say} />}
      <Toast msg={toast} />
    </section>
  );
}
function MemberSheet({ member: p, teams, onClose, onChanged, toast }: { member: Member; teams: Team[]; onClose: () => void; onChanged: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const [ms, setMs] = useState(p.memberships.map((m) => ({ team_id: m.team_id, role: m.role })));
  const roleOf = (tid: string) => ms.find((m) => m.team_id === tid)?.role ?? null;
  const toggle = (tid: string, role: Role) => setMs((cur) => cur.some((m) => m.team_id === tid && m.role === role) ? cur.filter((m) => m.team_id !== tid) : [...cur.filter((m) => m.team_id !== tid), { team_id: tid, role }]);
  const roles: Role[] = p.user_id && !p.supervised_by ? ["dancer", "trainer", "assistant"] : ["dancer"];
  return (
    <Sheet onClose={onClose} eyebrow={t("admin.member")} title={`${p.first_name} ${p.last_name}`}>
      <div className="tiny">{p.email ?? "–"} · {p.phone ?? "–"}{p.birth_year ? ` · ${p.birth_year}` : ""}{p.parents.length ? ` · ${t("admin.parents")}: ${p.parents.map((g) => g.first_name).join(", ")}` : ""}</div>
      <div className="field"><span>{t("admin.teamsAndRoles")}</span>
        <div className="teamgrid">{teams.map((tm) => { const r = roleOf(tm.id); return <div key={tm.id} className={"teamrow" + (r ? " on" : "")}><span className="grow">{tm.name}</span><div className="chips tight">{roles.map((role) => <button key={role} className={"chip small" + (r === role ? " on" : "")} onClick={() => toggle(tm.id, role)}>{t(`roles.${role}`)}</button>)}</div></div>; })}</div>
      </div>
      <div className="row"><button className="cta grow" onClick={async () => { await api.setMemberships(p.id, ms); toast(t("common.saved")); onChanged(); onClose(); }}>{t("common.save")}</button>
        <button className="ghost danger" onClick={async () => { await api.setPersonStatus(p.id, "inactive"); toast(t("admin.deactivated")); onChanged(); onClose(); }}>{t("admin.deactivate")}</button></div>
    </Sheet>
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
  const [f, setF] = useState<TeamInput & { name: string }>({ name: team?.name ?? "", style: team?.style ?? "Showdance", category: team?.category ?? "junior", level: team?.level ?? "", closed: team?.closed ?? false, parents_see_video: team?.parents_see_video ?? false, punch_card_open: team?.punch_card_open ?? false, visibility: "public" });
  const Toggle = ({ k, label, hint }: { k: "closed" | "parents_see_video" | "punch_card_open"; label: string; hint: string }) => <label className="toggle"><span>{label}<div className="tiny">{hint}</div></span><input type="checkbox" checked={!!f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} /></label>;
  return (
    <Sheet onClose={onClose} eyebrow={team ? t("common.edit") : t("admin.newTeam")} title={f.name || t("admin.team")}>
      <label className="field"><span>{t("admin.teamName")}</span><input id="tm-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="grid2">
        <label className="field"><span>{t("admin.style")}</span><input value={f.style ?? ""} onChange={(e) => setF({ ...f, style: e.target.value })} /></label>
        <label className="field"><span>{t("admin.level")}</span><input value={f.level ?? ""} onChange={(e) => setF({ ...f, level: e.target.value })} /></label>
      </div>
      <div className="field"><span>{t("admin.category")}</span><div className="chips">{CATS.map((c) => <button key={c} className={"chip" + (f.category === c ? " on" : "")} onClick={() => setF({ ...f, category: c, parents_see_video: c === "mini" || c === "kids" ? true : f.parents_see_video })}>{t(`category.${c}`)}</button>)}</div></div>
      <Toggle k="closed" label={t("admin.closedTeam")} hint={t("admin.closedHint")} />
      <Toggle k="parents_see_video" label={t("admin.parentsSeeVideo")} hint={t("admin.parentsSeeVideoHint")} />
      <Toggle k="punch_card_open" label={t("team.punchOpen")} hint={t("admin.punchHint")} />
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
