// Phase-4 smoke: parent signs Freja up for DM + pays, buys hoodie + punch card (MobilePay claim); admin marks paid, activates card, creates event, gives milestone, takes attendance (punch used); parent sees notifications, milestone, 9/10 punches.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errors = []; p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
const out = {}; const shot = (n) => p.screenshot({ path: `smoke4-${n}.png` });
const login = async (email) => { await p.waitForSelector("#email"); await p.fill("#email", email); await p.click("form button.cta"); await p.fill("#code", "123456"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar"); };
const logout = async () => { await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-more]"); await p.click("[data-testid=more-settings]"); await p.click("text=Log ud"); };
const closeSheet = async () => { await p.click(".sheet-bg", { position: { x: 5, y: 5 } }); await p.waitForTimeout(200); };
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });

// 1. parent: events → sign Freja up for DM → pay sheet → claim
await login("parent@demo");
out.homeEvents = await p.$$eval("[data-testid=home-event]", e => e.length);
await p.click("nav.tabbar >> text=Events"); await p.waitForSelector("[data-testid=event]");
await p.click("[data-testid=event] >> nth=0"); await p.waitForSelector("[data-testid=signup]");
await p.click("[data-testid=signup]"); await p.waitForSelector("[data-testid=mp-link]"); out.mpLink = await p.getAttribute("[data-testid=mp-link]", "href"); out.qr = await p.$$eval(".qr", e => e.length); await shot(1);
await p.click("#pay-claim"); await p.waitForSelector(".toast"); out.eventPaid = await p.textContent(".toast"); await closeSheet();
// 1b. shop: hoodie M → order → pay → claim
await p.click(".subtabs >> text=Stjerneshoppen"); await p.waitForSelector("[data-testid=product]"); await p.click("[data-testid=product] >> nth=0");
await p.click(".sheet .chip:has-text('M')"); await p.click("#add-to-cart"); await p.waitForSelector("[data-testid=cart]"); await p.click("#checkout");
await p.waitForSelector("#pay-claim"); await p.click("#pay-claim"); await p.waitForSelector("[data-testid=order]"); await p.waitForTimeout(200); out.orderStatus = await p.textContent("[data-testid=order] .chip"); await shot(2);
// 1c. punch card (Freja is on Contemporary Elite = punch card team)
await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-more]"); await p.click("[data-testid=more-punch]"); await p.waitForSelector("[data-testid=buy-card]"); await p.click("[data-testid=buy-card]");
await p.waitForSelector("#pay-claim"); await p.click("#pay-claim"); await p.waitForTimeout(200); out.cardStatus = await p.textContent("[data-testid=punchcard] .chip");
await p.click("text=‹ Mere"); await p.click("[data-testid=more-settings]"); await p.click("text=Log ud");

// 2. admin: badge, shop → mark paid, punch → activate, events → new, team → milestone, attendance → punch
await login("admin@demo"); await p.waitForSelector("[data-testid=badge]"); out.adminBadge = await p.textContent("[data-testid=badge]");
await p.click("nav.tabbar >> text=Admin"); await p.click(".item:has-text('Shop')"); await p.waitForSelector("[data-testid=admin-order]"); await p.click("[data-testid=admin-order] button >> nth=0"); await p.waitForTimeout(200);
out.adminOrderAfter = await p.textContent("[data-testid=admin-order]");
await p.click("text=‹ Admin"); await p.click(".item:has-text('Klippekort')"); await p.waitForSelector("[data-testid=admin-card]"); await p.click("[data-testid=admin-card] button"); await p.waitForTimeout(200); out.cardsWaitingAfter = await p.$$eval("[data-testid=admin-card]", e => e.length);
await p.click("text=‹ Admin"); await p.click(".item:has-text('Events')"); await p.waitForSelector("#event-new"); await p.click("#event-new");
await p.fill("#ev-title", "Workshop med gæstetræner"); await p.click(".sheet .chip:has-text('Workshop')"); await p.click("#ev-save"); await p.waitForSelector(".toast"); await p.waitForTimeout(200); out.eventsAfter = await p.$$eval("[data-testid=event]", e => e.length);
await p.click("nav.tabbar >> text=Mit hold"); await p.click("[data-testid=go-dancers]"); await p.waitForSelector("[data-testid=give-milestone]");
const freja = p.locator(".item", { hasText: "Freja" }); await freja.locator("[data-testid=give-milestone]").click(); await p.click(".sheet .chip:has-text('Spagat')"); await p.click("#milestone-save"); await p.waitForSelector(".toast"); out.milestone = await p.textContent(".toast");
// attendance on Contemporary Elite (Monday 19:20 this week) → Freja present → punch
await p.click("nav.tabbar >> text=Sale"); await p.waitForSelector(".cal"); await p.click(".days .day >> nth=0"); await p.waitForTimeout(200);
await p.click(".cal .ev:has-text('Contemporary Elite')"); await p.waitForSelector(".sheet"); await p.click("text=Fremmøde"); await p.waitForSelector(".sheet .list .item"); await p.click("text=Gem fremmøde"); await p.waitForSelector(".toast"); await shot(3);
await logout();

// 3. parent: notifications, milestone on Home, 9/10 punches
await login("parent@demo"); await p.waitForSelector("[data-testid=badge]"); out.parentBadge = await p.textContent("[data-testid=badge]");
await p.click("[data-testid=bell]"); await p.waitForSelector("[data-testid=notif]"); out.notifs = await p.$$eval("[data-testid=notif]", e => e.map(x => x.textContent.slice(0, 40))); await shot(4); await closeSheet();
out.homeMilestones = await p.$$eval(".sec .chip.gold", e => e.map(x => x.textContent));
await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-more]"); await p.click("[data-testid=more-punch]"); await p.waitForSelector("[data-testid=punchcard]"); out.punchesLeft = await p.textContent("[data-testid=punchcard] .tiny >> nth=1"); out.usedDots = await p.$$eval(".punch.used", e => e.length);
await p.click("text=‹ Mere"); await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-more]"); await p.click("[data-testid=more-milestones]"); await p.waitForSelector("[data-testid=milestone]"); out.milestones = await p.$$eval("[data-testid=milestone]", e => e.length);
await p.setViewportSize({ width: 1280, height: 900 }); await p.click("text=‹ Mere"); await p.click("nav.tabbar >> text=Events"); await p.waitForTimeout(400); await shot(5);

out.errors = errors; console.log(JSON.stringify(out, null, 1)); await b.close();
if (errors.length) process.exit(1);
