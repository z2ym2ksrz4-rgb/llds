import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Absence, type Channel, type Member, type Session } from "@/core/api";
import { useAuth } from "@/core/auth";
import { TeamPicker } from "../components/TeamPicker";
import { SessionSheet } from "../components/SessionSheet";
import { Toast } from "../components/Sheet";
import { Feed } from "../components/Feed";
import { MessageComposer } from "../components/Messages";
import { Folders } from "./Folders";
import { Choreo } from "./Choreo";
import { Notes } from "./Notes";
import { MILESTONE_IDEAS } from "../lib/milestones";
import { Sheet } from "../components/Sheet";
import { addDays, dateLabel, hm, startOfDay } from "../lib/time";

type Page = "team" | "folders" | "choreo" | "notes";

/** "Mit hold": header, choreography/folders/notes, team room feed, upcoming trainings, roster (staff see contact details). */
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
  const [open, setOpen] = useState<Session | null>(null);
  const [compose, setCompose] = useState(false);
  const [award, setAward] = useState<Member | null>(null);
  const [awardTitle, setAwardTitle] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };

  const load = useCallback(async () => {
    if (!teamId) return;
    const from = startOfDay(new Date());
    const s = (await api.listSessions(from.toISOString(), addDays(from, 28).toISOString())).filter((x) => x.team_id === teamId);
    setSessions(s); setAbsences(await api.listAbsences(s.map((x) => x.id)));
    if (staff) setMembers((await api.listMembers()).filter((p) => p.memberships.some((m) => m.team_id === teamId)));
  }, [teamId, staff]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage("team"); }, [teamId]);

  if (!team) return <section className="screen"><header className="topbar"><h1 className="display">{t("team.myTeam")}</h1></header><TeamPicker /><p className="muted">{t("team.noneYet")}</p></section>;
  if (page === "folders") return <><Folders teamId={team.id} staff={staff} onBack={() => setPage("team")} toast={say} /><Toast msg={toast} /></>;
  if (page === "choreo") return <><Choreo teamId={team.id} staff={staff} onBack={() => setPage("team")} toast={say} /><Toast msg={toast} /></>;
  if (page === "notes") return <Notes teamId={team.id} staff={staff} onBack={() => setPage("team")} />;

  const role = roleOn(team.id);
  const dancers = members.filter((p) => p.memberships.some((m) => m.team_id === team.id && m.role === "dancer"));
  const trainers = members.filter((p) => p.memberships.some((m) => m.team_id === team.id && m.role !== "dancer"));
  // parents on a team without parents_see_video don't get choreography (Line's rule) – except for children under 13
  const child = viewing.isChild ? me.children.find((c) => c.id === viewing.personId) : null;
  const seesChoreo = staff || role !== "parent" || team.parents_see_video || (!!child?.birth_year && new Date().getFullYear() - child.birth_year < 13);
  const channels: Channel[] = isStaffAnywhere ? ["team", "school", "trainers"] : ["team", "school"];

  return (
    <section className="screen">
      <TeamPicker />
      <div className="hero"><div className="hero-bg" /><div><div className="eyebrow">{team.style} · {t(`category.${team.category}`)} · {team.level}</div><h1 className="display">{team.name}</h1>
        <div className="small muted">{t(`roles.${role ?? "dancer"}`)}{team.closed ? ` · ${t("team.closed")}` : ""}{team.punch_card_open ? ` · ${t("team.punchOpen")}` : ""}</div></div></div>

      <div className="grid3">
        <button className={"card tap" + (seesChoreo ? "" : " dim")} disabled={!seesChoreo} onClick={() => setPage("choreo")} data-testid="go-choreo"><div className="eyebrow">{t("team.choreo")}</div><div className="tiny">{seesChoreo ? t("team.choreoSub") : t("team.choreoLocked")}</div></button>
        <button className="card tap" onClick={() => setPage("folders")} data-testid="go-folders"><div className="eyebrow">{t("team.folders")}</div><div className="tiny">{t("team.foldersSub")}</div></button>
        {staff && <button className="card tap" onClick={() => setPage("notes")} data-testid="go-notes"><div className="eyebrow">{t("notes.title")}</div><div className="tiny">{t("notes.subStaff")}</div></button>}
      </div>

      <div className="sec"><div className="row between"><h2>{t("feed.title")}</h2>{staff && <button className="ghost small" onClick={() => setCompose(true)}>{t("msg.new")}</button>}</div>
        <Feed teamId={team.id} channels={channels} toast={say} />
      </div>

      <div className="sec"><h2>{t("team.upcoming")}</h2>
        <div className="card list">
          {sessions.slice(0, 8).map((s) => <button key={s.id} className={"item" + (s.cancelled ? " off" : "")} onClick={() => setOpen(s)}><span className="time">{dateLabel(s.starts_at)}<br />{hm(s.starts_at)}</span><span className="grow">{s.title ?? s.team_name}<div className="tiny">{s.room_name} · {s.substitute_name ?? s.trainer_name}{s.cancelled ? " · " + t("session.cancelled") : ""}</div></span>{staff && <span className="tiny">{absences.filter((a) => a.session_id === s.id).length} {t("team.absent")}</span>}</button>)}
          {!sessions.length && <p className="muted">{t("home.noTrainings")}</p>}
        </div>
      </div>

      {staff && (
        <div className="sec"><h2>{t("team.dancers")} · {dancers.length}</h2>
          <div className="card list">
            {trainers.map((p) => <div key={p.id} className="item"><span className="avatar">{p.first_name[0]}</span><span className="grow">{p.first_name} {p.last_name}<div className="tiny">{t(`roles.${p.memberships.find((m) => m.team_id === team.id)?.role ?? "trainer"}`)}</div></span></div>)}
            {dancers.map((p) => <div key={p.id} className="item"><span className="avatar">{p.first_name[0]}</span><span className="grow">{p.first_name} {p.last_name}{p.birth_year ? <span className="tiny"> · {p.birth_year}</span> : ""}
              <div className="tiny">{p.parents.map((g) => `${g.first_name} ${g.phone ?? ""}`).join(" · ") || p.phone || ""}{p.photo_consent === false ? " · " + t("team.noPhotoConsent") : ""}</div></span>{p.supervised_by && <span className="chip small">{t("team.childAccount")}</span>}<button className="ghost small" aria-label={t("milestones.give")} data-testid="give-milestone" onClick={() => { setAward(p); setAwardTitle(""); }}>🏅</button></div>)}
          </div>
        </div>
      )}

      {open && <SessionSheet session={open} absences={absences} onClose={() => setOpen(null)} onChanged={() => void load()} toast={say} />}
      {compose && <MessageComposer teams={me.person.is_admin ? me.teams : me.teams.filter((x) => me.memberships.some((m) => m.person_id === me.person.id && m.team_id === x.id && m.role !== "dancer"))} defaultTeam={team.id} onClose={() => setCompose(false)} toast={say} />}
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
}
