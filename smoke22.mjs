// "Vis appen som" must show exactly what that person sees: an admin can read everyone's payments (RLS), so the wallet has to filter to the viewed household. Mock.
import { chromium } from "playwright";
const base = process.env.BASE ?? "http://localhost:4173/";
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const out = { errors: [] };
const run = async (viewAs) => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); p.on("pageerror", e => out.errors.push(e.message));
  await p.addInitScript((pid) => { try { localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); localStorage.setItem("llds_welcome", new Date().toDateString()); localStorage.setItem("llds_cal_view", "grid"); if (pid) sessionStorage.setItem("llds_viewas", pid); } catch {} }, null);
  await p.goto(base, { waitUntil: "networkidle" }); await p.fill("#email", "admin@demo"); await p.click("form button.cta"); await p.fill("#code", "123456"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar");
  // one open payment that belongs to Tilde's household only
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("llds_mock")); s.payments = (s.payments ?? []).filter((x) => x.reference !== "LEAKTEST"); s.payments.push({ id: "pay-leak", dancer_id: "t-tilde", contact_id: "t-tilde", team_id: "team-0", team_name: "The AXIS", dancer_name: "Tilde Testperson", contact_name: "Tilde Testperson", email: null, phone: null, plan: "full", amount_dkk: 1234, reference: "LEAKTEST", note: null, status: "awaiting_payment", claimed_paid_at: null, created_at: new Date().toISOString(), source: "admin" }); localStorage.setItem("llds_mock", JSON.stringify(s)); });
  await p.evaluate((pid) => sessionStorage.setItem("llds_viewas", pid), viewAs); await p.reload({ waitUntil: "networkidle" }); await p.waitForSelector("nav.tabbar"); await p.waitForTimeout(600);
  const ht = await p.textContent("main"); const home = ht.includes("1234") || ht.includes("1.234"); await p.click("[data-testid=avatar]"); await p.click("[data-testid=menu-wallet]"); await p.waitForTimeout(600); const wt = await p.textContent("main"); const wallet = wt.includes("1234") || wt.includes("1.234"); if (process.env.DEBUG) console.log(viewAs, wt.slice(0, 400)); await ctx.close(); return { home, wallet }; };
out.asPia = await run("t-pia"); out.asTilde = await run("t-tilde");
console.log(JSON.stringify(out, null, 1)); await b.close();
process.exit(!out.errors.length && !out.asPia.home && !out.asPia.wallet && out.asTilde.wallet ? 0 : 1);
