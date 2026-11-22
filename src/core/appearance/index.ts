import { create } from "zustand";
import { api, type Appearance, type CustomBox } from "@/core/api";

/** Home sections an admin can reorder/hide (Admin → Tilpas appen). Order here = default order. */
export const HOME_SECTIONS = ["hero", "teampick", "messages", "subs", "yourDay", "week", "gallery", "payments", "badges", "studioHead", "stats", "studio", "upcoming"] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

type Store = { a: Appearance; loaded: boolean; load: () => Promise<void>; save: (a: Appearance) => Promise<void> };
export const useAppearance = create<Store>((set) => ({
  a: {}, loaded: false,
  async load() { try { set({ a: await api.getAppearance(), loaded: true }); } catch { set({ loaded: true }); } },
  async save(a) { await api.saveAppearance(a); set({ a }); },
}));

/** Full ordered list of section keys incl. custom boxes; unknown/new sections are appended in default order. */
export function homeOrder(a: Appearance): string[] {
  const boxes = (a.boxes ?? []).map((b) => "box:" + b.id);
  const all = [...HOME_SECTIONS, ...boxes];
  const given = (a.home ?? []).filter((k) => all.includes(k));
  return [...given, ...all.filter((k) => !given.includes(k))];
}
export const boxOf = (a: Appearance, key: string): CustomBox | undefined => a.boxes?.find((b) => "box:" + b.id === key);
export const isHidden = (a: Appearance, key: string) => (a.hidden ?? []).includes(key);

/** Texts an admin can override in Tilpas appen → Tekster. `site.*` keys are applied live by the website (data-txt hooks, Danish only);
 *  `app.*` keys replace the locale string in the app via useText(). `em` = the second part after "|" is rendered in italics on the site. */
export const TEXT_KEYS: { key: string; multiline?: boolean; em?: boolean; appKey?: string }[] = [
  { key: "site.heroTitle", em: true }, { key: "site.heroLead", multiline: true }, { key: "site.welcomeTitle", em: true }, { key: "site.welcome", multiline: true },
  { key: "site.videoTitle" }, { key: "site.appTitle", em: true }, { key: "site.appLead", multiline: true }, { key: "site.bandTitle" }, { key: "site.band", multiline: true },
  { key: "app.loginTagline", appKey: "login.tagline" }, { key: "app.registerIntro", appKey: "register.intro", multiline: true }, { key: "app.pendingBody", appKey: "pending.body", multiline: true },
];
/** Default Danish site texts (what the generated page shows when nothing is overridden). */
export const SITE_TEXT_DEFAULTS: Record<string, string> = {
  "site.heroTitle": "Dans med hjertet. | Vind med holdet.",
  "site.heroLead": "Danseskole for alle aldre – fra de allermindste til elitehold, der stiller op til DM. Showdance, hip hop, contemporary, disco, ballet og spring.",
  "site.welcomeTitle": "Velkommen til | LL Dance Studio",
  "site.welcome": "LL Dance Studio er en danseskole i Ulstrup med showdance for alle aldre – fra de mindste på Mini Cuties til elitehold, der stiller op til DM. Vores elitehold optager via audition. Undervisningen ledes af Line Lund Olesen med 15 års erfaring som danser og 10 år som underviser, sammen med et hold af dygtige trænere.",
  "site.videoTitle": "Udforsk vores danseunivers",
  "site.appTitle": "Alt det praktiske – | i lommen",
  "site.appLead": "Dansere, forældre og trænere har hvert deres rum. Tilmelding, afbud, koreografi-videoer, holdets billeder, beskeder fra træneren, events og Stjerneshoppen – ét sted.",
  "site.bandTitle": "Du er altid velkommen",
  "site.band": "Du er altid velkommen til at kontakte os – uanset om du ønsker at deltage på et af vores hold, har spørgsmål til programmet eller bare vil vide mere.",
};
/** The admin's override for an app text, else the locale string. */
export function textOverride(a: Appearance, key: string): string | null { const v = a.texts?.[key]; return typeof v === "string" && v.trim() ? v : null; }
