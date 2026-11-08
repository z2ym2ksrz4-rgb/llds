import { useTranslation } from "react-i18next";
import { useAuth } from "@/core/auth";
import type { Team } from "@/core/api";

/** Team switcher at the top of "Mit hold": every team the person can open, grouped by WHY they can – trainer on, assistant on,
 *  dancer on, parent of <child>. One tap switches; no hidden sheet. Admins without roles get every team in one scrollable row. */
export function TeamPicker() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me);
  const viewing = useAuth((s) => s.viewing);
  const teamId = useAuth((s) => s.teamId);
  const setTeam = useAuth((s) => s.setTeam);
  const setViewing = useAuth((s) => s.setViewing);
  if (!me || !viewing) return null;
  const teamOf = (id: string) => me.teams.find((x) => x.id === id);
  const own = me.memberships.filter((m) => m.person_id === me.person.id);
  const groups: { key: string; label: string; personId: string; isChild: boolean; teams: Team[] }[] = [];
  const add = (key: string, label: string, personId: string, isChild: boolean, ids: string[]) => { const teams = ids.map(teamOf).filter((x): x is Team => !!x); if (teams.length) groups.push({ key, label, personId, isChild, teams }); };
  add("trainer", t("team.groupTrainer"), me.person.id, false, own.filter((m) => m.role === "trainer").map((m) => m.team_id));
  add("assistant", t("team.groupAssistant"), me.person.id, false, own.filter((m) => m.role === "assistant").map((m) => m.team_id));
  add("dancer", t("team.groupDancer"), me.person.id, false, own.filter((m) => m.role === "dancer").map((m) => m.team_id));
  for (const c of me.children) add("child-" + c.id, t("team.groupParent", { name: c.first_name }), c.id, true, me.memberships.filter((m) => m.person_id === c.id && m.role === "dancer").map((m) => m.team_id));
  const inGroups = new Set(groups.flatMap((g) => g.teams.map((x) => x.id)));
  if (me.person.is_admin) { const rest = me.teams.filter((x) => !inGroups.has(x.id)); if (rest.length) groups.push({ key: "all", label: t("team.groupAll"), personId: me.person.id, isChild: false, teams: rest }); }
  const current = teamOf(teamId ?? "");
  const pickTeam = (g: typeof groups[number], id: string) => { if (g.personId !== viewing.personId) setViewing({ personId: g.personId, isChild: g.isChild }); setTeam(id); };
  const total = groups.reduce((n, g) => n + g.teams.length, 0);

  if (!total) {
    const kid = viewing.isChild ? me.children.find((c) => c.id === viewing.personId) : null;
    const staffOn = kid ? me.memberships.filter((m) => m.person_id === kid.id && m.role !== "dancer").map((m) => teamOf(m.team_id)?.name).filter(Boolean) : [];
    return <div className="teampick static" data-tour="teampick"><span className="eyebrow">{t("team.myTeam")}</span><strong>{t("team.none")}</strong>
      <p className="tiny muted" style={{ margin: "4px 0 0" }}>{kid ? (staffOn.length ? t("team.childNoDancerTeams", { name: kid.first_name, teams: staffOn.join(", ") }) : t("team.childNoTeams", { name: kid.first_name })) : t("team.noneYet")}</p></div>;
  }
  return (
    <div className="teampick static" data-tour="teampick" data-testid="teampick">
      <span className="eyebrow">{viewing.isChild ? t("team.childsTeam", { name: me.children.find((c) => c.id === viewing.personId)?.first_name }) : t("team.myTeam")}</span>
      <strong>{current?.name ?? t("team.none")}</strong>
      {total > 1 && <div className="teamgroups">
        {groups.map((g) => (
          <div key={g.key} className="tg"><span className="tiny lbl">{g.label}</span>
            <div className="chips tight scrollx">{g.teams.map((x) => <button key={x.id} type="button" className={"chip small" + (x.id === teamId && g.personId === viewing.personId ? " on" : "")} onClick={() => pickTeam(g, x.id)}>{x.name}</button>)}</div>
          </div>
        ))}
      </div>}
    </div>
  );
}
