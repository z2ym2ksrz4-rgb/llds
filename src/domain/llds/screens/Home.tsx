import { useTranslation } from "react-i18next";
import { useAuth } from "@/core/auth";
import { TeamPicker } from "../components/TeamPicker";

/** Phase 1 home: proves identity, hat and team selection. Schedule, feed and events arrive in phase 2–4. */
export function Home() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me);
  const viewing = useAuth((s) => s.viewing);
  const teamId = useAuth((s) => s.teamId);
  const roleOn = useAuth((s) => s.roleOn);
  const isAdmin = useAuth((s) => s.isAdmin)();
  if (!me || !viewing) return null;
  const hat = viewing.isChild ? me.children.find((c) => c.id === viewing.personId) : me.person;
  const role = teamId ? roleOn(teamId) : null;
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("home.hi", { name: me.person.first_name })}</h1><span className="avatar">{me.person.first_name[0]}{me.person.last_name[0] ?? ""}</span></header>
      <TeamPicker />
      <div className="card stack">
        <div className="eyebrow">{t("home.youAre")}</div>
        <div>{isAdmin ? t("roles.admin") : role ? t(`roles.${role}`) : t("home.noRole")}{hat && viewing.isChild ? ` · ${t("home.onBehalf", { name: hat.first_name })}` : ""}</div>
        <div className="tiny">{t("home.phase1")}</div>
      </div>
    </section>
  );
}
