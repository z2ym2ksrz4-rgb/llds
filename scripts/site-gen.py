#!/usr/bin/env python3
"""Generate the public website for LL Dance Studio.
Same functionality (and URL slugs) as lldancestudio.dk, but in the app's editorial black/gold expression:
glass header + full-screen menu, cinematic hero, "Find dit hold" filter, weekly plan, rich team pages, trainers,
shop, membership, contact. Static content comes from site/*.json; live content (events, news, products, this
week's schedule) is read client-side from Supabase public views. AI illustrations from public/art/ are used where
no real photo fits (app section, fallbacks, menu).
Usage: python3 scripts/site-gen.py [out_dir] [--base /llds]
"""
import json, os, shutil, sys, html, re
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.load(open(os.path.join(ROOT, "app.config.json")))
OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else os.path.join(ROOT, "..", "ilumie-site", "llds")
BASE = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "/llds"
SB_URL, SB_KEY, SLUG, SUPPORT = cfg["supabase"]["url"], cfg["supabase"]["anonKey"], cfg["schoolSlug"], cfg["supportEmail"]
MONTHS = ["januar","februar","marts","april","maj","juni","juli","august","september","oktober","november","december"]
TODAY = f"{date.today().day}. {MONTHS[date.today().month-1]} {date.today().year}"
P = json.load(open(os.path.join(ROOT, "site", "pages.json")))
SCHED = json.load(open(os.path.join(ROOT, "site", "schedule.json")))
TEAMS = [t for t in json.load(open(os.path.join(ROOT, "site", "teams.json"))) if "error" not in t] if os.path.exists(os.path.join(ROOT, "site", "teams.json")) else []
C, H, M, S = P["contact"], P["home"], P["membership"], P["shop"]
E = lambda x: html.escape(html.unescape(str(x)))
ART = lambda n: f"{BASE}/art/{n}.jpg"   # 1 group · 2 solo · 3 trophy · 4 studio · 5 trails · 6 costume

team_by_slug = {t["slug"].strip("/"): t for t in TEAMS}
import re as _re
_g = open(os.path.join(ROOT, "scripts", "gen-content-sql.py")).read()
SLUG2NAME = eval(_re.search(r"SLUG2NAME = (\{[\s\S]*?\})\nHITFIT", _g).group(1))
def team_img(slug, i=0):
    t = team_by_slug.get(slug or ""); imgs = (t or {}).get("images") or []; return imgs[i] if len(imgs) > i else (imgs[0] if imgs else None)
def short_title(t): return re.sub(r"\s*2\d/2\d\s*$", "", html.unescape(t))

# age group per team from the schedule's age labels
AGE = {"mindste": "0–6 år", "mini": "Mini børn", "born": "Børn", "junior": "Junior", "voksen": "Voksen"}
def age_tokens(label):
    l = label.lower(); out = set()
    if "0–" in l or "3 år" in l or "skolegruppen" in l: out.add("mindste")
    if "mini" in l: out.add("mini")
    if re.search(r"(^|[^i] )børn", l) or l.startswith("børn"): out.add("born")
    if "junior" in l: out.add("junior")
    if "voksen" in l or "14+" in l: out.add("voksen")
    return out
team_ages = {}
for c in SCHED["classes"] + SCHED["monthly"]:
    if c.get("slug"): team_ages.setdefault(c["slug"], set()).update(age_tokens(c["age"]))
team_ages["solo-duo"] = {"born", "junior", "voksen"}

LOGO = f'<img class="mark" src="{BASE}/brand/logo-white.png" alt="LL Dance Studio">'
NAV = [("Holdplan", "/saeson-26-27/", "Alle hold, dag for dag"), ("Medlemsskab", "/medlemsskab/", "Priser, rater og prøvetimer"), ("Stjerneshoppen", "/merchandise/", "Tøj og merchandise"), ("Backstage", "/backstage/", "Trænerne bag studiet"), ("Kontakt", "/kontakt/", "Find os i Ulstrup")]
ICON_ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'

