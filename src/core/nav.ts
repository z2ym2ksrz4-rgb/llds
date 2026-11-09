import { create } from "zustand";
export type Tab = "home" | "rooms" | "team" | "social" | "events" | "admin" | "more" | "shop";
export type NavRef = Record<string, string>;
type Nav = { tab: Tab; prev: Tab; adminPage: string | null; pendingRef: NavRef | null; setTab: (t: Tab) => void; back: () => void; openAdmin: (page: string) => void; takeAdminPage: () => string | null; openRef: (tab: Tab, ref: NavRef) => void; takeRef: (key: string) => string | null };
export const useNav = create<Nav>((set, get) => ({ tab: "home", prev: "home", adminPage: null, pendingRef: null,
  /** jump to a tab and open the thing a notification points at (session_id, event_id, …) */
  openRef: (tab, ref) => set({ pendingRef: ref, tab, prev: get().tab === tab ? get().prev : get().tab }),
  takeRef: (key) => { const r = get().pendingRef; if (r && r[key]) { set({ pendingRef: null }); return r[key]; } return null; }, openAdmin: (page) => set({ adminPage: page, tab: "admin", prev: get().tab === "admin" ? get().prev : get().tab }), takeAdminPage: () => { const p = get().adminPage; if (p) set({ adminPage: null }); return p; }, setTab: (tab) => set({ tab, prev: get().tab === tab ? get().prev : get().tab }), back: () => set({ tab: get().prev, prev: "home" }) }));
