import { create } from "zustand";

/** Tiny per-device settings (language only for now). Backend holds everything else. */
export type Settings = { language: "da" | "en" };
const KEY = "llds_settings";
const defaults: Settings = { language: "da" };

type Store = Settings & { load: () => void; set: <K extends keyof Settings>(k: K, v: Settings[K]) => void };

export const useSettings = create<Store>((setState, get) => ({
  ...defaults,
  load() { try { setState({ ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }); } catch { /* ignore */ } },
  set(k, v) {
    setState({ [k]: v } as Partial<Settings>);
    const { language } = get();
    try { localStorage.setItem(KEY, JSON.stringify({ language, [k]: v })); } catch { /* ignore */ }
  },
}));