CSS = r"""
:root{--bg:#0a0a0b;--bg2:#111113;--card:#161618;--line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.16);--fg:#f4f1ea;--muted:#a8a49c;--fg3:#6f6c66;--gold:#c9a24a;--gold2:#e6c87a;--gold3:#8c6c25;--gold-soft:rgba(201,162,74,.12);--display:"Cormorant Garamond",Georgia,serif;--body:"Outfit",system-ui,-apple-system,"Segoe UI",sans-serif;--r:22px;--ease:cubic-bezier(.2,.7,.2,1)}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--body);font-weight:300;line-height:1.55;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body:after{content:"";position:fixed;inset:0;pointer-events:none;z-index:99;opacity:.035;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
a{color:var(--gold2);text-decoration:none}img{max-width:100%}
h1,h2,h3,h4{font-family:var(--display);font-weight:500;margin:0;letter-spacing:.005em;text-wrap:balance;line-height:1.05}
h1{font-size:clamp(2.8rem,8vw,6.2rem)}h1 em,h2 em,h3 em{font-style:italic;font-weight:400;color:var(--gold2)}
h2{font-size:clamp(2rem,4.6vw,3.4rem);margin:0 0 20px}h3{font-size:1.5rem}
.wrap{max-width:1180px;margin:0 auto;padding:0 clamp(18px,4vw,40px)}
.eyebrow{font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:14px;display:flex;align-items:center;gap:10px}.eyebrow:before{content:"";width:22px;height:1px;background:var(--gold)}
.lead{font-size:clamp(1.05rem,1.5vw,1.25rem);color:var(--muted);max-width:58ch;margin:16px 0 28px;font-weight:300}
.muted{color:var(--muted)}.tiny{font-size:.78rem;color:var(--fg3)}.small{font-size:.92rem}
.btn{display:inline-flex;align-items:center;gap:10px;background:linear-gradient(135deg,var(--gold2),var(--gold));color:#161206;padding:15px 24px;border-radius:999px;font-weight:500;letter-spacing:.02em;transition:transform .5s var(--ease),box-shadow .5s var(--ease);box-shadow:0 10px 30px -12px rgba(201,162,74,.6)}
.btn:hover{transform:translateY(-2px);box-shadow:0 18px 40px -14px rgba(201,162,74,.8)}.btn svg{transition:transform .4s var(--ease)}.btn:hover svg{transform:translateX(4px)}
.btn.ghost{background:rgba(255,255,255,.04);color:var(--fg);border:1px solid var(--line2);box-shadow:none;backdrop-filter:blur(8px)}.btn.ghost:hover{border-color:var(--gold3);box-shadow:none}
.btns{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
/* header + menu */
header.top{position:fixed;top:0;left:0;right:0;z-index:50;padding:16px 0;transition:background .5s,backdrop-filter .5s,padding .5s}
header.top.solid{background:rgba(10,10,11,.72);backdrop-filter:blur(16px) saturate(140%);-webkit-backdrop-filter:blur(16px) saturate(140%);padding:10px 0;border-bottom:1px solid var(--line)}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{display:flex;align-items:center;gap:10px;color:var(--fg)}.logo .mark{height:54px;width:auto;transition:transform .5s var(--ease)}.logo:hover .mark{transform:rotate(-6deg)}
.pill{display:flex;gap:2px;padding:4px;border:1px solid var(--line);border-radius:999px;background:rgba(10,10,11,.5);backdrop-filter:blur(12px)}
.pill a{color:var(--muted);padding:9px 16px;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;border-radius:999px;transition:all .3s}.pill a:hover{color:var(--fg)}.pill a.on{color:#161206;background:linear-gradient(135deg,var(--gold2),var(--gold))}
.hr{display:flex;align-items:center;gap:8px}.langs{display:flex;gap:2px;margin-right:4px}.flag{font-size:1.15rem;line-height:1;padding:6px 5px;border-radius:999px;opacity:.55;transition:opacity .3s,transform .3s;filter:saturate(.8)}.flag:hover{opacity:1;transform:scale(1.1)}.flag.on{opacity:1}
.btn.sm{padding:11px 18px;font-size:.85rem}
.burger{display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,.04);border:1px solid var(--line2);color:var(--fg);border-radius:999px;padding:10px 16px;font-family:inherit;font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;backdrop-filter:blur(8px);position:relative;z-index:60}
.burger i{display:block;width:18px;height:10px;position:relative}.burger i:before,.burger i:after{content:"";position:absolute;left:0;right:0;height:1.5px;background:currentColor;transition:transform .4s var(--ease),top .4s}.burger i:before{top:0}.burger i:after{top:8px}
body.navopen .burger i:before{top:4px;transform:rotate(45deg)}body.navopen .burger i:after{top:4px;transform:rotate(-45deg)}
@media(max-width:900px){.pill{display:none}.btn.sm.hbtn{display:none}}
.menu{position:fixed;inset:0;z-index:40;background:#0a0a0b;display:grid;grid-template-columns:1.1fr .9fr;opacity:0;visibility:hidden;transition:opacity .5s var(--ease),visibility .5s}body.navopen .menu{opacity:1;visibility:visible}body.navopen{overflow:hidden}
.menu .l{padding:120px clamp(18px,6vw,80px) 40px;display:flex;flex-direction:column;justify-content:center;overflow-y:auto}
.menu .l a.big{display:flex;align-items:baseline;gap:18px;color:var(--fg);font-family:var(--display);font-size:clamp(2.2rem,5.5vw,4.4rem);line-height:1.1;padding:8px 0;border-bottom:1px solid var(--line);transform:translateY(20px);opacity:0;transition:transform .6s var(--ease),opacity .6s,color .3s}
body.navopen .menu .l a.big{transform:none;opacity:1}.menu .l a.big:hover{color:var(--gold2)}.menu .l a.big small{font-family:var(--body);font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);min-width:28px}.menu .l a.big span{font-family:var(--body);font-size:.85rem;color:var(--fg3);margin-left:auto;font-weight:300}
.menu .l .foot{margin-top:34px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;color:var(--muted);font-size:.9rem}
.menu .r{background:center/cover;position:relative}.menu .r:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#0a0a0b 0%,rgba(10,10,11,.2) 40%,transparent)}
.menu .r div{position:absolute;left:40px;bottom:40px;right:40px}.menu .r h3{font-size:2rem}
@media(max-width:900px){.menu{grid-template-columns:1fr}.menu .r{display:none}.menu .l{padding-top:100px;justify-content:flex-start}.menu .l a.big span{display:none}}
/* hero */
.hero{position:relative;min-height:100svh;display:flex;align-items:flex-end;padding:120px 0 70px;overflow:hidden;isolation:isolate}
.hero .bg{position:absolute;inset:-6%;background:center/cover;z-index:-2;animation:kb 26s ease-in-out infinite alternate}@keyframes kb{from{transform:scale(1) translate(0,0)}to{transform:scale(1.1) translate(-1.5%,1%)}}
.hero:before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(10,10,11,.35) 0%,rgba(10,10,11,.2) 40%,rgba(10,10,11,.75) 75%,var(--bg) 100%)}
.hero.small{min-height:62svh;padding-bottom:50px}.hero.small .bg{animation-duration:40s}
.hero .wrap{position:relative;width:100%}
.hero h1{max-width:16ch}.hero .lead{margin-top:22px}
.stats{display:flex;gap:0;margin-top:26px;padding-top:14px;border-top:1px solid var(--line2);overflow-x:auto;scrollbar-width:none}.stats::-webkit-scrollbar{display:none}.stats div{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 8px;border-left:1px solid rgba(201,162,74,.25);text-align:center}.stats div:first-child{border-left:0;padding-left:0}.stats b{display:block;font-family:var(--display);font-size:1.5rem;font-weight:500;line-height:1;color:var(--gold2);white-space:nowrap}.stats span{font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);white-space:nowrap}@media(min-width:720px){.stats{gap:0;margin-top:40px;padding-top:22px}.stats div{align-items:flex-start;text-align:left;padding:0 24px}.stats b{font-size:2.2rem}.stats span{font-size:.7rem}}
.cue{position:absolute;right:clamp(18px,4vw,40px);bottom:28px;width:28px;height:46px;border:1px solid var(--line2);border-radius:999px}.cue:after{content:"";position:absolute;left:50%;top:9px;width:3px;height:8px;margin-left:-1.5px;border-radius:2px;background:var(--gold2);animation:cue 1.8s infinite}@keyframes cue{0%{transform:translateY(0);opacity:1}100%{transform:translateY(16px);opacity:0}}
/* marquee */
.marq{overflow:hidden;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:16px 0;white-space:nowrap;mask:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}
.marq div{display:inline-block;animation:mq 40s linear infinite}.marq span{font-family:var(--display);font-size:1.5rem;font-style:italic;color:var(--muted);padding:0 26px}.marq span:after{content:"✦";color:var(--gold3);margin-left:52px;font-style:normal;font-size:.9rem;vertical-align:middle}@keyframes mq{to{transform:translateX(-50%)}}
/* sections */
section{padding:clamp(64px,9vw,120px) 0;position:relative}section.tight{padding-top:0}
.head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:34px;flex-wrap:wrap}.head h2{margin:0}.head .btn{margin-bottom:6px}
.rv{opacity:0;transform:translateY(26px);transition:opacity .9s var(--ease),transform .9s var(--ease)}.rv.in{opacity:1;transform:none}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:22px;transition:border-color .4s,transform .5s var(--ease)}.card:hover{border-color:var(--line2)}
.chip{display:inline-block;font-size:.74rem;padding:4px 11px;border:1px solid var(--line2);border-radius:999px;color:var(--muted);margin:2px 4px 0 0}.chip.gold{color:var(--gold2);border-color:var(--gold3);background:var(--gold-soft)}
/* find dit hold */
.finder{background:var(--bg2);border:1px solid var(--line);border-radius:28px;padding:clamp(22px,4vw,44px);position:relative;overflow:hidden}
.finder:before{content:"";position:absolute;right:-120px;top:-120px;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(201,162,74,.18),transparent 65%);pointer-events:none}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 24px}.chips button{background:transparent;border:1px solid var(--line2);color:var(--muted);border-radius:999px;padding:10px 18px;font-family:inherit;font-size:.92rem;cursor:pointer;transition:all .3s}.chips button:hover{color:var(--fg);border-color:var(--fg3)}.chips button.on{color:#161206;background:linear-gradient(135deg,var(--gold2),var(--gold));border-color:transparent}
.tcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}@media(min-width:700px){.tcards{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}}
.tcard{position:relative;display:block;aspect-ratio:3/4;border-radius:18px;overflow:hidden;background:var(--card);color:var(--fg);isolation:isolate}
.tcard img,.tcard .ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform 1.2s var(--ease);z-index:-1}.tcard .ph{background:center/cover}.tcard:hover img,.tcard:hover .ph{transform:scale(1.06)}
.tcard:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,11,.05) 30%,rgba(10,10,11,.92));z-index:-1}
.tcard .in{position:absolute;left:16px;right:16px;bottom:14px}.tcard h4{font-size:1.35rem;margin:4px 0 2px}.tcard .m{font-size:.76rem;color:var(--muted)}.tcard .t{font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold2)}
.tcard .closed{position:absolute;top:12px;left:12px;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold2);background:rgba(10,10,11,.6);border:1px solid var(--gold3);padding:4px 9px;border-radius:999px;backdrop-filter:blur(6px)}
.tcards:empty:before{content:"Ingen hold matcher – prøv en anden alder.";color:var(--fg3)}
/* editorial split + tiles */
.split{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,5vw,70px);align-items:center}@media(max-width:860px){.split{grid-template-columns:1fr}}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:12px}.tiles .tile:first-child{grid-row:span 2}
.tile{position:relative;display:block;min-height:200px;border-radius:20px;overflow:hidden;color:var(--fg);isolation:isolate}.tile .bg{position:absolute;inset:0;background:center/cover;transition:transform 1.4s var(--ease)}.tile:hover .bg{transform:scale(1.07)}
.tile:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 35%,rgba(10,10,11,.9));z-index:1}
.tile .in{position:absolute;left:18px;right:16px;bottom:16px;z-index:2;display:flex;align-items:flex-end;justify-content:space-between;gap:8px}.tile h3{font-size:1.5rem}.tile .ar{width:38px;height:38px;border-radius:50%;border:1px solid var(--line2);display:grid;place-items:center;background:rgba(10,10,11,.4);backdrop-filter:blur(6px);transition:all .4s;flex:none}.tile:hover .ar{background:var(--gold2);color:#161206;border-color:transparent}
/* video */
.vid{position:relative;border-radius:28px;overflow:hidden;aspect-ratio:16/8;background:#000 center/cover;cursor:pointer}.vid video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s}.vid.play video{opacity:1}
.vid .pl{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(180deg,rgba(10,10,11,.1),rgba(10,10,11,.6));transition:opacity .4s}.vid.play .pl{opacity:0;pointer-events:none}
.vid .pl b{width:92px;height:92px;border-radius:50%;background:rgba(10,10,11,.5);border:1px solid var(--gold3);backdrop-filter:blur(8px);display:grid;place-items:center;color:var(--gold2);font-size:0;transition:transform .5s var(--ease)}.vid:hover .pl b{transform:scale(1.08)}.vid .pl b:after{content:"";border-left:22px solid currentColor;border-top:13px solid transparent;border-bottom:13px solid transparent;margin-left:6px}
.vid .cap{position:absolute;left:28px;bottom:24px;z-index:2;pointer-events:none}.vid.play .cap{opacity:0;transition:opacity .4s}.vid.loading:after{content:"";position:absolute;left:50%;top:50%;width:36px;height:36px;margin:-18px;border-radius:50%;border:2px solid rgba(201,162,74,.3);border-top-color:var(--gold2);animation:spin 1s linear infinite;z-index:3}@keyframes spin{to{transform:rotate(360deg)}}.vid.play video{z-index:1}
/* events / news */
.event{display:flex;gap:18px;align-items:flex-start;position:relative;overflow:hidden;background:var(--card) center/cover;min-height:150px}.event:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,10,11,.92),rgba(10,10,11,.7))}.event>*{position:relative}
.event .date{font-family:var(--display);font-size:2.2rem;line-height:1;color:var(--gold2);min-width:64px;text-align:center}.event .date small{display:block;font-family:var(--body);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:6px}
.post{border-left:1px solid var(--gold3);padding-left:18px;margin-bottom:22px;white-space:pre-wrap;color:var(--muted)}
.empty{color:var(--fg3);font-size:.92rem}
/* trainers scroller */
.scroller{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 0 18px;margin:0 calc(-1*clamp(18px,4vw,40px));padding-left:clamp(18px,4vw,40px);scrollbar-width:none}.scroller::-webkit-scrollbar{display:none}
.tr{flex:0 0 260px;scroll-snap-align:start;border-radius:20px;overflow:hidden;background:var(--card);border:1px solid var(--line);color:var(--fg)}.tr img{width:100%;aspect-ratio:1.4;object-fit:cover;display:block;filter:saturate(.9);transition:transform 1s var(--ease)}.tr:hover img{transform:scale(1.05)}.tr .in{padding:14px 16px 18px}.tr h4{font-size:1.25rem}.tr .tiny{color:var(--gold)}
/* app band */
.app{display:grid;grid-template-columns:1.1fr .9fr;border-radius:32px;overflow:hidden;background:var(--bg2);border:1px solid var(--line)}@media(max-width:860px){.app{grid-template-columns:1fr}}
.app .txt{padding:clamp(28px,5vw,64px)}.app .pic{background:center/cover;min-height:320px;position:relative}.app .pic:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,var(--bg2),transparent 40%)}@media(max-width:860px){.app .pic:before{background:linear-gradient(180deg,var(--bg2),transparent 40%)}}
.feat{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;margin:22px 0 28px;padding:0;list-style:none}.feat li{display:flex;gap:10px;align-items:flex-start;color:var(--muted);font-size:.95rem}.feat li:before{content:"✦";color:var(--gold);font-size:.7rem;margin-top:6px}
/* bands */
.band{position:relative;min-height:380px;border-radius:32px;overflow:hidden;display:flex;align-items:flex-end;padding:clamp(24px,4vw,44px);isolation:isolate}.band .bg{position:absolute;inset:0;background:center/cover;z-index:-2;transition:transform 2s var(--ease)}.band:hover .bg{transform:scale(1.04)}
.band:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,11,.05),rgba(10,10,11,.88));z-index:-1}.band h2{margin:0 0 8px}.band p{max-width:52ch}
/* holdplan */
/* web sign-up / buy modal */
.wm{position:fixed;inset:0;z-index:60;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.7);backdrop-filter:blur(6px)}.wm.open{display:flex}
.wm .box{width:100%;max-width:560px;max-height:92dvh;overflow:auto;background:var(--bg2);border:1px solid rgba(201,162,74,.3);border-radius:22px 22px 0 0;padding:22px 22px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -20px 60px -30px rgba(201,162,74,.4)}
@media(min-width:720px){.wm{align-items:center}.wm .box{border-radius:22px}}
.wm h3{font-family:var(--display);font-weight:400;font-size:1.8rem;margin:4px 0 14px}.wm label{display:block;margin:0 0 12px;font-size:.82rem;color:var(--muted)}
.wm input,.wm select,.wm textarea{display:block;width:100%;margin-top:5px;background:var(--card);color:var(--fg);border:1px solid var(--line2);border-radius:12px;padding:11px 12px;font:inherit;font-size:1rem}
.wm .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wm .seg{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.wm .seg button{background:var(--card);border:1px solid var(--line2);color:var(--fg);border-radius:999px;padding:8px 14px;font:inherit;font-size:.9rem;cursor:pointer}.wm .seg button.on{border-color:var(--gold);color:var(--gold2);background:var(--gold-soft)}
.wm .err{color:#e08a8a;font-size:.9rem;margin:6px 0}.wm .btn{width:100%;justify-content:center;margin-top:6px}.wm .x{float:right;background:none;border:0;color:var(--muted);font-size:1.6rem;line-height:1;cursor:pointer}
.wm .pay{text-align:center}.wm .pay .amt{font-family:var(--display);font-size:3rem;color:var(--gold2);line-height:1;margin:8px 0}.wm .pay .ref{font-size:1.1rem;background:var(--card);border:1px dashed var(--line2);border-radius:12px;padding:10px;margin:10px 0}
.wm .qty{display:flex;align-items:center;gap:10px}.wm .qty button{width:38px;height:38px;border-radius:50%;border:1px solid var(--line2);background:var(--card);color:var(--fg);font-size:1.2rem;cursor:pointer}
.prod .buy{margin-top:10px}.prod .buy .btn{padding:9px 16px;font-size:.85rem}

.seg{display:inline-flex;border:1px solid var(--line2);border-radius:999px;padding:3px;background:var(--card);margin:14px 0 20px}.seg button{background:none;border:0;color:var(--muted);border-radius:999px;padding:9px 18px;font:inherit;font-size:.9rem;cursor:pointer}.seg button.on{background:var(--gold-soft);color:var(--gold2);border:1px solid rgba(201,162,74,.5)}
.scards{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}@media(min-width:720px){.scards{grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px}}
.scard{position:relative;aspect-ratio:16/11;border-radius:16px;overflow:hidden;background:var(--card);border:1px solid var(--line);color:var(--fg);text-align:left;padding:0;cursor:pointer;isolation:isolate;font:inherit}
.scard img,.scard .ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1;transition:transform 1s var(--ease)}.scard .ph{background:center/cover}.scard:hover img{transform:scale(1.05)}
.scard:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,11,.05) 20%,rgba(10,10,11,.9));z-index:-1}
.scard .in{position:absolute;left:12px;right:12px;bottom:10px}.scard h4{font-family:var(--display);font-weight:400;font-size:1.25rem;margin:0}.scard .m{font-size:.72rem;color:var(--muted)}
.scard.on{border-color:var(--gold);box-shadow:0 0 0 2px rgba(201,162,74,.25)}
.style-teams:empty{display:none}.style-teams{margin-top:16px;border-top:1px solid var(--line);padding-top:14px}.style-teams .sh{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:14px 0 6px}.style-teams .sh h3{font-family:var(--display);font-weight:400;font-size:1.4rem;margin:0}.style-teams .sh .tiny{color:var(--fg3)}
.badge{display:inline-block;font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;padding:4px 8px;border-radius:999px;border:1px solid var(--gold3);color:var(--gold2);background:rgba(201,162,74,.1);white-space:nowrap}.badge.try{border-color:var(--line2);color:var(--muted);background:none}
.style-teams .lh{font-size:.62rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold3);margin:10px 0 2px;display:flex;align-items:center;gap:8px}.style-teams .lh:after{content:"";flex:1;height:1px;background:var(--line)}
.trow{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);color:var(--fg);text-decoration:none}.trow:last-child{border-bottom:0}.trow .pic{flex:none;width:64px;height:64px;border-radius:12px;background:center/cover var(--card)}.trow .tx{flex:1;min-width:0}.trow h4{font-family:var(--display);font-weight:400;font-size:1.2rem;margin:0;line-height:1.1}.trow .m{font-size:.78rem;color:var(--muted)}.trow .badge{margin-top:5px}.trow .go{color:var(--gold2)}.trow .closed{font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold2)}
.gal{position:relative}.gal .track{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:2px 0 6px;-webkit-overflow-scrolling:touch}.gal .track::-webkit-scrollbar{display:none}
.gal .track img{flex:none;width:84%;max-width:560px;aspect-ratio:4/5;object-fit:cover;border-radius:22px;scroll-snap-align:center;border:1px solid rgba(201,162,74,.25);box-shadow:0 20px 50px -30px rgba(201,162,74,.5);background:var(--card)}
@media(min-width:720px){.gal .track img{width:46%;aspect-ratio:4/3}}@media(min-width:1100px){.gal .track img{width:31%}}
.gal .dots{display:flex;justify-content:center;gap:6px;margin-top:12px}.gal .dots i{width:6px;height:6px;border-radius:50%;background:var(--fg3);transition:all .3s}.gal .dots i.on{background:var(--gold2);width:18px;border-radius:3px}
.pay .qr{width:168px;height:168px;margin:14px auto 6px;padding:10px;background:#fff;border-radius:14px}.pay .qr svg{width:100%;height:100%;display:block}
.evnext{grid-column:1/-1;position:relative;min-height:340px;border-radius:26px;overflow:hidden;background-size:cover;background-position:center;border:1px solid rgba(201,162,74,.3);display:flex;align-items:flex-end}.evnext::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,12,0) 0%,rgba(10,10,12,.55) 40%,rgba(10,10,12,.97) 75%)}.evnext-in{position:relative;padding:28px 26px 26px;max-width:620px}.evnext-in h3{font-size:clamp(28px,5vw,42px);margin:6px 0 8px;line-height:1.05}.evnext-in .btn{margin-top:16px}
.bar{position:sticky;top:64px;z-index:20;background:rgba(10,10,11,.8);backdrop-filter:blur(14px);border:1px solid var(--line);border-radius:999px;padding:6px;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin:0 0 28px}.bar::-webkit-scrollbar{display:none}
.bar button{flex:1 0 auto;background:none;border:0;color:var(--muted);border-radius:999px;padding:11px 20px;font-family:inherit;font-size:.9rem;cursor:pointer;transition:all .3s;white-space:nowrap}.bar button.on{color:#161206;background:linear-gradient(135deg,var(--gold2),var(--gold))}
.day{display:none}.day.on{display:grid;grid-template-columns:1fr 1fr;gap:28px}@media(max-width:760px){.day.on{grid-template-columns:1fr}}
.room h3{font-size:.74rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);font-family:var(--body);font-weight:500;margin:0 0 14px;display:flex;align-items:center;gap:10px}.room h3:after{content:"";flex:1;height:1px;background:var(--line)}
.cls{display:flex;gap:16px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:10px;margin-bottom:10px;color:var(--fg);transition:border-color .3s,transform .5s var(--ease)}
.cls .img{width:92px;height:92px;border-radius:12px;background:center/cover;flex:none;position:relative;overflow:hidden}.cls .img:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent,rgba(10,10,11,.4))}
.cls .t{font-variant-numeric:tabular-nums;color:var(--gold2);font-size:.82rem;letter-spacing:.06em}.cls h4{font-size:1.25rem;margin:2px 0 3px}.cls .tiny{line-height:1.45}
a.cls:hover{border-color:var(--gold3);transform:translateX(4px)}.cls.na{opacity:.8}.cls .go{margin-left:auto;color:var(--fg3);flex:none;padding-right:8px}a.cls:hover .go{color:var(--gold2)}
.cls.hid{display:none}
/* team page */
.facts{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;padding:2px 0 14px;margin:0 0 10px}.facts::-webkit-scrollbar{display:none}.facts div{flex:0 0 auto;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 16px;min-width:150px;max-width:260px}.facts b{display:block;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:4px}.facts span{font-size:.92rem}
.cols{display:grid;grid-template-columns:1fr 340px;gap:clamp(24px,5vw,64px);align-items:start}@media(max-width:900px){.cols{grid-template-columns:1fr}}
.side{position:sticky;top:90px}.side .card{padding:24px}.side .price{font-family:var(--display);font-size:2.4rem;color:var(--gold2);line-height:1;margin:6px 0 2px}.side ul{padding-left:0;list-style:none;margin:14px 0 0}.side li{display:flex;gap:10px;color:var(--muted);font-size:.9rem;padding:6px 0;border-top:1px solid var(--line)}.side li:before{content:"✓";color:var(--gold)}
.side ol.steps{list-style:none;padding:0;margin:14px 0 0}.side ol.steps li{display:flex;gap:12px;align-items:flex-start;color:var(--muted);font-size:.92rem;line-height:1.5;padding:10px 0;border-top:1px solid var(--line)}.side ol.steps li:before{content:none}.side ol.steps b{flex:none;width:26px;height:26px;border-radius:50%;border:1px solid var(--gold3);color:var(--gold2);display:grid;place-items:center;font-family:var(--display);font-size:.95rem;font-weight:500}.side ol.steps em{color:var(--fg);font-style:normal}
article{max-width:72ch}article h2{font-size:1.9rem;margin:38px 0 10px}article p,article li{color:var(--muted)}article ul{padding-left:18px}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:28px 0}.gallery img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:14px;transition:transform .8s var(--ease)}.gallery img:hover{transform:scale(1.03)}
.stickycta{display:none;position:fixed;left:14px;right:14px;bottom:14px;z-index:30}.stickycta:empty{display:none!important}.stickycta .btn{width:100%;justify-content:center}@media(max-width:900px){.stickycta{display:block}body.hasstk{padding-bottom:80px}}
/* shop / membership / staff / contact */
.prods{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}.prod{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:6px;min-height:150px;position:relative;overflow:hidden}.prod.img{padding:0}.prod .pimg{aspect-ratio:4/5;background:center/cover;transition:transform 1s var(--ease)}.prod:hover .pimg{transform:scale(1.04)}.prod .pin{padding:14px 16px 16px;display:flex;flex-direction:column;gap:4px;flex:1}.prod.img:before{display:none}.prod:before{content:attr(data-i);position:absolute;right:-6px;top:-18px;font-family:var(--display);font-size:5rem;color:rgba(201,162,74,.08);font-style:italic}.prod h4{font-size:1.2rem}.prod .price{color:var(--gold2);font-family:var(--display);font-size:1.6rem;margin-top:auto}
.acc{border-top:1px solid var(--line)}.acc details{border-bottom:1px solid var(--line)}.acc summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:22px 0;font-family:var(--display);font-size:1.6rem}.acc summary::-webkit-details-marker{display:none}.acc summary:after{content:"+";color:var(--gold);font-family:var(--body);font-size:1.4rem;transition:transform .4s}.acc details[open] summary:after{transform:rotate(45deg)}.acc .b{padding:0 0 22px;color:var(--muted);max-width:70ch;white-space:pre-line}
.staff{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}.staff .card{padding:0;overflow:hidden}.staff img{width:100%;aspect-ratio:1536/647;object-fit:cover;display:block}.staff .in{padding:16px 18px 20px}
.contact{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}.map{border-radius:28px;overflow:hidden;border:1px solid var(--line);aspect-ratio:16/7;margin-top:28px;filter:grayscale(1) invert(.92) contrast(.9)}.map iframe{width:100%;height:100%;border:0;display:block}
footer{padding:70px 0 40px;border-top:1px solid var(--line);margin-top:40px}footer .cols3{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:30px}@media(max-width:760px){footer .cols3{grid-template-columns:1fr}}
footer h4{font-family:var(--body);font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:12px}footer a{color:var(--muted);display:block;padding:4px 0}footer a:hover{color:var(--fg)}footer .legal{margin-top:40px;padding-top:20px;border-top:1px solid var(--line);color:var(--fg3);font-size:.8rem;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
footer .big{font-family:var(--display);font-size:clamp(2rem,5vw,3.4rem);line-height:1;margin:0 0 14px}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.rv{opacity:1;transform:none}}
"""

