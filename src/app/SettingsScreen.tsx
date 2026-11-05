import { useTranslation } from "react-i18next";
import { useSettings } from "@/core/settings";
import { SUPPORTED, type Lang } from "@/core/i18n";
import i18n from "@/core/i18n";
import { useAuth } from "@/core/auth";
import { appVersion } from "@/core/release";
import appConfig from "../../app.config.json";

export function SettingsScreen() {
  const { t } = useTranslation();
  const s = useSettings();
  const me = useAuth((a) => a.me);
  const signOut = useAuth((a) => a.signOut);
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("nav.settings")}</h1></header>
      {me && <div className="card"><strong>{me.person.first_name} {me.person.last_name}</strong><div className="tiny">{me.person.email} · {me.person.phone}</div></div>}
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
