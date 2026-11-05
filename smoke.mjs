// Phase-1 smoke: signup → pending → admin approves → parent sees child's team. Runs against the in-memory mock.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errors = []; p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
const shot = (n) => p.screenshot({ path: `smoke-${n}.png` });
const out = {};

// 1. sign in with a new address → register
await p.goto(base, { waitUntil: "networkidle" });
await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });
await p.fill("#email", "ny@demo"); await p.click("form button.cta");
await p.fill("#code", "123456"); await p.click("form button.cta");
await p.waitForSelector("#firstName");
out.registerShown = true; await shot(1);
await p.click("text=Forælder"); await p.click("text=Træner");
await p.fill("#firstName", "Test"); await p.fill("#lastName", "Testesen"); await p.fill("#phone", "12345678");
await p.click("text=Tilføj barn");
await p.fill("input[placeholder='Barnets fornavn']", "Mille"); await p.fill("input[placeholder='Fødselsår']", "2014");
await p.fill("#wishedTeams", "Apexion");
await p.click("form button.cta");
await p.waitForSelector("text=Tak, Test"); out.pendingShown = true; await shot(2);

// 2. sign out, sign in as admin, approve with memberships
await p.click("text=Log ud"); await p.waitForSelector("#email");
await p.fill("#email", "admin@demo"); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta");
await p.waitForSelector("nav.tabbar"); await p.click("nav.tabbar >> text=Admin");
await p.click(".item:has-text(\"Brugere\")");
await p.waitForSelector("[data-testid=pending]");
out.pendingCount = await p.$$eval("[data-testid=pending]", e => e.length);
const card = p.locator("[data-testid=pending]", { hasText: "Test Testesen" });
// adult: trainer on Hip Hop; child: dancer on Apexion
await card.locator(".assign", { hasText: "(voksen)" }).locator(".teamrow", { hasText: "Hip Hop" }).locator("button", { hasText: "Træner" }).click();
await card.locator(".assign", { hasText: "(barn" }).locator(".teamrow", { hasText: "Apexion" }).locator("button", { hasText: "Danser" }).click();
await shot(3);
await card.locator("button", { hasText: "Godkend" }).click();
await p.waitForSelector("text=Test er godkendt");
out.approved = true;

// 3. sign in as the new user → team picker shows both hats
await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-more]"); await p.click("[data-testid=more-settings]"); await p.click("text=Log ud"); await p.waitForSelector("#email");
await p.fill("#email", "ny@demo"); await p.click("form button.cta"); await p.fill("#code", "111111"); await p.click("form button.cta");
try { await p.waitForSelector(".teampick", { timeout: 8000 }); } catch (e) { await shot("fail"); console.log("MAIN:", await p.evaluate(() => document.querySelector("main")?.innerText.slice(0, 400)), "STATE:", await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("llds_mock") || "{}"); return JSON.stringify({ email: s.email, persons: (s.persons || []).map(x => [x.first_name, x.email, x.status]) }); })); throw e; }
out.firstTeam = await p.textContent(".teampick strong");
await p.click(".teampick"); await p.waitForSelector(".sheet");
out.hats = await p.$$eval(".sheet .chips .chip", els => els.map(e => e.textContent));
await p.click(".sheet .chip:has-text('Mille')"); await p.waitForTimeout(100);
out.childTeams = await p.$$eval(".sheet .list .item", els => els.map(e => e.textContent));
await shot(4);
// 4. desktop width renders (tab bar on top)
await p.setViewportSize({ width: 1280, height: 800 }); await p.waitForTimeout(200); await shot(5);
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await b.close();
process.exit(errors.length ? 1 : 0);
