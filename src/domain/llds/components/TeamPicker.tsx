import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/core/auth";

/** The "Mit hold" switcher Line asked for: tap the team name → sheet with all my (or my child's) teams, plus whose hat I wear. */
export function TeamPicker() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me);
  const viewing = useAuth((s) => s.viewing);
  const teamId = useAuth((s) => s.teamId);
  const setTeam = useAuth((s) => s.setTeam);
  const setViewing = useAuth((s) => s.setViewing);
  const myTeams = useAuth((s) => s.myTeams)();
  const roleOn = useAuth((s) => s.roleOn);
  const [open, setOpen] = useState(false);
  if (!me || !viewing) return null;
  const current = myTeams.find((x) => x.id === teamId);
  const hats = [{ id: me.person.id, name: me.person.first_name, isChild: false }, ...me.children.map((c) => ({ id: c.id, name: c.first_name, isChild: true }))];
  const ownHasTeams = me.memberships.some((m) => m.person_id === me.person.id);
  const showHats = hats.length > 1 && (ownHasTeams || me.children.length > 1);

  return (
    <>
      <button className="teampick" data-tour="teampick" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="eyebrow">{viewing.isChild ? t("team.childsTeam", { name: hats.find((h) => h.id === viewing.personId)?.name }) : t("team.myTeam")}</span>
        <strong>{current?.name ?? t("team.none")} <span className="caret">▾</span></strong>
      </button>
      {open && (
        <div className="sheet-bg" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="handle" />
            {showHats && (
              <div className="field"><span>{t("team.viewAs")}</span>
                <div className="chips">{hats.map((h) => <button key={h.id} className={"chip" + (viewing.personId === h.id ? " on" : "")} onClick={() => setViewing({ personId: h.id, isChild: h.isChild })}>{h.name}</button>)}</div>
              </div>
            )}
            <div className="field"><span>{t("team.pick")}</span>
              <div className="list">
                {myTeams.map((x) => (
                  <button key={x.id} className={"item" + (x.id === teamId ? " on" : "")} onClick={() => { setTeam(x.id); setOpen(false); }}>
                    <div className="grow"><div>{x.name}</div><div className="tiny">{x.style} · {x.level} · {t(`roles.${roleOn(x.id) ?? "dancer"}`)}</div></div>
                    {x.id === teamId && <span className="gold">✓</span>}
                  </button>
                ))}
                {!myTeams.length && (() => { const kid = viewing.isChild ? me.children.find((c) => c.id === viewing.personId) : null; const staffOn = kid ? me.memberships.filter((m) => m.person_id === kid.id && m.role !== "dancer").map((m) => me.teams.find((x) => x.id === m.team_id)?.name).filter(Boolean) : []; return (
                  <p className="muted">{kid ? (staffOn.length ? t("team.childNoDancerTeams", { name: kid.first_name, teams: staffOn.join(", ") }) : t("team.childNoTeams", { name: kid.first_name })) : t("team.noneYet")}</p>); })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
