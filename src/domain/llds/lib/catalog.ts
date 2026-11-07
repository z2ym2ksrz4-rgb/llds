import list from "./catalog.generated.json";
/** Image catalogue (public/art/catalog) – AI illustrations in the studio's black/gold look, picked by admins for teams, events and posts. */
export type CatalogImage = { key: string; file: string; title: string; tags: string[] };
export const CATALOG: CatalogImage[] = list as CatalogImage[];
/** ref = bundled key ("light-trails") or a full URL of an uploaded catalogue image */
export const catalogUrl = (ref: string | null | undefined) => { if (!ref) return null; if (/^(https?:|data:|blob:)/.test(ref)) return ref; const c = CATALOG.find((x) => x.key === ref); return c ? `${import.meta.env.BASE_URL}art/catalog/${c.file}` : null; };
/** resolve an external or catalogue-relative image reference (team.cover_url may be "art/catalog/x.jpg") */
export const resolveImage = (ref: string | null | undefined) => (!ref ? null : ref.startsWith("http") || ref.startsWith("data:") || ref.startsWith("blob:") ? ref : `${import.meta.env.BASE_URL}${ref.replace(/^\//, "")}`);
export const catalogFor = (tag: "event" | "team" | "post") => CATALOG.filter((c) => c.tags.includes(tag));
