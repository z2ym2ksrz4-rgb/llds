import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/core/auth";
import { useNav, type Tab } from "@/core/nav";

/** First-login tour: spotlights the key elements one by one. "Senere" shows it again next login, "Nej tak" never again.
 * Targets are marked with data-tour="…"; a step switches to the tab where its target lives. */
type Step = { key: string; tab?: Tab; target: string; staffOnly?: boolean; adminOnly?: boolean };
const STEPS: Step[] = [
  { key: "hero", tab: "home", target: "[data-tour=hero]" },
  { key: "team", tab: "home", target: "[data-tour=teampick]" },
  { key: "week", tab: "home", target: "[data-tour=week]" },
  { key: "bell", tab: "home", target: "[data-tour=bell]" },
  { key: "profile", tab: "home", target: "[data-tour=avatar]" },
  { key: "rooms", target: "[data-tour=tab-rooms]" },
  { key: "teamtab", target: "[data-tour=tab-team]" },
  { key: "social", target: "[data-tour=tab-social]" },
  { key: "events", target: "[data-tour=tab-events]" },
  { key: "admin", target: "[data-tour=tab-admin]", adminOnly: true },
];
const KEY = "llds_tour";
type Saved = { state: "done" | "later"; at: number };
const read = (): Saved | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; } };
const save = (s: Saved) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };
export const resetTour = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

export function Tour() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me); const phase = useAuth((s) => s.phase);
  const setTab = useNav((s) => s.setTab);
  const [i, setI] = useState<number>(-1);           // -1 = not running, -2 = intro card
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tick, setTick] = useState(0);
  const isAdmin = !!me?.person.is_admin; const isStaff = useAuth((s) => s.isStaff)();
  const steps = STEPS.filter((s) => (!s.adminOnly || isAdmin) && (!s.staffOnly || isStaff));

  // start on first ready login (or when "later" was chosen and this is a new login)
  useEffect(() => {
    if (phase !== "ready" || !me) return;
    const saved = read();
    if (saved?.state === "done") return;
    if (saved?.state === "later" && Date.now() - saved.at < 6 * 3600e3) return; // same sitting – don't nag
    const tm = setTimeout(() => setI(-2), 900); return () => clearTimeout(tm);
  }, [phase, me?.person.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // measure the current target (after switching tab and letting it render)
  useLayoutEffect(() => {
    if (i < 0) { setRect(null); return; }
    const step = steps[i]; if (!step) return;
    if (step.tab) setTab(step.tab);
    let tries = 0; let raf = 0;
    const find = () => {
      const el = document.querySelector<HTMLElement>(step.target);
      if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); setTimeout(() => setRect(document.querySelector<HTMLElement>(step.target)?.getBoundingClientRect() ?? null), 350); }
      else if (tries++ < 20) raf = window.setTimeout(find, 100);
      else next(); // target not on this screen (e.g. no team) – skip
    };
    find(); return () => clearTimeout(raf);
  }, [i, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const h = () => setTick((x) => x + 1); addEventListener("resize", h); return () => removeEventListener("resize", h); }, []);

  const finish = (state: Saved["state"]) => { save({ state, at: Date.now() }); setI(-1); setTab("home"); dispatchEvent(new Event("llds:tour-done")); };
  const next = () => { if (i + 1 >= steps.length) finish("done"); else setI(i + 1); };
  if (i === -1 || !me) return null;

  if (i === -2) return (
    <div className="tour-bg" role="dialog" aria-modal="true" data-testid="tour-intro">
      <div className="tour-card center">
        <div className="eyebrow">{t("tour.eyebrow")}</div>
        <h2 className="display">{t("tour.title", { name: me.person.first_name })}</h2>
        <p className="muted">{t("tour.intro")}</p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="cta" onClick={() => setI(0)} data-testid="tour-start">{t("tour.start")}</button>
          <button className="ghost" onClick={() => finish("later")} data-testid="tour-later">{t("tour.later")}</button>
          <button className="ghost" onClick={() => finish("done")} data-testid="tour-no">{t("tour.no")}</button>
        </div>
      </div>
    </div>
  );

  const step = steps[i]; const pad = 8;
  const below = rect ? rect.top + rect.height / 2 < window.innerHeight / 2 : true;
  return (
    <div className="tour-bg transparent" data-testid="tour-step" data-step={step.key}>
      {rect && <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />}
      {rect && <div className="tour-label" style={{ left: Math.max(8, rect.left - pad), top: below ? rect.bottom + pad + 6 : undefined, bottom: below ? undefined : window.innerHeight - rect.top + pad + 6 }}>{t(`tour.steps.${step.key}.label`)}</div>}
      <div className={"tour-card " + (below ? "bottom" : "top")} style={rect && below ? { top: Math.min(rect.bottom + pad + 44, window.innerHeight - 230) } : rect ? { bottom: Math.min(window.innerHeight - rect.top + pad + 44, window.innerHeight - 160) } : undefined}>
        <div className="row between"><div className="eyebrow">{t("tour.stepOf", { i: i + 1, n: steps.length })}</div><button className="linklike small" onClick={() => finish("done")}>{t("tour.skip")}</button></div>
        <h3>{t(`tour.steps.${step.key}.title`)}</h3>
        <p className="muted small" style={{ margin: 0 }}>{t(`tour.steps.${step.key}.body`)}</p>
        <div className="row" style={{ gap: 8 }}>
          {i > 0 && <button className="ghost small" onClick={() => setI(i - 1)}>{t("tour.back")}</button>}
          <button className="cta small grow" onClick={next} data-testid="tour-next">{i + 1 >= steps.length ? t("tour.finish") : t("tour.next")}</button>
        </div>
      </div>
    </div>
  );
}
