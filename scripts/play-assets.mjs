// Play/App Store assets for LLDS: icon-512, feature graphics (da/en), 6 framed phone screenshots per language from the mock app.
// Usage: preview on :4173 (mock build) → node scripts/play-assets.mjs → store/ + ../ilumie-site/play-assets/llds/
import { chromium } from "playwright";
import { mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
const OUT = "store/play"; const SITE = "../ilumie-site/play-assets/llds"; mkdirSync(OUT, { recursive: true }); mkdirSync(SITE, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
const COPY = {
  da: [["Hele danseskolen i lommen", "Træninger, beskeder og billeder – samlet ét sted."], ["Dit hold", "Koreografi, formationer, mapper og beskeder fra træneren."], ["Din uge", "Næste træninger, afbud og events – med ét blik."], ["Events og stævner", "Program, pakkeliste og tilmelding."], ["Holdets eget rum", "Opslag, billeder og kommentarer – kun for holdet."], ["Stjerneshoppen", "Merchandise og klippekort med MobilePay."]],
  en: [["Your dance school in your pocket", "Trainings, messages and photos – all in one place."], ["Your team", "Choreography, formations, folders and trainer messages."], ["Your week", "Next trainings, absences and events at a glance."], ["Events and competitions", "Programme, packing list and sign-up."], ["The team's own room", "Posts, photos and comments – for the team only."], ["The shop", "Merchandise and punch cards with MobilePay."]],
};
const shots = [];
for (const lang of ["da", "en"]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await p.addInitScript((l) => { try { localStorage.setItem("llds_tour", JSON.stringify({ state: "done", at: Date.now() })); localStorage.setItem("llds_notif_asked", JSON.stringify({ at: Date.now() })); localStorage.setItem("llds_welcome", new Date().toDateString()); localStorage.setItem("llds_lang", l); } catch {} }, lang);
  await p.goto("http://localhost:4173/", { waitUntil: "networkidle" }); await p.evaluate((l) => { localStorage.clear(); localStorage.setItem("llds_lang", l); }, lang); await p.reload({ waitUntil: "networkidle" });
  await p.fill("#email", "parent@demo"); await p.click("form button.cta"); await p.fill("#code", "000000"); await p.click("form button.cta"); await p.waitForSelector("nav.tabbar");
  if (lang === "en") { const f = await p.$("[data-testid=lang-en], .langflags button:nth-child(2)"); if (f) { await f.click(); await p.waitForTimeout(600); } }
  await p.addStyleTag({ content: ".testmenu,.viewbar{display:none!important}" });
  const tabs = lang === "da" ? ["Hjem", "Mit hold", "Sale", "Events", "Social"] : ["Home", "My team", "Rooms", "Events", "Social"];
  const files = [];
  const snap = async (name) => { await p.waitForTimeout(900); const f = `${OUT}/raw-${lang}-${name}.png`; await p.screenshot({ path: f }); files.push(f); };
  await p.evaluate(() => window.scrollTo(0, 0)); await snap("home");
  await p.click(`nav.tabbar >> text=${tabs[1]}`); await snap("team");
  await p.click(`nav.tabbar >> text=${tabs[0]}`); await p.waitForTimeout(300); await p.evaluate(() => { const el = document.querySelector("[data-testid=your-week], .sec h2"); el?.scrollIntoView(); }); await snap("week");
  await p.click(`nav.tabbar >> text=${tabs[3]}`); await snap("events");
  await p.click(`nav.tabbar >> text=${tabs[4]}`); await snap("social");
  await p.click("[data-testid=shop]"); await snap("shop");
  await p.close();
  // frame 1080×2400
  const W = 1080, H = 2400;
  for (let i = 0; i < files.length; i++) {
    const [title, sub] = COPY[lang][i];
    const fp = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const img = (await sharp(files[i]).resize(W * 0.78 | 0).png().toBuffer()).toString("base64");
    await fp.setContent(`<html><head><meta charset=utf-8><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Outfit:wght@300;500&display=swap" rel=stylesheet><style>
      html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}body{background:radial-gradient(120% 60% at 50% 0%,#2a2416 0%,#0b0b0d 55%);color:#f3eee4;font-family:Outfit,sans-serif;position:relative}
      .copy{position:absolute;top:120px;left:0;right:0;text-align:center;padding:0 90px}.eyebrow{color:#c9a24a;letter-spacing:.3em;font-size:26px;text-transform:uppercase;font-weight:500}
      h1{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:88px;line-height:1.02;margin:22px 0 0}p{font-size:34px;font-weight:300;color:#cfc8ba;margin:24px 0 0;line-height:1.3}
      .dev{position:absolute;left:50%;transform:translateX(-50%);top:600px;width:${W * 0.78 | 0}px;border-radius:70px;padding:16px;background:#000;border:1px solid rgba(201,162,74,.55);box-shadow:0 60px 120px -40px rgba(201,162,74,.45)}
      .dev img{display:block;width:100%;border-radius:56px}</style></head><body>
      <div class=copy><div class=eyebrow>LL Dance Studio · Backstage</div><h1>${title}</h1><p>${sub}</p></div><div class=dev><img src="data:image/png;base64,${img}"></div></body></html>`);
    await fp.waitForTimeout(1200);
    const out = `${OUT}/${lang}-${i + 1}.png`; await fp.screenshot({ path: out }); await fp.close(); shots.push(out);
    mkdirSync(`${SITE}/${lang}`, { recursive: true }); copyFileSync(out, `${SITE}/${lang}/store-android-${i + 1}.png`);
  }
}
// iOS 6.7" (1290×2796) frames from the same raw captures → store/ios/<lang>-<n>.png
for (const lang of ["da", "en"]) {
  const W = 1290, H = 2796; mkdirSync("store/ios", { recursive: true });
  for (let i = 0; i < 6; i++) {
    const raw = `${OUT}/raw-${lang}-${["home","team","week","events","social","shop"][i]}.png`;
    const [title, sub] = COPY[lang][i];
    const fp = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const img = (await sharp(raw).resize(W * 0.78 | 0).png().toBuffer()).toString("base64");
    await fp.setContent(`<html><head><meta charset=utf-8><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Outfit:wght@300;500&display=swap" rel=stylesheet><style>
      html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}body{background:radial-gradient(120% 60% at 50% 0%,#2a2416 0%,#0b0b0d 55%);color:#f3eee4;font-family:Outfit,sans-serif;position:relative}
      .copy{position:absolute;top:150px;left:0;right:0;text-align:center;padding:0 100px}.eyebrow{color:#c9a24a;letter-spacing:.3em;font-size:30px;text-transform:uppercase;font-weight:500}
      h1{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:104px;line-height:1.02;margin:26px 0 0}p{font-size:40px;font-weight:300;color:#cfc8ba;margin:28px 0 0;line-height:1.3}
      .dev{position:absolute;left:50%;transform:translateX(-50%);top:700px;width:${W * 0.78 | 0}px;border-radius:84px;padding:18px;background:#000;border:1px solid rgba(201,162,74,.55);box-shadow:0 70px 140px -50px rgba(201,162,74,.45)}
      .dev img{display:block;width:100%;border-radius:68px}</style></head><body>
      <div class=copy><div class=eyebrow>LL Dance Studio · Backstage</div><h1>${title}</h1><p>${sub}</p></div><div class=dev><img src="data:image/png;base64,${img}"></div></body></html>`);
    await fp.waitForTimeout(1200); await fp.screenshot({ path: `store/ios/${lang}-${i + 1}.png` }); await fp.close();
  }
}
// icon 512 + feature graphic 1024×500
await sharp("resources/icon.png").resize(512, 512).png().toFile(`${SITE}/icon-512.png`);
const logo = (await sharp("public/brand/logo-white.png").resize({ height: 220 }).png().toBuffer()).toString("base64");
for (const [lang, line] of [["da", "Danseskolens app – træninger, beskeder, billeder og hold"], ["en", "The dance school's app – trainings, messages, photos and teams"]]) {
  const fp = await b.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await fp.setContent(`<html><head><meta charset=utf-8><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Outfit:wght@300;500&display=swap" rel=stylesheet><style>html,body{margin:0;width:1024px;height:500px;overflow:hidden}body{background:radial-gradient(90% 90% at 20% 10%,#2a2416 0%,#0b0b0d 60%);display:flex;align-items:center;gap:60px;padding:0 80px;box-sizing:border-box;color:#f3eee4;font-family:Outfit,sans-serif}.t{flex:1}.e{color:#c9a24a;letter-spacing:.3em;font-size:18px;text-transform:uppercase;font-weight:500}h1{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:64px;margin:10px 0 0;line-height:1}p{font-size:22px;font-weight:300;color:#cfc8ba;margin:16px 0 0}</style></head><body><img src="data:image/png;base64,${logo}"><div class=t><div class=e>Backstage</div><h1>LL Dance Studio</h1><p>${line}</p></div></body></html>`);
  await fp.waitForTimeout(1000); await fp.screenshot({ path: `${SITE}/feature-graphic-${lang}.png` }); await fp.close();
}
await b.close(); console.log("ok", shots.length);
