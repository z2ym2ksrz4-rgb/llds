// iPad 13" (2048×2732) App Store screenshots from the mock app (tablet layout). Requires mock preview on :4173. Build with VITE_MOCK=1 VITE_ANON=1.
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdirSync } from "node:fs";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const COPY = {
  da: [["Hele danseskolen i lommen", "Træninger, beskeder og billeder – samlet ét sted."], ["Dit hold", "Koreografi, formationer, mapper og beskeder fra træneren."], ["Events og stævner", "Program, pakkeliste og tilmelding."]],
  en: [["Your dance school in your pocket", "Trainings, messages and photos – all in one place."], ["Your team", "Choreography, formations, folders and trainer messages."], ["Events and competitions", "Programme, packing list and sign-up."]],
};
mkdirSync("store/ipad", { recursive: true });
for (const lang of ["da", "en"]) {
  const p = await b.newPage({ viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2 });
  await p.addInitScript((l) => { try { localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); localStorage.setItem("llds_welcome", new Date().toDateString()); localStorage.setItem("llds_lang", l); localStorage.setItem("llds_settings", JSON.stringify({ language: l })); } catch {} }, lang);
  await p.goto("http://localhost:4173/", { waitUntil: "networkidle" }); await p.evaluate((l) => { localStorage.clear(); localStorage.setItem("llds_lang", l); localStorage.setItem("llds_settings", JSON.stringify({ language: l })); }, lang); await p.reload({ waitUntil: "networkidle" });
  await p.fill("#email", "parent@demo"); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar");
  await p.addStyleTag({ content: ".testmenu,.viewbar{display:none!important}" });
  const tabs = lang === "da" ? ["Hjem", "Mit hold", "Sale", "Events", "Social"] : ["Home", "My team", "Rooms", "Events", "Social"];
  const raws = [];
  const snap = async (name) => { await p.waitForTimeout(900); const f = `store/ipad/raw-${lang}-${name}.png`; await p.screenshot({ path: f }); raws.push(f); };
  await p.evaluate(() => window.scrollTo(0, 0)); await snap("home");
  await p.click(`nav.tabbar >> text=${tabs[1]}`); await snap("team");
  await p.click(`nav.tabbar >> text=${tabs[3]}`); await snap("events");
  await p.close();
  const W = 2048, H = 2732;
  for (let i = 0; i < raws.length; i++) {
    const [title, sub] = COPY[lang][i];
    const fp = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const dw = W * 0.8 | 0;
    const img = (await sharp(raws[i]).resize(dw).png().toBuffer()).toString("base64");
    await fp.setContent(`<html><head><meta charset=utf-8><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Outfit:wght@300;500&display=swap" rel=stylesheet><style>
      html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}body{background:radial-gradient(120% 60% at 50% 0%,#2a2416 0%,#0b0b0d 55%);color:#f3eee4;font-family:Outfit,sans-serif;position:relative}
      .copy{position:absolute;top:130px;left:0;right:0;text-align:center;padding:0 160px}.eyebrow{color:#c9a24a;letter-spacing:.3em;font-size:30px;text-transform:uppercase;font-weight:500}
      h1{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:104px;line-height:1.02;margin:24px 0 0}p{font-size:40px;font-weight:300;color:#cfc8ba;margin:24px 0 0;line-height:1.3}
      .dev{position:absolute;left:50%;transform:translateX(-50%);top:560px;width:${dw}px;border-radius:60px;padding:22px;background:#000;border:1px solid rgba(201,162,74,.55);box-shadow:0 70px 140px -50px rgba(201,162,74,.45)}
      .dev img{display:block;width:100%;border-radius:40px}</style></head><body>
      <div class=copy><div class=eyebrow>LL Dance Studio · Backstage</div><h1>${title}</h1><p>${sub}</p></div><div class=dev><img src="data:image/png;base64,${img}"></div></body></html>`);
    await fp.waitForTimeout(1200); await fp.screenshot({ path: `store/ipad/${lang}-${i + 1}.png` }); await fp.close();
  }
}
await b.close();
console.log("ok");
