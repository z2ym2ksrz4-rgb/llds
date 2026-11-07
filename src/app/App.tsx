import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/core/auth";
import { useNav, type Tab } from "@/core/nav";
import { isRelease } from "@/core/release";
import { Home, Login, Register, Pending, Rooms, TeamScreen, Admin, More, Social, Events } from "@/domain";
import { Icon } from "@/domain/llds/components/Icons";
import { Logo } from "@/domain/llds/components/Logo";
import { Tour } from "@/domain/llds/components/Tour";
import { UpdateBanner } from "./UpdateBanner";
import { TestMenu } from "./TestMenu";

export default function App() {
  const { t } = useTranslation();
  const phase = useAuth((s) => s.phase);
  const me = useAuth((s) => s.me);
  const isAdmin = !!me?.person.is_admin;
  const realAdmin = useAuth((s) => !!s.realMe?.person.is_admin);
  const viewAs = useAuth((s) => s.viewAs); const setViewAs = useAuth((s) => s.setViewAs);
  const hasTeams = !!me && (me.memberships.length > 0 || (realAdmin && !viewAs));
  const blocked = useAuth((s) => s.previewBlocked)();
  const tab = useNav((s) => s.tab); const setTab = useNav((s) => s.setTab);
  useEffect(() => { if (phase !== "ready") setTab("home"); }, [phase, setTab]);
  useEffect(() => { if ((tab === "admin" && !isAdmin) || (tab === "team" && !hasTeams)) setTab("home"); }, [tab, isAdmin, hasTeams, setTab]); // every sign-in starts on Home

  let body: React.ReactNode;
  if (phase === "loading") body = <section className="screen centered"><Logo size={150} draw /></section>;
  else if (phase === "signedOut") body = <Login />;
  else if (phase === "register") body = <Register />;
  else if (phase === "pending") body = <Pending />;
  else if (phase === "rejected") body = <Pending rejected />;
  else if (blocked) body = <section className="screen centered"><div className="card" style={{ maxWidth: 420 }}><div className="eyebrow">{t("view.blockedEyebrow")}</div><h2 className="display">{blocked.name}</h2><p className="muted">{t("view.blocked", { years: blocked.years ?? "", age: 10 })}</p><div className="row" style={{ gap: 8, marginTop: 12 }}><button className="cta" onClick={() => setViewAs("parent")}>{t("view.asParent")}</button><button className="ghost" onClick={() => setViewAs(null)}>{t("view.exit")}</button></div></div></section>;
  else body = tab === "home" ? <Home /> : tab === "rooms" ? <Rooms /> : tab === "team" ? <TeamScreen /> : tab === "social" ? <Social /> : tab === "events" ? <Events /> : tab === "admin" && isAdmin ? <Admin /> : <More />;

  const tabs: [Tab, string, string][] = [["home", t("nav.home"), "home"], ["rooms", t("nav.rooms"), "cal"], ...(hasTeams ? [["team", realAdmin && !viewAs ? t("nav.teams") : t("nav.team"), "team"] as [Tab, string, string]] : []), ["social", t("nav.social"), "chat"], ["events", t("nav.events"), "star"], ...(isAdmin ? [["admin", t("nav.admin"), "grid"] as [Tab, string, string]] : [])];
  return (
    <div className="app">
      {phase === "ready" && viewAs && <div className="viewbar" data-testid="viewbar"><span>{t("view.previewing", { role: t(`roles.${viewAs}`) })}</span><button onClick={() => setViewAs(null)}>{t("view.exit")}</button></div>}
      <main>{body}</main>
      {phase === "ready" && <Tour />}
      <UpdateBanner />
      {phase === "ready" && (
        <nav className="tabbar">
          {tabs.map(([k, label, icon]) => <button key={k} className={tab === k ? "active" : ""} data-tour={`tab-${k}`} onClick={() => setTab(k)}><Icon name={icon} /><span>{label}</span></button>)}
        </nav>
      )}
      {!isRelease && <TestMenu />}
    </div>
  );
}
