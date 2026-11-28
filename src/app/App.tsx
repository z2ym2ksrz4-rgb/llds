import { Skeleton } from "@/domain/llds/components/Skeleton";
import { OfflineBar } from "@/domain/llds/components/OfflineBar";
import { useEffect , lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/core/auth";
import { useNav, type Tab } from "@/core/nav";
import { useBadges } from "@/core/badges";
import { isRelease } from "@/core/release";
import { initDeepLinks } from "@/core/links";
import { SceneBg } from "@/domain/llds/components/Scene";
import { Home, Login, Register, Pending, Rooms, TeamScreen, More, Social, Events } from "@/domain";
const Admin = lazy(() => import("@/domain/llds/admin/Admin").then((m) => ({ default: m.Admin })));   // members never open Admin – they should not download it
import { Icon } from "@/domain/llds/components/Icons";
import { Logo } from "@/domain/llds/components/Logo";
import { Tour } from "@/domain/llds/components/Tour";
import { NotifyPrompt } from "@/domain/llds/components/NotifyPrompt";
import { FeedbackPrompt } from "@/domain/llds/components/FeedbackPrompt";
import { Welcome } from "@/domain/llds/components/Welcome";
import { UpdateBanner } from "./UpdateBanner";
import { ShopScreen } from "@/domain/llds/screens/ShopScreen";
import { TestMenu } from "./TestMenu";

/** Tapping the tab you are already on takes you back to the top of it (and, in Admin, back to the Admin menu) – the way phone apps do. */
function againTab(k: string) {
  window.dispatchEvent(new CustomEvent("llds:tab-again", { detail: k }));
  const smooth: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  window.scrollTo({ top: 0, behavior: smooth });
  document.querySelectorAll<HTMLElement>("main .calwrap, main .callist").forEach((el) => el.scrollTo({ top: 0, behavior: smooth }));
}

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
  useEffect(() => { initDeepLinks(); const tone = () => { const h = new Date().getHours(); document.documentElement.dataset.tone = h < 10 ? "morning" : h < 17 ? "day" : "evening"; }; tone(); const i = setInterval(tone, 60_000);
    // scroll reveal: sections fade in once as they enter the viewport (no-op with reduced motion or without IntersectionObserver)
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; let io: IntersectionObserver | null = null; let mo: MutationObserver | null = null;
    if (!reduce && "IntersectionObserver" in window) { io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { e.target.classList.add("in"); io?.unobserve(e.target); } }, { rootMargin: "0px 0px -8% 0px" }); const scan = () => document.querySelectorAll<HTMLElement>("main .sec:not(.rv), main .nextcard:not(.rv)").forEach((el) => { el.classList.add("rv"); const top = el.getBoundingClientRect().top; if (top < innerHeight * 1.6) el.classList.add("in"); else { io!.observe(el); setTimeout(() => el.classList.add("in"), 700); } });   /* only sections well below the fold reveal; lists never hide */ scan(); mo = new MutationObserver(scan); mo.observe(document.body, { childList: true, subtree: true }); }
    return () => { clearInterval(i); io?.disconnect(); mo?.disconnect(); }; }, []);
  useEffect(() => { if (phase !== "ready") setTab("home"); }, [phase, setTab]);
  // unread counters on the tabs: refresh when ready, every minute, and on every tab change; opening a tab marks its notifications seen
  const badges = useBadges((b) => b.tabs); const refreshBadges = useBadges((b) => b.refresh); const seenTab = useBadges((b) => b.seen);
  useEffect(() => { if (phase !== "ready") return; void refreshBadges(); const i = setInterval(() => void refreshBadges(), 60_000); return () => clearInterval(i); }, [phase, me?.person.id, refreshBadges]);
  useEffect(() => { if (phase !== "ready") return; void seenTab(tab).then(() => refreshBadges()); }, [tab, phase, seenTab, refreshBadges]);
  useEffect(() => { if ((tab === "admin" && !isAdmin) || (tab === "team" && !hasTeams)) setTab("home"); }, [tab, isAdmin, hasTeams, setTab]); // every sign-in starts on Home

  let body: React.ReactNode;
  if (phase === "loading") body = <section className="screen centered"><Logo size={150} draw /></section>;
  else if (phase === "signedOut") body = <Login />;
  else if (phase === "register") body = <Register />;
  else if (phase === "pending") body = <Pending />;
  else if (phase === "rejected") body = <Pending rejected />;
  else if (blocked) body = <section className="screen centered"><div className="card" style={{ maxWidth: 420 }}><div className="eyebrow">{t("view.blockedEyebrow")}</div><h2 className="display">{blocked.name}</h2><p className="muted">{t("view.blocked", { years: blocked.years ?? "", age: 10 })}</p><div className="row" style={{ gap: 8, marginTop: 12 }}><button className="ghost" onClick={() => setViewAs(null)}>{t("view.exit")}</button></div></div></section>;
  else body = tab === "home" ? <Home /> : tab === "rooms" ? <Rooms /> : tab === "team" ? <TeamScreen /> : tab === "social" ? <Social /> : tab === "events" ? <Events /> : tab === "admin" && isAdmin ? <Suspense fallback={<Skeleton rows={6} />}><Admin /></Suspense> : tab === "shop" ? <ShopScreen /> : <More />;

  const tabs: [Tab, string, string][] = [["home", t("nav.home"), "home"], ["rooms", t("nav.rooms"), "cal"], ...(hasTeams ? [["team", t("nav.team"), "team"] as [Tab, string, string]] : []), ["social", t("nav.social"), "chat"], ["events", t("nav.events"), "star"], ...(isAdmin ? [["admin", t("nav.admin"), "grid"] as [Tab, string, string]] : [])];
  return (
    <div className="app">
      <SceneBg />
      <OfflineBar />
      {phase === "ready" && viewAs && me && <div className="viewbar" data-testid="viewbar"><span>{t("view.previewing", { role: `${me.person.first_name} ${me.person.last_name}` })}</span><button onClick={() => setViewAs(null)}>{t("view.exit")}</button></div>}
      <main>{body}</main>
      {phase === "ready" && <Welcome />}
      {phase === "ready" && <Tour />}
      {phase === "ready" && <NotifyPrompt />}
      {phase === "ready" && <FeedbackPrompt />}
      <UpdateBanner />
      {phase === "ready" && (
        <nav className="tabbar">
          {tabs.map(([k, label, icon]) => <button key={k} className={tab === k ? "active" : ""} data-tour={`tab-${k}`} onClick={() => { if (tab === k) againTab(k); else setTab(k); }}><Icon name={icon} />{(badges[k] ?? 0) > 0 && <em className="tabbadge" data-testid={`tabbadge-${k}`}>{badges[k]! > 99 ? "99+" : badges[k]}</em>}<span>{label}</span></button>)}
        </nav>
      )}
      {!isRelease && <TestMenu />}
    </div>
  );
}
