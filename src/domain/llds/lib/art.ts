/** Stock art (AI-generated, no real people) shipped with the app. Used where no real photo exists yet. */
export type ArtKey = "group" | "solo" | "trophy" | "studio" | "trails" | "costume";
const N: Record<ArtKey, number> = { group: 1, solo: 2, trophy: 3, studio: 4, trails: 5, costume: 6 };
export const art = (k: ArtKey, small = false) => `${import.meta.env.BASE_URL}art/${N[k]}${small ? "s" : ""}.jpg`;
/** deterministic pick for lists (events, teams) so the same item always gets the same picture */
export const artFor = (seed: string, pool: ArtKey[] = ["group", "trophy", "studio", "trails", "solo"], small = false) => { let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0; return art(pool[h % pool.length], small); };
export const artForCategory = (cat: string | null | undefined) => art(cat === "mini" || cat === "kids" ? "trophy" : cat === "adult" ? "studio" : "group");
