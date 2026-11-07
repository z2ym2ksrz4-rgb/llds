// Admin → Medlemmer v2: explicit roles (check rows), dancer teams as checkboxes, children linked/created, access summary.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage(); await p.addInitScript(() => { localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); localStorage.setItem("llds_welcome", new Date().toDateString()); });
const errors = []; p.on("pageerror", e => errors.push(e.message));
const out = {};
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.removeItem("llds")); await p.reload({ waitUntil: "networkidle" });
await p.fill("#email", "admin@demo"); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta");
await p.waitForSelector("nav.tabbar"); await p.click("nav.tabbar >> text=Admin"); await p.click(".item:has-text(\"Medlemmer\")");
await p.fill("#mq", "Steffen"); await p.click(".list .item:has-text(\"Steffen\")");
await p.waitForSelector("[data-testid=role-parent]");
out.parentOn = await p.getAttribute("[data-testid=role-parent]", "aria-checked");
out.kidsBefore = await p.$$eval("[data-testid=kids] .checkrow", e => e.length);
// create a new child on Apexion
await p.click("text=Nyt barn"); await p.fill("[data-testid=new-kid] input:not([type=date])", "Noa"); await p.fill("[data-testid=new-kid] input[type=date]", "2016-05-01");
await p.locator("[data-testid=new-kid] .checkrow", { hasText: "Apexion" }).click();
await p.click("[data-testid=new-kid] button.cta"); await p.waitForSelector("text=Noa er oprettet");
out.kidsAfter = await p.$$eval("[data-testid=kids] .checkrow", e => e.length);
out.accessHasNoa = (await p.locator("[data-testid=access]").innerText()).includes("forælder til Noa");
await p.evaluate(() => document.querySelector(".sheet, [role=dialog]")?.scrollTo(0, 0)); await p.screenshot({ path: "smoke17-0.png" }); await p.screenshot({ path: "smoke17-1.png" });
// make Karin a dancer on Empire too
await p.click("[data-testid=role-dancer]"); await p.locator("[data-testid=dancer-teams] .checkrow", { hasText: "Empire" }).click();
out.accessHasEmpire = (await p.locator("[data-testid=access]").innerText()).includes("Empire");
await p.click("[data-testid=member-save]"); await p.waitForTimeout(800); await p.screenshot({ path: "smoke17-save.png" }); console.log("errs", errors); await p.waitForSelector("[data-testid=access]", { state: "detached", timeout: 5000 });
// reopen: persisted
await p.click(".list .item:has-text(\"Steffen\")"); await p.waitForSelector("[data-testid=access]");
const acc = await p.locator("[data-testid=access]").innerText(); out.persisted = acc.includes("Empire") && acc.includes("Noa");
// open child from parent sheet
await p.locator("[data-testid=kids] .checkrow", { hasText: "Noa" }).locator("button", { hasText: "Redigér" }).click();
await p.waitForSelector("[data-testid=dancer-teams]");
out.childDancerApexion = await p.locator("[data-testid=dancer-teams] .checkrow.on", { hasText: "Apexion" }).count();
out.childHasNoParentToggle = (await p.getAttribute("[data-testid=role-parent]", "aria-disabled")) === "true";
await p.screenshot({ path: "smoke17-2.png" });
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await b.close();
const ok = out.parentOn === "true" && out.kidsAfter === out.kidsBefore + 1 && out.accessHasNoa && out.accessHasEmpire && out.persisted && out.childDancerApexion === 1 && out.childHasNoParentToggle && !errors.length;
process.exit(ok ? 0 : 1);