QRLIB = open(os.path.join(ROOT, "site", "vendor", "qrcode.min.js")).read()
JS = r"""%(qrlib)s

const SB="%(url)s",KEY="%(key)s",SLUG="%(slug)s",BASE="%(base)s",SUPPORT="%(support)s",ICON=`%(icon)s`;const EN=document.documentElement.lang==="en";const L=EN?{kinds:{competition:"Competition",show:"Show",workshop:"Workshop",social:"Social"},noEvents:"No upcoming events right now – the Christmas ball, workshops and shows are announced here.",live:"This week – live from the app",cancel:"Cancellations and substitutes are shown in the app.",inApp:"In the app right now",mon:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]}:{kinds:{competition:"Konkurrence",show:"Show",workshop:"Workshop",social:"Socialt"},noEvents:"Ingen kommende events lige nu – julebal, workshops og shows annonceres her.",live:"Denne uge – live fra appen",cancel:"Aflysninger og vikarer vises i appen.",inApp:"I appen lige nu",mon:["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"]};
const q=async(v,x="")=>{try{const r=await fetch(`${SB}/rest/v1/${v}?select=*${x}`,{headers:{apikey:KEY}});return r.ok?await r.json():[]}catch{return[]}};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const DOW=EN?["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]:["søn","man","tirs","ons","tors","fre","lør"];const MON=L.mon;
const hm=iso=>new Date(iso).toLocaleTimeString("da-DK",{hour:"2-digit",minute:"2-digit"});
const artFor=s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return `${BASE}/art/${[1,3,4,5][h%%4]}.jpg`};
// header + menu
const hd=document.querySelector("header.top");const onS=()=>hd.classList.toggle("solid",scrollY>40);onS();addEventListener("scroll",onS,{passive:true});
document.querySelectorAll(".burger").forEach(b=>b.addEventListener("click",()=>document.body.classList.toggle("navopen")));
addEventListener("keydown",e=>{if(e.key==="Escape")document.body.classList.remove("navopen")});
// reveal
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{rootMargin:"0px 0px -8%% 0px"});document.querySelectorAll(".rv").forEach((el,i)=>{el.style.transitionDelay=(i%%4)*60+"ms";io.observe(el)});
// hero parallax
const hb=document.querySelector(".hero .bg");if(hb&&matchMedia("(prefers-reduced-motion:no-preference)").matches)addEventListener("scroll",()=>{hb.style.translate=`0 ${scrollY*.18}px`},{passive:true});
// video
document.querySelectorAll(".vid").forEach(v=>{const m=v.querySelector("video");if(!m)return;m.addEventListener("ended",()=>{v.classList.remove("play");m.removeAttribute("controls")});v.addEventListener("click",e=>{if(v.classList.contains("play")&&e.target===m)return;if(v.classList.contains("play")){if(m.paused)m.play().catch(()=>{});return}v.classList.add("play","loading");m.setAttribute("controls","");m.muted=false;const p=m.play();if(p&&p.catch)p.catch(()=>{m.muted=true;m.play().catch(()=>{v.classList.remove("play","loading")})});m.addEventListener("playing",()=>v.classList.remove("loading"),{once:true})})});
// holdplan: day bar + age filter
document.querySelectorAll(".bar button[data-day]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".bar button[data-day]").forEach(x=>x.classList.toggle("on",x===b));document.querySelectorAll(".day").forEach(d=>d.classList.toggle("on",d.dataset.day===b.dataset.day))}));
const applyAge=a=>{document.querySelectorAll("[data-ages]").forEach(el=>el.classList.toggle("hid",a!=="all"&&!el.dataset.ages.split(" ").includes(a)));document.querySelectorAll(".chips button[data-age]").forEach(x=>x.classList.toggle("on",x.dataset.age===a))};
document.querySelectorAll(".plan .chips button[data-age]").forEach(b=>b.addEventListener("click",()=>applyAge(b.dataset.age)));
// find dit hold (forside)
const fin=document.getElementById("finder");if(fin){const T=JSON.parse(document.getElementById("teams-data").textContent);const CL=EN?"Audition":"Audition",TRY=EN?"Trial · level":"Prøvegange · niveau",TEAMS_W=EN?"teams":"hold",ALLSTYLES=EN?"All styles":"Alle stilarter";
const row=t=>`<a class="trow" href="${BASE}/${t.slug}/"><div class="pic" style="background-image:url(${t.img||artFor(t.slug)})"></div><div class="tx"><h4>${esc(t.title)}</h4><div class="m">${esc(t.years||"")}${t.level?" · "+esc(t.level):""}</div>${t.closed?`<span class="badge aud" title="${esc(t.note||"")}">${CL}</span>`:t.tryout?`<span class="badge try" title="${esc(t.note||"")}">${TRY}</span>`:""}</div><span class="go">›</span></a>`;
const LV=EN?{"Alle niveauer":"All levels","Begynder & let øvet":"Beginner & light intermediate","Øvet":"Intermediate","Øvet+":"Intermediate+","Elite":"Elite"}:{};const byLevel=ts=>{const ls=[...new Set(ts.slice().sort((a,b)=>a.lvlRank-b.lvlRank).map(t=>t.lvl))];return ls.map(l=>`<div class="lh">${esc(LV[l]||l)}</div>${ts.filter(t=>t.lvl===l).map(row).join("")}`).join("")};const group=(list,el,single)=>{const cats=single?[single]:[...new Set(list.flatMap(t=>t.cats))];el.innerHTML=cats.map(c=>{const ts=list.filter(t=>t.cats.includes(c));return `<div class="sh"><h3>${esc(c)}</h3><span class="tiny">${ts.length} ${TEAMS_W}</span></div>${byLevel(ts)}`}).join("")||`<p class="muted">${EN?"No teams match – try another age.":"Ingen hold matcher – prøv en anden alder."}</p>`};
const st=document.getElementById("style-teams");document.querySelectorAll(".scard").forEach(b=>b.addEventListener("click",()=>{const on=b.classList.contains("on");document.querySelectorAll(".scard").forEach(x=>x.classList.remove("on"));if(on){st.innerHTML="";return}b.classList.add("on");group(T.filter(t=>t.cats.includes(b.dataset.cat)),st,b.dataset.cat);st.scrollIntoView({behavior:"smooth",block:"nearest"})}));
const at=document.getElementById("age-teams");let curAge="all";const renderAge=a=>{curAge=a;group(T.filter(t=>a==="all"||t.ages.includes(a)),at)};renderAge("all");
q("public_teams").then(rows=>{if(!rows.length)return;for(const t of T){const r=rows.find(x=>x.name===t.db);if(!r)continue;t.closed=r.admission==="audition";t.tryout=r.admission==="tryout";t.note=r.admission_note||""}renderAge(curAge);const on=document.querySelector(".scard.on");if(on)group(T.filter(t=>t.cats.includes(on.dataset.cat)),st,on.dataset.cat)});
document.querySelectorAll("#mode-age .chips button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("#mode-age .chips button").forEach(x=>x.classList.toggle("on",x===b));renderAge(b.dataset.age)}));
document.querySelectorAll("#finder .seg button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("#finder .seg button").forEach(x=>x.classList.toggle("on",x===b));document.getElementById("mode-styles").hidden=b.dataset.mode!=="styles";document.getElementById("mode-age").hidden=b.dataset.mode!=="age"}))}
// sticky cta
if(document.querySelector(".stickycta a"))document.body.classList.add("hasstk");
// live data
(async()=>{const[school]=await q("school",`&slug=eq.${SLUG}`);const f=school?`&school_id=eq.${school.id}`:"";
const eEl=document.getElementById("events");if(eEl){const ev=await q("public_events",f+"&order=starts_at");const CM2=%(catmap)s;const evImg=e=>{const k=e.image_key||"";if(/^https?:/.test(k))return k;if(CM2[k])return `${BASE}/app/art/catalog/${CM2[k]}`;let h=0;for(const c of e.id)h=(h*31+c.charCodeAt(0))>>>0;return `${BASE}/art/${[1,3,4,5,2][h%%5]}.jpg`};const when=e=>{const d=new Date(e.starts_at),t=d.getHours()||d.getMinutes()?` · ${String(d.getHours()).padStart(2,"0")}.${String(d.getMinutes()).padStart(2,"0")}`:"";return `${DOW[d.getDay()]} ${d.getDate()}. ${MON[d.getMonth()]}${t}`};const meta=e=>[L.kinds[e.kind]||"",e.place?esc(e.place):"",e.price_dkk?e.price_dkk+" kr.":(EN?"Free":"Gratis"),e.signup_deadline?(EN?"Sign up by ":"Tilmelding senest ")+new Date(e.signup_deadline).getDate()+". "+MON[new Date(e.signup_deadline).getMonth()]:""].filter(Boolean).join(" · ");
eEl.innerHTML=ev.length?ev.map((e,i)=>i===0?`<div class="evnext" style="background-image:url(${evImg(e)})"><div class="evnext-in"><div class="eyebrow">${EN?"Next up":"Næste"} · ${when(e)}</div><h3>${esc(e.title)}</h3><div class="tiny">${meta(e)}</div>${e.team_names?.length?`<div class="tiny" style="margin-top:4px">${esc(e.team_names.join(" · "))}</div>`:""}<a class="btn" href="${BASE}/app/">${EN?"Sign up in the app":"Tilmeld i appen"} ${ICON}</a></div></div>`:`<div class="card event" style="background-image:url(${evImg(e)})"><div class="date">${new Date(e.starts_at).getDate()}<small>${MON[new Date(e.starts_at).getMonth()]}</small></div><div><h3>${esc(e.title)}</h3><div class="tiny">${meta(e)}</div></div></div>`).join(""):`<p class="empty">${L.noEvents}</p>`}
const nEl=document.getElementById("news");if(nEl){const ps=await q("public_posts",f+"&order=created_at.desc&limit=3");if(ps.length)nEl.innerHTML=ps.map(p=>{const d=new Date(p.created_at);return`<div class="post"><div class="tiny">${d.getDate()}. ${MON[d.getMonth()]} ${d.getFullYear()}</div>${esc(p.body)}</div>`}).join("");else nEl.closest("section")?.remove()}
const sEl=document.getElementById("live-note");if(sEl){const sc=await q("public_schedule",f+"&order=starts_at");if(sc.length)sEl.innerHTML=`<div class="card"><div class="eyebrow">${L.live}</div>${sc.map(s=>`<div class="small"><span style="color:var(--gold2)">${hm(s.starts_at)}–${hm(s.ends_at)}</span> ${esc(s.name)}${s.room?` <span class="tiny">· ${esc(s.room)}</span>`:""}</div>`).join("")}<p class="tiny" style="margin:8px 0 0">${L.cancel}</p></div>`}
})();

// ---- sign up for a team / buy in the shop without the app (anon RPCs → MobilePay with a reference; Line confirms in Admin)
const W=EN?{signup:"Sign up for",who:"Who is dancing?",child:"My child",self:"Myself",dancerFirst:"Dancer's first name",dancerLast:"Dancer's last name",birth:"Date of birth",contact:"Contact (parent)",contactSelf:"Your details",first:"First name",last:"Last name",email:"E-mail",phone:"Phone",plan:"Payment",full:"Full season",half:"Half season",rates:"Instalments (agreed with Line)",r2:"2 instalments",r4:"4 instalments",r10:"10 instalments",feeNote:"Instalments: 50 kr. per instalment – one fee per instalment, however many teams.",firstRate:"1st instalment",ofN:"of",rateInfo:"The remaining instalments follow – Line sends a reminder.",noPrice:"This team is signed up without a season fee:",note:"Anything we should know? (optional)",send:"Sign up",sending:"Sending…",thanks:"You're signed up – now pay",payHow:"Pay with Vipps MobilePay to",ref:"Write this as reference",ratesText:"Line contacts you about instalments – nothing to pay right now.",paid:"I have paid",paidOk:"Thanks! Line confirms the payment and approves the sign-up – you'll hear from her.",openMp:"Open Vipps MobilePay",scanQr:"On a computer? Scan the code with your phone – Vipps MobilePay opens with amount and reference filled in.",reqTo:"Or Line sends a payment request to",noPhone:"your number",buy:"Buy",size:"Size",qty:"Quantity",name:"Name",order:"Order",orderOk:"Order #{n} – now pay",pickup:"Collect in the studio at the next training once Line has registered the payment.",err:"Something went wrong – try again or write to",errTeam:"Could not find the team.",errMail:"Check the e-mail address.",errMany:"Too many sign-ups from this e-mail today.",close:"Close"}:{signup:"Tilmeld",who:"Hvem skal danse?",child:"Mit barn",self:"Mig selv",dancerFirst:"Danserens fornavn",dancerLast:"Danserens efternavn",birth:"Fødselsdato",contact:"Kontakt (forælder)",contactSelf:"Dine oplysninger",first:"Fornavn",last:"Efternavn",email:"E-mail",phone:"Telefon",plan:"Betaling",full:"Hel sæson",half:"Halv sæson",rates:"Rater (aftales med Line)",r2:"2 rater",r4:"4 rater",r10:"10 rater",feeNote:"Ratebetaling: 50 kr. pr. rate – kun ét gebyr pr. rate, uanset hvor mange hold.",firstRate:"1. rate",ofN:"af",rateInfo:"Herefter betales de resterende rater løbende – Line sender besked.",noPrice:"Dette hold tilmeldes uden sæsonbetaling:",note:"Noget vi skal vide? (valgfrit)",send:"Tilmeld",sending:"Sender…",thanks:"Du er tilmeldt – betal nu",payHow:"Betal med Vipps MobilePay til",ref:"Skriv dette i beskeden",ratesText:"Line kontakter dig om rater – du skal ikke betale noget nu.",paid:"Jeg har betalt",paidOk:"Tak! Line bekræfter betalingen og godkender tilmeldingen – du hører fra hende.",openMp:"Åbn Vipps MobilePay",scanQr:"Sidder du ved computeren? Scan koden med din telefon – Vipps MobilePay åbner med beløb og besked udfyldt.",reqTo:"Ellers sender Line en betalingsanmodning til",noPhone:"dit nummer",buy:"Køb",size:"Størrelse",qty:"Antal",name:"Navn",order:"Bestil",orderOk:"Ordre #{n} – betal nu",pickup:"Hentes i studiet ved næste træning, når Line har registreret betalingen.",err:"Noget gik galt – prøv igen eller skriv til",errTeam:"Kunne ikke finde holdet.",errMail:"Tjek e-mailadressen.",errMany:"For mange tilmeldinger fra denne e-mail i dag.",close:"Luk"};
const rpc=async(fn,body)=>{const r=await fetch(`${SB}/rest/v1/rpc/${fn}`,{method:"POST",headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,"Content-Type":"application/json"},body:JSON.stringify(body)});const j=await r.json().catch(()=>null);if(!r.ok)throw new Error((j&&(j.message||j.hint))||r.statusText);return j};
const amountsOf=p=>(p||"").match(/([0-9][0-9.]*) kr/g)?.map(x=>parseInt(x.replace(/\D/g,""),10))||[];
const kr=n=>n.toLocaleString("da-DK")+" kr.";
let wm=document.querySelector(".wm");if(!wm){wm=document.createElement("div");wm.className="wm";wm.innerHTML='<div class="box"></div>';document.body.appendChild(wm);wm.addEventListener("click",e=>{if(e.target===wm)wm.classList.remove("open")})}
const box=wm.querySelector(".box");const openWm=h=>{box.innerHTML=`<button class="x" aria-label="${W.close}">×</button>`+h;box.querySelector(".x").onclick=()=>wm.classList.remove("open");wm.classList.add("open");box.scrollTop=0};
const MOBILE=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const payView=(title,amount,ref,mp,phone,extra="",eyebrow=W.thanks,disc=null)=>{const link=amount?`mobilepay://send?phone=${mp}&amount=${amount}&comment=${encodeURIComponent(ref)}`:null;openWm(`<div class="pay"><div class="eyebrow">${eyebrow}</div><h3>${esc(title)}</h3>${amount?`<div class="tiny">${W.payHow} <b>${mp}</b></div><div class="amt">${kr(amount)}</div>${disc&&disc.pct?`<div class="tiny" style="color:var(--gold2)">${EN?"Family discount":"Familierabat"} ${disc.pct} %% · ${EN?"before":"før"} ${kr(disc.before)}</div>`:""}<div class="tiny">${W.ref}</div><div class="ref">${esc(ref)}</div>${MOBILE?`<a class="btn" href="${link}">${W.openMp}</a>`:`<div class="qr" id="wm-qr"></div><p class="tiny">${W.scanQr}</p><p class="tiny">${W.reqTo} <b>${esc(phone||W.noPhone)}</b>.</p>`}`:`<p class="muted">${W.ratesText}</p>`}<p class="tiny" style="margin-top:14px">${extra}</p></div>`);const qe=box.querySelector("#wm-qr");if(qe&&link){try{const qr=qrcode(0,"M");qr.addData(link);qr.make();qe.innerHTML=qr.createSvgTag({cellSize:4,margin:0,scalable:true})}catch{qe.remove()}}};
// team sign-up
const PT=q("public_teams");document.querySelectorAll("[data-signup]").forEach(el=>el.addEventListener("click",async e=>{e.preventDefault();const team=el.dataset.signup;const rows=await PT;const pt=rows.find(x=>x.name===team)||{};const am=pt.price_full?[pt.price_signup||pt.price_full,pt.price_half].filter(Boolean):amountsOf(el.dataset.price);const canRates=pt.installments_allowed!==false&&am.length;const base=am[0];const perRate=(n,b)=>Math.ceil((b+50*n)/n);let self=false,plan=am.length?"full":"none";
const render=()=>{openWm(`<div class="eyebrow">${W.signup}</div><h3>${esc(team)}</h3><form id="wm-f"><div class="eyebrow" style="margin-bottom:6px">${W.who}</div><div class="seg"><button type="button" data-w="child" class="${self?"":"on"}">${W.child}</button><button type="button" data-w="self" class="${self?"on":""}">${W.self}</button></div>
${self?"":`<div class="two" style="margin-top:12px"><label>${W.dancerFirst}<input name="df" required></label><label>${W.dancerLast}<input name="dl"></label></div>`}<label style="margin-top:${self?12:0}px">${W.birth}<input name="bd" type="date" required></label>
<div class="eyebrow" style="margin:6px 0">${self?W.contactSelf:W.contact}</div><div class="two"><label>${W.first}<input name="cf" required></label><label>${W.last}<input name="cl" required></label></div><div class="two"><label>${W.email}<input name="em" type="email" required></label><label>${W.phone}<input name="ph" type="tel" ${MOBILE?"":"required"}></label></div>
${am.length?`<div class="eyebrow" style="margin:6px 0">${W.plan}</div><div class="seg"><button type="button" data-p="full" class="${plan==="full"?"on":""}">${W.full} · ${kr(am[0])}</button>${pt.price_half?`<button type="button" data-p="half" class="${plan==="half"?"on":""}">${W.half} · ${kr(pt.price_half)}</button>`:""}${canRates?`<button type="button" data-p="rates2" class="${plan==="rates2"?"on":""}">${W.r2} · 2 × ${kr(perRate(2,base))}</button><button type="button" data-p="rates4" class="${plan==="rates4"?"on":""}">${W.r4} · 4 × ${kr(perRate(4,base))}</button><button type="button" data-p="rates10" class="${plan==="rates10"?"on":""}">${W.r10} · 10 × ${kr(perRate(10,base))}</button>`:""}</div>${pt.price_note?`<p class="tiny" style="margin:8px 0 0">${esc(pt.price_note)}</p>`:""}${canRates?`<p class="tiny" style="margin:6px 0 0">${W.feeNote}</p>`:""}`:`<p class="muted small" style="margin:8px 0 0">${W.noPrice} ${esc(pt.price_note||"")}</p>`}
<label style="margin-top:12px">${W.note}<textarea name="nt" rows="2"></textarea></label><div class="err" id="wm-err"></div><button class="btn" type="submit">${W.send} ${ICON}</button></form>`);
box.querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>{self=b.dataset.w==="self";render()});box.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{plan=b.dataset.p;box.querySelectorAll("[data-p]").forEach(x=>x.classList.toggle("on",x===b))});
box.querySelector("#wm-f").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),g=k=>(f.get(k)||"").toString().trim(),btn=ev.target.querySelector("[type=submit]"),err=box.querySelector("#wm-err");btn.disabled=true;btn.textContent=W.sending;err.textContent="";
try{const r=await rpc("web_signup",{p_school_slug:SLUG,p_team_name:team,p_dancer_first:self?g("cf"):g("df"),p_dancer_last:self?g("cl"):g("dl"),p_birth_date:g("bd"),p_contact_first:g("cf"),p_contact_last:g("cl"),p_email:g("em"),p_phone:g("ph"),p_self:self,p_plan:plan,p_note:g("nt")});
const multi=(r.installments||1)>1;payView(`${r.team} · ${self?g("cf"):g("df")}${multi?` · ${W.firstRate} ${W.ofN} ${r.installments}`:""}`,multi?r.per_rate_dkk:r.amount_dkk,multi?`${r.reference} rate 1/${r.installments}`:r.reference,r.mobilepay,g("ph"),(multi?W.rateInfo+" ":"")+(r.note&&!r.amount_dkk?esc(r.note)+" ":"")+(EN?"Want trainings, messages and the team's photos on your phone? <a href='"+BASE+"/app/'>Get the app</a> – log in with the same e-mail.":"Vil du have træninger, beskeder og holdets billeder på telefonen? <a href='"+BASE+"/app/'>Hent appen</a> – log ind med samme e-mail."),W.thanks,{pct:r.discount_pct,before:r.amount_before_dkk})}
catch(x){const m=String(x.message||"");err.textContent=m.includes("team")?W.errTeam:m.includes("email")?W.errMail:m.includes("too many")?W.errMany:W.err+" "+SUPPORT;btn.disabled=false;btn.innerHTML=W.send+" "+ICON}}};render()}));
// shop: buy a product
const buyBtns=document.querySelectorAll("[data-buy]");if(buyBtns.length){const prodsP=q("public_products");buyBtns.forEach(el=>el.addEventListener("click",async e=>{e.preventDefault();const prods=await prodsP;const pr=prods.find(x=>x.name===el.dataset.buy);if(!pr){openWm(`<p class="muted">${W.err} ${SUPPORT}</p>`);return}let qty=1,size=pr.sizes?.[0]||"";
openWm(`<div class="eyebrow">${W.buy}</div><h3>${esc(pr.name)}</h3><form id="wm-b">${pr.sizes?.length?`<div class="eyebrow" style="margin-bottom:6px">${W.size}</div><div class="seg">${pr.sizes.map(z=>`<button type="button" data-z="${esc(z)}" class="${z===size?"on":""}">${esc(z)}</button>`).join("")}</div>`:""}
<div class="eyebrow" style="margin:12px 0 6px">${W.qty}</div><div class="qty"><button type="button" id="wm-m">−</button><b id="wm-q">1</b><button type="button" id="wm-pl">+</button><span class="muted" style="margin-left:auto" id="wm-t">${kr(pr.price_dkk)}</span></div>
<div class="two" style="margin-top:12px"><label>${W.name}<input name="nm" required></label><label>${W.phone}<input name="ph" type="tel" ${MOBILE?"":"required"}></label></div><label>${W.email}<input name="em" type="email" required></label><div class="err" id="wm-err"></div><button class="btn" type="submit">${W.order} ${ICON}</button></form>`);
const upd=()=>{box.querySelector("#wm-q").textContent=qty;box.querySelector("#wm-t").textContent=kr(qty*pr.price_dkk)};box.querySelector("#wm-m").onclick=()=>{qty=Math.max(1,qty-1);upd()};box.querySelector("#wm-pl").onclick=()=>{qty=Math.min(10,qty+1);upd()};box.querySelectorAll("[data-z]").forEach(b=>b.onclick=()=>{size=b.dataset.z;box.querySelectorAll("[data-z]").forEach(x=>x.classList.toggle("on",x===b))});
box.querySelector("#wm-b").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),g=k=>(f.get(k)||"").toString().trim(),btn=ev.target.querySelector("[type=submit]"),err=box.querySelector("#wm-err");btn.disabled=true;btn.textContent=W.sending;err.textContent="";
try{const r=await rpc("web_order",{p_school_slug:SLUG,p_name:g("nm"),p_email:g("em"),p_phone:g("ph"),p_lines:[{product_id:pr.id,size,qty}]});payView(W.orderOk.replace("{n}",r.number),r.total_dkk,r.reference,r.mobilepay,g("ph"),W.pickup,W.buy)}
catch(x){const m=String(x.message||"");err.textContent=m.includes("email")?W.errMail:m.includes("too many")?W.errMany:W.err+" "+SUPPORT;btn.disabled=false;btn.innerHTML=W.order+" "+ICON}}}))}

// photo carousel on the front page: Line picks the images in the app (Admin → Tilpas appen → Billedkarrusel); falls back to her team photos
const gal=document.getElementById("gallery");if(gal){const CM=%(catmap)s;const resolve=r=>/^https?:|^data:/.test(r)?r:r.startsWith("art/")?`${BASE}/${r}`:CM[r]?`${BASE}/app/art/catalog/${CM[r]}`:null;
const render=list=>{const tr=gal.querySelector(".track"),dots=gal.querySelector(".dots");tr.innerHTML=list.map((u,i)=>`<img src="${esc(u)}" alt="" loading="${i<2?"eager":"lazy"}">`).join("");dots.innerHTML=list.map((_,i)=>`<i class="${i?"":"on"}"></i>`).join("");
let idx=0,timer=0;const go=i=>{idx=(i+list.length)%%list.length;const el=tr.children[idx];if(el)tr.scrollTo({left:el.offsetLeft-(tr.clientWidth-el.clientWidth)/2,behavior:"smooth"});dots.querySelectorAll("i").forEach((d,k)=>d.classList.toggle("on",k===idx))};
const auto=()=>{clearInterval(timer);timer=setInterval(()=>{if(document.visibilityState==="visible"&&gal.getBoundingClientRect().top<innerHeight)go(idx+1)},4200)};auto();
tr.addEventListener("scroll",()=>{const c=tr.scrollLeft+tr.clientWidth/2;let best=0,bd=1e9;[...tr.children].forEach((el,k)=>{const d=Math.abs(el.offsetLeft+el.clientWidth/2-c);if(d<bd){bd=d;best=k}});if(best!==idx){idx=best;dots.querySelectorAll("i").forEach((d,k)=>d.classList.toggle("on",k===idx))}},{passive:true});
tr.addEventListener("pointerdown",()=>clearInterval(timer));tr.addEventListener("pointerup",auto);dots.querySelectorAll("i").forEach((d,k)=>d.addEventListener("click",()=>{go(k);auto()}))};
const def=JSON.parse(gal.dataset.default||"[]");render(def);
q("school",`&slug=eq.${SLUG}`).then(rows=>{const g=rows[0]&&rows[0].appearance&&rows[0].appearance.websiteGallery;if(Array.isArray(g)&&g.length){const l=g.map(resolve).filter(Boolean);if(l.length)render(l)}})}
"""

