// Admin → Medlemmer v2: access summary on top, any role combination, one team list grouped by style with role chips (incl. Forælder via child), children linked/created.
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
await p.fill("#mq", "Steffen"); await p.click(".list .item:has-text(\"Steffen Therkildsen\")");
await p.waitForSelector("[data-testid=role-parent]");
out.parentOn = await p.getAttribute("[data-testid=role-parent]", "aria-checked");
out.accessFirst = await p.evaluate(() => { const f = document.querySelector("[data-testid=access]"); const r = document.querySelector("[data-testid=role-parent]"); return !!(f && r && (f.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING)); });
out.kidsBefore = await p.$$eval("[data-testid=kids] .checkrow", e => e.length);
// create a new child on Apexion
// pick existing: list opens at once, filter by name, cancel
await p.click("[data-testid=kid-pick-open]"); await p.waitForSelector("[data-testid=kid-pick] .item");
out.pickListOpen = await p.$$eval("[data-testid=kid-pick] .item", e => e.length) > 3;
await p.fill("#kid-search", "Tilde"); await p.waitForTimeout(150); out.pickFiltered = await p.$$eval("[data-testid=kid-pick] .item", e => e.map(x => x.textContent)).then(a => a.length === 1 && a[0].includes("Tilde"));
await p.click("[data-testid=kid-pick] .ghost");
// draft a new child, remove it again, draft once more – created only on Gem
await p.click("[data-testid=kid-new-open]"); await p.fill("[data-testid=new-kid] input:not([type=date])", "Noa"); await p.fill("[data-testid=new-kid] input[type=date]", "2016-05-01");
await p.locator("[data-testid=new-kid] .chip", { hasText: "Apexion" }).click(); await p.click("[data-testid=kid-add]");
out.draftAdded = await p.$$eval("[data-testid=kid-draft]", e => e.length) === 1;
await p.click("[data-testid=kid-draft] .danger"); out.draftRemoved = await p.$$eval("[data-testid=kid-draft]", e => e.length) === 0;
await p.click("[data-testid=kid-new-open]"); await p.fill("[data-testid=new-kid] input:not([type=date])", "Noa"); await p.fill("[data-testid=new-kid] input[type=date]", "2016-05-01");
await p.locator("[data-testid=new-kid] .chip", { hasText: "Apexion" }).click(); await p.click("[data-testid=kid-add]");
out.kidsAfter = await p.$$eval("[data-testid=kids] .checkrow", e => e.length);
out.accessHasNoa = (await p.locator("[data-testid=access]").innerText()).includes("forælder til Noa");
// dancer + trainer + admin at the same time, all from the one team list
await p.click("[data-testid=role-dancer]"); await p.click("[data-testid=role-staff]"); await p.click("[data-testid=admin-toggle]");
const empire = p.locator("[data-testid=teamlist] .trow[data-team=Empire]");
await empire.locator("button", { hasText: "Danser" }).click();
await p.locator("[data-testid=teamlist] .trow[data-team='Mini Angels'] button", { hasText: "Hjælpetræner" }).click();
// parent follows the child's dancer teams: The AXIS row shows "forælder til Freja", no parent chip to click
out.parentMarkerAxis = (await p.locator("[data-testid=teamlist] .trow[data-team='The AXIS'] [data-testid=chip-parent]").innerText()).includes("Freja");
out.noParentButtons = (await p.locator("[data-testid=teamlist] button", { hasText: /^Forælder$/ }).count()) === 0;
const acc = await p.locator("[data-testid=access]").innerText();
out.accessHasEmpireDancer = acc.includes("Empire") && acc.includes("Danser"); out.accessHasAssistant = acc.includes("Hjælpetræner"); out.accessHasFrejaEmpire = acc.includes("forælder til Freja"); out.accessAdmin = acc.includes("administrator");
out.groups = await p.$$eval("[data-testid=teamlist] .tgroup .eyebrow", e => e.map(x => x.textContent));
await p.screenshot({ path: "smoke17-1.png" });
await p.click("[data-testid=member-save]"); await p.waitForSelector("[data-testid=access]", { state: "detached" });
await p.click(".list .item:has-text(\"Steffen Therkildsen\")"); await p.waitForSelector("[data-testid=access]");
const acc2 = await p.locator("[data-testid=access]").innerText(); out.persisted = acc2.includes("Empire") && acc2.includes("Noa") && acc2.includes("Hjælpetræner") && acc2.includes("administrator");
out.adminPersisted = await p.getAttribute("[data-testid=admin-toggle]", "aria-checked");
// child sheet: only dancer eligible
await p.locator("[data-testid=kids] .checkrow", { hasText: "Noa" }).locator("button", { hasText: "Redigér" }).click();
await p.waitForSelector("[data-testid=teamlist]");
out.childDancerApexion = (await p.locator("[data-testid=teamlist] .trow[data-team=Apexion] button.on", { hasText: "Danser" }).count()) === 1;
out.childParentDisabled = (await p.getAttribute("[data-testid=role-parent]", "aria-disabled")) === "true";
await p.screenshot({ path: "smoke17-2.png" });
out.errors = errors;
console.log(JSON.stringify(out, null, 1));
await b.close();
const ok = out.parentOn === "true" && out.accessFirst && out.kidsAfter === out.kidsBefore + 1 && out.accessHasNoa && out.accessHasEmpireDancer && out.accessHasAssistant && out.accessHasFrejaEmpire && out.parentMarkerAxis && out.noParentButtons && out.accessAdmin && out.groups.length > 1 && out.persisted && out.adminPersisted === "true" && out.childDancerApexion && out.childParentDisabled && !errors.length;
process.exit(ok ? 0 : 1);
