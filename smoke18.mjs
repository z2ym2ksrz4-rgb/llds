// Season planner: edit opens with times filled; drag a training to another day → editor prefilled, scope "this and future"; series-wide conflict sheet; move to a free slot moves every future week.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
const p = await ctx.newPage(); await p.addInitScript(() => { localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); localStorage.setItem("llds_welcome", new Date().toDateString()); });
const errors = []; p.on("pageerror", e => errors.push(e.message));
const out = {};
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.removeItem("llds")); await p.reload({ waitUntil: "networkidle" });
await p.fill("#email", "admin@demo"); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta");
await p.waitForSelector("nav.tabbar"); await p.click("nav.tabbar >> text=Admin"); await p.click(".item:has-text(\"Sæsonplan\")");
await p.waitForSelector(".week .blk");
// 1. open Empire: times filled
await p.locator(".blk", { hasText: /^Empire\s*1[0-9]/ }).first().click(); await p.waitForSelector("#se-start");
out.start = await p.inputValue("#se-start"); out.end = await p.inputValue("#se-end");
out.scopeFirst = await p.evaluate(() => { const a = document.querySelector(".seg2"); const r = document.querySelector("#se-room"); return !!(a && r && (a.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING)); });
await p.mouse.click(5, 5); await p.waitForSelector("#se-start", { state: "detached" });
// 2. drag Empire (Wed, Lille Sal) to Thursday → editor with moveTo, scope future
const lille = p.locator(".sec", { hasText: "Lille Sal" });
const src = lille.locator(".blk", { hasText: "Empire" }).first(); const dst = lille.locator(".col").nth(3);
await src.dragTo(dst); await p.waitForSelector("#se-date");
out.dragDate = await p.inputValue("#se-date"); out.dragScopeFuture = await p.locator(".seg2 button.on").innerText();
const expected = new Date(out.dragDate); out.dragIsThursday = expected.getDay() === 4;
// 3. save at 17:40 → conflicts with Ballet Mini every week
await p.locator("button.cta", { hasText: "Gem" }).click();
await p.waitForSelector("[data-testid=se-conflicts]");
out.conflictText = (await p.locator("[data-testid=se-conflicts] .eyebrow").innerText());
out.conflictWeeks = await p.$$eval("[data-testid=se-conflicts] li", e => e.length);
await p.screenshot({ path: "smoke18-1.png" });
await p.locator("[data-testid=se-conflicts] button", { hasText: "Annuller" }).click();
// 4. move to a free slot 18:10–19:05 → all future weeks move
await p.fill("#se-start", "18:10"); await p.fill("#se-end", "19:05");
await p.locator("button.cta", { hasText: "Gem" }).click(); await p.waitForSelector("text=Træningen er gemt").catch(() => {});
await p.waitForSelector("#se-start", { state: "detached" });
// next week: Empire on Thursday in Lille Sal, not Wednesday
await p.locator(".row.between button.linklike").nth(1).click(); await p.waitForTimeout(400);
const cols = lille.locator(".col");
out.nextWeekWed = await cols.nth(2).locator(".blk", { hasText: "Empire" }).count();
out.nextWeekThu = await cols.nth(3).locator(".blk", { hasText: "Empire" }).count();
out.nextWeekThuTime = await cols.nth(3).locator(".blk", { hasText: "Empire" }).innerText().catch(() => "");
await p.screenshot({ path: "smoke18-2.png" });
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await b.close();
const ok = out.start === "17:40" && out.end === "18:40" && out.scopeFirst && out.dragIsThursday && /fremover/.test(out.dragScopeFuture) && out.conflictWeeks >= 2 && out.nextWeekWed === 0 && out.nextWeekThu === 1 && out.nextWeekThuTime.includes("18.10") && !errors.length;
process.exit(ok ? 0 : 1);
