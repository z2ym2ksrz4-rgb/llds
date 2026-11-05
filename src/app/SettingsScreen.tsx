import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/core/settings";
import { SUPPORTED, type Lang } from "@/core/i18n";
import i18n from "@/core/i18n";
import { useAuth } from "@/core/auth";
import { api } from "@/core/api";
import { appVersion } from "@/core/release";
import appConfig from "../../app.config.json";

export function SettingsScreen() {
  const { t } = useTranslation();
  const s = useSettings();
  const me = useAuth((a) => a.me);
  const refresh = useAuth((a) => a.refresh);
  const signOut = useAuth((a) => a.signOut);
  const [childEmail, setChildEmail] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const year = new Date().getFullYear();
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("nav.settings")}</h1></header>
      {me && <div className="card"><strong>{me.person.first_name} {me.person.last_name}</strong><div className="tiny">{me.person.email} · {me.person.phone}</div></div>}

      {me && me.children.length > 0 && (
        <div className="sec"><h2>{t("settings.children")}</h2>
          {me.children.map((c) => { const age = c.birth_year ? year - c.birth_year : null; const eligible = age != null && age >= appConfig.supervisedFromAge && age < appConfig.minAccountAge; return (
            <div className="card" key={c.id}>
              <div className="row between"><strong>{c.first_name}</strong><span className="tiny">{c.birth_year ?? ""}{age != null ? ` · ${age} ${t("settings.years")}` : ""}</span></div>
              {c.supervised_by ? (
                <><div className="small"><span className="chip ok small">{t("settings.childLoginOn")}</span> {c.email}</div><p className="tiny">{t("settings.childLoginExplain")}</p>
                  <button className="ghost small" onClick={async () => { await api.revokeChildLogin(c.id); await refresh(); setMsg(t("settings.childLoginRevoked", { name: c.first_name })); }}>{t("settings.revokeChildLogin")}</button></>
              ) : eligible ? (
                <><p className="small muted">{t("settings.childLoginOffer", { name: c.first_name })}</p>
                  <div className="row"><input placeholder={t("settings.childEmail")} type="email" value={childEmail[c.id] ?? ""} onChange={(e) => setChildEmail({ ...childEmail, [c.id]: e.target.value })} />
                    <button className="small" disabled={!(childEmail[c.id] ?? "").includes("@")} onClick={async () => { try { await api.grantChildLogin(c.id, childEmail[c.id]); await refresh(); setMsg(t("settings.childLoginGranted", { name: c.first_name })); } catch (e) { setMsg((e as Error).message); } }}>{t("settings.grant")}</button></div>
                  <p className="tiny">{t("settings.childConsent")}</p></>
              ) : <p className="tiny">{age != null && age < appConfig.supervisedFromAge ? t("settings.childTooYoung", { age: appConfig.supervisedFromAge }) : t("settings.childOwnAccount")}</p>}
            </div>); })}
          {msg && <p className="ok small" role="status">{msg}</p>}
        </div>
      )}

      <label className="field"><span>{t("settings.language")}</span>
        <select value={s.language} onChange={(e) => { const l = e.target.value as Lang; s.set("language", l); void i18n.changeLanguage(l); }}>
          {SUPPORTED.map((l) => <option key={l} value={l}>{t(`lang.${l}`)}</option>)}
        </select>
      </label>
      <button className="ghost" onClick={() => void signOut()}>{t("common.signOut")}</button>
      <p className="muted small">
        <a href={appConfig.privacyUrl}>{t("settings.privacy")}</a> · <a href={appConfig.termsUrl}>{t("settings.terms")}</a> · {appConfig.supportEmail} · v{appVersion}
      </p>
    </section>
  );
}
