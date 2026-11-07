import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Message, type Absence, type Event, type Member, type PersonBadge, type Result, type Session } from "@/core/api";
import { resolveImage } from "../lib/catalog";
import { aboutImage, teamAccent } from "../lib/art";
import { confetti } from "../lib/confetti";
import { EmblemRow, EmblemSheet, GiveEmblemSheet } from "../components/Emblems";
import { useAuth } from "@/core/auth";
import { useNav } from "@/core/nav";
import { TeamPicker } from "../components/TeamPicker";
import { SessionSheet } from "../components/SessionSheet";
import { Sheet, Toast } from "../components/Sheet";
import { MessageComposer, MessageSheet } from "../components/Messages";
import { ThreadComposer } from "../components/Threads";
import { ScrollList } from "../components/ScrollList";
import { ago } from "../lib/time";
import { TopRight } from "../components/ProfileMenu";
import { Folders } from "./Folders";
import { Choreo } from "./Choreo";
import { Notes } from "./Notes";
import { MILESTONE_IDEAS } from "../lib/milestones";
import { artForCategory } from "../lib/art";
import { ageOf, addDays, ago, dateLabel, DAY_LONG, hm, startOfDay } from "../lib/time";

type Page = "team" | "folders" | "choreo" | "notes" | "dancers";

