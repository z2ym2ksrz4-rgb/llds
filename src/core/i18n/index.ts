import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import da from "@/locales/da.json";

export const SUPPORTED = ["da", "en"] as const;
export type Lang = (typeof SUPPORTED)[number];

export function detectLanguage(): Lang {
  const nav = (navigator.language || "da").slice(0, 2).toLowerCase();
  return nav === "en" ? "en" : "da";
}

export async function initI18n(lang: Lang) {
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, da: { translation: da } },
    lng: lang, fallbackLng: "da", interpolation: { escapeValue: false },
  });
  return i18n;
}
export default i18n;
