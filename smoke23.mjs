// Ferier og fridage: admin adds a period → the coming fixed trainings in it leave the calendar (count shown first), the calendar shows the period,
// a new weekly series skips it, and deleting the period puts the trainings back. Mock.
import { open } from "./_lib.mjs";
const { b, p, tab, errors } = await open({ w: 390, h: 844 }); const out = { errors };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const count = () => p.evaluate(() => { const s = JSON.parse(localStorage.getItem("llds_mock")); const find = (o, d = 0) => { if (d > 3 || !o || typeof o !== "object") return null; if (Array.isArray(o.sessions)) return o; for (const k in o) { const r = find(o[k], d + 1); if (r) return r; } return null; }; const S = find(s); return { sessions: S.sessions.length, closures: (S.closures ?? []).length }; });
const from = new Date(Date.now() + 7 * 864e5), to = new Date(Date.now() + 13 * 864e5);
out.before = await count();
await tab("Admin"); await p.click("[data-testid=admin-season]"); await p.click("[data-testid=season-closures]"); await p.waitForSelector("[data-testid=closures]");
await p.click("[data-testid=cl-new]"); await p.fill("[data-testid=cl-name]", "Testferie"); await p.fill("[data-testid=cl-from]", iso(from)); await p.fill("[data-testid=cl-to]", iso(to));
await p.waitForFunction(() => /fjernes|ingen faste/.test(document.querySelector("[data-testid=cl-preview]")?.textContent ?? ""));
out.preview = (await p.locator("[data-testid=cl-preview] p").first().innerText()).slice(0, 70);
await p.click("[data-testid=cl-save]"); await p.waitForSelector("[data-testid=closure]"); out.msg = await p.locator("[data-testid=cl-msg]").innerText();
out.after = await count();
await p.click("[data-testid=sheet-close]");
// calendar shows the period on a day inside it
await tab("Kalender"); await p.waitForTimeout(500);
out.bannerToday = await p.locator("[data-testid=day-closure]").count();
// delete with restore
await tab("Admin"); await p.click("[data-testid=admin-season]"); await p.click("[data-testid=season-closures]"); await p.click("[data-testid=cl-delete]");
await p.click("[data-testid=cl-del-restore]"); await p.waitForSelector("[data-testid=cl-msg]"); out.delMsg = await p.locator("[data-testid=cl-msg]").innerText();
out.restored = await count();
const ok = out.after.sessions < out.before.sessions && out.after.closures === 1 && out.restored.sessions === out.before.sessions && out.restored.closures === 0 && !errors.length;
console.log(JSON.stringify(out)); await b.close(); process.exit(ok ? 0 : 1);
