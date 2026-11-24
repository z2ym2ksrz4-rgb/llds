import { useCallback, useEffect, useState } from "react";
import { loc } from "../lib/time";
import { useTranslation } from "react-i18next";
import { api, type Milestone } from "@/core/api";
import { useAuth } from "@/core/auth";
import { useNav } from "@/core/nav";
import { AccountSettings, ChildrenSettings } from "@/app/SettingsScreen";
import { NotifySettings } from "../components/NotifyPrompt";
import { FeedbackSheet } from "../components/FeedbackPrompt";
import { resetTour } from "../components/Tour";
import { JoinTeam, MyPayments } from "./Payments";
import { MyWallet } from "./PunchCards";
import { Toast } from "../components/Sheet";
import appConfig from "../../../../app.config.json";

export type MorePage = "profile" | "children" | "wallet" | "notifications" | "help" | "milestones";
const PAGES: MorePage[] = ["profile", "children", "wallet", "notifications", "help", "milestones"];

/** The pages behind the avatar menu (P2.17): one short menu replaces "Mere" + settings. Opened via useNav.openRef("more", { page }). */
export function More() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const pendingRef = useNav((n) => n.pendingRef);
  const setTab = useNav((s) => s.setTab);
  const [page, setPage] = useState<MorePage>(() => (useNav.getState().takeRef("page") as MorePage | null) ?? "profile");
  useEffect(() => { const p = useNav.getState().takeRef("page") as MorePage | null; if (p && PAGES.includes(p)) setPage(p); }, [pendingRef]);
  const back = <button className="linklike" onClick={() => setTab("home")}>‹ {t("nav.home")}</button>;
  if (page === "milestones") return <Milestones onBack={() => setTab("home")} />;
  if (page === "wallet") return <WalletPage back={back} />;
  if (page === "children") return <section className="screen">{back}<header className="topbar"><h1 className="display">{t("settings.children")}</h1></header>{me.children.length ? <ChildrenSettings /> : <p className="muted">{t("settings.noChildren")}</p>}</section>;
  if (page === "notifications") return <section className="screen">{back}<header className="topbar"><h1 className="display">{t("notif.settingsTitle")}</h1></header><NotifySettings /></section>;
  if (page === "help") return <HelpPage back={back} />;
  return <section className="screen">{back}<AccountSettings /></section>;
}

function WalletPage({ back }: { back: React.ReactNode }) {
  const { t } = useTranslation();
  const [join, setJoin] = useState(false); const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  return (
    <section className="screen">
      {back}
      <header className="topbar"><h1 className="display">{t("more.wallet")}</h1></header>
      <MyPayments inline />
      <MyWallet />
      <div className="card list"><button className="item" data-testid="more-join" onClick={() => setJoin(true)}><span className="grow">{t("pay.join")}<div className="tiny">{t("pay.joinSub")}</div></span><span className="gold">›</span></button></div>
      {join && <JoinTeam onClose={() => setJoin(false)} toast={say} />}
      <Toast msg={toast} />
    </section>
  );
}

/** A.9: one help page – five questions people actually ask, then the ways to get more help. */
function HelpPage({ back }: { back: React.ReactNode }) {
  const { t } = useTranslation();
  const [fb, setFb] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  const qs = ["absence", "pay", "video", "write", "child"] as const;
  return (
    <section className="screen">
      {back}
      <header className="topbar"><h1 className="display">{t("help.title")}</h1></header>
      <div className="card faq" data-testid="help-faq">
        {qs.map((q) => <details key={q} className="faqitem"><summary>{t(`help.q.${q}`)}</summary><p className="small">{t(`help.a.${q}`)}</p></details>)}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="ghost small" onClick={() => { resetTour(); location.reload(); }}>{t("tour.again")}</button>
        <button className="ghost small" data-testid="settings-feedback" onClick={() => setFb(true)}>{t("feedback.give")}</button>
        <a className="linklike small" href={`${appConfig.siteUrl}support/`} target="_blank" rel="noreferrer">{t("help.site")} ↗</a>
      </div>
      {msg && <p className="ok small" role="status">{msg}</p>}
      {fb && <FeedbackSheet context="help" onClose={(sent) => { setFb(false); if (sent) setMsg(t("feedback.thanks")); }} />}
      <p className="muted small">{t("help.contact", { email: appConfig.supportEmail })}</p>
    </section>
  );
}

function Milestones({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const [list, setList] = useState<Milestone[]>([]);
  const load = useCallback(async () => setList(await api.listMilestones()), []);
  useEffect(() => { void load(); }, [load]);
  const people = [me.person, ...me.children];
  return (
    <section className="screen">
      <button className="linklike" onClick={onBack}>‹ {t("nav.home")}</button>
      <header className="topbar"><h1 className="display">{t("milestones.title")}</h1></header>
      {people.map((p) => { const ms = list.filter((m) => m.person_id === p.id); if (!ms.length) return null; return (
        <div key={p.id} className="sec"><h2>{p.first_name}</h2>
          {ms.map((m) => <div key={m.id} className="card milestone" data-testid="milestone"><div className="display big">{m.title}</div><div className="tiny">{m.reached_on ? new Date(m.reached_on).toLocaleDateString(loc()) : ""}{m.team_name ? ` · ${m.team_name}` : ""}{m.given_by_name ? ` · ${t("milestones.by", { name: m.given_by_name })}` : ""}</div></div>)}
        </div>); })}
      {!list.length && <p className="muted">{t("milestones.empty")}</p>}
    </section>
  );
}
