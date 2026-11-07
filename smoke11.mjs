// Catalogue uploads: admin uploads own image from Admin → Billedkatalog into a new folder; it appears in the event picker and can be chosen.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } }); await p.addInitScript(() => { try { if (!localStorage.getItem("llds_tour")) localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); if (!localStorage.getItem("llds_notif_asked")) localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); localStorage.setItem("llds_welcome", new Date().toDateString()); } catch {} }); const out = { errors: [] };
p.on("pageerror", (e) => out.errors.push(e.message));
await p.goto(base, { waitUntil: "networkidle" }); await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: "networkidle" });
await p.fill("#email", "admin@demo"); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar");
await p.click("nav.tabbar >> text=Admin"); await p.click(".item:has-text('Billedkatalog')"); await p.waitForSelector("[data-testid=catalog-folder-input]");
await p.fill("[data-testid=catalog-folder-input]", "Julebal 2026");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8z8DwnwEKGGEMEAAATQUDAX7Y1fwAAAAASUVORK5CYII=", "base64");
await p.setInputFiles("input[type=file]", { name: "scene.png", mimeType: "image/png", buffer: png }); await p.waitForSelector(".toast"); out.toast = await p.textContent(".toast");
await p.waitForTimeout(300); out.folders = await p.$$eval("[data-testid=catalog-folders] .chip", (e) => e.map((x) => x.textContent)); out.gridCount = await p.$$eval("[data-testid=catalog-grid] .ip", (e) => e.length);
await p.click("text=‹ Admin"); await p.click("nav.tabbar >> text=Events"); await p.click("text=Nyt event"); await p.waitForSelector("[data-testid=image-picker]");
out.pickerHasOwn = await p.$$eval("[data-testid=image-picker] .ip", (e) => e.some((x) => (x.getAttribute("style") || "").includes("data:image")));
out.pickerUpload = !!(await p.$("[data-testid=catalog-upload]"));
console.log(JSON.stringify(out, null, 1)); await b.close();
if (out.errors.length || !out.folders.some((f) => f.startsWith("Julebal 2026")) || out.gridCount < 1 || !out.pickerHasOwn || !out.pickerUpload) process.exit(1);
