import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Absence, type Member, type Session } from "@/core/api";
import { useAuth } from "@/core/auth";
import { TeamPicker } from "../components/TeamPicker";
import { SessionSheet } from "../components/SessionSheet";
import { Toast } from "../components/Sheet";
import { addDays, dateLabel, hm, startOfDay } from "../lib/time";

/** "Mit hold": header, upcoming trainings, roster (staff see contact details). Feed/video/folders arrive in phase 3. */
export function TeamScreen() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const teamId = useAuth((s) => s.teamId);
  const roleOn = useAuth((s) => s.roleOn);
  const team = me.teams.find((x) => x.id === teamId);
  const staff = me.person.is_admin || (teamId != null && me.memberships.some((m) => m.person_id === me.person.id && m.team_id === teamId && m.role !== "dancer"));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState<Session | null>(null);
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

  if (!team) return <section className="screen"><header className="topbar"><h1 className="display">{t("team.myTeam")}</h1></header><TeamPicker /><p className="muted">{t("team.noneYet")}</p></section>;
  const role = roleOn(team.id);
  const dancers = members.filter((p) => p.memberships.some((m) => m.team_id === team.id && m.role === "dancer"));
  const trainers = members.filter((p) => p.memberships.some((m) => m.team_id === team.id && m.role !== "dancer"));

  return (
    <section className="screen">
      <TeamPicker />
      <div className="hero"><div className="hero-bg" /><div><div className="eyebrow">{team.style} · {t(`category.${team.category}`)} · {team.level}</div><h1 className="display">{team.name}</h1>
        <div className="small muted">{t(`roles.${role ?? "dancer"}`)}{team.closed ? ` · ${t("team.closed")}` : ""}{team.punch_card_open ? ` · ${t("team.punchOpen")}` : ""}</div></div></div>

      <div className="grid2">
        <div className="card tap dim"><div className="eyebrow">{t("team.choreo")}</div><div className="tiny">{t("team.phase3")}</div></div>
        <div className="card tap dim"><div className="eyebrow">{t("team.folders")}</div><div className="tiny">{t("team.phase3")}</div></div>
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
              <div className="tiny">{p.parents.map((g) => `${g.first_name} ${g.phone ?? ""}`).join(" · ") || p.phone || ""}{p.photo_consent === false ? " · " + t("team.noPhotoConsent") : ""}</div></span>{p.supervised_by && <span className="chip small">{t("team.childAccount")}</span>}</div>)}
          </div>
        </div>
      )}

      {open && <SessionSheet session={open} absences={absences} onClose={() => setOpen(null)} onChanged={() => void load()} toast={say} />}
      <Toast msg={toast} />
    </section>
  );
}
