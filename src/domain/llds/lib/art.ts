/** Stock art (AI-generated, no real people) shipped with the app. Used where no real photo exists yet. */
import type { CSSProperties } from "react";
import type { Focus } from "@/core/api";
import { catalogFor } from "./catalog";
export type ArtKey = "group" | "solo" | "trophy" | "studio" | "trails" | "costume";
const N: Record<ArtKey, number> = { group: 1, solo: 2, trophy: 3, studio: 4, trails: 5, costume: 6 };
export const art = (k: ArtKey, small = false) => `${import.meta.env.BASE_URL}art/${N[k]}${small ? "s" : ""}.jpg`;
/** deterministic pick for lists (events, teams) so the same item always gets the same picture */
export const artFor = (seed: string, pool: ArtKey[] = ["group", "trophy", "studio", "trails", "solo"], small = false) => { let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0; return art(pool[h % pool.length], small); };
export const artForCategory = (cat: string | null | undefined) => art(cat === "mini" || cat === "kids" ? "trophy" : cat === "adult" ? "studio" : "group");

/** Colour themes a team can be given in Admin → Hold. Each is a pair: the tone itself (lines, glow) and a lighter one for text, so words stay readable on photos and dark cards.
 *  All sit in the same warm, muted family as the gold – nothing neon. The team stores the first value. */
export const TEAM_THEMES: { key: string; accent: string; text: string }[] = [
  { key: "gold", accent: "#c9a24a", text: "#e6c87a" },
  { key: "champagne", accent: "#d9c58a", text: "#f1e3b5" },
  { key: "copper", accent: "#c0804a", text: "#e2a877" },
  { key: "rosegold", accent: "#c99082", text: "#e8b8aa" },
  { key: "bronze", accent: "#a8843a", text: "#cfae63" },
  { key: "brown", accent: "#9a6b4b", text: "#cfa283" },
  { key: "bordeaux", accent: "#b8485a", text: "#e39aa6" },
  { key: "plum", accent: "#8f6a94", text: "#c9a9cd" },
  { key: "dustyblue", accent: "#6f93b0", text: "#a9c6dc" },
  { key: "sage", accent: "#7f9f7a", text: "#b4cfae" },
  { key: "silver", accent: "#9a9aa2", text: "#d0d0d6" },
];
const AUTO = TEAM_THEMES.slice(0, 5);   // teams without a chosen theme get one of the five metals, always the same one for the same team
/** Per-team accent – the theme chosen in Admin, else a fixed metal from the gold family. An older free colour still works (text gets the same tone). */
export function teamAccent(team: { id: string; color: string | null }): Record<string, string> {
  if (team.color) { const th = TEAM_THEMES.find((x) => x.accent.toLowerCase() === team.color!.toLowerCase()); return { "--accent": team.color, "--accent2": th?.text ?? team.color } as Record<string, string>; }
  let h = 0; for (const c of team.id) h = (h * 31 + c.charCodeAt(0)) >>> 0; const th = AUTO[h % AUTO.length];
  return { "--accent": th.accent, "--accent2": th.text } as Record<string, string>;
}

/** Image for the "Om holdet" card: another of Line's own photos when the team has any; otherwise a catalogue image for the category that differs from the hero. Never AI next to real photos. */
export function aboutImage(team: { id: string; category: string; cover_url?: string | null; about_url?: string | null; alt_url?: string | null; cover_path?: string | null; photos?: string[] }, heroUrl: string | null): string | null {
  if (team.about_url) return team.about_url.startsWith("http") ? team.about_url : `${import.meta.env.BASE_URL}${team.about_url}`;
  const own = (team.photos ?? []).filter((p) => p !== heroUrl && p !== team.cover_url);
  if (/^https?:\/\//.test(team.alt_url ?? "") && !own.includes(team.alt_url!)) own.push(team.alt_url!); // website photo displaced by an uploaded cover
  const hasOwn = !!team.cover_path || (team.photos?.length ?? 0) > 0 || /^https?:/.test(team.cover_url ?? "");
  if (hasOwn) return own[0] ?? null;
  const pool = catalogFor("team").map((c) => `${import.meta.env.BASE_URL}art/catalog/${c.file}`).filter((u) => u !== heroUrl);
  if (!pool.length) return null;
  let h = 7; for (const c of team.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}

/** CSS vars for background-position from a focus point – default: horizontally centred, upper third (where faces usually are). */
export function focusStyle(f?: Focus | null, extra?: CSSProperties): CSSProperties {
  const x = f ? Math.round(Math.min(1, Math.max(0, f.x)) * 100) : 50, y = f ? Math.round(Math.min(1, Math.max(0, f.y)) * 100) : 35;
  return { ...(extra ?? {}), ["--fx" as string]: `${x}%`, ["--fy" as string]: `${y}%` } as CSSProperties;
}
