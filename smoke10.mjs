// First-login tour: intro → start → steps highlight marked elements → finish; "Nej tak" persists.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const out = { errors: [] };
p.on("pageerror", (e) => out.errors.push(e.message));
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });
await p.fill("#email", "parent@demo"); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar");
await p.waitForSelector("[data-testid=tour-intro]", { timeout: 5000 }); out.intro = await p.textContent("[data-testid=tour-intro] h2");
await p.click("[data-testid=tour-start]"); await p.waitForSelector("[data-testid=tour-step]"); await p.waitForTimeout(600);
out.steps = [];
for (let i = 0; i < 12; i++) { const el = await p.$("[data-testid=tour-step]"); if (!el) break; out.steps.push(await el.getAttribute("data-step")); const spot = await p.$(".tour-spot"); if (spot && i === 0) out.spotBox = await spot.boundingBox(); await p.click("[data-testid=tour-next]"); await p.waitForTimeout(700); }
out.finished = !(await p.$("[data-testid=tour-step]")); out.saved = await p.evaluate(() => JSON.parse(localStorage.getItem("llds_tour") || "{}").state);
await p.reload({ waitUntil: "networkidle" }); await p.waitForSelector("nav.tabbar"); await p.waitForTimeout(1500); out.notAgain = !(await p.$("[data-testid=tour-intro]"));
console.log(JSON.stringify(out, null, 1)); await b.close();
if (out.errors.length || !out.steps.includes("hero") || !out.steps.includes("events") || !out.finished || out.saved !== "done" || !out.notAgain || !out.spotBox) process.exit(1);
