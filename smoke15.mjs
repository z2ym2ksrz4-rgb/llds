// Formation tool: trainer creates a plan, adds frames, drags a dancer, labels, plays; dancer sees it read-only.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.addInitScript(() => { try { if (!localStorage.getItem("llds_tour")) localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); if (!localStorage.getItem("llds_notif_asked")) localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); localStorage.setItem("llds_welcome", new Date().toDateString()); } catch {} }); const out = { errors: [] };
p.on("pageerror", (e) => out.errors.push(e.message)); p.on("dialog", (d) => d.accept("Rekvisit"));
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });
const login = async (email) => { await p.fill("#email", email); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar"); };
const logout = async () => { await p.click("nav.tabbar >> text=Hjem"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-more]"); await p.click("[data-testid=more-settings]"); await p.click("text=Log ud"); await p.waitForSelector("#email"); };
await login("admin@demo");
await p.click("nav.tabbar >> text=/^(Mit hold|Hold)$/"); await p.waitForSelector("[data-testid=go-formations]"); await p.click("[data-testid=go-formations]"); await p.waitForSelector("[data-testid=form-new]");
await p.click("[data-testid=form-new]"); await p.fill("[data-testid=form-title]", "DM-dansen 2027"); await p.click("[data-testid=form-create]"); await p.waitForSelector("[data-testid=frame-add]");
await p.click("[data-testid=frame-add]"); await p.waitForSelector("[data-testid=fstage]"); out.dotsAuto = await p.$$eval("[data-testid=fdot]", (e) => e.length);
// drag first dot to the front-left
const dot = await p.$("[data-testid=fdot] >> nth=0"); const bb = await dot.boundingBox(); const st = await (await p.$("[data-testid=fstage]")).boundingBox();
await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(st.x + st.width * 0.2, st.y + st.height * 0.8, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(1000);
out.dragged = await p.$eval("[data-testid=fdot] >> nth=0", (e) => e.style.left + " " + e.style.top);
await p.click("[data-testid=frame-title]"); await p.fill("[data-testid=frame-label]", "Intro"); await p.fill("[data-testid=frame-at]", "1-8"); await p.click("text=OK");
await p.click("[data-testid=frame-add]"); await p.waitForTimeout(800); out.frames = await p.$$eval("[data-testid=fthumb]", (e) => e.length);
await p.click(".chips >> text=Anden markør"); await p.waitForTimeout(300); out.dotsAfterCustom = await p.$$eval("[data-testid=fdot]", (e) => e.length);
await p.click("[data-testid=form-play]"); await p.waitForTimeout(2200); out.playedToFrame = await p.$$eval("[data-testid=fthumb]", (e) => e.findIndex((x) => x.classList.contains("on")));
await p.screenshot({ path: "/tmp/f1.png" }); await p.click("[data-testid=form-play]");
out.saved = await p.evaluate(() => (JSON.parse(localStorage.getItem("llds_mock")).X.formationSets || []).map((f) => f.title + ":" + f.frames.length + ":" + f.frames[0].label + "@" + f.frames[0].at));
// dancer (parent as Freja's team) sees read-only
await logout(); await login("parent@demo"); await p.click("nav.tabbar >> text=/^(Mit hold|Hold)$/"); await p.waitForSelector("[data-testid=go-formations]"); await p.click("[data-testid=go-formations]"); await p.waitForSelector("[data-testid=form-set]"); await p.click("[data-testid=form-set]"); await p.waitForSelector("[data-testid=fstage]");
out.dancerNoAdd = !(await p.$("[data-testid=frame-add]")); out.dancerSeesDots = await p.$$eval("[data-testid=fdot]", (e) => e.length);
await b.close(); console.log(JSON.stringify(out, null, 1));
