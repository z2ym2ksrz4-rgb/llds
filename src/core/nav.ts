import { create } from "zustand";
export type Tab = "home" | "rooms" | "team" | "social" | "events" | "admin" | "more" | "shop";
type Nav = { tab: Tab; prev: Tab; adminPage: string | null; setTab: (t: Tab) => void; back: () => void; openAdmin: (page: string) => void; takeAdminPage: () => string | null };
export const useNav = create<Nav>((set, get) => ({ tab: "home", prev: "home", adminPage: null, openAdmin: (page) => set({ adminPage: page, tab: "admin", prev: get().tab === "admin" ? get().prev : get().tab }), takeAdminPage: () => { const p = get().adminPage; if (p) set({ adminPage: null }); return p; }, setTab: (tab) => set({ tab, prev: get().tab === tab ? get().prev : get().tab }), back: () => set({ tab: get().prev, prev: "home" }) }));
