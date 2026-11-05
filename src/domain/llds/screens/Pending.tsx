import { useTranslation } from "react-i18next";
import { useAuth } from "@/core/auth";
import { Logo } from "../components/Logo";

export function Pending({ rejected = false }: { rejected?: boolean }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me);
  const signOut = useAuth((s) => s.signOut);
  const refresh = useAuth((s) => s.refresh);
  return (
    <section className="screen centered">
      <Logo size={120} wordmark={false} />
      <h1 className="display">{rejected ? t("pending.rejectedTitle") : t("pending.title", { name: me?.person.first_name })}</h1>
      <p className="muted">{rejected ? t("pending.rejectedBody") : t("pending.body")}</p>
      {!rejected && <ul className="checklist">
        <li>{t("pending.step1")}</li><li>{t("pending.step2")}</li><li>{t("pending.step3")}</li>
      </ul>}
      <div className="row">
        <button className="ghost" onClick={() => void refresh()}>{t("pending.refresh")}</button>
        <button className="linklike" onClick={() => void signOut()}>{t("common.signOut")}</button>
      </div>
    </section>
  );
}
