// "Vis appen som": admin previews real test personas (Testperson) – tabs, team picker, child login and admin follow the persona. Runs against the mock.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.addInitScript(() => { localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); localStorage.setItem("llds_welcome", new Date().toDateString()); });
const out = { errors: [] };
p.on("pageerror", (e) => out.errors.push(e.message));
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.removeItem("llds")); await p.reload({ waitUntil: "networkidle" });
await p.fill("#email", "admin@demo"); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta");
await p.waitForSelector("nav.tabbar");
const tabs = () => p.$$eval("nav.tabbar button span", (e) => e.map((x) => x.textContent));
const pick = async (name) => { await p.click("[data-testid=avatar]"); await p.waitForSelector("[data-testid=view-as] .persona"); await p.click(`[data-testid=view-as] .persona:has-text('${name}')`); await p.waitForTimeout(500); };
out.tabsAdmin = await tabs();
await p.click("[data-testid=avatar]"); await p.waitForSelector("[data-testid=view-as] .persona");
out.personas = await p.$$eval("[data-testid=view-as] .persona b", (e) => e.map((x) => x.textContent.split(" ·")[0]));
await p.click("[data-testid=sheet-close]"); await p.waitForSelector(".sheet-bg", { state: "detached" });
// trainer
await pick("Rasmus"); out.viewbar = await p.textContent("[data-testid=viewbar]"); out.tabsTrainer = await tabs();
await p.click("nav.tabbar >> text=/^(Mit hold|Hold)$/"); await p.waitForSelector(".teampick"); out.trainerTeam = await p.textContent(".teampick strong");
// dancer 15: home + team follow The AXIS
await pick("Tilde"); await p.click("nav.tabbar >> text=Hjem"); await p.waitForTimeout(300);
await p.click("nav.tabbar >> text=/^(Mit hold|Hold)$/"); await p.waitForSelector(".teampick"); out.dancerTeam = await p.textContent(".teampick strong");
out.tabsDancer = await tabs();
// child login 11: no photo upload in Social
await pick("Milo"); await p.click("nav.tabbar >> text=Social"); await p.waitForTimeout(400); out.kidsPhotoButtonHidden = !(await p.$("button:has-text('Tilføj billede')"));
// parent: wears the child's hat
await pick("Pia"); await p.click("nav.tabbar >> text=/^(Mit hold|Hold)$/"); await p.waitForSelector(".teampick"); out.parentEyebrow = await p.textContent(".teampick .eyebrow"); out.parentTeam = await p.textContent(".teampick strong");
// admin + trainer + parent persona keeps Admin tab
await pick("Camilla"); out.tabsCamilla = await tabs();
// exit
await p.click("[data-testid=viewbar] button"); await p.waitForTimeout(300); out.viewbarGone = !(await p.$("[data-testid=viewbar]")); out.tabsBack = await tabs();
console.log(JSON.stringify(out, null, 1)); await b.close();
const ok = !out.errors.length && out.personas.length >= 8 && out.viewbar.includes("Rasmus Testperson") && !out.tabsTrainer.includes("Admin") && out.tabsTrainer.includes("Mit hold") && /Hip Hop|Empire/.test(out.trainerTeam) && out.dancerTeam.includes("The AXIS") && !out.tabsDancer.includes("Admin") && out.kidsPhotoButtonHidden && /Milos|Idas/.test(out.parentEyebrow) && out.tabsCamilla.includes("Admin") && out.viewbarGone && out.tabsBack.includes("Admin");
process.exit(ok ? 0 : 1);
