import { create } from "zustand";
import type { OrderLine } from "@/core/api";

/** The shop basket – kept for the session so you can browse products and pay once. */
type Cart = { lines: OrderLine[]; add: (l: OrderLine) => void; remove: (i: number) => void; clear: () => void };
const KEY = "llds_cart";
const load = (): OrderLine[] => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const save = (lines: OrderLine[]) => { try { sessionStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* ignore */ } };
export const useCart = create<Cart>((set) => ({
  lines: load(),
  add: (l) => set((s) => { const lines = [...s.lines, l]; save(lines); return { lines }; }),
  remove: (i) => set((s) => { const lines = s.lines.filter((_, j) => j !== i); save(lines); return { lines }; }),
  clear: () => { save([]); set({ lines: [] }); },
}));
