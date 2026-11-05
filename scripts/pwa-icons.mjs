// PWA icons from resources/icon.svg → public/icons/icon-192.png, icon-512.png, apple-touch-icon.png (180)
import { chromium } from "playwright"; import { readFileSync, mkdirSync } from "node:fs";
mkdirSync("public/icons", { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/opt/pw-browsers/chromium" });
for (const [n, s] of [["icon-192", 192], ["icon-512", 512], ["apple-touch-icon", 180]]) {
  const p = await b.newPage({ viewport: { width: s, height: s } });
  await p.setContent(`<html><body style="margin:0">${readFileSync("resources/icon.svg", "utf8").replace("<svg ", `<svg width="${s}" height="${s}" `)}</body></html>`);
  await p.screenshot({ path: `public/icons/${n}.png`, clip: { x: 0, y: 0, width: s, height: s } }); await p.close();
}
await b.close(); console.log("pwa icons done");
