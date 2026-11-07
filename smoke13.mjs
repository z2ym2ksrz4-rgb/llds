// Notification prefs (prompt + settings), admin notifications on sign-up/order, Admin → Tilpas appen (reorder, hide, custom box, login image).
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.addInitScript(() => { try { if (!localStorage.getItem("llds_tour")) localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); } catch {} }); const out = { errors: [] };
p.on("pageerror", (e) => out.errors.push(e.message));
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });
const login = async (email) => { await p.fill("#email", email); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar"); };
await login("admin@demo");
// 1) prompt appears (tour done) and "Slå til" stores prefs
await p.waitForSelector("[data-testid=notif-prompt]", { timeout: 5000 }); await p.click("[data-testid=notif-on]"); await p.waitForTimeout(300);
out.promptGone = !(await p.$("[data-testid=notif-prompt]"));
// 2) settings: switch off "order" kind
await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-more]"); await p.click("[data-testid=more-settings]"); await p.waitForSelector("[data-testid=notif-settings]");
out.masterOn = await p.isChecked("[data-testid=notif-master]"); out.hasSignupKind = !!(await p.$("[data-testid=notif-kind-signup]"));
await p.click("[data-testid=notif-kind-order]"); await p.waitForTimeout(300); out.orderOff = !(await p.isChecked("[data-testid=notif-kind-order]"));
out.prefs = await p.evaluate(() => JSON.parse(localStorage.getItem("llds_mock")).persons.find((x) => x.id === "p-line").notify_prefs);
// 3) parent buys a punch card + signs up for an event -> admin gets punch + signup notifications, but no order (we'll place an order too and check it is filtered)
await p.click("text=Log ud"); await p.waitForSelector("#email"); await login("parent@demo");
await p.waitForSelector("[data-testid=notif-prompt]", { timeout: 5000 }); await p.click("[data-testid=notif-later]"); await p.waitForTimeout(200);
await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-more]"); const hasPunch = await p.$("[data-testid=more-punch]");
if (hasPunch) { await hasPunch.click(); await p.waitForSelector("[data-testid=buy-card]"); await p.click("[data-testid=buy-card] >> nth=0"); await p.waitForTimeout(500); await p.mouse.click(195, 140); await p.waitForTimeout(200); }
out.hasPunch = !!hasPunch;
// event overlay from Home: open + close in place
await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=hero]"); await p.waitForSelector("[data-testid=event-facts]"); out.eventOverlay = (await p.textContent(".sheet h2")).length > 0; out.eventPhoto = !!(await p.$(".sheet-photo"));
await p.click(".sheet-close"); await p.waitForTimeout(200); out.stillHome = !!(await p.$("[data-testid=hero]")) && !(await p.$(".sheet"));
const notifs = await p.evaluate(() => JSON.parse(localStorage.getItem("llds_mock")).Y.notifications.filter((n) => n.person_id === "p-line").map((n) => n.kind + ":" + n.title));
out.adminPunchNotif = notifs.some((n) => n.startsWith("punch:Nyt klippekort"));
out.adminNotifs = notifs.slice(-4);
// 4) admin: customize – move hero down, hide stats, add a box, pick login image
await p.evaluate(() => { localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); });
await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-more]"); await p.click("[data-testid=more-settings]"); await p.click("text=Log ud"); await p.waitForSelector("#email"); await login("admin@demo");
await p.click("nav.tabbar >> text=Admin"); await p.click("text=Tilpas appen"); await p.waitForSelector("[data-testid=customize]");
await p.click("[data-testid=cz-row-hero] button[aria-label='Flyt ned']"); await p.click("[data-testid=cz-row-stats] >> text=Skjul");
await p.click("[data-testid=cz-newbox]"); await p.fill("[data-testid=cz-box-title]", "Velkommen til sæsonen"); await p.fill("[data-testid=cz-box-body]", "Husk drikkedunk og godt humør."); await p.click("[data-testid=cz-box-save]"); await p.waitForTimeout(200);
out.rows = await p.$$eval("[data-testid=cz-order] .item", (els) => els.map((e) => e.getAttribute("data-testid")));
await p.click("[data-testid=cz-save]"); await p.waitForSelector("text=Gemt");
out.saved = await p.evaluate(() => JSON.parse(localStorage.getItem("llds_mock")).appearance);
await p.click("nav.tabbar >> text=Hjem"); await p.waitForTimeout(300);
out.homeHasBox = !!(await p.$("[data-testid^=box-]")); out.homeHasStats = !!(await p.$(".kv"));
out.homeOrder = await p.$$eval(".screen > *", (els) => els.slice(0, 5).map((e) => e.className.split(" ")[0] + (e.dataset.testid ? "#" + e.dataset.testid : "")));
await p.screenshot({ path: "/tmp/smoke13-home.png" });
await b.close(); console.log(JSON.stringify(out, null, 1));
