import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/core/api";
import { useAuth } from "@/core/auth";
import { registerPush } from "@/core/push";
import { askBrowserPermission } from "../lib/notify";

/** First-login question: notifications on? Shown once the tour is finished/declined (or at once when the tour was already done). "Ikke nu" asks again next login. */
const KEY = "llds_notif_asked";
export function NotifyPrompt() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me); const phase = useAuth((s) => s.phase); const refresh = useAuth((s) => s.refresh);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (phase !== "ready" || !me || me.person.notify_prefs?.asked) return;
    let asked = false; try { const a = JSON.parse(localStorage.getItem(KEY) ?? "null") as { at: number } | null; asked = !!a && Date.now() - a.at < 6 * 3600e3; } catch { /* ignore */ }
    if (asked) return; // "Ikke nu" – ask again next sitting
    let tour: { state?: string } | null = null; try { tour = JSON.parse(localStorage.getItem("llds_tour") ?? "null"); } catch { /* ignore */ }
    const start = () => setShow(true);
    if (tour?.state) { const tm = setTimeout(start, 1200); return () => clearTimeout(tm); }
    addEventListener("llds:tour-done", start); return () => removeEventListener("llds:tour-done", start);
  }, [phase, me?.person.id, me?.person.notify_prefs?.asked]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!show || !me) return null;
  const answer = async (on: boolean, remember: boolean) => {
    setShow(false);
    if (!remember) { try { localStorage.setItem(KEY, JSON.stringify({ at: Date.now() })); } catch { /* ignore */ } } // "Ikke nu": ask again next sitting on this device
    if (remember) { await api.updateNotifyPrefs({ ...(me.person.notify_prefs ?? {}), on, asked: true }); await refresh(); }
    if (on) { await askBrowserPermission(); void registerPush(); }
  };
  return (
    <div className="tour-bg" role="dialog" aria-modal="true" data-testid="notif-prompt">
      <div className="tour-card center">
        <div className="eyebrow">{t("notifPrefs.eyebrow")}</div>
        <h2 className="display">{t("notifPrefs.promptTitle")}</h2>
        <p className="muted">{t("notifPrefs.promptBody")}</p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="cta" onClick={() => void answer(true, true)} data-testid="notif-on">{t("notifPrefs.turnOn")}</button>
          <button className="ghost" onClick={() => void answer(false, false)} data-testid="notif-later">{t("notifPrefs.notNow")}</button>
          <button className="ghost" onClick={() => void answer(false, true)} data-testid="notif-off">{t("notifPrefs.noThanks")}</button>
        </div>
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
        {on && NOTIFY_KINDS_FOR(me.person.is_admin).map((k) => (
          <label className="item switch" key={k.key}><span className="avatar small">{k.emoji}</span><span className="grow">{t(`notifPrefs.kinds.${k.key}`)}</span>
            <input type="checkbox" role="switch" checked={p.kinds?.[k.key] ?? true} disabled={busy} data-testid={`notif-kind-${k.key}`} onChange={(e) => void set({ ...p, kinds: { ...(p.kinds ?? {}), [k.key]: e.target.checked } })} /></label>
        ))}
      </div>
    </div>
  );
}
import { NOTIFY_KINDS } from "../lib/notify";
const NOTIFY_KINDS_FOR = (admin: boolean) => NOTIFY_KINDS.filter((k) => admin || !k.admin);
