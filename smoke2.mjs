// Phase-2 smoke: parent reports absence, admin creates weekly training (clash check), trainer takes attendance + asks substitute, dancer books room, admin approves, parent grants child login.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); await p.addInitScript(() => { try { if (!localStorage.getItem("llds_tour")) localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); if (!localStorage.getItem("llds_notif_asked")) localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); localStorage.setItem("llds_welcome", new Date().toDateString()); } catch {} });
const errors = []; p.on("pageerror", e => errors.push(e.message)); p.on("console", m => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) errors.push(m.text()); });
const out = {}; const shot = (n) => p.screenshot({ path: `smoke2-${n}.png` });
const login = async (email) => { await p.waitForSelector("#email"); await p.fill("#email", email); await p.click("form button.cta"); await p.fill("#code", "123456"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar"); };
const logout = async () => { await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-more]"); await p.click("[data-testid=more-settings]"); await p.click("text=Log ud"); };
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });

// 1. parent: Freja's week, report absence on first training
await login("parent@demo");
await p.waitForSelector(".sec .item"); out.parentWeek = await p.$$eval(".sec .item", e => e.length);
await p.click(".sec .item >> nth=0"); await p.waitForSelector(".sheet");
await p.click("text=Meld afbud for Freja"); await p.click(".sheet .chip:has-text('Syg')"); await p.fill("#absNote", "Feber"); await p.click("text=Send afbud");
await p.waitForSelector(".toast"); out.absence = await p.textContent(".toast"); await shot(1);
// 1b. parent books Store Sal for Freja Friday 10:00
await p.click("nav.tabbar >> text=Sale"); await p.waitForSelector(".cal");
if ((new Date().getDay() + 6) % 7 >= 4) { await p.click("text=Næste uge"); await p.waitForTimeout(200); }   // Fri–Sun: book next week's Friday so it is in the future
await p.click(".days .day >> nth=4"); await p.waitForTimeout(200);
await p.click("button[aria-label='Store Sal 10:00']"); await p.waitForSelector("#bk-title"); await p.click("text=Send til godkendelse");
await p.waitForSelector(".toast"); out.booking = await p.textContent(".toast"); await shot(2);
// 1c. parent grants child login (Freja is 2013 → 13 → not eligible in 2026; so expect "own account" text)
await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-more]"); await p.click("[data-testid=more-settings]"); out.childText = await p.textContent(".sec .card .tiny");
await p.click("text=Log ud");

// 2. admin: season → new weekly training (clash), bookings → approve
await login("admin@demo");
await p.click("nav.tabbar >> text=Admin"); await p.click("text=Sæsonplan"); await p.waitForSelector(".week");
await p.click("text=+ Træning"); await p.waitForSelector("#se-team");
await p.selectOption("#se-team", { label: "The AXIS" }); await p.selectOption("#se-room", { label: "Store Sal" });
out.staffAuto = (await p.textContent("[data-testid=se-staff]")).replace(/\s+/g, " ").slice(0, 80);  // trainer follows the team
out.endDateShown = !!(await p.$("#se-until"));
await p.click("[data-testid=se-repeat] input"); out.endDateHiddenWhenOnce = !(await p.$("#se-until"));
const tue = new Date(); tue.setDate(tue.getDate() - ((tue.getDay() + 6) % 7) + 1); await p.fill("#se-date", tue.toISOString().slice(0, 10));
await p.fill("#se-start", "17:00"); await p.fill("#se-end", "18:00"); await p.click("text=Opret træning");
await p.waitForSelector(".error"); out.clash = await p.textContent(".error");
await p.fill("#se-start", "21:00"); await p.fill("#se-end", "22:00"); await p.click("text=Opret træning"); await p.waitForSelector(".toast"); out.created = await p.textContent(".toast");
await p.click("text=‹ Admin"); await p.click("text=Bookinger"); await p.waitForSelector(".list .item");
await p.click(".list .item >> text=Godkend"); await p.waitForTimeout(200); out.approvedChip = await p.textContent(".list .item .chip");
await shot(3); await logout();

// 3. trainer Maja: today's/ week sessions, attendance, ask substitute
await login("maja@demo"); await p.click("nav.tabbar >> text=Sale"); await p.waitForSelector(".cal");
await p.click("text=Næste uge"); await p.waitForTimeout(200); await p.click(".days .day >> nth=0"); await p.waitForTimeout(200);
await p.click(".cal .ev:has-text('Hip Hop Junior & Voksen Elite')"); await p.waitForSelector(".sheet");
await p.click("text=Bed om vikar"); await p.waitForSelector(".toast"); out.sub = await p.textContent(".toast");
await p.click(".days .day >> nth=1"); await p.waitForTimeout(200);
await p.click(".cal .ev:has-text('Styrketræning Junior & Voksen')"); await p.waitForSelector(".sheet"); await p.waitForTimeout(300);
out.noAttendanceBtn = !(await p.$(".sheet button:has-text('Fremmøde')")); // presence is assumed unless absent – no tick needed on non-punch teams
await p.mouse.click(195, 140); await p.waitForTimeout(300);
await shot(4); await logout();

// 4. Sofie (trainer) sees substitute wanted on Home and takes it
await login("sofie@demo"); await p.waitForSelector("text=Vikar søges"); await p.click(".card:has-text(\"Vikar søges\") .item >> nth=0"); await p.waitForSelector(".sheet");
await p.click("text=Jeg tager den som vikar"); await p.waitForSelector(".toast"); out.took = await p.textContent(".toast");
await p.setViewportSize({ width: 1280, height: 800 }); await p.click("nav.tabbar >> text=Sale"); await p.waitForSelector(".cal"); await shot(5);
out.errors = errors; console.log(JSON.stringify(out, null, 1)); await b.close(); process.exit(errors.length ? 1 : 0);
