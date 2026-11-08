import { create } from "zustand";
import { api, type Appearance, type CustomBox } from "@/core/api";

/** Home sections an admin can reorder/hide (Admin → Tilpas appen). Order here = default order. */
export const HOME_SECTIONS = ["hero", "teampick", "stats", "messages", "subs", "yourDay", "studio", "week", "gallery", "upcoming", "payments", "badges"] as const;
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