def page(title, body, desc, active="", hero=None, hero_title=None, hero_sub=None, hero_lead=None, small=True, extra="", sticky=""):
    pill = "".join(f'<a href="{BASE}{h}" class="{"on" if h == active else ""}">{l}</a>' for l, h, _ in NAV)
    big = "".join(f'<a class="big" href="{BASE}{h}" style="transition-delay:{80+i*60}ms"><small>0{i+1}</small>{l}<span>{d}</span></a>' for i, (l, h, d) in enumerate(NAV))
    heroh = f'<div class="hero{" small" if small else ""}"><div class="bg" style="background-image:url({hero})"></div><div class="wrap">{"<div class=eyebrow>" + E(hero_sub) + "</div>" if hero_sub else ""}<h1>{hero_title}</h1>{("<p class=lead>" + hero_lead + "</p>") if hero_lead else ""}{extra}</div></div>' if hero else ""
    return f"""<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{E(title)}</title><meta name="description" content="{E(desc)}"><meta name="theme-color" content="#0a0a0b"><meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}">{f'<meta property="og:image" content="{hero}">' if hero else ""}
<link rel="icon" href="{BASE}/favicon.png" type="image/png"><link rel="apple-touch-icon" href="{BASE}/icons/apple-touch-icon.png"><link rel="stylesheet" href="{BASE}/style.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Outfit:wght@300;400;500&display=swap"></head><body>
<header class="top"><div class="wrap"><a class="logo" href="{BASE}/">{LOGO}</a><nav class="pill">{pill}</nav><div class="hr"><div class="langs"><a href="__DA__" class="flag on" title="Dansk" aria-label="Dansk">🇩🇰</a><a href="__EN__" class="flag" title="English" aria-label="English">🇬🇧</a></div><a class="btn sm hbtn" href="{BASE}/app/">Åbn appen</a><button class="burger" aria-label="Menu"><i></i>Menu</button></div></div></header>
<div class="menu"><div class="l"><a class="big" href="{BASE}/" style="transition-delay:40ms"><small>00</small>Forside<span>LL Dance Studio</span></a>{big}<div class="foot"><a class="btn" href="{BASE}/app/">Åbn appen {ICON_ARROW}</a><a class="btn ghost" href="tel:{C["phone"].replace(" ", "")}">{E(C["phone"])}</a></div></div><div class="r" style="background-image:url({ART(6)})"><div><div class="eyebrow">Ulstrup</div><h3>Dans med hjertet.<br><em>Vind med holdet.</em></h3></div></div></div>
{heroh}{body}
<footer><div class="wrap"><div class="cols3"><div><img src="{BASE}/brand/logo-white.png" alt="LL Dance Studio" style="width:180px;margin-bottom:14px"><p class="muted small">{E(C["address"])}<br><a href="tel:{C["phone"].replace(" ", "")}" style="display:inline">{E(C["phone"])}</a> · {E(C["hours"])}<br><a href="mailto:{C["email"]}" style="display:inline">{C["email"]}</a></p></div>
<div><h4>Sider</h4>{"".join(f'<a href="{BASE}{h}">{l}</a>' for l, h, _ in NAV)}<a href="{BASE}/solo-duo/">Solo / Duo</a></div>
<div><h4>Appen</h4><a href="{BASE}/app/">Log ind / tilmeld</a><a href="{BASE}/support/">Hjælp &amp; FAQ</a><a href="{BASE}/privacy/">Privatlivspolitik</a><a href="{BASE}/terms/">Vilkår</a></div></div>
<div class="legal"><span>© {date.today().year} {E(C["name"])}</span><span>App og website af <a href="https://ilumie.com/" style="display:inline">Ilumie</a></span></div></div></footer>
<div class="stickycta">{sticky}</div>
<script src="{BASE}/site.js" defer></script></body></html>"""

