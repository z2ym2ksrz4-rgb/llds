import { chromium } from "playwright"; import { createServer } from "http"; import { readFileSync, existsSync, statSync } from "fs"; import { join } from "path";
const S="/tmp/claude-0/-home-claude/3044d1cf-5408-513b-86aa-778c465d4d10/scratchpad/"; const root=S+"root";
const T={".js":"text/javascript",".css":"text/css",".jpg":"image/jpeg",".png":"image/png",".svg":"image/svg+xml"};
const srv=createServer((req,res)=>{ let p=join(root, decodeURIComponent(req.url.split("?")[0])); if (existsSync(p)&&statSync(p).isDirectory()) p=join(p,"index.html"); if(!existsSync(p)){res.statusCode=404;return res.end("nf");} res.setHeader("content-type", T[p.slice(p.lastIndexOf("."))]||"text/html"); res.end(readFileSync(p)); }).listen(4194);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const w of [360,390,430]) { const p=await (await b.newContext({viewport:{width:w,height:800}})).newPage(); await p.route(/supabase\.co/, r=>r.fulfill({contentType:"application/json", body:"[]"})); await p.route(/lldancestudio\.dk|fonts\.g|googleapis|gstatic/, r=>r.abort());
  for (const pg of ["merchandise/","en/"]) { await p.goto("http://localhost:4194/llds/"+pg,{waitUntil:"domcontentloaded"}); await p.waitForTimeout(300);
  console.log(w,pg, await p.evaluate(()=>[...document.querySelectorAll("header.top .wrap > *, header.top .wrap a, header.top .wrap button")].filter(e=>e.getBoundingClientRect().width>0).map(e=>[(e.className||e.tagName).toString().slice(0,10), Math.round(e.getBoundingClientRect().left), Math.round(e.getBoundingClientRect().right), Math.round(e.getBoundingClientRect().height)]).filter(x=>x[2]>innerWidth||x[1]<0))); } }
await b.close(); srv.close();
