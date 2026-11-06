import { useTranslation } from "react-i18next";
import i18n, { type Lang } from "@/core/i18n";
import { useSettings } from "@/core/settings";

/** 🇩🇰 / 🇬🇧 – switches the whole app's language (persisted per device). */
export function LangFlags({ className = "" }: { className?: string }) {
  const { i18n: inst } = useTranslation();
  const set = useSettings((s) => s.set);
  const cur = (inst.language || "da").slice(0, 2) as Lang;
  const pick = (l: Lang) => { set("language", l); void i18n.changeLanguage(l); };
  return (
    <div className={"langflags " + className} role="group" aria-label="Sprog / Language">
      <button className={cur === "da" ? "on" : ""} onClick={() => pick("da")} aria-label="Dansk" title="Dansk" data-testid="lang-da">🇩🇰</button>
      <button className={cur === "en" ? "on" : ""} onClick={() => pick("en")} aria-label="English" title="English" data-testid="lang-en">🇬🇧</button>
    </div>
  );
}