/** "Mit hold" like the demo: photo hero, four tiles, next events, trophy shelf, then feed, trainings and (staff) roster. */
export function TeamScreen() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const viewing = useAuth((s) => s.viewing)!;
  const teamId = useAuth((s) => s.teamId);
  const roleOn = useAuth((s) => s.roleOn);
  const team = me.teams.find((x) => x.id === teamId);
  const staff = me.person.is_admin || (teamId != null && me.memberships.some((m) => m.person_id === me.person.id && m.team_id === teamId && m.role !== "dancer"));
  const isStaffAnywhere = me.person.is_admin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer");
  const [page, setPage] = useState<Page>("team");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [stats, setStats] = useState({ videos: 0, media: 0, formations: 0, dancers: 0 });
  const [open, setOpen] = useState<Session | null>(null);
  const [compose, setCompose] = useState(false);
  const [write, setWrite] = useState(false);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [openMsg, setOpenMsg] = useState<Message | null>(null);
  const [award, setAward] = useState<Member | null>(null);
  const setTab = useNav((s) => s.setTab);
  const [badges, setBadges] = useState<PersonBadge[]>([]);
  const [giveTo, setGiveTo] = useState<Member | null>(null);
  const [openBadge, setOpenBadge] = useState<PersonBadge | null>(null);
  const [awardTitle, setAwardTitle] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const load = useCallback(async () => {
    if (!teamId) return;
    const from = startOfDay(new Date());
    const [s, ev, rs, st, bd] = await Promise.all([api.listSessions(from.toISOString(), addDays(from, 28).toISOString()), api.listEvents(), api.listResults(teamId), api.teamStats(teamId), api.listPersonBadges({ teamId })]);
    const mine = s.filter((x) => x.team_id === teamId);
    setSessions(mine); setEvents(ev.filter((e) => !e.team_ids.length || e.team_ids.includes(teamId))); setResults(rs); setStats(st); setBadges(bd);
    setAbsences(await api.listAbsences(mine.map((x) => x.id)));
    void api.listMessages().then(setMsgs).catch(() => setMsgs([]));
    if (staff) setMembers((await api.listMembers()).filter((p) => p.memberships.some((m) => m.team_id === teamId)));
  }, [teamId, staff]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage("team"); }, [teamId]);

  if (!team) return <section className="screen"><header className="topbar"><h1 className="display">{t("team.myTeam")}</h1><TopRight /></header><TeamPicker /><p className="muted">{t("team.noneYet")}</p></section>;
  if (page === "folders") return <><Folders teamId={team.id} staff={staff} onBack={() => { setPage("team"); void load(); }} toast={say} /><Toast msg={toast} /></>;
  if (page === "choreo") return <><Choreo teamId={team.id} staff={staff} onBack={() => { setPage("team"); void load(); }} toast={say} /><Toast msg={toast} /></>;
  if (page === "notes") return <Notes teamId={team.id} staff={staff} onBack={() => setPage("team")} />;

  const role = roleOn(team.id);
  const dancers = members.filter((p) => p.memberships.some((m) => m.team_id === team.id && m.role === "dancer"));
  const trainers = members.filter((p) => p.memberships.some((m) => m.team_id === team.id && m.role !== "dancer"));
  const child = viewing.isChild ? me.children.find((c) => c.id === viewing.personId) : null;
  const seesChoreo = staff || role !== "parent" || team.parents_see_video || ((ageOf(child) ?? 99) < 13);
  const next = sessions[0];
  const trainerName = next?.trainer_name ?? trainers[0]?.first_name ?? null;

  if (page === "dancers") return (
    <section className="screen">
      <button className="linklike" onClick={() => setPage("team")}>‹ {team.name}</button>
      <header className="topbar"><h1 className="display">{t("team.dancers")} · {stats.dancers}</h1></header>
      <div className="card list">
        {trainers.map((p) => <div key={p.id} className="item"><span className="avatar">{p.first_name[0]}</span><span className="grow">{p.first_name} {p.last_name}<div className="tiny">{t(`roles.${p.memberships.find((m) => m.team_id === team.id)?.role ?? "trainer"}`)}</div></span></div>)}
        {dancers.map((p) => <div key={p.id} className="item"><span className="avatar">{p.first_name[0]}</span><span className="grow">{p.first_name} {p.last_name}{p.birth_year ? <span className="tiny"> · {p.birth_year}</span> : ""}
          <div className="tiny">{p.parents.map((g) => `${g.first_name} ${g.phone ?? ""}`).join(" · ") || p.phone || ""}{p.photo_consent === false ? " · " + t("team.noPhotoConsent") : ""}</div><EmblemRow badges={badges.filter((b) => b.person_id === p.id)} size="sm" /></span>{p.supervised_by && <span className="chip small">{t("team.childAccount")}</span>}<button className="ghost small" aria-label={t("badges.give")} data-testid="give-badge" onClick={() => setGiveTo(p)}>🎖</button><button className="ghost small" aria-label={t("milestones.give")} data-testid="give-milestone" onClick={() => { setAward(p); setAwardTitle(""); }}>🏅</button></div>)}
        {!staff && <p className="muted">{t("team.rosterStaffOnly")}</p>}
      </div>
      {giveTo && <GiveEmblemSheet personId={giveTo.id} personName={giveTo.first_name} teamId={team.id} onClose={() => setGiveTo(null)} onGiven={(b) => { setGiveTo(null); confetti(); say(t("badges.given", { name: giveTo.first_name, badge: `${b.emoji} ${b.name}` })); void load(); }} />}
      {award && (
        <Sheet onClose={() => setAward(null)} eyebrow={t("milestones.give")} title={award.first_name}>
          <div className="chips">{MILESTONE_IDEAS.map((m) => <button key={m} className={"chip" + (awardTitle === m ? " on" : "")} onClick={() => setAwardTitle(m)}>{m}</button>)}</div>
          <input id="milestone-title" placeholder={t("milestones.custom")} value={awardTitle} onChange={(e) => setAwardTitle(e.target.value)} />
          <button className="cta" id="milestone-save" disabled={!awardTitle.trim()} onClick={async () => { await api.giveMilestone(award.id, awardTitle.trim(), team.id); setAward(null); say(t("milestones.given", { name: award.first_name })); }}>{t("milestones.giveBtn")}</button>
        </Sheet>
      )}
      <Toast msg={toast} />
    </section>
  );

  const heroUrl = resolveImage(team.cover_url) ?? artForCategory(team.category);
  const aboutImg = aboutImage(team, heroUrl);
  return (
    <section className="screen" style={teamAccent(team)}>
      <header className="topbar"><h1 className="display">{team.name}</h1><TopRight /></header>
      <TeamPicker />
      <div className="hero photo kb" data-testid="team-hero" data-tour="team-hero"><span className="bg warm" style={{ backgroundImage: `url(${heroUrl})` }} />
        <div><div className="eyebrow">{team.style} · {t(`category.${team.category}`)} · {team.level}</div><h2 className="display">{team.name}</h2>
          <div className="small muted">{t("team.dancersN", { n: stats.dancers })}{trainerName ? ` · ${trainerName}` : ""}{next ? ` · ${DAY_LONG[(new Date(next.starts_at).getDay() + 6) % 7]} ${hm(next.starts_at)} ${next.room_name ?? ""}` : ""}</div>
          <div className="small muted">{t(`roles.${role ?? "dancer"}`)}{team.closed ? ` · ${t("team.closed")}` : ""}{team.punch_card_open ? ` · ${t("team.punchOpen")}` : ""}</div></div>
      </div>

      <div className="grid2 tiles">
        <button className={"card tap" + (seesChoreo ? "" : " dim")} disabled={!seesChoreo} onClick={() => setPage("choreo")} data-testid="go-choreo"><div className="eyebrow">{t("team.choreo")}</div><div className="big">{seesChoreo ? t("team.videosN", { n: stats.videos }) : t("team.choreoLocked")}</div></button>
        <button className="card tap" onClick={() => setPage("folders")} data-testid="go-folders"><div className="eyebrow">{t("team.folders")}</div><div className="big">{t("team.mediaN", { n: stats.media })}</div></button>
        <button className={"card tap" + (seesChoreo ? "" : " dim")} disabled={!seesChoreo} onClick={() => setPage("choreo")}><div className="eyebrow">{t("choreo.formations")}</div><div className="big">{t("team.formationsN", { n: stats.formations })}</div></button>
        <button className="card tap" onClick={() => setPage("dancers")} data-testid="go-dancers"><div className="eyebrow">{t("team.dancers")}</div><div className="big">{stats.dancers}{staff ? "" : ""}</div></button>
      </div>
      {staff && <div className="row" style={{ marginTop: 6 }}><button className="ghost small" onClick={() => setPage("notes")} data-testid="go-notes">{t("notes.title")}</button></div>}

      {(team.description || team.price || team.day_time) && (
        <div className="sec"><h2>{t("team.about")}</h2><div className="card" data-testid="team-about">
          {aboutImg && <div className="mood" data-testid="team-about-img" style={{ backgroundImage: `url(${aboutImg})` }} />}
          {(team.day_time || team.years) && <div className="small muted" style={{ marginBottom: 8 }}>{[team.day_time, team.years].filter(Boolean).join(" · ")}</div>}
          {team.description && <About text={team.description} />}
          {team.price && (staff || role === "parent") && <div className="row between" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}><span className="tiny">{t("team.price")}</span><span className="gold small">{team.price}</span></div>}
        </div></div>
      )}
      {events.length > 0 && (
        <div className="sec"><h2>{t("team.nextForTeam")}</h2><ScrollList>
          {events.map((e) => <div key={e.id} className="item"><span className="time">{dateLabel(e.starts_at)}</span><span className="grow">{e.title}<div className="tiny">{e.place ?? t(`events.kind.${e.kind}`)}</div></span><span className="gold">›</span></div>)}
        </ScrollList></div>
      )}

      <div className="sec"><div className="row between"><h2>{t("team.trophies")}</h2>{staff && <button className="linklike small" onClick={() => setTab("events")}>+ {t("events.addResult")}</button>}</div><ScrollList testId="trophies">
        {results.map((r) => <div key={r.id} className="item" data-testid="result"><span className="time">{new Date(r.held_on).toLocaleDateString("da-DK", { month: "short", year: "numeric" })}</span><span className="grow">{r.event_title}</span><span className="chip gold small">{r.placed}</span></div>)}
        {!results.length && <p className="muted small" style={{ margin: 0 }}>{events.find((e) => e.kind === "competition") ? t("team.noTrophiesYet", { event: events.find((e) => e.kind === "competition")!.title, date: dateLabel(events.find((e) => e.kind === "competition")!.starts_at) }) : t("team.noTrophies")}</p>}
      </ScrollList></div>

      <div className="sec"><div className="row between"><h2>{t("badges.title")}</h2>{staff && <button className="linklike small" onClick={() => setPage("dancers")}>{t("badges.give")}</button>}</div><div className="card" data-testid="team-badges">
        {badges.map((b) => <button key={b.id} className="item" onClick={() => setOpenBadge(b)}><span className="emblem sm"><span className="e">{b.emoji}</span></span><span className="grow">{b.person_name}<div className="tiny">{b.name}{b.note ? ` · “${b.note}”` : ""} · {ago(b.created_at)}</div></span></button>)}
        {!badges.length && <p className="muted small" style={{ margin: 0 }}>{t("badges.emptyTeam")}</p>}
      </div></div>
      {openBadge && <EmblemSheet b={openBadge} onClose={() => setOpenBadge(null)} onRemove={staff ? async () => { await api.removeBadge(openBadge.id); setOpenBadge(null); void load(); } : undefined} />}

      {(() => { const teamMsgs = msgs.filter((m) => m.audience.teams?.includes(team.id)); const allMsgs = msgs.filter((m) => m.audience.all); const Row = ({ m }: { m: Message }) => <button className="item" onClick={() => setOpenMsg(m)} data-testid="team-msg"><span className="grow">{m.title}<div className="tiny">{m.author_name} · {ago(m.created_at)}</div></span>{m.acted_at ? <span className="chip ok small">{t(`msg.done.${m.needs}`)}</span> : <span className="chip warn small">{t(`msg.needs.${m.needs}`)}</span>}</button>; return (
      <div className="sec teammsgs" data-testid="team-messages">
        <div className="row between"><h2>{t("team.messages")}</h2>
          <div className="row" style={{ gap: 6 }}>{staff && <button className="small" data-testid="write-team" onClick={() => setCompose(true)}>{t("team.writeToTeam")}</button>}<button className="ghost small" data-testid="write-trainer" onClick={() => setWrite(true)}>{staff ? t("threads.newConversation") : t("threads.writeTo")}</button></div></div>
        <div className="group team"><div className="eyebrow">{t("team.fromTrainer", { team: team.name })}</div>
          <ScrollList className="m0">{teamMsgs.map((m) => <Row key={m.id} m={m} />)}{!teamMsgs.length && <p className="muted small" style={{ margin: 0 }}>{t("team.noTeamMessages")}</p>}</ScrollList></div>
        {allMsgs.length > 0 && <div className="group all"><div className="eyebrow">{t("team.toEveryone")}</div>
          <ScrollList className="m0">{allMsgs.map((m) => <Row key={m.id} m={m} />)}</ScrollList></div>}
      </div>); })()}
      {openMsg && <MessageSheet message={openMsg} onClose={() => { setOpenMsg(null); void load(); }} toast={say} />}
      {write && <ThreadComposer teamId={team.id} teamName={team.name} onClose={() => setWrite(false)} toast={say} />}

      <div className="sec"><h2>{t("team.upcoming")}</h2>
        <ScrollList>
          {sessions.map((s) => <button key={s.id} className={"item" + (s.cancelled ? " off" : "")} onClick={() => setOpen(s)}><span className="time">{dateLabel(s.starts_at)}<br />{hm(s.starts_at)}</span><span className="grow">{s.title ?? s.team_name}<div className="tiny">{s.room_name} · {s.substitute_name ?? s.trainer_name}{s.cancelled ? " · " + t("session.cancelled") : ""}</div></span>{staff && <span className="tiny">{absences.filter((a) => a.session_id === s.id).length} {t("team.absent")}</span>}</button>)}
          {!sessions.length && <p className="muted">{t("home.noTrainings")}</p>}
        </ScrollList>
      </div>

      {open && <SessionSheet session={open} absences={absences} onClose={() => setOpen(null)} onChanged={() => void load()} toast={say} />}
      {compose && <MessageComposer teams={me.person.is_admin ? me.teams : me.teams.filter((x) => me.memberships.some((m) => m.person_id === me.person.id && m.team_id === x.id && m.role !== "dancer"))} defaultTeam={team.id} onClose={() => setCompose(false)} toast={say} />}
      <Toast msg={toast} />
    </section>
  );
}

function About({ text }: { text: string }) {
  const [open, setOpen] = useState(false); const { t } = useTranslation();
  const short = text.length > 260 && !open ? text.slice(0, 260).replace(/\s+\S*$/, "") + "…" : text;
  return <div><p className="small muted" style={{ whiteSpace: "pre-line", margin: 0 }}>{short}</p>{text.length > 260 && <button className="linklike small" onClick={() => setOpen(!open)}>{open ? t("common.less") : t("common.more")}</button>}</div>;
}