EN = json.load(open(os.path.join(ROOT, "site", "en.json")))
UI = json.load(open(os.path.join(ROOT, "site", "en-ui.json")))
_ALL = {html.escape(html.unescape(k)): v for k, v in {**EN, **UI}.items() if k != "_tokens"}
_KEYS = sorted(_ALL, key=len, reverse=True)
_B = r"(?<![\wæøåÆØÅ])", r"(?![\wæøåÆØÅ])"
_TOK = [(re.compile(_B[0] + k + _B[1]), v) for k, v in UI.get("_tokens", {}).items()]
def translate_text(txt):
    t = txt.strip()
    if not t: return txt
    if t in _ALL: return txt.replace(t, _ALL[t])
    out = txt
    for k in _KEYS:
        if len(k) > 3 and k in out: out = out.replace(k, _ALL[k])
    for rx, v in _TOK: out = rx.sub(v, out)
    return out
def translate_html(h, rel):
    h = re.sub(r">([^<>]+)<", lambda m: ">" + translate_text(m.group(1)) + "<", h)
    h = re.sub(r'(placeholder|alt|title|aria-label|content)="([^"]*)"', lambda m: f'{m.group(1)}="{translate_text(m.group(2))}"', h)
    h = h.replace('<html lang="da">', '<html lang="en">')
    h = re.sub(r'href="' + re.escape(BASE) + r'/(?!en/|style\.css|site\.js|brand/|icons/|art/|favicon|app/)', f'href="{BASE}/en/', h)
    h = h.replace('class="tiny en-only" hidden', 'class="tiny en-only"')
    return h
