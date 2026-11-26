// Every t("a.b") used in src must exist in da.json and en.json – a missing key shows up as raw text in production, and neither typecheck nor the smokes catch it.
import { readFileSync, readdirSync, statSync } from "fs"; import { join } from "path";
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|mjs)$/.test(f) ? [p] : []; });
const get = (o, k) => k.split(".").reduce((x, p) => (x && typeof x === "object" ? x[p] : undefined), o);
const has = (o, k) => get(o, k) !== undefined || ["_one", "_other"].some((s) => get(o, k + s) !== undefined);
const keys = new Set(); const dyn = new Set();
for (const f of walk("src")) { const s = readFileSync(f, "utf8"); for (const m of s.matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g)) keys.add(m[1]); for (const m of s.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\.\$\{/g)) dyn.add(m[1]); }
let bad = 0;
for (const lang of ["da", "en"]) { const o = JSON.parse(readFileSync(`src/locales/${lang}.json`, "utf8"));
  const miss = [...keys].filter((k) => k.includes(".") && !has(o, k)); const missDyn = [...dyn].filter((k) => typeof get(o, k) !== "object");
  if (miss.length || missDyn.length) { bad = 1; console.log(`${lang}: missing ${miss.length} keys`, miss.slice(0, 40), missDyn.length ? `missing groups: ${missDyn}` : ""); } else console.log(`${lang}: ok (${keys.size} keys, ${dyn.size} dynamic groups)`); }
process.exit(bad);
