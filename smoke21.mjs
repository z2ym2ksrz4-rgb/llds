// Website tools: page editor (Tilpas appen → Websitets sider), event boost + web sign-up options, website guests list with paid toggle. Mock.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage(); await p.addInitScript(() => { try { localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); localStorage.setItem("llds_welcome", new Date().toDateString()); } catch {} });
const out = { errors: [] }; p.on("pageerror", e => out.errors.push(e.message));
const login = async (email) => { await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => sessionStorage.clear()); await p.waitForSelector("#email"); await p.fill("#email", email); await p.click("form button.cta"); await p.fill("#code", "123456"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar"); await p.waitForTimeout(600); };
await login("admin@demo");
// 1. page editor
await p.click("nav.tabbar >> text=Admin"); await p.click("[data-testid=admin-customize]"); await p.click("[data-testid=cz-sitepages] summary"); await p.waitForSelector("[data-testid=sitepages]");
out.pages = await p.locator("[data-testid^=sitepage-]").count();
await p.click("[data-testid=sitepage-home]"); await p.waitForSelector("[data-testid=sitepage]");
out.texts = await p.locator("[data-testid=site-text]").count(); out.images = await p.locator("[data-testid=site-img]").count();
await p.locator("[data-testid=site-text]").first().fill("Ny overskrift fra Line"); await p.click("[data-testid=cz-save]"); await p.waitForTimeout(600);
out.savedText = await p.evaluate(() => { const a = JSON.parse(localStorage.getItem("llds_mock")).appearance; return Object.values(a?.pages?.home?.texts ?? {})[0] ?? null; });
// 2. event: boost + web sign-up
await p.click("nav.tabbar >> text=Events").catch(async () => { await p.click("nav.tabbar >> text=Hjem"); });
await p.waitForSelector("[data-testid=event]"); await p.click("[data-testid=event] >> nth=0"); await p.click("[data-testid=ev-edit]"); await p.waitForSelector("[data-testid=ev-people]");
if (!(await p.$("[data-testid=ev-webopts]"))) await p.locator("label.check", { hasText: "website" }).first().click();
await p.waitForSelector("[data-testid=ev-webopts]"); await p.check("[data-testid=ev-featured]"); await p.check("[data-testid=ev-web]");
await p.click("#ev-save"); await p.waitForTimeout(700);
const st = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("llds_mock")); const e = s.Y.events.find((x) => x.featured); return e ? { id: e.id, featured: e.featured, web: e.web_signup, vis: e.visibility } : null; }); out.eventSaved = st;
// 3. website guests: seed one, see it, mark paid
await p.evaluate((id) => { const s = JSON.parse(localStorage.getItem("llds_mock")); s.Y.guests = [{ id: "g1", school_id: "school-llds", event_id: id, first_name: "Emma", last_name: "Jensen", birth_date: "2014-03-12", contact_name: "Mette Jensen", email: "mette@eksempel.dk", phone: "12345678", note: null, person_id: null, amount_dkk: 255, reference: "Workshop Emma", paid: false, claimed_paid_at: null, created_at: new Date().toISOString() }]; const e = s.Y.events.find((x) => x.id === id); if (!e.price_dkk) e.price_dkk = 255; localStorage.setItem("llds_mock", JSON.stringify(s)); }, st.id);
await p.reload({ waitUntil: "networkidle" }); await p.waitForSelector("nav.tabbar"); await p.click("nav.tabbar >> text=Events"); await p.waitForSelector("[data-testid=event]");
out.cardChip = (await p.locator("[data-testid=event]", { hasText: "web-tilmelding" }).first().textContent().catch(() => "")).includes("(1)");
await p.locator("[data-testid=event]", { hasText: "web-tilmelding" }).first().click(); await p.waitForSelector("[data-testid=ev-guests]");
out.guestRow = (await p.textContent("[data-testid=ev-guests]")).includes("Emma Jensen");
await p.click("[data-testid=guest-paid]"); await p.waitForTimeout(400);
out.paid = await p.evaluate(() => JSON.parse(localStorage.getItem("llds_mock")).Y.guests[0].paid);
console.log(JSON.stringify(out, null, 1)); await b.close();
