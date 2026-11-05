#!/usr/bin/env node
// Usage: npm run new-app -- --slug furkeep --name "Furkeep" --id com.ilumie.furkeep --color "#4A6B57"
import { readFileSync, writeFileSync } from "node:fs";
const args = Object.fromEntries(process.argv.slice(2).join(" ").split("--").filter(Boolean).map(s => { const [k, ...v] = s.trim().split(" "); return [k, v.join(" ").replace(/^"|"$/g, "")]; }));
if (!args.slug || !args.name || !args.id) { console.error("need --slug --name --id [--color]"); process.exit(1); }
const cfg = JSON.parse(readFileSync("app.config.json", "utf8"));
Object.assign(cfg, { appSlug: args.slug, appName: args.name, appId: args.id, brandColor: args.color ?? cfg.brandColor,
  supportEmail: `support@${args.slug}.app`, privacyUrl: `https://${args.slug}.app/privacy`, termsUrl: `https://${args.slug}.app/terms` });
writeFileSync("app.config.json", JSON.stringify(cfg, null, 2) + "\n");
let cm = readFileSync("codemagic.yaml", "utf8").replaceAll("com.ilumie.template", args.id);
writeFileSync("codemagic.yaml", cm);
let pkg = JSON.parse(readFileSync("package.json", "utf8")); pkg.name = args.slug; writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log(`Configured ${args.name} (${args.id}). Next: npx cap add ios && npx cap add android`);
