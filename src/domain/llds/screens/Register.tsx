import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type SignUpInput } from "@/core/api";
import { useAuth } from "@/core/auth";
import appConfig from "../../../../app.config.json";

type R = SignUpInput["roles"][number];
const ROLES: R[] = ["parent", "dancer", "trainer", "assistant"];
const thisYear = new Date().getFullYear();

/** Self-registration. The admin approves and places people on teams afterwards. */
export function Register() {
  const { t } = useTranslation();
  const email = useAuth((s) => s.email);
  const refresh = useAuth((s) => s.refresh);
  const signOut = useAuth((s) => s.signOut);
  const [f, setF] = useState<SignUpInput>({ firstName: "", lastName: "", phone: "", birthYear: null, roles: [], wishedTeams: "", children: [] });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const minAge = appConfig.minAccountAge;

  const toggleRole = (r: R) => setF((x) => ({ ...x, roles: x.roles.includes(r) ? x.roles.filter((y) => y !== r) : [...x.roles, r] }));
  const isParent = f.roles.includes("parent");
  const isDancer = f.roles.includes("dancer");
  const tooYoung = isDancer && f.birthYear != null && thisYear - f.birthYear < minAge;
  const valid = f.firstName.trim() && f.lastName.trim() && f.phone.trim() && f.roles.length > 0 && !tooYoung
    && (!isParent || f.children.every((c) => c.firstName.trim() && c.birthYear > 1990))
    && (!isDancer || f.birthYear != null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try { await api.signUp({ ...f, children: isParent ? f.children : [] }); await refresh(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("register.title")}</h1></header>
      <p className="muted">{t("register.intro")}</p>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <div className="field"><span>{t("register.iAm")}</span>
          <div className="chips">
            {ROLES.map((r) => <button type="button" key={r} className={"chip" + (f.roles.includes(r) ? " on" : "")} onClick={() => toggleRole(r)}>{t(`roles.${r}`)}</button>)}
          </div>
          <small className="muted">{t("register.rolesHint")}</small>
        </div>
        <div className="grid2">
          <label className="field"><span>{t("register.firstName")}</span><input id="firstName" required value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></label>
          <label className="field"><span>{t("register.lastName")}</span><input id="lastName" required value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></label>
        </div>
        <label className="field"><span>{t("register.phone")}</span><input id="phone" type="tel" inputMode="tel" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <label className="field"><span>{t("register.email")}</span><input value={email ?? ""} disabled /></label>
        {isDancer && (
          <label className="field"><span>{t("register.birthYear")}</span>
            <input id="birthYear" type="number" inputMode="numeric" min={1940} max={thisYear} value={f.birthYear ?? ""} onChange={(e) => setF({ ...f, birthYear: e.target.value ? Number(e.target.value) : null })} />
            {tooYoung && <small className="error">{t("register.tooYoung", { age: minAge })}</small>}
          </label>
        )}
        {isParent && (
          <div className="field"><span>{t("register.children")}</span>
            {f.children.map((c, i) => (
              <div className="row" key={i}>
                <input placeholder={t("register.childName")} value={c.firstName} onChange={(e) => setF({ ...f, children: f.children.map((x, j) => j === i ? { ...x, firstName: e.target.value } : x) })} />
                <input type="number" inputMode="numeric" placeholder={t("register.birthYear")} style={{ maxWidth: 110 }} value={c.birthYear || ""} onChange={(e) => setF({ ...f, children: f.children.map((x, j) => j === i ? { ...x, birthYear: Number(e.target.value) } : x) })} />
                <button type="button" className="ghost small" aria-label={t("common.remove")} onClick={() => setF({ ...f, children: f.children.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button type="button" className="ghost small" onClick={() => setF({ ...f, children: [...f.children, { firstName: "", birthYear: 0 }] })}>+ {t("register.addChild")}</button>
            <small className="muted">{t("register.childHint", { age: minAge })}</small>
          </div>
        )}
        <label className="field"><span>{t("register.wishedTeams")}</span><input id="wishedTeams" value={f.wishedTeams} onChange={(e) => setF({ ...f, wishedTeams: e.target.value })} placeholder={t("register.wishedTeamsPh")} /></label>
        <p className="tiny">{t("register.terms")} <a href={appConfig.termsUrl} target="_blank" rel="noreferrer">{t("settings.terms")}</a> · <a href={appConfig.privacyUrl} target="_blank" rel="noreferrer">{t("settings.privacy")}</a></p>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="cta" disabled={busy || !valid}>{t("register.submit")}</button>
        <button type="button" className="linklike" onClick={() => void signOut()}>{t("common.signOut")}</button>
      </form>
    </section>
  );
}