def write(rel, content):
    d = rel.rsplit("/", 1)[0] + "/" if "/" in rel else ""
    da = content.replace("__DA__", f"{BASE}/{d}").replace("__EN__", f"{BASE}/en/{d}").replace('class="flag on"', 'class="flag on"')
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "w").write(da)
    if rel.endswith(".html"):
        en = content.replace('class="flag on" title="Dansk"', 'class="flag" title="Dansk"').replace('class="flag" title="English"', 'class="flag on" title="English"')
        en = translate_html(en, rel).replace("__DA__", f"{BASE}/{d}").replace("__EN__", f"{BASE}/en/{d}")
        p2 = os.path.join(OUT, "en", rel); os.makedirs(os.path.dirname(p2), exist_ok=True); open(p2, "w").write(en)

def tcard(t):
    slug = t["slug"].strip("/"); f = t.get("facts") or {}; img = team_img(slug)
    inner = f'<img src="{img}" alt="" loading="lazy">' if img else f'<div class="ph" style="background-image:url({ART(1)})"></div>'
    return f'<a class="tcard" href="{BASE}/{slug}/">{inner}{"<span class=closed>Audition</span>" if f.get("closed") else ""}<div class="in"><div class="t">{E(f.get("style") or "")}</div><h4>{E(short_title(t["title"]))}</h4><div class="m">{E(f.get("years") or "")}{(" · " + E(f["level"])) if f.get("level") else ""}</div></div></a>'

# ---------------- forside
STYLE_CAT = [("Showdance (solo", ["Solo & Duo"]), ("Showdance", ["Showdance"]), ("Hip Hop", ["Hip Hop"]), ("Contemporary", ["Contemporary"]), ("Disco & Disco Slow", ["Disco", "Disco Slow"]), ("Disco Slow", ["Disco Slow"]), ("Disco", ["Disco"]), ("Ballet", ["Ballet"]), ("Spring", ["Spring & Tumbling"]), ("Smidighed", ["Smidighed & Acro"]), ("Styrke", ["Styrketræning"]), ("Hit Fit", ["Hit Fit Dance"]), ("Dans og bevægelse", ["Mini-dans"])]
def style_cats(st):
    for k, v in STYLE_CAT:
        if (st or "").startswith(k): return v
    return [st or "Andet"]
def style_cat(st): return style_cats(st)[0]
LEVELS = ["Alle niveauer", "Begynder & let øvet", "Øvet", "Øvet+", "Elite"]
def level_bucket(lv):
    l = (lv or "").lower()
    if "begynder" in l: return "Begynder & let øvet"
    if "øvet+" in l: return "Øvet+"
    if "elite" in l: return "Elite"
    if "øvet" in l: return "Øvet"
    return "Alle niveauer"
STYLE_ORDER = ["Showdance", "Hip Hop", "Contemporary", "Disco", "Disco Slow", "Ballet", "Spring & Tumbling", "Smidighed & Acro", "Styrketræning", "Hit Fit Dance", "Mini-dans", "Solo & Duo"]
STYLE_BLURB = {"Showdance": "Vores største stil – fra Mini Cuties til konkurrencehold, der stiller op til DM.", "Hip Hop": "Energi, attitude og grooves – for mini, børn, junior og voksne.", "Contemporary": "Flow, udtryk og teknik – begynder til elite.", "Disco": "Hurtige fødder og glimmer.", "Disco Slow": "Disco i roligere tempo – teknik og udtryk.", "Ballet": "Grundteknik, holdning og elegance for de mindste.", "Spring & Tumbling": "Spring, flik-flak og akrobatik – alle aldre.", "Smidighed & Acro": "Smidighed, styrke og akrobatiske elementer.", "Styrketræning": "Styrke og skadeforebyggelse for dansere.", "Hit Fit Dance": "Dansefitness for voksne – klippekort, ingen binding.", "Mini-dans": "Dans og bevægelse for de allermindste – også med forælder.", "Solo & Duo": "Egen koreografi til konkurrence, solo eller duo."}
teams_data = json.dumps([{"slug": t["slug"].strip("/"), "db": SLUG2NAME.get(t["slug"].strip("/")) or ("Hit Fit Dance tirsdag" if t["slug"].strip("/") == "hit-fit-dance" else None), "title": short_title(t["title"]), "style": (t.get("facts") or {}).get("style") or "", "cat": style_cat((t.get("facts") or {}).get("style")), "cats": style_cats((t.get("facts") or {}).get("style")), "lvl": level_bucket((t.get("facts") or {}).get("level")), "lvlRank": LEVELS.index(level_bucket((t.get("facts") or {}).get("level"))), "years": (t.get("facts") or {}).get("years") or "", "level": ((t.get("facts") or {}).get("level") or "").replace(" (lukket hold)", "").replace("(lukket hold)", "").strip(), "img": team_img(t["slug"].strip("/")), "closed": bool((t.get("facts") or {}).get("closed")), "tryout": bool((t.get("facts") or {}).get("audition") and "ingen audition" in str((t.get("facts") or {}).get("audition")).lower()), "ages": sorted(team_ages.get(t["slug"].strip("/"), []))} for t in TEAMS], ensure_ascii=False)
def style_cards():
    out = []
    for cat in STYLE_ORDER:
        ts = [t for t in TEAMS if cat in style_cats((t.get("facts") or {}).get("style"))]
        if not ts: continue
        img = next((team_img(t["slug"].strip("/")) for t in ts if team_img(t["slug"].strip("/"))), None)
        ages = sorted({a for t in ts for a in team_ages.get(t["slug"].strip("/"), [])}, key=list(AGE).index)
        span = f"{AGE[ages[0]].replace(' børn','').replace(' år','')}–{AGE[ages[-1]].replace(' børn','')}" if len(ages) > 1 else (AGE[ages[0]] if ages else "")
        out.append(f'<button class="scard" data-cat="{E(cat)}">{(f"<img src=\"{img}\" alt=\"\" loading=\"lazy\">" if img else f"<div class=ph style=\"background-image:url({ART(1)})\"></div>")}<div class="in"><h4>{E(cat)}</h4><div class="m">{len(ts)} hold · {E(span)}</div></div></button>')
    return "".join(out)
age_chips = '<button data-age="all" class="on">Alle</button>' + "".join(f'<button data-age="{k}">{v}</button>' for k, v in AGE.items())
styles = ["Showdance", "Hip Hop", "Contemporary", "Disco", "Ballet", "Spring & Tumbling", "Smidighed & Acro", "Styrketræning", "Hit Fit Dance", "Solo & Duo", "Konkurrencehold"]
marq = "".join(f"<span>{E(s)}</span>" for s in styles)
stats = f'<div class="stats"><div><b>{len([t for t in TEAMS if t["slug"].strip("/") != "solo-duo"])}</b><span>hold</span></div><div><b>{len(P["staff"])}</b><span>trænere</span></div><div><b>0–99</b><span>år</span></div><div><b>2</b><span>prøvetimer</span></div></div>'
_gal = []
for _t in TEAMS:
    for _u in (_t.get("images") or [])[:2]:
        if _u.startswith("http") and _u not in _gal: _gal.append(_u)
