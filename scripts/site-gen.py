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

LOGO = """<svg class="mark" viewBox="-30 0 300 230" role="img" aria-label="LL Dance Studio"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3dc9a"/><stop offset=".35" stop-color="#c9a24a"/><stop offset=".55" stop-color="#8c6c25"/><stop offset=".8" stop-color="#e6c87a"/><stop offset="1" stop-color="#a8832f"/></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#e6c87a"/><stop offset="1" stop-color="#b48a35"/></linearGradient></defs><g fill="url(#g2)"><path d="M120 6l3.6 7.6 8.3 1.1-6.1 5.7 1.6 8.2-7.4-4.1-7.4 4.1 1.6-8.2-6.1-5.7 8.3-1.1z"/><path d="M93 12l3 6.1 6.7.9-4.9 4.6 1.3 6.6-6.1-3.3-6.1 3.3 1.3-6.6-4.9-4.6 6.7-.9z"/><path d="M147 12l3 6.1 6.7.9-4.9 4.6 1.3 6.6-6.1-3.3-6.1 3.3 1.3-6.6-4.9-4.6 6.7-.9z"/><path d="M69 24l2.5 5 5.5.8-4 3.8 1 5.4-5-2.7-5 2.7 1-5.4-4-3.8 5.5-.8z"/><path d="M171 24l2.5 5 5.5.8-4 3.8 1 5.4-5-2.7-5 2.7 1-5.4-4-3.8 5.5-.8z"/></g><circle cx="120" cy="105" r="62" fill="url(#g1)"/><g font-family="Cormorant Garamond,Georgia,serif" font-weight="600" font-size="72" fill="#0c0b0a"><g transform="matrix(-1 0 0 1 240 0)"><text x="124" y="129">L</text></g><text x="124" y="129">L</text></g><rect x="119" y="72" width="2" height="66" fill="#0c0b0a"/><text x="120" y="212" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-weight="600" font-size="34" fill="url(#g2)" letter-spacing="4">DANCE STUDIO</text></svg>"""
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
.logo{display:flex;align-items:center;gap:10px;color:var(--fg)}.logo .mark{width:56px;height:44px;transition:transform .5s var(--ease)}.logo:hover .mark{transform:rotate(-6deg)}
.pill{display:flex;gap:2px;padding:4px;border:1px solid var(--line);border-radius:999px;background:rgba(10,10,11,.5);backdrop-filter:blur(12px)}
.pill a{color:var(--muted);padding:9px 16px;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;border-radius:999px;transition:all .3s}.pill a:hover{color:var(--fg)}.pill a.on{color:#161206;background:linear-gradient(135deg,var(--gold2),var(--gold))}
.hr{display:flex;align-items:center;gap:8px}
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
.stats{display:flex;gap:28px;flex-wrap:wrap;margin-top:40px;padding-top:26px;border-top:1px solid var(--line2)}.stats div{min-width:110px}.stats b{display:block;font-family:var(--display);font-size:2.2rem;font-weight:500;line-height:1;color:var(--gold2)}.stats span{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
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
.vid .cap{position:absolute;left:28px;bottom:24px;z-index:2}
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
article{max-width:72ch}article h2{font-size:1.9rem;margin:38px 0 10px}article p,article li{color:var(--muted)}article ul{padding-left:18px}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:28px 0}.gallery img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:14px;transition:transform .8s var(--ease)}.gallery img:hover{transform:scale(1.03)}
.stickycta{display:none;position:fixed;left:14px;right:14px;bottom:14px;z-index:30}.stickycta:empty{display:none!important}.stickycta .btn{width:100%;justify-content:center}@media(max-width:900px){.stickycta{display:block}body.hasstk{padding-bottom:80px}}
/* shop / membership / staff / contact */
.prods{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}.prod{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:6px;min-height:150px;position:relative;overflow:hidden}.prod:before{content:attr(data-i);position:absolute;right:-6px;top:-18px;font-family:var(--display);font-size:5rem;color:rgba(201,162,74,.08);font-style:italic}.prod h4{font-size:1.2rem}.prod .price{color:var(--gold2);font-family:var(--display);font-size:1.6rem;margin-top:auto}
.acc{border-top:1px solid var(--line)}.acc details{border-bottom:1px solid var(--line)}.acc summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:22px 0;font-family:var(--display);font-size:1.6rem}.acc summary::-webkit-details-marker{display:none}.acc summary:after{content:"+";color:var(--gold);font-family:var(--body);font-size:1.4rem;transition:transform .4s}.acc details[open] summary:after{transform:rotate(45deg)}.acc .b{padding:0 0 22px;color:var(--muted);max-width:70ch;white-space:pre-line}
.staff{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}.staff .card{padding:0;overflow:hidden}.staff img{width:100%;aspect-ratio:1536/647;object-fit:cover;display:block}.staff .in{padding:16px 18px 20px}
.contact{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}.map{border-radius:28px;overflow:hidden;border:1px solid var(--line);aspect-ratio:16/7;margin-top:28px;filter:grayscale(1) invert(.92) contrast(.9)}.map iframe{width:100%;height:100%;border:0;display:block}
footer{padding:70px 0 40px;border-top:1px solid var(--line);margin-top:40px}footer .cols3{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:30px}@media(max-width:760px){footer .cols3{grid-template-columns:1fr}}
footer h4{font-family:var(--body);font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:12px}footer a{color:var(--muted);display:block;padding:4px 0}footer a:hover{color:var(--fg)}footer .legal{margin-top:40px;padding-top:20px;border-top:1px solid var(--line);color:var(--fg3);font-size:.8rem;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
footer .big{font-family:var(--display);font-size:clamp(2rem,5vw,3.4rem);line-height:1;margin:0 0 14px}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.rv{opacity:1;transform:none}}
"""

JS = r"""
const SB="%(url)s",KEY="%(key)s",SLUG="%(slug)s",BASE="%(base)s";
const q=async(v,x="")=>{try{const r=await fetch(`${SB}/rest/v1/${v}?select=*${x}`,{headers:{apikey:KEY}});return r.ok?await r.json():[]}catch{return[]}};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const MON=["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
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
document.querySelectorAll(".vid").forEach(v=>v.addEventListener("click",()=>{const m=v.querySelector("video");v.classList.add("play");m.muted=false;m.play()}));
// holdplan: day bar + age filter
document.querySelectorAll(".bar button[data-day]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".bar button[data-day]").forEach(x=>x.classList.toggle("on",x===b));document.querySelectorAll(".day").forEach(d=>d.classList.toggle("on",d.dataset.day===b.dataset.day))}));
const applyAge=a=>{document.querySelectorAll("[data-ages]").forEach(el=>el.classList.toggle("hid",a!=="all"&&!el.dataset.ages.split(" ").includes(a)));document.querySelectorAll(".chips button[data-age]").forEach(x=>x.classList.toggle("on",x.dataset.age===a))};
document.querySelectorAll(".plan .chips button[data-age]").forEach(b=>b.addEventListener("click",()=>applyAge(b.dataset.age)));
// find dit hold (forside)
const fd=document.getElementById("finder-cards");if(fd){const T=JSON.parse(document.getElementById("teams-data").textContent);const render=a=>{const l=T.filter(t=>a==="all"||t.ages.includes(a)).slice(0,8);fd.innerHTML=l.map(t=>`<a class="tcard" href="${BASE}/${t.slug}/">${t.img?`<img src="${t.img}" alt="" loading="lazy">`:`<div class="ph" style="background-image:url(${artFor(t.slug)})"></div>`}${t.closed?'<span class="closed">Lukket hold</span>':""}<div class="in"><div class="t">${esc(t.style)}</div><h4>${esc(t.title)}</h4><div class="m">${esc(t.years||"")}${t.level?" · "+esc(t.level):""}</div></div></a>`).join("")};render("all");document.querySelectorAll("#finder .chips button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("#finder .chips button").forEach(x=>x.classList.toggle("on",x===b));render(b.dataset.age)}))}
// sticky cta
if(document.querySelector(".stickycta a"))document.body.classList.add("hasstk");
// live data
(async()=>{const[school]=await q("school",`&slug=eq.${SLUG}`);const f=school?`&school_id=eq.${school.id}`:"";
const eEl=document.getElementById("events");if(eEl){const ev=await q("public_events",f+"&order=starts_at");eEl.innerHTML=ev.length?ev.map(e=>{const d=new Date(e.starts_at);return`<div class="card event" style="background-image:url(${artFor(e.title)})"><div class="date">${d.getDate()}<small>${MON[d.getMonth()]}</small></div><div><h3>${esc(e.title)}</h3><div class="tiny">${{competition:"Konkurrence",show:"Show",workshop:"Workshop",social:"Socialt"}[e.kind]||""}${e.place?" · "+esc(e.place):""}${e.price_dkk?" · "+e.price_dkk+" kr.":""}</div>${e.info?`<p class="small muted">${esc(e.info)}</p>`:""}</div></div>`}).join(""):'<p class="empty">Ingen kommende events lige nu – julebal, workshops og shows annonceres her.</p>'}
const nEl=document.getElementById("news");if(nEl){const ps=await q("public_posts",f+"&order=created_at.desc&limit=3");if(ps.length)nEl.innerHTML=ps.map(p=>{const d=new Date(p.created_at);return`<div class="post"><div class="tiny">${d.getDate()}. ${MON[d.getMonth()]} ${d.getFullYear()}</div>${esc(p.body)}</div>`}).join("");else nEl.closest("section")?.remove()}
const pEl=document.getElementById("live-products");if(pEl){const pr=await q("public_products",f+"&order=name");if(pr.length)pEl.innerHTML=`<div class="eyebrow">I appen lige nu</div><div class="prods">${pr.map((p,i)=>`<div class="prod" data-i="${i+1}"><h4>${esc(p.name)}</h4>${p.sizes?.length?`<div class="tiny">${p.sizes.map(esc).join(" · ")}</div>`:""}<div class="price">${p.price_dkk} kr.</div></div>`).join("")}</div>`}
const sEl=document.getElementById("live-note");if(sEl){const sc=await q("public_schedule",f+"&order=starts_at");if(sc.length)sEl.innerHTML=`<div class="card"><div class="eyebrow">Denne uge – live fra appen</div>${sc.map(s=>`<div class="small"><span style="color:var(--gold2)">${hm(s.starts_at)}–${hm(s.ends_at)}</span> ${esc(s.name)}${s.room?` <span class="tiny">· ${esc(s.room)}</span>`:""}</div>`).join("")}<p class="tiny" style="margin:8px 0 0">Aflysninger og vikarer vises i appen.</p></div>`}
})();
"""

def page(title, body, desc, active="", hero=None, hero_title=None, hero_sub=None, hero_lead=None, small=True, extra="", sticky=""):
    pill = "".join(f'<a href="{BASE}{h}" class="{"on" if h == active else ""}">{l}</a>' for l, h, _ in NAV)
    big = "".join(f'<a class="big" href="{BASE}{h}" style="transition-delay:{80+i*60}ms"><small>0{i+1}</small>{l}<span>{d}</span></a>' for i, (l, h, d) in enumerate(NAV))
    heroh = f'<div class="hero{" small" if small else ""}"><div class="bg" style="background-image:url({hero})"></div><div class="wrap">{"<div class=eyebrow>" + E(hero_sub) + "</div>" if hero_sub else ""}<h1>{hero_title}</h1>{("<p class=lead>" + hero_lead + "</p>") if hero_lead else ""}{extra}</div></div>' if hero else ""
    return f"""<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{E(title)}</title><meta name="description" content="{E(desc)}"><meta name="theme-color" content="#0a0a0b"><meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}">{f'<meta property="og:image" content="{hero}">' if hero else ""}
<link rel="icon" href="{BASE}/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="{BASE}/style.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Outfit:wght@300;400;500&display=swap"></head><body>
<header class="top"><div class="wrap"><a class="logo" href="{BASE}/">{LOGO}</a><nav class="pill">{pill}</nav><div class="hr"><a class="btn sm hbtn" href="{BASE}/app/">Åbn appen</a><button class="burger" aria-label="Menu"><i></i>Menu</button></div></div></header>
<div class="menu"><div class="l"><a class="big" href="{BASE}/" style="transition-delay:40ms"><small>00</small>Forside<span>LL Dance Studio</span></a>{big}<div class="foot"><a class="btn" href="{BASE}/app/">Åbn appen {ICON_ARROW}</a><a class="btn ghost" href="tel:{C["phone"].replace(" ", "")}">{E(C["phone"])}</a></div></div><div class="r" style="background-image:url({ART(6)})"><div><div class="eyebrow">Ulstrup</div><h3>Dans med hjertet.<br><em>Vind med holdet.</em></h3></div></div></div>
{heroh}{body}
<footer><div class="wrap"><div class="cols3"><div><div class="big">LL Dance<br><em style="color:var(--gold2)">Studio</em></div><p class="muted small">{E(C["address"])}<br><a href="tel:{C["phone"].replace(" ", "")}" style="display:inline">{E(C["phone"])}</a> · {E(C["hours"])}<br><a href="mailto:{C["email"]}" style="display:inline">{C["email"]}</a></p></div>
<div><h4>Sider</h4>{"".join(f'<a href="{BASE}{h}">{l}</a>' for l, h, _ in NAV)}<a href="{BASE}/solo-duo/">Solo / Duo</a></div>
<div><h4>Appen</h4><a href="{BASE}/app/">Log ind / tilmeld</a><a href="{BASE}/support/">Hjælp &amp; FAQ</a><a href="{BASE}/privacy/">Privatlivspolitik</a><a href="{BASE}/terms/">Vilkår</a></div></div>
<div class="legal"><span>© {date.today().year} {E(C["name"])}</span><span>App og website af <a href="https://ilumie.com/" style="display:inline">Ilumie</a></span></div></div></footer>
<div class="stickycta">{sticky}</div>
<script src="{BASE}/site.js" defer></script></body></html>"""

def write(rel, content):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "w").write(content)

def tcard(t):
    slug = t["slug"].strip("/"); f = t.get("facts") or {}; img = team_img(slug)
    inner = f'<img src="{img}" alt="" loading="lazy">' if img else f'<div class="ph" style="background-image:url({ART(1)})"></div>'
    return f'<a class="tcard" href="{BASE}/{slug}/">{inner}{"<span class=closed>Lukket hold</span>" if f.get("closed") else ""}<div class="in"><div class="t">{E(f.get("style") or "")}</div><h4>{E(short_title(t["title"]))}</h4><div class="m">{E(f.get("years") or "")}{(" · " + E(f["level"])) if f.get("level") else ""}</div></div></a>'

# ---------------- forside
teams_data = json.dumps([{"slug": t["slug"].strip("/"), "title": short_title(t["title"]), "style": (t.get("facts") or {}).get("style") or "", "years": (t.get("facts") or {}).get("years") or "", "level": (t.get("facts") or {}).get("level") or "", "img": team_img(t["slug"].strip("/")), "closed": bool((t.get("facts") or {}).get("closed")), "ages": sorted(team_ages.get(t["slug"].strip("/"), []))} for t in TEAMS], ensure_ascii=False)
age_chips = '<button data-age="all" class="on">Alle</button>' + "".join(f'<button data-age="{k}">{v}</button>' for k, v in AGE.items())
styles = ["Showdance", "Hip Hop", "Contemporary", "Disco", "Ballet", "Spring & Tumbling", "Smidighed & Acro", "Styrketræning", "Hit Fit Dance", "Solo & Duo", "Konkurrencehold"]
marq = "".join(f"<span>{E(s)}</span>" for s in styles)
stats = f'<div class="stats"><div><b>{len([t for t in TEAMS if t["slug"].strip("/") != "solo-duo"])}</b><span>hold</span></div><div><b>{len(P["staff"])}</b><span>trænere</span></div><div><b>0–99</b><span>år</span></div><div><b>2</b><span>gratis prøvetimer</span></div></div>'
home = f"""
<div class="marq"><div>{marq}{marq}</div></div>
<section id="finder"><div class="wrap"><div class="finder rv"><div class="eyebrow">Find dit hold</div><h2>Hvor gammel er <em>danseren?</em></h2><p class="muted" style="margin:0;max-width:60ch">Vælg alder, så viser vi de hold, der passer – fra forældre-barn-dans til elitehold, der stiller op til DM.</p>
<div class="chips">{age_chips}</div><div class="tcards" id="finder-cards"></div><p style="margin:26px 0 0"><a class="btn ghost" href="{BASE}/saeson-26-27/">Se hele holdplanen {ICON_ARROW}</a></p></div></div></section>
<section class="tight"><div class="wrap split"><div class="rv"><div class="eyebrow">Velkommen</div><h2>{E(H["welcome_title"]).replace("LL Dance Studio", "<em>LL Dance Studio</em>")}</h2><p class="lead">{E(H["welcome"])}</p><div class="btns"><a class="btn" href="{BASE}/medlemsskab/">Bliv medlem {ICON_ARROW}</a><a class="btn ghost" href="{BASE}/backstage/">Mød trænerne</a></div></div>
<div class="tiles rv">{"".join(f'<a class="tile" href="{BASE}{t["href"]}"><div class="bg" style="background-image:url({t["image"]})"></div><div class="in"><h3>{E(t["label"])}</h3><span class="ar">{ICON_ARROW}</span></div></a>' for t in H["tiles"])}</div></div></section>
<section class="tight"><div class="wrap"><div class="vid rv" style="background-image:url({team_img("the-axis-25-26", 1) or H["hero"]})"><video src="{H["video"]}" playsinline preload="none"></video><div class="pl"><b>Afspil</b></div><div class="cap"><div class="eyebrow">{E(H["universe_title"])}</div></div></div></div></section>
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
    side = f'<aside class="side"><div class="card"><div class="eyebrow">Pris</div><div class="price">{p1}</div><div class="tiny">{p2}</div>{(("<div class=muted style=margin-top:10px;font-size:.9rem>" + E(t["payment"]) + "</div>") if t.get("payment") else "")}{inc}<div class="btns" style="margin-top:18px;flex-direction:column;align-items:stretch"><a class="btn" style="justify-content:center" href="{BASE}/app/">Tilmeld via appen {ICON_ARROW}</a><a class="btn ghost" style="justify-content:center" href="{BASE}/medlemsskab/">Rater og familierabat</a></div><p class="tiny" style="margin:14px 0 0">{"Elitehold – optagelse via audition." if f.get("closed") else "2 gratis prøvetimer – start når som helst i sæsonen."}</p></div></aside>'
    body = f"""<section class="tight"><div class="wrap"><div class="facts rv">{factsh}</div><div class="cols"><article class="rv">{"<p class=lead>" + E(t["intro"]) + "</p>" if t.get("intro") else ""}{secs}{docsh}{gal}</article>{side}</div></div></section>{relh}"""
    write(f"{slug}/index.html", page(f"{short_title(t['title'])} – LL Dance Studio", body, (t.get("intro") or t["title"])[:155], "/saeson-26-27/", hero=imgs[0] if imgs else ART(1), hero_title=E(short_title(t["title"])), hero_sub=" · ".join(x for x in [f.get("style"), f.get("level"), f.get("years")] if x) or "Hold", extra=f'<div class="btns"><a class="btn" href="{BASE}/app/">Tilmeld via appen {ICON_ARROW}</a><a class="btn ghost" href="{BASE}/saeson-26-27/">Holdplanen</a></div>', sticky=f'<a class="btn" href="{BASE}/app/">Tilmeld via appen · {p1}</a>'))

# ---------------- medlemsskab
acc = "".join(f'<details{" open" if i == 0 else ""}><summary>{E(s["title"])}</summary><div class="b">{E(s["body"])}</div></details>' for i, s in enumerate(M["sections"]))
mem = f"""<section class="tight"><div class="wrap cols"><div><p class="lead rv">{E(M["intro"])}</p><div class="acc rv">{acc}</div></div>
<aside class="side"><div class="card"><div class="eyebrow">Sådan gør du</div><ol style="padding-left:18px;color:var(--muted);margin:0"><li style="margin-bottom:10px">Find dit hold under <a href="{BASE}/saeson-26-27/">Holdplan</a>.</li><li style="margin-bottom:10px">Opret dig i <a href="{BASE}/app/">appen</a> – dig selv og dine børn – og vælg hold.</li><li>Line godkender, typisk samme dag. Så er I på holdet.</li></ol><a class="btn" style="margin-top:18px;width:100%;justify-content:center" href="{BASE}/app/">Tilmeld via appen {ICON_ARROW}</a></div></aside></div></section>"""
write("medlemsskab/index.html", page("Medlemsskab – LL Dance Studio", mem, "Priser, betaling i rater, familierabat, prøvetimer og fortrydelsesret.", "/medlemsskab/", hero=M["image"], hero_title="Bliv en del af <em>studiet</em>", hero_sub="Medlemsskab"))

# ---------------- stjerneshoppen
prods = "".join(f'<div class="prod" data-i="{i+1:02d}"><h4>{E(n)}</h4><div class="tiny">{E(sz)}</div><div class="price">{p} kr.</div></div>' for i, (n, p, sz) in enumerate(S["products"]))
shop = f"""<section class="tight"><div class="wrap"><div class="head rv"><p class="lead" style="margin:0">{E(S["intro"])}</p><a class="btn" href="{BASE}/app/">Bestil i appen {ICON_ARROW}</a></div><div id="live-products" class="rv" style="margin-bottom:34px"></div>
<div class="eyebrow">Sortiment</div><div class="prods rv">{prods}</div><p class="tiny" style="margin-top:16px">Priser i kr. inkl. moms. Betales med MobilePay i appen og udleveres i studiet ved næste træning.</p></div></section>"""
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
write("site.js", JS % {"url": SB_URL, "key": SB_KEY, "slug": SLUG, "base": BASE})
shutil.copy(os.path.join(ROOT, "public", "favicon.svg"), os.path.join(OUT, "favicon.svg"))
os.makedirs(os.path.join(OUT, "art"), exist_ok=True)
for n in range(1, 7): shutil.copy(os.path.join(ROOT, "public", "art", f"{n}.jpg"), os.path.join(OUT, "art", f"{n}.jpg"))
print(f"site written to {OUT}: {len(TEAMS)} team pages")
