/** Stock art (AI-generated, no real people) shipped with the app. Used where no real photo exists yet. */
import { catalogFor } from "./catalog";
export type ArtKey = "group" | "solo" | "trophy" | "studio" | "trails" | "costume";
const N: Record<ArtKey, number> = { group: 1, solo: 2, trophy: 3, studio: 4, trails: 5, costume: 6 };
export const art = (k: ArtKey, small = false) => `${import.meta.env.BASE_URL}art/${N[k]}${small ? "s" : ""}.jpg`;
/** deterministic pick for lists (events, teams) so the same item always gets the same picture */
export const artFor = (seed: string, pool: ArtKey[] = ["group", "trophy", "studio", "trails", "solo"], small = false) => { let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0; return art(pool[h % pool.length], small); };
export const artForCategory = (cat: string | null | undefined) => art(cat === "mini" || cat === "kids" ? "trophy" : cat === "adult" ? "studio" : "group");

/** Per-team accent – the team's own colour if Line set one, else a deterministic metal from the gold family (gold, champagne, copper, rose gold, bronze). */
const METALS = [["#c9a24a", "#e6c87a"], ["#d9c58a", "#f1e3b5"], ["#c0804a", "#e2a877"], ["#c99082", "#e8b8aa"], ["#a8843a", "#cfae63"]];
export function teamAccent(team: { id: string; color: string | null }): Record<string, string> {
  if (team.color) return { "--accent": team.color, "--accent2": team.color } as Record<string, string>;
  let h = 0; for (const c of team.id) h = (h * 31 + c.charCodeAt(0)) >>> 0; const [a, b] = METALS[h % METALS.length];
  return { "--accent": a, "--accent2": b } as Record<string, string>;
}

/** Image for the "Om holdet" card: another of Line's own photos when the team has any; otherwise a catalogue image for the category that differs from the hero. Never AI next to real photos. */
export function aboutImage(team: { id: string; category: string; cover_url?: string | null; alt_url?: string | null; cover_path?: string | null; photos?: string[] }, heroUrl: string | null): string | null {
  const own = (team.photos ?? []).filter((p) => p !== heroUrl && p !== team.cover_url);
  if (/^https?:\/\/(?!.*supabase)/.test(team.alt_url ?? "") && !own.includes(team.alt_url!)) own.push(team.alt_url!); // website photo displaced by an uploaded cover
  const hasOwn = !!team.cover_path || (team.photos?.length ?? 0) > 0 || /^https?:/.test(team.cover_url ?? "");
  if (hasOwn) return own[0] ?? null;
  const pool = catalogFor("team").map((c) => `${import.meta.env.BASE_URL}art/catalog/${c.file}`).filter((u) => u !== heroUrl);
  if (!pool.length) return null;
  let h = 7; for (const c of team.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return pool[h % pool.length];
}