import random as _rnd; _rnd.Random(7).shuffle(_gal); default_gallery = _gal[:14]
CATALOG_MAP = {c["key"]: c["file"] for c in json.load(open(os.path.join(ROOT, "src", "domain", "llds", "lib", "catalog.generated.json")))}
home = f"""
<div class="marq"><div>{marq}{marq}</div></div>
<section id="finder"><div class="wrap"><div class="finder rv"><div class="eyebrow">Find dit hold</div><h2>Vælg <em>stilart</em> – eller se alle hold for en alder</h2>
<div class="seg" role="tablist"><button class="on" data-mode="styles">Stilarter</button><button data-mode="age">Efter alder</button></div>
<div id="mode-styles"><p class="muted" style="margin:0 0 16px;max-width:60ch">Tryk på en stilart for at se alle dens hold.</p><div class="scards" id="style-cards">{style_cards()}</div><div id="style-teams" class="style-teams"></div></div>
<div id="mode-age" hidden><p class="muted" style="margin:0 0 12px;max-width:60ch">Vælg alder, så viser vi alle hold på tværs af stilarter, der passer.</p><div class="chips">{age_chips}</div><div id="age-teams" class="style-teams"></div></div>
<p class="tiny" style="margin:18px 0 0"><span class="badge aud">Audition</span> = optagelse kun via audition/udtagelse · <span class="badge try">Prøvegange · niveau</span> = åbent hold, men træneren vurderer niveau efter 4 prøvegange</p><p style="margin:18px 0 0"><a class="btn ghost" href="{BASE}/saeson-26-27/">Se hele holdplanen {ICON_ARROW}</a></p></div></div></section>
<section class="tight"><div class="wrap split"><div class="rv"><div class="eyebrow">Velkommen</div><h2>{E(H["welcome_title"]).replace("LL Dance Studio", "<em>LL Dance Studio</em>")}</h2><p class="lead">{E(H["welcome"])}</p><div class="btns"><a class="btn" href="{BASE}/medlemsskab/">Bliv medlem {ICON_ARROW}</a><a class="btn ghost" href="{BASE}/backstage/">Mød trænerne</a></div></div>
<div class="tiles rv">{"".join(f'<a class="tile" href="{BASE}{t["href"]}"><div class="bg" style="background-image:url({t["image"]})"></div><div class="in"><h3>{E(t["label"])}</h3><span class="ar">{ICON_ARROW}</span></div></a>' for t in H["tiles"])}</div></div></section>
<section class="tight"><div class="wrap"><div class="vid rv" style="background-image:url({team_img("the-axis-25-26", 1) or H["hero"]})"><video src="{H["video"]}" playsinline preload="none"></video><div class="pl"><b>Afspil</b></div><div class="cap"><div class="eyebrow">{E(H["universe_title"])}</div><div class="tiny" style="color:var(--muted);margin-top:4px">Se videoen fra studiet · tryk for at afspille med lyd</div></div></div></div></section>
<section class="tight gal-sec"><div class="wrap"><div class="head rv"><div><div class="eyebrow">Øjeblikke</div><h2>Fra gulvet, scenen <em>og backstage</em></h2></div></div><div class="gal rv" id="gallery" data-default='{json.dumps(default_gallery, ensure_ascii=False)}'><div class="track"></div><div class="dots"></div></div></div></section>
<section class="tight"><div class="wrap"><div class="head rv"><div><div class="eyebrow">Kalender</div><h2>Events, shows <em>&amp; workshops</em></h2></div><a class="btn ghost" href="{BASE}/app/">Tilmeld i appen {ICON_ARROW}</a></div><div class="grid rv" id="events"><p class="empty">Henter…</p></div></div></section>
<section class="tight"><div class="wrap"><div class="eyebrow">Fra studiet</div><h2>Nyt</h2><div id="news"></div></div></section>
<section class="tight"><div class="wrap"><div class="head rv"><div><div class="eyebrow">Backstage</div><h2>Trænerne bag <em>holdene</em></h2></div><a class="btn ghost" href="{BASE}/backstage/">Alle trænere {ICON_ARROW}</a></div>
<div class="scroller rv">{"".join(f'<a class="tr" href="{BASE}/backstage/"><img src="{s["image"]}" alt="{E(s["name"])}" loading="lazy"><div class="in"><h4>{E(s["name"])}</h4><div class="tiny">{E(s["role"])}</div></div></a>' for s in P["staff"][:8])}</div></div></section>
<section class="tight"><div class="wrap"><div class="app rv"><div class="txt"><div class="eyebrow">LL Dance Studio-appen</div><h2>Alt det praktiske – <em>i lommen</em></h2><p class="muted">Dansere, forældre og trænere har hvert deres rum. Tilmelding, afbud, koreografi-videoer, holdets billeder, beskeder fra Line, events og Stjerneshoppen – ét sted.</p>
<ul class="feat"><li>Ugens træninger og afbud med ét tryk</li><li>Koreografi og musik til øvning hjemme</li><li>Holdets billeder og videoer – kun for holdet</li><li>Beskeder, aflysninger og vikarer</li><li>Tilmelding og betaling til events</li><li>Klippekort og Stjerneshoppen</li></ul>
<div class="btns"><a class="btn" href="{BASE}/app/">Åbn appen {ICON_ARROW}</a><a class="btn ghost" href="{BASE}/support/">Sådan kommer du i gang</a></div></div><div class="pic" style="background-image:url({ART(5)})"></div></div></div></section>
<section class="tight"><div class="wrap grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))"><div class="band rv"><div class="bg" style="background-image:url({H["shop_image"]})"></div><div><div class="eyebrow">Merchandise</div><h2>{E(H["shop_title"])}</h2><p class="muted small">{E(H["shop_text"])}</p><a class="btn" href="{BASE}/merchandise/">Se Stjerneshoppen {ICON_ARROW}</a></div></div>
<div class="band rv"><div class="bg" style="background-image:url({H["welcome_band_image"]})"></div><div><div class="eyebrow">Kom forbi</div><h2>{E(H["welcome_band_title"])}</h2><p class="muted small">{E(H["welcome_band"])}</p><a class="btn ghost" href="{BASE}/kontakt/">Kontakt os {ICON_ARROW}</a></div></div></div></section>
<script type="application/json" id="teams-data">{teams_data}</script>
"""
write("index.html", page("LL Dance Studio – danseskole i Ulstrup", home, "Showdance, hip hop, contemporary, disco, ballet og spring for alle aldre i Ulstrup. Find dit hold, bliv medlem og følg med i appen.", "/", hero=H["hero"], hero_title="Dans med hjertet.<br><em>Vind med holdet.</em>", hero_sub="LL Dance Studio · Ulstrup", hero_lead="Danseskole for alle aldre – fra de allermindste til elitehold, der stiller op til DM. Showdance, hip hop, contemporary, disco, ballet og spring.", small=False, extra=f'<div class="btns" style="margin-top:6px"><a class="btn" href="#finder">Find dit hold {ICON_ARROW}</a><a class="btn ghost" href="{BASE}/app/">Log ind i appen</a></div>{stats}<div class="cue"></div>'))

# ---------------- holdplan
days = "".join(f'<button data-day="{i}" class="{"on" if i == 0 else ""}">{d}</button>' for i, d in enumerate(SCHED["days"]))
def cls(c):
    img = team_img(c.get("slug")) or ART(3 if "Mini" in c["age"] else 1); ages = " ".join(sorted(age_tokens(c["age"])))
    sub = f'{E(c["age"])} · {E(c["level"])}' + (' · <span class="chip gold" style="margin:0;padding:1px 8px">Lukket hold</span>' if c.get("closed") else "")
    body = f'<div class="img" style="background-image:url({img})"></div><div><div class="t">{E(c["time"])}</div><h4>{E(c["name"])}</h4><div class="tiny">{sub}{("<br>" + E(c["note"])) if c.get("note") else ""}</div></div>'
    return f'<a class="cls" href="{BASE}/{c["slug"]}/" data-ages="{ages}">{body}<span class="go">{ICON_ARROW}</span></a>' if c.get("slug") else f'<div class="cls na" data-ages="{ages}">{body}</div>'
dayblocks = ""
for i, d in enumerate(SCHED["days"]):
    rooms = "".join(f'<div class="room"><h3>{r}</h3>{"".join(cls(c) for c in SCHED["classes"] if c["day"] == i and c["room"] == r)}</div>' for r in SCHED["rooms"])
    dayblocks += f'<div class="day{" on" if i == 0 else ""}" data-day="{i}">{rooms}</div>'
monthly = "".join(cls({**m, "time": "Én gang om måneden"}) for m in SCHED["monthly"])
holdplan = f"""
<section class="tight plan" style="margin-top:-20px"><div class="wrap"><div class="chips" style="margin-top:0">{age_chips}</div><div class="bar">{days}</div>{dayblocks}
<div style="margin-top:36px" class="room"><h3>Månedligt</h3>{monthly}</div>
<div id="live-note" style="margin-top:36px"></div>
<div class="card" style="margin-top:36px;display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:240px"><h3>Ferie, kalender og aflysninger</h3><p class="muted small" style="margin:4px 0 0">Alle holds kalendere, ferier, ekstra træninger og dagens aflysninger ligger i appen – med push-besked når noget ændrer sig.</p></div><a class="btn" href="{BASE}/app/">Åbn appen {ICON_ARROW}</a></div></div></section>
"""
write("saeson-26-27/index.html", page("Holdplan – Sæson 26/27 – LL Dance Studio", holdplan, "Ugeplan for alle hold i sæson 26/27: dag, tid, sal, alder og niveau – filtrér på alder.", "/saeson-26-27/", hero=team_img("sky-stars", 1) or H["hero"], hero_title="Sæson <em>26/27</em>", hero_sub="Holdplan", hero_lead="Træning mandag–torsdag i Store Sal og Lille Sal på Vinkelvej 17. Filtrér på alder, og tryk på et hold for beskrivelse, pris og tilmelding."))

# ---------------- team pages
FACT_LABELS = [("day_time", "Dag og tid"), ("style", "Stilart"), ("level", "Niveau"), ("years", "Årgang"), ("trainer", "Træner"), ("assistant", "Hjælpetræner"), ("location", "Sted"), ("season", "Sæson"), ("audition", "Optagelse")]
for t in TEAMS:
    slug = t["slug"].strip("/"); f = t.get("facts") or {}; imgs = t.get("images") or []
    short_name = SLUG2NAME.get(slug) or ("Hit Fit Dance tirsdag" if slug == "hit-fit-dance" else short_title(t["title"]))   # the team's name in the database (web_signup resolves by name)
    factsh = "".join(f'<div><b>{l}</b><span>{E(f[k])}</span></div>' for k, l in FACT_LABELS if f.get(k))
    secs = "".join(f'<h2>{E(s["title"])}</h2><p>{E(s["body"]).replace(chr(10), "<br>")}</p>' for s in (t.get("sections") or []) if s.get("body") and not (t.get("intro") and s["body"][:60] in t["intro"]) and not any(k in s["title"].lower() for k in ("tilmeldingsprisen", "rater", "familierabat", "kontakt os")))
    inc = f'<ul>{"".join(f"<li>{E(x)}</li>" for x in t["included"])}</ul>' if t.get("included") else ""
    docs = [("Kalender (PDF)", t["calendar_pdf"])] if t.get("calendar_pdf") else []
    docs += [((d.get("title") or "Dokument"), d["url"]) if isinstance(d, dict) else (d.rsplit("/", 1)[-1].rsplit(".", 1)[0].replace("-", " "), d) for d in (t.get("documents") or [])]
    docsh = ('<h2>Dokumenter</h2><ul>' + "".join(f"<li><a href='{u}' target='_blank' rel='noreferrer'>{E(n)}</a></li>" for n, u in docs) + '</ul>') if docs else ""
    gal = ('<div class="gallery">' + "".join(f"<img src='{u}' alt='' loading='lazy'>" for u in imgs[1:5]) + '</div>') if len(imgs) > 1 else ""
    related = [x for x in TEAMS if x is not t and x["slug"].strip("/") != "solo-duo" and (team_ages.get(x["slug"].strip("/"), set()) & team_ages.get(slug, set()))][:4]
    relh = f'<section class="tight"><div class="wrap"><div class="head"><div><div class="eyebrow">Måske også</div><h2>Andre hold for <em>samme alder</em></h2></div></div><div class="tcards">{"".join(tcard(x) for x in related)}</div></div></section>' if related else ""
    price = E(f.get("price") or "Se medlemsskab"); p1, p2 = (price.split(" for ", 1) + ["pr. sæson"])[:2] if " for " in price else (price, "pr. sæson")
    side = f'<aside class="side"><div class="card"><div class="eyebrow">Pris</div><div class="price">{p1}</div><div class="tiny">{p2}</div>{(("<div class=muted style=margin-top:10px;font-size:.9rem>" + E(t["payment"]) + "</div>") if t.get("payment") else "")}{inc}<div class="btns" style="margin-top:18px;flex-direction:column;align-items:stretch"><button class="btn" style="justify-content:center" data-signup="{E(short_name)}" data-price="{E(f.get("price") or "")}">Tilmeld holdet {ICON_ARROW}</button><a class="btn ghost" style="justify-content:center" href="{BASE}/medlemsskab/">Rater og familierabat</a></div><p class="tiny" style="margin:10px 0 0">Har du appen? <a href="{BASE}/app/">Tilmeld dig dér</a> – så er profilen klar med det samme.</p><p class="tiny" style="margin:14px 0 0">{"Optagelse kun via audition/udtagelse – datoer og info på forsiden." if f.get("closed") else ("Klippekort – køb klip og mød op, ingen binding." if slug == "hit-fit-dance" else "2 gratis prøvetimer – start når som helst i sæsonen.")}</p></div></aside>'
    body = f"""<section class="tight"><div class="wrap"><div class="facts rv">{factsh}</div><div class="cols"><article class="rv">{"<p class=lead>" + E(t["intro"]) + "</p>" if t.get("intro") else ""}{'<p class="tiny en-only" hidden>Holdbeskrivelsen herunder er på dansk – skriv til os på engelsk, så hjælper vi.</p>' if secs else ""}{secs}{docsh}{gal}</article>{side}</div></div></section>{relh}"""
    write(f"{slug}/index.html", page(f"{short_title(t['title'])} – LL Dance Studio", body, (t.get("intro") or t["title"])[:155], "/saeson-26-27/", hero=imgs[0] if imgs else ART(1), hero_title=E(short_title(t["title"])), hero_sub=" · ".join(x for x in [f.get("style"), f.get("level"), f.get("years")] if x) or "Hold", extra=f'<div class="btns"><button class="btn" data-signup="{E(short_name)}" data-price="{E(f.get("price") or "")}">Tilmeld holdet {ICON_ARROW}</button><a class="btn ghost" href="{BASE}/saeson-26-27/">Holdplanen</a></div>', sticky=f'<a class="btn" href="#" data-signup="{E(short_name)}" data-price="{E(f.get("price") or "")}">Tilmeld holdet · {p1}</a>'))

# ---------------- medlemsskab
acc = "".join(f'<details{" open" if i == 0 else ""}><summary>{E(s["title"])}</summary><div class="b">{E(s["body"])}</div></details>' for i, s in enumerate(M["sections"]))
mem = f"""<section class="tight"><div class="wrap cols"><div><p class="lead rv">{E(M["intro"])}</p><div class="acc rv">{acc}</div></div>
<aside class="side"><div class="card"><div class="eyebrow">Sådan gør du</div><ol class="steps"><li><b>1</b><span>Find dit hold under <a href="{BASE}/saeson-26-27/">Holdplan</a> – på forsiden kan du også søge på stilart eller alder.</span></li><li><b>2</b><span>Tryk <em>Tilmeld holdet</em> på holdets side, udfyld navn og alder, og betal med MobilePay. Familierabat trækkes automatisk fra.</span></li><li><b>✓</b><span>Er I allerede i appen? Så tilmelder I jer nye hold direkte dér: <em>Mere → Tilmeld nyt hold</em>.</span></li><li><b>3</b><span>Line godkender, typisk samme dag, og I får en kvittering på e-mail. Så er I på holdet.</span></li></ol><a class="btn" style="margin-top:18px;width:100%;justify-content:center" href="{BASE}/saeson-26-27/">Find dit hold {ICON_ARROW}</a><p class="tiny" style="margin:12px 0 0">Elitehold optages via audition – datoer og info på forsiden.</p></div></aside></div></section>"""
write("medlemsskab/index.html", page("Medlemsskab – LL Dance Studio", mem, "Priser, betaling i rater, familierabat, prøvetimer og fortrydelsesret.", "/medlemsskab/", hero=M["image"], hero_title="Bliv en del af <em>studiet</em>", hero_sub="Medlemsskab"))

