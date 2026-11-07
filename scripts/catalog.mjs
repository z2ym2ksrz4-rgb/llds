// Scans public/art/catalog/*.jpg|png|webp → src/domain/llds/lib/catalog.generated.json (key = file name without extension).
// Titles/tags come from brand/catalog.json when present (key → {title, tags}); unknown files get a title from the file name.
import { readdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
const meta = existsSync("brand/catalog.json") ? JSON.parse(readFileSync("brand/catalog.json", "utf8")) : {};
const files = readdirSync("public/art/catalog").filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const list = files.map((file) => { const key = file.replace(/\.\w+$/, ""); const m = meta[key] ?? {}; return { key, file, title: m.title ?? key.replace(/-/g, " "), tags: m.tags ?? ["event", "team", "post"] }; });
writeFileSync("src/domain/llds/lib/catalog.generated.json", JSON.stringify(list, null, 1) + "\n");
console.log(`catalog: ${list.length} images`);
