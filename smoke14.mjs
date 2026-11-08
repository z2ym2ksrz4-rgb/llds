// Team page messages (from trainer / to everyone), "Skriv til træneren" conversation (parent → trainer + admin), trainer replies in Social → Samtaler, delete-account confirm.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.addInitScript(() => { try { if (!localStorage.getItem("llds_tour")) localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); if (!localStorage.getItem("llds_notif_asked")) localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); localStorage.setItem("llds_welcome", new Date().toDateString()); } catch {} }); const out = { errors: [] };
p.on("pageerror", (e) => out.errors.push(e.message));
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });
const login = async (email) => { await p.fill("#email", email); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar"); };
const logout = async () => { await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-more]"); await p.click("[data-testid=more-settings]"); await p.click("text=Log ud"); await p.waitForSelector("#email"); };
await login("parent@demo");
await p.click("nav.tabbar >> text=/^(Mit hold|Hold)$/"); await p.waitForSelector("[data-testid=team-messages]");
out.noFeedOnTeam = !(await p.$("[data-testid=composer], .feed")); out.groups = await p.$$eval("[data-testid=team-messages] .group .eyebrow", (e) => e.map((x) => x.textContent));
await p.click("[data-testid=write-trainer]"); await p.waitForSelector("[data-testid=thread-to] .chip"); out.recipients = await p.$$eval("[data-testid=thread-to] .chip", (e) => e.map((x) => x.textContent + (x.classList.contains("on") ? "*" : "")));
const admin = await p.$("[data-testid=to-admin]"); if (admin) await admin.click();
await p.fill("[data-testid=thread-body]", "Hej – kan Freja komme 10 min for sent på mandag?"); await p.click("[data-testid=thread-send]"); await p.waitForSelector(".toast");
await logout(); await login("admin@demo"); // Line is The AXIS' trainer and the admin
await p.click("nav.tabbar >> text=/^(Mit hold|Hold)$/"); await p.waitForSelector("[data-testid=msggroup-mine]"); await p.waitForSelector("[data-testid=team-thread]"); out.trainerSees = (await p.textContent("[data-testid=team-thread]")).slice(0, 80);
await p.click("[data-testid=team-thread]"); await p.waitForSelector("[data-testid=bubbles] .bubble"); await p.fill("[data-testid=thread-reply]", "Helt fint 👍"); await p.click("[data-testid=thread-reply-send]"); await p.waitForTimeout(400);
out.bubbles = await p.$$eval("[data-testid=bubbles] .bubble", (e) => e.length); await p.mouse.click(195, 100); await p.waitForTimeout(200);
// trainer writes to the team from the team page
await p.click("nav.tabbar >> text=/^(Mit hold|Hold)$/"); await p.waitForSelector("[data-testid=write-team]"); await p.click("[data-testid=write-team]"); await p.waitForSelector(".sheet"); out.teamComposer = !!(await p.$(".sheet textarea")); await p.mouse.click(195, 100); await p.waitForTimeout(200);
// parent sees the reply as unread in Samtaler
await logout(); await login("parent@demo"); await p.click("nav.tabbar >> text=/^(Mit hold|Hold)$/"); await p.waitForSelector("[data-testid=msggroup-mine]"); await p.waitForSelector("[data-testid=team-thread]"); out.parentUnread = !!(await p.$("[data-testid=team-thread].due"));
// settings: delete account – confirm appears, cancel
await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-more]"); await p.click("[data-testid=more-settings]"); await p.click("[data-testid=delete-account]"); await p.waitForSelector("[data-testid=delete-confirm]");
out.deleteConfirm = await p.textContent("[data-testid=delete-confirm] strong"); await p.click("[data-testid=delete-confirm] >> text=Annuller"); out.confirmGone = !(await p.$("[data-testid=delete-confirm]"));
await b.close(); console.log(JSON.stringify(out, null, 1));