# ---------------- stjerneshoppen
PRODUCTS = json.load(open(os.path.join(ROOT, "site", "products.json")))
prods = "".join(f'<div class="prod{" img" if p["images"] else ""}" data-i="{i+1:02d}">{("<div class=pimg style=\"background-image:url(" + p["images"][0] + ")\"></div>") if p["images"] else ""}<div class="pin"><h4>{E(p["name"])}</h4><div class="tiny">{" · ".join(E(x) for x in p["sizes"]) if p["sizes"] else "One size"}</div><div class="price">{p["price"]} kr.</div><div class="buy"><button class="btn" data-buy="{E(p["name"])}">Køb {ICON_ARROW}</button></div></div></div>' for i, p in enumerate(PRODUCTS))
shop = f"""<section class="tight"><div class="wrap"><div class="head rv"><p class="lead" style="margin:0">{E(S["intro"])}</p><a class="btn ghost" href="{BASE}/app/">Har du appen? Bestil dér {ICON_ARROW}</a></div>
<div class="eyebrow">Sortiment</div><div class="prods rv">{prods}</div><p class="tiny" style="margin-top:16px">Priser i kr. inkl. moms. Betales med Vipps MobilePay – her på siden eller i appen – og udleveres i studiet ved næste træning.</p></div></section>"""
write("merchandise/index.html", page("Stjerneshoppen – LL Dance Studio", shop, "Merchandise fra LL Dance Studio: tøj, tasker, drikkedunke – bestil i appen.", "/merchandise/", hero=S["image"], hero_title="Stjerne<em>shoppen</em>", hero_sub="Merchandise"))

# ---------------- backstage
staff = "".join(f'<div class="card rv"><img src="{s["image"]}" alt="{E(s["name"])}" loading="lazy"><div class="in"><h3>{E(s["name"])}</h3><div class="tiny" style="color:var(--gold)">{E(s["role"])}</div>{("<div class=tiny style=margin-top:4px>" + E(s["teaches"]) + "</div>") if s.get("teaches") else ""}<p class="small muted" style="margin:10px 0 0">{E(s["bio"])}</p></div></div>' for s in P["staff"])
back = f"""<section class="tight"><div class="wrap"><div class="staff">{staff}</div>
<div class="app rv" style="margin-top:40px"><div class="txt"><div class="eyebrow">For dansere, forældre og trænere</div><h2>Backstage er <em>appen</em></h2><p class="muted">Træninger, afbud, koreografi, holdets mapper, beskeder og tilmeldinger – alt det, der før lå spredt, ligger nu ét sted.</p><a class="btn" href="{BASE}/app/">Log ind i appen {ICON_ARROW}</a></div><div class="pic" style="background-image:url({ART(4)})"></div></div></div></section>"""
write("backstage/index.html", page("Backstage – LL Dance Studio", back, "Trænerne bag LL Dance Studio – og indgangen til appen for dansere, forældre og trænere.", "/backstage/", hero=P["staff"][0]["image"], hero_title="Mød <em>trænerne</em>", hero_sub="Backstage", hero_lead="Holdet bag LL Dance Studio – dansere og undervisere med erfaring fra konkurrencer, shows og mange års undervisning."))

# ---------------- kontakt
kon = f"""<section class="tight"><div class="wrap"><div class="contact rv"><div class="card"><div class="eyebrow">Adresse</div><h3>{E(C["address"]).replace(", ", "<br>")}</h3><a href="{C["map"]}" target="_blank" rel="noreferrer">Åbn i Google Maps</a></div><div class="card"><div class="eyebrow">Telefon</div><h3><a href="tel:{C["phone"].replace(" ", "")}" style="color:inherit">{E(C["phone"])}</a></h3><p class="tiny" style="margin:4px 0 0">{E(C["hours"])}</p></div><div class="card"><div class="eyebrow">E-mail</div><h3 style="font-size:1.2rem;word-break:break-all"><a href="mailto:{C["email"]}" style="color:inherit">{C["email"]}</a></h3></div><div class="card"><div class="eyebrow">Tilmelding</div><p class="muted small" style="margin:0 0 10px">Opret dig i appen og vælg hold – Line godkender inden for en dag.</p><a class="btn sm" href="{BASE}/app/">Åbn appen {ICON_ARROW}</a></div></div>
<div class="map rv"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q={E(C["address"]).replace(" ", "+")}&output=embed"></iframe></div></div></section>"""
write("kontakt/index.html", page("Kontakt – LL Dance Studio", kon, "Kontakt LL Dance Studio i Ulstrup – adresse, telefon, e-mail og telefontid.", "/kontakt/", hero=C["image"], hero_title="Kom <em>forbi</em>", hero_sub="Kontakt", hero_lead=E(H["welcome_band"])))

# ---------------- privacy / terms / support
def plain(title, inner, desc): return page(title, f'<section class="tight" style="padding-top:110px"><div class="wrap"><article>{inner}</article></div></section>', desc)
PRIVACY = f"""<h1 style="font-size:2.6rem">Privatlivspolitik</h1><p class="muted">Sidst opdateret {TODAY}</p>
<p>LL Dance Studio-appen og dette website drives af Ilumie (Therkildsen Group, CVR 46203798) for LL Dance Studio, {E(C["address"])}. LL Dance Studio er dataansvarlig for medlemsdata; Ilumie er databehandler.</p>
<h2>Hvad vi gemmer</h2><ul><li><b>Profil:</b> navn, e-mail, telefon, fødselsår, hold og rolle (danser, forælder, træner). Børn under 13 har ingen egen konto – deres profil ligger under forælderens. Børn på 10–12 år kan få et begrænset login, som forælderen opretter og kan lukke igen.</li>
<li><b>Træning:</b> afbud, fremmøde, bookinger af sale, klippekort og tilmeldinger til events.</li><li><b>Indhold:</b> opslag, kommentarer, billeder og videoer i holdets rum. Kun synligt for holdet, forældre og trænere – aldrig offentligt, medmindre Line udtrykkeligt markerer et opslag som offentligt.</li>
<li><b>Køb:</b> ordrer i shoppen og klippekort. Betaling sker via MobilePay direkte til LL Dance Studio – appen gemmer ingen betalingsoplysninger.</li><li><b>Teknisk:</b> login-tidspunkter og en logbog over administrative handlinger.</li></ul>
<h2>Hvor data ligger</h2><p>Alle data gemmes hos Supabase i EU (Irland). Login-mails sendes via Resend (EU). Der bruges ingen tracking, annoncer eller analyseværktøjer. Kortet på kontaktsiden indlæses fra Google Maps.</p>
<h2>Hvem kan se hvad</h2><p>Adgang styres pr. hold: dansere ser deres eget hold, forældre ser deres børns hold, trænere ser de hold de underviser, og Line (administrator) ser hele studiet. Fotos af børn kan fravælges (fotosamtykke) i profilen.</p>
<h2>Sletning</h2><p>Skriv til <a href="mailto:{SUPPORT}">{SUPPORT}</a> eller til Line. Data slettes senest 30 dage efter udmeldelse, bortset fra hvad bogføringsloven kræver om køb.</p>
<h2>Dine rettigheder</h2><p>Du har ret til indsigt, berigtigelse, sletning og dataportabilitet efter GDPR. Klager kan rettes til Datatilsynet.</p>"""
TERMS = f"""<h1 style="font-size:2.6rem">Vilkår for brug</h1><p class="muted">Sidst opdateret {TODAY}</p>
<h2>Konto</h2><p>Appen er for medlemmer af LL Dance Studio, deres forældre og trænere. Line godkender alle profiler. Egen konto kræver, at du er fyldt 13 år; yngre dansere er under en forælders profil.</p>
<h2>God tone</h2><p>Holdets rum er et trygt sted. Vær sød og respektfuld – ingen mobning, ingen deling af andres billeder uden for appen. Trænere og Line læser med, og alt kan anmeldes med ét tryk. Indhold, der bryder reglerne, fjernes, og gentagne brud kan føre til lukning af kontoen.</p>
<h2>Billeder og video</h2><p>Billeder og koreografi-videoer tilhører LL Dance Studio og må kun bruges til egen øvelse – ikke deles på sociale medier uden aftale.</p>
<h2>Køb og medlemsskab</h2><p>Priser er i danske kroner inkl. moms. Shop og klippekort betales via MobilePay; ordren bekræftes, når LL Dance Studio har registreret betalingen. Klippekort gælder 12 måneder fra aktivering. Sæsonpris, rater, prøvetimer og fortrydelsesret: se <a href="{BASE}/medlemsskab/">Medlemsskab</a>.</p>
<h2>Drift</h2><p>Appen leveres som den er; vi tilstræber høj oppetid, men garanterer den ikke. Ilumie kan opdatere appen og disse vilkår – væsentlige ændringer meldes i appen.</p><p>Kontakt: <a href="mailto:{SUPPORT}">{SUPPORT}</a></p>"""
SUPPORTP = f"""<h1 style="font-size:2.6rem">Hjælp</h1>
<h2>Sådan kommer du i gang</h2><ol><li>Åbn <a href="{BASE}/app/">appen</a> og skriv din e-mail – du får en 6-cifret kode (tjek spam første gang).</li><li>Udfyld din profil og dine børn, vælg hold og tryk Send.</li><li>Line godkender – typisk samme dag.</li></ol>
<h2>Føj appen til hjemmeskærmen</h2><p><b>iPhone:</b> åbn linket i Safari → Del → “Føj til hjemmeskærm”. <b>Android:</b> menuen (⋮) → “Installér app”.</p>
<h2>Ofte stillede spørgsmål</h2><p><b>Jeg får ingen kode.</b> Tjek spam/kampagner og stavningen. Koden gælder i 1 time.</p><p><b>Mit barn er 10–12 år – kan det få sit eget login?</b> Ja: Mere → Indstillinger → dit barn → “Giv login”.</p><p><b>Jeg ser ikke koreografi-videoer.</b> På junior- og voksenhold er videoer kun for danserne selv.</p><p><b>Betaling.</b> Shop, klippekort og egenbetaling betales med MobilePay i appen – tryk “Jeg har betalt”, Line bekræfter.</p>
<h2>Kontakt</h2><p>Hold, priser og betaling: Line Lund Olesen, {E(C["phone"])}. Tekniske problemer: <a href="mailto:{SUPPORT}">{SUPPORT}</a>.</p>"""
write("privacy/index.html", plain("Privatlivspolitik – LL Dance Studio", PRIVACY, "Sådan behandler LL Dance Studio-appen dine data."))
write("terms/index.html", plain("Vilkår – LL Dance Studio", TERMS, "Vilkår for brug af LL Dance Studio-appen."))
write("support/index.html", plain("Hjælp – LL Dance Studio", SUPPORTP, "Kom i gang med LL Dance Studio-appen."))

write("style.css", CSS)
write("site.js", JS % {"url": SB_URL, "key": SB_KEY, "slug": SLUG, "base": BASE, "support": SUPPORT, "icon": ICON_ARROW.replace("%", "%%"), "catmap": json.dumps(CATALOG_MAP), "qrlib": QRLIB})
shutil.copy(os.path.join(ROOT, "public", "favicon.png"), os.path.join(OUT, "favicon.png"))
os.makedirs(os.path.join(OUT, "brand"), exist_ok=True); os.makedirs(os.path.join(OUT, "icons"), exist_ok=True)
for n in os.listdir(os.path.join(ROOT, "public", "brand")): shutil.copy(os.path.join(ROOT, "public", "brand", n), os.path.join(OUT, "brand", n))
for n in os.listdir(os.path.join(ROOT, "public", "icons")): shutil.copy(os.path.join(ROOT, "public", "icons", n), os.path.join(OUT, "icons", n))
os.makedirs(os.path.join(OUT, "art"), exist_ok=True)
for n in range(1, 7): shutil.copy(os.path.join(ROOT, "public", "art", f"{n}.jpg"), os.path.join(OUT, "art", f"{n}.jpg"))
print(f"site written to {OUT}: {len(TEAMS)} team pages")
