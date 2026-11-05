// Compose App Store / Play marketing screenshots from the raw captures in store/screenshots/<lang>/.
// Usage: node scripts/store-frames.mjs [lang...]   (run scripts/screenshots.mjs first)
// Output: store/screenshots/<lang>/store-<device>-<n>.png — exact store pixel sizes, no paywall shot.
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ["en", "da", "de", "sv", "nb"];
const DEVICES = {
  "iphone-6.7": { w: 1290, h: 2796, radius: 150 },
  "iphone-6.1": { w: 1179, h: 2556, radius: 140 },
  "android":    { w: 1080, h: 2400, radius: 110 },
};
const SHOTS = ["home", "care", "vaccines", "weight", "horse"]; // paywall intentionally excluded

const COPY = {
  en: ["Every pet in one place", "Never miss a treatment", "Vaccines & due dates", "Weight at a glance", "Horses, rabbits & more"],
  da: ["Alle dine dyr ét sted", "Glem aldrig en kur igen", "Vacciner og frister", "Vægten med ét blik", "Heste, kaniner og flere"],
  de: ["Alle Tiere an einem Ort", "Keine Behandlung vergessen", "Impfungen & Termine", "Gewicht auf einen Blick", "Pferde, Kaninchen & mehr"],
  sv: ["Alla dina djur på ett ställe", "Missa aldrig en behandling", "Vaccin med nästa datum", "Vikten i en överblick", "Hästar, kaniner och fler"],
  nb: ["Alle dyrene dine på ett sted", "Glem aldri en behandling", "Vaksiner med neste frist", "Vekten på et blunk", "Hester, kaniner og flere"],
};
const SUB = {
  en: "No account. Your data stays on your phone.",
  da: "Ingen konto. Dine data bliver på din telefon.",
  de: "Kein Konto. Deine Daten bleiben auf dem Handy.",
  sv: "Inget konto. Din data stannar i telefonen.",
  nb: "Ingen konto. Dataene dine blir på telefonen.",
};

const html = ({ w, h, radius, title, sub, img, last }) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden}
  body{font-family:-apple-system,Inter,"Segoe UI",Roboto,sans-serif;background:linear-gradient(160deg,#5A7F68 0%,#3E5C4B 100%);color:#F6F1E7;position:relative}
  .copy{position:absolute;top:${Math.round(h*0.055)}px;left:0;right:0;text-align:center;padding:0 ${Math.round(w*0.08)}px}
  h1{margin:0;font-size:${Math.round(w*0.082)}px;line-height:1.1;font-weight:800;letter-spacing:-0.02em}
  p{margin:${Math.round(w*0.02)}px 0 0;font-size:${Math.round(w*0.036)}px;opacity:.85;font-weight:500}
  .device{position:absolute;left:50%;transform:translateX(-50%);top:${Math.round(h*0.235)}px;width:${Math.round(w*0.80)}px;
    height:${Math.round(w*0.80*(h/w))}px;border-radius:${radius}px;background:#111;padding:${Math.round(w*0.018)}px;box-sizing:border-box;
    box-shadow:0 ${Math.round(w*0.05)}px ${Math.round(w*0.12)}px rgba(0,0,0,.35)}
  .device img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:${radius-Math.round(w*0.018)}px;display:block}
  .paw{position:absolute;right:${Math.round(w*0.06)}px;bottom:${Math.round(h*0.03)}px;width:${Math.round(w*0.09)}px;opacity:.35}
</style></head><body>
  <div class="copy"><h1>${title}</h1><p>${last ? sub : ""}</p></div>
  <div class="device"><img src="${img}"></div>
  <svg class="paw" viewBox="0 0 1024 1024"><g fill="#F6F1E7"><ellipse cx="262" cy="392" rx="84" ry="106" transform="rotate(-22 262 392)"/><ellipse cx="762" cy="392" rx="84" ry="106" transform="rotate(22 762 392)"/><ellipse cx="418" cy="226" rx="78" ry="98" transform="rotate(-8 418 226)"/><ellipse cx="606" cy="226" rx="78" ry="98" transform="rotate(8 606 226)"/><path d="M512 830 C 410 756, 302 686, 302 578 C 302 508, 356 462, 420 462 C 464 462, 494 486, 512 520 C 530 486, 560 462, 604 462 C 668 462, 722 508, 722 578 C 722 686, 614 756, 512 830 Z"/></g></svg>
</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const lang of LANGS) {
  for (const [device, d] of Object.entries(DEVICES)) {
    const page = await browser.newPage({ viewport: { width: d.w, height: d.h }, deviceScaleFactor: 1 });
    let n = 0;
    for (const [i, shot] of SHOTS.entries()) {
      const src = resolve(`store/screenshots/${lang}/${device}-${i + 1}-${shot}.png`);
      if (!existsSync(src)) { console.warn("missing", src); continue; }
      const img = `data:image/png;base64,${readFileSync(src).toString("base64")}`;
      await page.setContent(html({ ...d, title: COPY[lang][i], sub: SUB[lang], img, last: i === 0 }));
      await page.screenshot({ path: `store/screenshots/${lang}/store-${device}-${++n}.png`, clip: { x: 0, y: 0, width: d.w, height: d.h } });
    }
    await page.close();
    console.log(`${lang}/${device}: ${n} store images`);
  }
}
await browser.close();
