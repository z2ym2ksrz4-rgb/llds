// Emblems: admin gives Freja an emblem from the dancers list → shows on the team page + dancer strip; parent sees it on Home.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.addInitScript(() => { try { if (!localStorage.getItem("llds_tour")) localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); } catch {} }); const out = { errors: [] };
p.on("pageerror", (e) => out.errors.push(e.message));
const login = async (email) => { await p.goto(base, { waitUntil: "networkidle" }); await p.fill("#email", email); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar"); };
await login("admin@demo");
await p.click("nav.tabbar >> text=/^(Mit hold|Hold)$/"); await p.waitForSelector("[data-testid=team-hero]");
await p.click(".teampick"); await p.click(".sheet .item:has-text('The AXIS')"); await p.waitForTimeout(300);
out.trophiesShown = !!(await p.$("[data-testid=trophies]"));
out.badgesEmpty = (await p.textContent("[data-testid=team-badges]")).slice(0, 40);
await p.click("[data-testid=go-dancers]"); await p.waitForSelector("[data-testid=give-badge]");
const row = p.locator(".item", { hasText: "Freja" }); await row.locator("[data-testid=give-badge]").click();
await p.waitForSelector("[data-testid=badge-picker]"); await p.click("[data-testid=badge-picker] .chip:has-text('Fighter')");
await p.fill("input[placeholder='En lille hilsen (valgfrit)']", "Blev ved i spagaten"); await p.click("[data-testid=badge-save]");
await p.waitForSelector(".toast"); out.toast = await p.textContent(".toast");
await p.waitForTimeout(300); out.stripCount = await row.locator("[data-testid=emblem]").count();
await p.click("text=‹ The AXIS"); await p.waitForSelector("[data-testid=team-badges]");
out.teamBadges = (await p.textContent("[data-testid=team-badges]")).slice(0, 60);
await p.click("[data-testid=team-badges] .item"); out.sheetTitle = await p.textContent(".sheet h2"); await p.mouse.click(195, 140); await p.waitForSelector(".sheet-bg", { state: "detached" });
// monthly emblem twice → error
await p.click("[data-testid=go-dancers]"); await row.locator("[data-testid=give-badge]").click(); await p.click("[data-testid=badge-picker] .chip:has-text('holdkammerat')"); await p.click("[data-testid=badge-save]"); await p.waitForSelector(".toast");
await p.waitForTimeout(2800); await row.locator("[data-testid=give-badge]").click(); await p.click("[data-testid=badge-picker] .chip:has-text('holdkammerat')"); await p.click("[data-testid=badge-save]"); await p.waitForTimeout(300);
out.monthlyTwice = await p.textContent(".sheet .error").catch(() => null);
console.log(JSON.stringify(out, null, 1)); await b.close();
if (out.errors.length || !out.trophiesShown || out.stripCount < 1 || !out.teamBadges.includes("Freja") || !out.sheetTitle.includes("Fighter") || !out.monthlyTwice) process.exit(1);
