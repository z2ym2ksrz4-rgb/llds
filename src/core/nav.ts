import { create } from "zustand";
export type Tab = "home" | "rooms" | "team" | "social" | "events" | "admin" | "more";
type Nav = { tab: Tab; setTab: (t: Tab) => void };
export const useNav = create<Nav>((set) => ({ tab: "home", setTab: (tab) => set({ tab }) }));
