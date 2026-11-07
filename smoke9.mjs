// Catalogue picker + shop sizes/images + size presets in product editor (mock).
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.addInitScript(() => { try { if (!localStorage.getItem("llds_tour")) localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); } catch {} }); const out = { errors: [] };
p.on("pageerror", (e) => out.errors.push(e.message));
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });
await p.fill("#email", "admin@demo"); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar");
// event with catalogue image
await p.click("nav.tabbar >> text=Events"); await p.click("text=+ Nyt event").catch(async () => p.click("text=Nyt event")); await p.waitForSelector("#ev-title");
await p.fill("#ev-title", "Katalogtest"); out.options = await p.$$eval("[data-testid=image-option]", (e) => e.length);
await p.click("[data-testid=image-option] >> nth=2"); await p.click("#ev-save"); await p.waitForTimeout(800);
const card = p.locator("[data-testid=event]", { hasText: "Katalogtest" }); out.eventBg = (await card.getAttribute("style")).includes("art/catalog/");
// product editor size presets
await p.click("nav.tabbar >> text=Admin"); await p.click(".item:has-text('Shop')"); await p.click("text=+ Ny vare").catch(async () => p.click("text=Ny vare")); await p.waitForSelector("#pr-name");
await p.click(".chip:has-text('Børn 5–13 år')"); await p.click(".chip:has-text('Voksen XS–L')"); out.sizes = await p.inputValue("input[placeholder='XS, S, M, L']");
console.log(JSON.stringify(out, null, 1)); await b.close();
if (out.errors.length || out.options < 5 || !out.eventBg || !out.sizes.includes("12-13 år") || !out.sizes.includes("XS")) process.exit(1);
