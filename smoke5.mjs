// Phase-5b smoke: admin imports a zip of team photos → folders, media, covers.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await p.addInitScript(() => { try { if (!localStorage.getItem("llds_tour")) localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); if (!localStorage.getItem("llds_notif_asked")) localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); } catch {} });
const errors = []; p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
const out = {};
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });
await p.fill("#email", "admin@demo"); await p.click("form button.cta"); await p.fill("#code", "123456"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar");
await p.click("nav.tabbar >> text=Admin"); await p.click(".item:has-text('Importér billeder')"); await p.waitForSelector("#import-zip", { state: "attached" });
await p.setInputFiles("#import-zip", process.env.ZIP ?? "/tmp/claude-0/-home-claude/3044d1cf-5408-513b-86aa-778c465d4d10/scratchpad/t.zip"); await p.waitForSelector("[data-testid=import-group]");
out.groups = await p.$$eval("[data-testid=import-group] select", e => e.map(s => s.options[s.selectedIndex].text));
await p.click("#import-run"); await p.waitForSelector("text=Færdig", { timeout: 20000 }); out.done = await p.textContent(".ok");
await p.click("nav.tabbar >> text=/^(Mit hold|Hold)$/"); await p.waitForSelector("[data-testid=team-hero]"); out.hero = (await p.getAttribute("[data-testid=team-hero] .bg", "style")).slice(0, 40);
await p.click("[data-testid=go-folders]"); await p.waitForSelector("[data-testid=folder]"); out.folderCounts = await p.$$eval("[data-testid=folder] .tiny", e => e.map(x => x.textContent));
out.errors = errors; console.log(JSON.stringify(out, null, 1)); await b.close(); if (errors.length) process.exit(1);
