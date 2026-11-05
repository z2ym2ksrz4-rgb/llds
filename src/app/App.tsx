import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/core/auth";
import { useNav, type Tab } from "@/core/nav";
import { isRelease } from "@/core/release";
import { Home, Login, Register, Pending, Rooms, TeamScreen, Admin, More, Social, Events } from "@/domain";
import { Icon } from "@/domain/llds/components/Icons";
import { TestMenu } from "./TestMenu";

export default function App() {
  const { t } = useTranslation();
  const phase = useAuth((s) => s.phase);
  const me = useAuth((s) => s.me);
  const isAdmin = !!me?.person.is_admin;
  const hasTeams = !!me && me.memberships.length > 0;
  const tab = useNav((s) => s.tab); const setTab = useNav((s) => s.setTab);
  useEffect(() => { if (phase !== "ready") setTab("home"); }, [phase, setTab]); // every sign-in starts on Home

  let body: React.ReactNode;
  if (phase === "loading") body = <section className="screen centered"><div className="spinner" aria-label={t("common.loading")} /></section>;
  else if (phase === "signedOut") body = <Login />;
  else if (phase === "register") body = <Register />;
  else if (phase === "pending") body = <Pending />;
  else if (phase === "rejected") body = <Pending rejected />;
  else body = tab === "home" ? <Home /> : tab === "rooms" ? <Rooms /> : tab === "team" ? <TeamScreen /> : tab === "social" ? <Social /> : tab === "events" ? <Events /> : tab === "admin" && isAdmin ? <Admin /> : <More />;

  const tabs: [Tab, string, string][] = [["home", t("nav.home"), "home"], ["rooms", t("nav.rooms"), "cal"], ...(hasTeams ? [["team", t("nav.team"), "team"] as [Tab, string, string]] : []), ["social", t("nav.social"), "chat"], ["events", t("nav.events"), "star"], ...(isAdmin ? [["admin", t("nav.admin"), "grid"] as [Tab, string, string]] : [])];
  return (
    <div className="app">
      <main>{body}</main>
      {phase === "ready" && (
        <nav className="tabbar">
          {tabs.map(([k, label, icon]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}><Icon name={icon} /><span>{label}</span></button>)}
        </nav>
      )}
      {!isRelease && <TestMenu />}
    </div>
  );
}
