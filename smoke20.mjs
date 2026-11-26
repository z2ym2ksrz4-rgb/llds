// Audition flow: parent applies child → trainer (admin) sends brief → scores + selects → sends results → parent accepts → MobilePay. Mock.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage(); await p.addInitScript(() => { try { localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); localStorage.setItem("llds_welcome", new Date().toDateString()); localStorage.setItem("llds_cal_view", "grid"); } catch {} });
const out = { errors: [] }; p.on("pageerror", e => out.errors.push(e.message));
const login = async (email) => { await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => sessionStorage.clear()); await p.waitForSelector("#email"); await p.fill("#email", email); await p.click("form button.cta"); await p.fill("#code", "123456"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar"); await p.waitForTimeout(600); };
const logout = async () => { await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-signout]"); await p.waitForSelector("#email"); };
// 1. parent applies Freja for an audition team
await login("parent@demo");
await p.click("[data-testid=home-join]"); await p.waitForSelector("[data-testid=join-team]"); await p.click(".sheet .chips .chip:has-text('Freja')");
const audBtn = p.locator("[data-testid=join-team]", { hasText: "Audition" }).first(); out.auditionTeam = (await audBtn.textContent()).slice(0, 30); await audBtn.click();
await p.waitForSelector("[data-testid=audition-apply]"); await p.click("[data-testid=audition-apply]"); await p.waitForTimeout(400); out.appliedThanks = !!(await p.$("text=meldt til audition"));
await p.click("[data-testid=sheet-close]"); await p.waitForTimeout(300); out.homeCard = !!(await p.$("[data-testid=audition-card]"));
await logout();
// 2. admin: brief + results
await login("admin@demo");
await p.click("nav.tabbar >> text=Admin"); await p.click(".item:has-text('Auditions')"); await p.waitForSelector("[data-testid=audition-team]"); await p.locator("[data-testid=audition-team]", { hasText: "1 tilmeldt" }).first().click(); await p.waitForSelector("[data-testid=audition-admin]");
await p.fill("[data-testid=audition-text]", "1) Dobbelt pirouette 2) Spagat 3) Kombination i videoen"); await p.fill("[data-testid=audition-video]", "https://example.com/krav.mp4");
await p.click("[data-testid=audition-send-brief]"); await p.waitForTimeout(500); out.briefToast = await p.textContent(".toast").catch(() => null);
await p.click("[data-testid=audition-cand] >> nth=0"); await p.waitForSelector("[data-testid=score-technique]"); await p.click("[data-testid=score-technique] .chip:has-text('5')"); await p.click("[data-testid=score-expression] .chip:has-text('4')"); await p.click("[data-testid=audition-decision] .chip:has-text('Udtaget')"); await p.click("[data-testid=audition-save]"); await p.waitForTimeout(400);
out.candChip = await p.textContent("[data-testid=audition-cand] .chip");
await p.click("[data-testid=audition-send-results]"); await p.waitForTimeout(500); out.resultsToast = await p.textContent(".toast").catch(() => null);
await logout();
// 3. parent accepts → pay sheet
await login("parent@demo");
await p.waitForSelector("[data-testid=audition-card]"); out.selectedChip = await p.textContent("[data-testid=audition-card] .chip.ok").catch(() => null);
await p.click("[data-testid=audition-accept]"); await p.waitForSelector("[data-testid=audition-accept-confirm]"); await p.click("[data-testid=audition-accept-confirm]"); await p.waitForSelector("#pay-claim", { timeout: 8000 }).catch(() => null);
out.paySheet = !!(await p.$("#pay-claim"));
console.log(JSON.stringify(out, null, 1)); await b.close();
const ok = !out.errors.length && out.appliedThanks && out.homeCard && /1/.test(out.briefToast || "") && /Udtaget/.test(out.candChip || "") && /1/.test(out.resultsToast || "") && out.paySheet;
process.exit(ok ? 0 : 1);
