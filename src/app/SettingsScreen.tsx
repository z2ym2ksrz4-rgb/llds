import { ageOf } from "@/domain/llds/lib/time";
import { resetTour } from "@/domain/llds/components/Tour";
import { NotifySettings } from "@/domain/llds/components/NotifyPrompt";
import { ProfileSection } from "@/domain/llds/components/Profile";
import { MyWallet } from "@/domain/llds/screens/PunchCards";
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
  const [confirmDel, setConfirmDel] = useState(false); const [delErr, setDelErr] = useState<string | null>(null);
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("nav.settings")}</h1></header>
      {me && <div className="card"><strong>{me.person.first_name} {me.person.last_name}</strong><div className="tiny">{me.person.email} · {me.person.phone}</div></div>}
      <ProfileSection />
      <MyWallet />

      {me && me.children.length > 0 && (
        <div className="sec"><h2>{t("settings.children")}</h2>
          {me.children.map((c) => { const age = ageOf(c); const eligible = age != null && age >= appConfig.supervisedFromAge && age < 18 && !c.user_id; const unconfirmed = !!c.user_id && !c.supervised_by && age != null && age < appConfig.minAccountAge; return (
            <div className="card" key={c.id}>
              <div className="row between"><strong>{c.first_name}</strong><span className="tiny">{c.birth_year ?? ""}{age != null ? ` · ${age} ${t("settings.years")}` : ""}</span></div>
              {unconfirmed ? (
                <><p className="small muted">{t("settings.childConfirmOffer", { name: c.first_name })}</p>
                  <button className="small" data-testid="confirm-child" onClick={async () => { try { await api.confirmChild(c.id); await refresh(); setMsg(t("settings.childConfirmed", { name: c.first_name })); } catch (e) { setMsg((e as Error).message); } }}>{t("settings.confirmChild")}</button></>
              ) : c.supervised_by ? (
                <><div className="small"><span className="chip ok small">{t("settings.childLoginOn")}</span> {c.email}</div><p className="tiny">{t("settings.childLoginExplain")}</p>
                  <button className="ghost small" onClick={async () => { await api.revokeChildLogin(c.id); await refresh(); setMsg(t("settings.childLoginRevoked", { name: c.first_name })); }}>{t("settings.revokeChildLogin")}</button></>
              ) : eligible ? (
                <><p className="small muted">{t("settings.childLoginOffer", { name: c.first_name })}</p>
                  <div className="row"><input placeholder={t("settings.childEmail")} type="email" value={childEmail[c.id] ?? ""} onChange={(e) => setChildEmail({ ...childEmail, [c.id]: e.target.value })} />
                    <button className="small" disabled={!(childEmail[c.id] ?? "").includes("@")} onClick={async () => { try { await api.grantChildLogin(c.id, childEmail[c.id]); await refresh(); setMsg(t("settings.childLoginGranted", { name: c.first_name })); } catch (e) { setMsg((e as Error).message); } }}>{t("settings.grant")}</button></div>
                  <p className="tiny">{t("settings.childConsent")}</p></>
              ) : <p className="tiny">{c.user_id ? t("settings.childHasLogin") : age != null && age < appConfig.supervisedFromAge ? t("settings.childTooYoung", { age: appConfig.supervisedFromAge }) : t("settings.childOwnAccount")}</p>}
            </div>); })}
          {msg && <p className="ok small" role="status">{msg}</p>}
        </div>
      )}

      <NotifySettings />
      <button className="ghost small" style={{ alignSelf: "flex-start" }} onClick={() => { resetTour(); location.reload(); }}>{t("tour.again")}</button>
      <label className="field"><span>{t("settings.language")}</span>
        <select value={s.language} onChange={(e) => { const l = e.target.value as Lang; s.set("language", l); void i18n.changeLanguage(l); }}>
          {SUPPORTED.map((l) => <option key={l} value={l}>{t(`lang.${l}`)}</option>)}
        </select>
      </label>
      <button className="ghost" onClick={() => void signOut()}>{t("common.signOut")}</button>
      <div className="sec"><h2>{t("settings.dangerTitle")}</h2>
        {!confirmDel ? <button className="ghost danger small" data-testid="delete-account" onClick={() => setConfirmDel(true)}>{t("settings.deleteAccount")}</button> : (
          <div className="card" style={{ borderColor: "#7a3b3b" }} data-testid="delete-confirm">
            <strong>{t("settings.deleteSure")}</strong>
            <p className="small muted" style={{ margin: 0 }}>{t("settings.deleteExplain")}</p>
            {delErr && <p className="small warn" style={{ margin: 0 }}>{delErr}</p>}
            <div className="row" style={{ gap: 8 }}>
              <button className="danger" data-testid="delete-yes" onClick={async () => { try { await api.deleteMyAccount(); await signOut(); } catch (e) { setDelErr((e as Error).message.includes("last admin") ? t("settings.deleteLastAdmin") : (e as Error).message); } }}>{t("settings.deleteYes")}</button>
              <button className="ghost" onClick={() => { setConfirmDel(false); setDelErr(null); }}>{t("common.cancel")}</button>
            </div>
          </div>)}
      </div>
      <p className="muted small">
        <a href={appConfig.privacyUrl}>{t("settings.privacy")}</a> · <a href={appConfig.termsUrl}>{t("settings.terms")}</a> · {appConfig.supportEmail} · v{appVersion}
      </p>
    </section>
  );
}
