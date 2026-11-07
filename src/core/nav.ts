import { create } from "zustand";
export type Tab = "home" | "rooms" | "team" | "social" | "events" | "admin" | "more" | "shop";
type Nav = { tab: Tab; prev: Tab; setTab: (t: Tab) => void; back: () => void };
export const useNav = create<Nav>((set, get) => ({ tab: "home", prev: "home", setTab: (tab) => set({ tab, prev: get().tab === tab ? get().prev : get().tab }), back: () => set({ tab: get().prev, prev: "home" }) }));
