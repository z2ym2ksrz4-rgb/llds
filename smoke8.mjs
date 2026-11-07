// Language flags: 🇬🇧 on the login screen switches the app to English; persists after login; 🇩🇰 switches back.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.addInitScript(() => { try { if (!localStorage.getItem("llds_tour")) localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); if (!localStorage.getItem("llds_notif_asked")) localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); } catch {} }); const out = { errors: [] };
p.on("pageerror", (e) => out.errors.push(e.message));
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });
out.daTitle = await p.textContent("h1");
await p.click("[data-testid=lang-en]"); await p.waitForTimeout(300); out.enTitle = await p.textContent("h1");
await p.fill("#email", "admin@demo"); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar");
out.tabsEn = await p.$$eval("nav.tabbar button span", (e) => e.map((x) => x.textContent));
await p.click("[data-testid=lang-da]"); await p.waitForTimeout(300); out.tabsDa = await p.$$eval("nav.tabbar button span", (e) => e.map((x) => x.textContent));
console.log(JSON.stringify(out, null, 1)); await b.close();
if (out.errors.length || !/Welcome/.test(out.enTitle) || !out.tabsEn.includes("Home") || !out.tabsDa.includes("Hjem")) process.exit(1);
