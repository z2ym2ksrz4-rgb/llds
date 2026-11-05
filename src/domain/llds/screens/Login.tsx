import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api, isMock } from "@/core/api";
import { Logo } from "../components/Logo";
import { art } from "../lib/art";

/** E-mail + one-time code. No passwords. */
export function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    setBusy(true); setErr(null);
    try { await api.sendCode(email.trim()); setStep("code"); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setErr(null);
    try { await api.verifyCode(email.trim(), code.trim()); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <section className="screen login">
      <img className="login-bg" src={art("trails")} alt="" aria-hidden="true" /><div className="login-art" aria-hidden="true" />
      <div className="login-body">
        <Logo />
        <h1 className="display">{t("login.welcome")} <em>{t("login.backstage")}</em></h1>
        <p className="muted">{t("login.tagline")}</p>
        {step === "email" ? (
          <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="stack">
            <label className="field"><span>{t("login.email")}</span>
              <input id="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dit@navn.dk" /></label>
            <button className="cta" disabled={busy || !email.includes("@")}>{t("login.sendCode")}</button>
            <p className="tiny">{t("login.noAccount")}</p>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="stack">
            <p className="small">{t("login.codeSent", { email })}</p>
            <label className="field"><span>{t("login.code")}</span>
              <input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="••••••" /></label>
            <button className="cta" disabled={busy || code.length < 6}>{t("login.verify")}</button>
            <div className="row between">
              <button type="button" className="linklike" onClick={() => void send()}>{t("login.resend")}</button>
              <button type="button" className="linklike" onClick={() => setStep("email")}>{t("login.otherEmail")}</button>
            </div>
          </form>
        )}
        {err && <p className="error" role="alert">{err}</p>}
        {isMock && <p className="tiny demo-hint">{t("login.demoHint")}</p>}
      </div>
    </section>
  );
}
