/** Stock art (AI-generated, no real people) shipped with the app. Used where no real photo exists yet. */
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
