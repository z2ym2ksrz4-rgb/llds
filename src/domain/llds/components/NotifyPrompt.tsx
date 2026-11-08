import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/core/api";
import { useAuth } from "@/core/auth";
import { registerPush } from "@/core/push";
import { askBrowserPermission, notifyKindsFor } from "../lib/notify";

/** First-login question: notifications on? Shown once the tour is finished/declined (or at once when the tour was already done). "Ikke nu" asks again next login. */
const KEY = "llds_notif_asked";
export function NotifyPrompt() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me); const phase = useAuth((s) => s.phase); const refresh = useAuth((s) => s.refresh); const viewAs = useAuth((s) => s.viewAs);
  const [show, setShow] = useState(false);
  const [pick, setPick] = useState<Record<string, boolean> | null>(null);   // step 2: which kinds
  useEffect(() => {
    // once per person: never in a "Vis appen som" preview, never again once answered (server flag or this device)
    if (phase !== "ready" || !me || viewAs || me.person.notify_prefs?.asked) return;
    let asked = false; try { asked = !!localStorage.getItem(KEY + ":" + me.person.id) || !!localStorage.getItem(KEY); } catch { /* ignore */ }
    if (asked) return;
    let tour: { state?: string } | null = null; try { tour = JSON.parse(localStorage.getItem("llds_tour") ?? "null"); } catch { /* ignore */ }
    const start = () => setShow(true);
    if (tour?.state) { const tm = setTimeout(start, 1200); return () => clearTimeout(tm); }
    addEventListener("llds:tour-done", start); return () => removeEventListener("llds:tour-done", start);
  }, [phase, me?.person.id, me?.person.notify_prefs?.asked, viewAs]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show || !me) return null;
  const kinds = notifyKindsFor(me);
  const finish = async (on: boolean, chosen?: Record<string, boolean>) => {
    setShow(false); setPick(null);
    try { localStorage.setItem(KEY + ":" + me.person.id, "1"); } catch { /* ignore */ }
    await api.updateNotifyPrefs({ ...(me.person.notify_prefs ?? {}), on, kinds: chosen ?? me.person.notify_prefs?.kinds ?? {}, asked: true }); await refresh();
    if (on) { await askBrowserPermission(); void registerPush(); }
  };
  return (
    <div className="tour-bg" role="dialog" aria-modal="true" data-testid="notif-prompt">
      <div className="tour-card center">
        <div className="eyebrow">{t("notifPrefs.eyebrow")}</div>
        {!pick ? (<>
          <h2 className="display">{t("notifPrefs.promptTitle")}</h2>
          <p className="muted">{t("notifPrefs.promptBody")}</p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="cta" onClick={() => setPick(Object.fromEntries(kinds.map((k) => [k.key, true])))} data-testid="notif-on">{t("notifPrefs.turnOn")}</button>
            <button className="ghost" onClick={() => void finish(false)} data-testid="notif-off">{t("notifPrefs.noThanks")}</button>
          </div>
        </>) : (<>
          <h2 className="display">{t("notifPrefs.pickTitle")}</h2>
          <p className="muted">{t("notifPrefs.pickBody")}</p>
          <div className="checklist" data-testid="notif-kinds">{kinds.map((k) => <button key={k.key} type="button" className={"checkrow" + (pick[k.key] ? " on" : "")} role="checkbox" aria-checked={!!pick[k.key]} onClick={() => setPick({ ...pick, [k.key]: !pick[k.key] })}><span className="box" aria-hidden>{pick[k.key] ? "✓" : ""}</span><span className="grow"><span className="lbl">{k.emoji} {t(`notifPrefs.kinds.${k.key}`)}</span></span></button>)}</div>
          <button className="cta" onClick={() => void finish(true, pick)} data-testid="notif-save">{t("notifPrefs.save")}</button>
        </>)}
        <p className="tiny muted" style={{ margin: 0 }}>{t("notifPrefs.changeLater")}</p>
      </div>
    </div>
  );
}

/** Settings section: master switch + one switch per kind. */
export function NotifySettings() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me); const refresh = useAuth((s) => s.refresh);
  const [busy, setBusy] = useState(false);
  if (!me) return null;
  const p = me.person.notify_prefs ?? {}; const on = p.on ?? true;
  const set = async (next: typeof p) => { setBusy(true); try { await api.updateNotifyPrefs({ ...next, asked: true }); await refresh(); if (next.on ?? true) { await askBrowserPermission(); void registerPush(); } } finally { setBusy(false); } };
  return (
    <div className="sec" data-testid="notif-settings"><h2>{t("notifPrefs.title")}</h2>
      <div className="card list">
        <label className="item switch"><span className="grow"><strong>{t("notifPrefs.master")}</strong><div className="tiny">{t("notifPrefs.masterSub")}</div></span>
          <input type="checkbox" role="switch" checked={on} disabled={busy} data-testid="notif-master" onChange={(e) => void set({ ...p, on: e.target.checked })} /></label>
        {on && notifyKindsFor(me).map((k) => (
          <label className="item switch" key={k.key}><span className="avatar small">{k.emoji}</span><span className="grow">{t(`notifPrefs.kinds.${k.key}`)}</span>
            <input type="checkbox" role="switch" checked={p.kinds?.[k.key] ?? true} disabled={busy} data-testid={`notif-kind-${k.key}`} onChange={(e) => void set({ ...p, kinds: { ...(p.kinds ?? {}), [k.key]: e.target.checked } })} /></label>
        ))}
      </div>
    </div>
  );
}
