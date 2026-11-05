import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/core/auth";
import { isRelease } from "@/core/release";
import { Home, Login, Register, Pending, Rooms, TeamScreen, Admin, More } from "@/domain";
import { TestMenu } from "./TestMenu";

type Tab = "home" | "rooms" | "team" | "admin" | "more";

export default function App() {
  const { t } = useTranslation();
  const phase = useAuth((s) => s.phase);
  const me = useAuth((s) => s.me);
  const isAdmin = !!me?.person.is_admin;
  const hasTeams = !!me && me.memberships.length > 0;
  const [tab, setTab] = useState<Tab>("home");
  useEffect(() => { if (phase !== "ready") setTab("home"); }, [phase]); // every sign-in starts on Home

  let body: React.ReactNode;
  if (phase === "loading") body = <section className="screen centered"><div className="spinner" aria-label={t("common.loading")} /></section>;
  else if (phase === "signedOut") body = <Login />;
  else if (phase === "register") body = <Register />;
  else if (phase === "pending") body = <Pending />;
  else if (phase === "rejected") body = <Pending rejected />;
  else body = tab === "home" ? <Home /> : tab === "rooms" ? <Rooms /> : tab === "team" ? <TeamScreen /> : tab === "admin" && isAdmin ? <Admin /> : <More />;

  const tabs: [Tab, string][] = [["home", t("nav.home")], ["rooms", t("nav.rooms")], ...(hasTeams ? [["team", t("nav.team")] as [Tab, string]] : []), ...(isAdmin ? [["admin", t("nav.admin")] as [Tab, string]] : []), ["more", t("nav.more")]];
  return (
    <div className="app">
      <main>{body}</main>
      {phase === "ready" && (
        <nav className="tabbar">
          {tabs.map(([k, label]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{label}</button>)}
        </nav>
      )}
      {!isRelease && <TestMenu />}
    </div>
  );
}
