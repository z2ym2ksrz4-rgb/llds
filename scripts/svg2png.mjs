import { chromium } from "playwright"; import { readFileSync } from "node:fs";
const jobs = [["icon",1024],["icon-foreground",1024],["icon-background",1024],["splash",2732]];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const [n,s] of jobs) {
  const p = await b.newPage({ viewport:{width:s,height:s} });
  await p.setContent(`<html><body style="margin:0;background:transparent">${readFileSync(`resources/${n}.svg`,"utf8").replace("<svg ", `<svg width="${s}" height="${s}" `)}</body></html>`);
  await p.screenshot({ path:`resources/${n}.png`, omitBackground:true, clip:{x:0,y:0,width:s,height:s} }); await p.close();
}
await b.close(); console.log("done");
