// Insights + feedback + trainer removes dancer → admin gets "no team" notification. Runs against the mock.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage(); await p.addInitScript(() => { try { localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); localStorage.setItem("llds_welcome", new Date().toDateString()); } catch {} });
const out = { errors: [] }; p.on("pageerror", e => out.errors.push(e.message));
const login = async (email) => { await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => sessionStorage.clear()); await p.waitForSelector("#email"); await p.fill("#email", email); await p.click("form button.cta"); await p.fill("#code", "123456"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar"); await p.waitForTimeout(600); };
// 1. parent sends feedback from settings
await login("parent@demo");
await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-help]"); await p.waitForSelector("[data-testid=settings-feedback]"); await p.click("[data-testid=settings-feedback]");
await p.click("[data-testid=feedback-mood] .chip >> nth=0"); await p.fill("[data-testid=feedback-body]", "Super app – men jeg savner et ugeoverblik for begge børn."); await p.click("[data-testid=feedback-send]"); await p.waitForTimeout(400);
out.feedbackThanks = (await p.textContent("body")).includes("Tak");
// 2. trainer removes a dancer from her team
await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-signout]"); await p.waitForSelector("#email");
await login("maja@demo");
await p.click("nav.tabbar >> text=Hold"); await p.waitForSelector("[data-testid=team-hero]"); await p.click("[data-testid=go-dancers]"); await p.waitForSelector("[data-testid=remove-dancer]");
out.dancersBefore = await p.$$eval("[data-testid=remove-dancer]", (e) => e.length);
await p.click("[data-testid=remove-dancer] >> nth=0"); await p.waitForSelector("[data-testid=remove-confirm]"); await p.click("[data-testid=remove-yes]"); await p.waitForTimeout(500);
out.dancersAfter = await p.$$eval("[data-testid=remove-dancer]", (e) => e.length);
// 3. admin: insights page + feedback row + notification
await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-signout]"); await p.waitForSelector("#email");
await login("admin@demo");
await p.click("nav.tabbar >> text=Admin"); await p.click(".item:has-text('App insights')"); await p.waitForSelector("[data-testid=insights-users]");
out.tiles = await p.$$eval("[data-testid=insights-users] .tile6", (e) => e.length);
out.feedbackRows = await p.$$eval("[data-testid=feedback-row]", (e) => e.length);
out.feedbackText = (await p.textContent("[data-testid=insights-feedback]")).includes("ugeoverblik");
await p.click("[data-testid=feedback-row] .chip"); await p.waitForTimeout(300);
out.unreadAfter = await p.$$eval("[data-testid=feedback-row].unread", (e) => e.length);
await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=bell]"); await p.waitForTimeout(400);
out.orphanNotif = (await p.textContent("body")).includes("ikke længere på noget hold");
console.log(JSON.stringify(out, null, 1)); await b.close();
const ok = !out.errors.length && out.feedbackThanks && out.dancersAfter === out.dancersBefore - 1 && out.tiles === 6 && out.feedbackRows >= 1 && out.feedbackText && out.unreadAfter === 0 && out.orphanNotif;
process.exit(ok ? 0 : 1);
