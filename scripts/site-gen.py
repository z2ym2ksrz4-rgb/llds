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
import time
BUILD = time.strftime("%Y%m%d%H%M")
BASE = sys.argv[sys.argv.index("--base") + 1] if "--base" in sys.argv else "/llds"
SITE = (sys.argv[sys.argv.index("--site") + 1] if "--site" in sys.argv else "https://ilumie.com").rstrip("/")   # origin for canonical/hreflang/og – change together with --base when the site moves to its own domain
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
NAV = [("Holdplan", "/saeson-26-27/", "Alle hold, uge for uge"), ("Medlemsskab", "/medlemsskab/", "Priser, rater og prøvetimer"), ("Stjerneshoppen", "/merchandise/", "Tøj og merchandise"), ("Om os", "/om-os/", "Trænerne og historien"), ("Kontakt", "/kontakt/", "Find os i Ulstrup"), ("Backstage", "/backstage/", "Appen – kun for medlemmer")]
ICON_ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
import unicodedata as _ud
def slugify(x):
    x = x.lower().replace("æ", "ae").replace("ø", "oe").replace("å", "aa"); x = _ud.normalize("NFKD", x).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", x).strip("-")
ICON_LOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
ICON_BACK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>'

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
.eyebrow{font-size:.75rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:14px;display:flex;align-items:center;gap:10px}.eyebrow:before{content:"";width:22px;height:1px;background:var(--gold)}
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
.top .back{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;border:1px solid var(--line2);color:var(--fg);background:rgba(10,10,11,.5);margin-right:10px;flex:none;transition:background .25s}.top .back:hover{background:var(--gold-soft);color:var(--gold2)}
.logo{display:flex;align-items:center;gap:10px;color:var(--fg);flex:none}.logo .mark{height:46px;width:auto;max-width:none;flex:none;display:block;transition:transform .5s var(--ease)}.logo:hover .mark{transform:rotate(-3deg)}
.pill{display:flex;gap:2px;padding:4px;border:1px solid var(--line);border-radius:999px;background:rgba(10,10,11,.5);backdrop-filter:blur(12px)}
.pill a{white-space:nowrap;color:var(--muted);padding:9px 14px;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;border-radius:999px;transition:all .3s}.pill a:hover{color:var(--fg)}.pill a.on{color:#161206;background:linear-gradient(135deg,var(--gold2),var(--gold))}
.hr{display:flex;align-items:center;gap:8px}.langs{display:flex;gap:2px;margin-right:4px}.flag{font-size:1.15rem;line-height:1;padding:6px 5px;border-radius:999px;opacity:.55;transition:opacity .3s,transform .3s;filter:saturate(.8)}.flag:hover{opacity:1;transform:scale(1.1)}.flag.on{opacity:1}
.btn.sm{padding:11px 18px;font-size:.85rem}
.burger{display:inline-flex;align-items:center;gap:10px;background:rgba(255,255,255,.04);border:1px solid var(--line2);color:var(--fg);border-radius:999px;padding:10px 16px;font-family:inherit;font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;backdrop-filter:blur(8px);position:relative;z-index:60}
.burger i{display:block;width:18px;height:10px;position:relative}.burger i:before,.burger i:after{content:"";position:absolute;left:0;right:0;height:1.5px;background:currentColor;transition:transform .4s var(--ease),top .4s}.burger i:before{top:0}.burger i:after{top:8px}
body.navopen .burger i:before{top:4px;transform:rotate(45deg)}body.navopen .burger i:after{top:4px;transform:rotate(-45deg)}
@media(min-width:901px){.burger{display:none}}@media(max-width:900px){.pill{display:none}.btn.sm.hbtn{padding:8px 11px;font-size:.78rem}.btn.sm.hbtn .ico{display:none}.top .back{width:34px;height:34px;margin-right:6px}.burger{padding:10px 12px;gap:0}.burger span{display:none}.hr{gap:6px}.langs{margin-right:0}.flag{padding:6px 3px;font-size:1.05rem}}
.btn.sm.hbtn .ico{width:16px;height:16px}.hbtn .lbl{display:none}.hbtn.is-get .get,.hbtn.is-open .open{display:inline}.hbtn:not(.is-get):not(.is-open) .get{display:inline}
.menu{position:fixed;inset:0;z-index:40;background:#0a0a0b;display:grid;grid-template-columns:1.1fr .9fr;opacity:0;visibility:hidden;transition:opacity .5s var(--ease),visibility .5s}body.navopen .menu{opacity:1;visibility:visible}body.navopen{overflow:hidden}
.menu .l{padding:120px clamp(18px,6vw,80px) 40px;display:flex;flex-direction:column;justify-content:center;overflow-y:auto}
.menu .l a.big{display:flex;align-items:baseline;gap:18px;color:var(--fg);font-family:var(--display);font-size:clamp(2.2rem,5.5vw,4.4rem);line-height:1.1;padding:8px 0;border-bottom:1px solid var(--line);transform:translateY(20px);opacity:0;transition:transform .6s var(--ease),opacity .6s,color .3s}
body.navopen .menu .l a.big{transform:none;opacity:1}.menu .l a.big:hover{color:var(--gold2)}.menu .l a.big small{font-family:var(--body);font-size:.75rem;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);min-width:28px}.menu .l a.big span{font-family:var(--body);font-size:.85rem;color:var(--fg3);margin-left:auto;font-weight:300}
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
.stats{display:flex;gap:0;margin-top:26px;padding-top:14px;border-top:1px solid var(--line2);overflow-x:auto;scrollbar-width:none}.stats::-webkit-scrollbar{display:none}.stats div{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 8px;border-left:1px solid rgba(201,162,74,.25);text-align:center}.stats div:first-child{border-left:0;padding-left:0}.stats b{display:block;font-family:var(--display);font-size:1.5rem;font-weight:500;line-height:1;color:var(--gold2);white-space:nowrap}.stats span{font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);white-space:nowrap}@media(min-width:720px){.stats{gap:0;margin-top:40px;padding-top:22px}.stats div{align-items:flex-start;text-align:left;padding:0 24px}.stats b{font-size:2.2rem}.stats span{font-size:.75rem}}
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
.chip{display:inline-block;font-size:.75rem;padding:4px 11px;border:1px solid var(--line2);border-radius:999px;color:var(--muted);margin:2px 4px 0 0}.chip.gold{color:var(--gold2);border-color:var(--gold3);background:var(--gold-soft)}
/* find dit hold */
.finder{background:var(--bg2);border:1px solid var(--line);border-radius:28px;padding:clamp(22px,4vw,44px);position:relative;overflow:hidden}
.finder:before{content:"";position:absolute;right:-120px;top:-120px;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(201,162,74,.18),transparent 65%);pointer-events:none}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 24px}.chips button{background:transparent;border:1px solid var(--line2);color:var(--muted);border-radius:999px;padding:10px 18px;font-family:inherit;font-size:.92rem;cursor:pointer;transition:all .3s}.chips button:hover{color:var(--fg);border-color:var(--fg3)}.chips button.on{color:#161206;background:linear-gradient(135deg,var(--gold2),var(--gold));border-color:transparent}
.tcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}@media(min-width:700px){.tcards{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}}
.tcard{position:relative;display:block;aspect-ratio:3/4;border-radius:18px;overflow:hidden;background:var(--card);color:var(--fg);isolation:isolate}
.tcard img,.tcard .ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform 1.2s var(--ease);z-index:-1}.tcard .ph{background:center/cover}.tcard:hover img,.tcard:hover .ph{transform:scale(1.06)}
.tcard:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,11,.05) 30%,rgba(10,10,11,.92));z-index:-1}
.tcard .in{position:absolute;left:16px;right:16px;bottom:14px}.tcard h4{font-size:1.35rem;margin:4px 0 2px}.tcard .m{font-size:.76rem;color:var(--muted)}.tcard .t{font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold2)}
.tcard .closed{position:absolute;top:12px;left:12px;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold2);background:rgba(10,10,11,.6);border:1px solid var(--gold3);padding:4px 9px;border-radius:999px;backdrop-filter:blur(6px)}
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
.event .date{font-family:var(--display);font-size:2.2rem;line-height:1;color:var(--gold2);min-width:64px;text-align:center}.event .date small{display:block;font-family:var(--body);font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-top:6px}
.post{border-left:1px solid var(--gold3);padding-left:18px;margin-bottom:22px;white-space:pre-wrap;color:var(--muted)}
.empty{color:var(--fg3);font-size:.92rem}
/* trainers scroller */
.scroller{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px 0 18px;margin:0 calc(-1*clamp(18px,4vw,40px));padding-left:clamp(18px,4vw,40px);scrollbar-width:none}.scroller::-webkit-scrollbar{display:none}
.tr{flex:0 0 260px;scroll-snap-align:start;border-radius:20px;overflow:hidden;background:var(--card);border:1px solid var(--line);color:var(--fg)}.tr img{width:100%;aspect-ratio:1.4;object-fit:cover;display:block;filter:saturate(.9);transition:transform 1s var(--ease)}.tr:hover img{transform:scale(1.05)}.tr .in{padding:14px 16px 18px}.tr h4{font-size:1.25rem}.tr .tiny{color:var(--gold)}
/* app band */
.app{display:grid;grid-template-columns:1.1fr .9fr;border-radius:32px;overflow:hidden;background:var(--bg2);border:1px solid var(--line)}@media(max-width:860px){.app{grid-template-columns:1fr}}
.app .txt{padding:clamp(28px,5vw,64px)}.app .pic{background:center/cover;min-height:320px;position:relative}.app .pic:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,var(--bg2),transparent 40%)}@media(max-width:860px){.app .pic:before{background:linear-gradient(180deg,var(--bg2),transparent 40%)}}
.feat{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;margin:22px 0 28px;padding:0;list-style:none}.feat li{display:flex;gap:10px;align-items:flex-start;color:var(--muted);font-size:.95rem}.feat li:before{content:"✦";color:var(--gold);font-size:.75rem;margin-top:6px}
/* bands */
.band{position:relative;min-height:380px;border-radius:32px;overflow:hidden;display:flex;align-items:flex-end;padding:clamp(24px,4vw,44px);isolation:isolate}.band .bg{position:absolute;inset:0;background:center/cover;z-index:-2;transition:transform 2s var(--ease)}.band:hover .bg{transform:scale(1.04)}
.band:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,11,.05),rgba(10,10,11,.88));z-index:-1}.band h2{margin:0 0 8px}.band p{max-width:52ch}
/* holdplan */
/* web sign-up / buy modal */
.wm{position:fixed;inset:0;z-index:60;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.7);backdrop-filter:blur(6px)}.wm.open{display:flex}
.wm .box{position:relative;width:100%;max-width:560px;min-height:50dvh;max-height:92dvh;overflow:auto;overscroll-behavior:contain;background:var(--bg2);border:1px solid rgba(201,162,74,.3);border-radius:22px 22px 0 0;padding:6px 22px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -20px 60px -30px rgba(201,162,74,.4);transition:transform .2s ease}
.wm .grab{position:sticky;top:0;padding:8px 0 10px;touch-action:none;background:var(--bg2);z-index:2}.wm .handle{width:40px;height:4px;border-radius:2px;background:var(--line2);margin:0 auto}
.wm .xclose{position:absolute;top:10px;right:12px;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid var(--line2);color:var(--fg);font-size:22px;line-height:1;cursor:pointer;z-index:3}
@media(min-width:720px){.wm{align-items:center}.wm .box{border-radius:22px;min-height:0;padding-top:22px}.wm .grab{display:none}}
.wm h3{font-family:var(--display);font-weight:400;font-size:1.8rem;margin:4px 0 14px}.wm label{display:block;margin:0 0 12px;font-size:.82rem;color:var(--muted)}
.wm input,.wm select,.wm textarea{display:block;width:100%;margin-top:5px;background:var(--card);color:var(--fg);border:1px solid var(--line2);border-radius:12px;padding:11px 12px;font:inherit;font-size:1rem}
.boostsec{padding-top:28px;padding-bottom:0}.boosts{display:grid;gap:18px}.boost{display:grid;grid-template-columns:1fr;border:1px solid rgba(201,162,74,.4);border-radius:26px;overflow:hidden;background:linear-gradient(180deg,rgba(201,162,74,.08),rgba(255,255,255,.02))}.boost-pic{min-height:240px;background-size:cover;background-position:center}.boost-in{padding:22px 22px 24px;display:flex;flex-direction:column;gap:8px;justify-content:center}.boost-in h2{margin:0;font-size:clamp(1.7rem,4vw,2.6rem)}.boost-in .btns{margin-top:8px;display:flex;gap:10px;flex-wrap:wrap}@media(min-width:860px){.boost{grid-template-columns:1.1fr 1fr}.boost-pic{min-height:340px}.boost-in{padding:34px}}.boosts.multi{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;}.boosts.multi::-webkit-scrollbar{display:none}.boosts.multi .boost{flex:0 0 88%;scroll-snap-align:center}.boostdots{display:flex;gap:8px;justify-content:center;margin-top:14px}.boostdots button{width:8px;height:8px;border-radius:50%;border:0;padding:0;background:rgba(255,255,255,.25);cursor:pointer;transition:.25s}.boostdots button.on{background:#c9a24a;width:22px;border-radius:6px}@media(min-width:860px){.boosts.multi .boost{flex:0 0 100%}}.evpic{height:170px;border-radius:14px;background-size:cover;background-position:center;margin-bottom:12px}.evul{margin:0;padding-left:18px;line-height:1.6}.btn[aria-disabled=true]{opacity:.6;pointer-events:none}
.tchecks{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;max-height:190px;overflow:auto;padding:8px 10px;border:1px solid rgba(255,255,255,.1);border-radius:10px;background:rgba(255,255,255,.03)}.tcheck{display:flex;align-items:center;gap:8px;font-size:.88rem;min-height:30px;cursor:pointer}.tcheck input{width:18px;height:18px;accent-color:#c9a24a;margin:0;flex:none}
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
.scard .in{position:absolute;left:12px;right:12px;bottom:10px}.scard h4{font-family:var(--display);font-weight:400;font-size:1.25rem;margin:0}.scard .m{font-size:.75rem;color:var(--muted)}
.scard.on{border-color:var(--gold);box-shadow:0 0 0 2px rgba(201,162,74,.25)}
.style-teams:empty{display:none}.style-teams{margin-top:16px;border-top:1px solid var(--line);padding-top:14px}.style-teams .sh{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:14px 0 6px}.style-teams .sh h3{font-family:var(--display);font-weight:400;font-size:1.4rem;margin:0}.style-teams .sh .tiny{color:var(--fg3)}
.badge{display:inline-block;font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;padding:4px 8px;border-radius:999px;border:1px solid var(--gold3);color:var(--gold2);background:rgba(201,162,74,.1);white-space:nowrap}.badge.try{border-color:var(--line2);color:var(--muted);background:none}
.style-teams .lh{font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold3);margin:10px 0 2px;display:flex;align-items:center;gap:8px}.style-teams .lh:after{content:"";flex:1;height:1px;background:var(--line)}
.trow{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);color:var(--fg);text-decoration:none}.trow:last-child{border-bottom:0}.trow .pic{flex:none;width:64px;height:64px;border-radius:12px;background:center/cover var(--card)}.trow .tx{flex:1;min-width:0}.trow h4{font-family:var(--display);font-weight:400;font-size:1.2rem;margin:0;line-height:1.1}.trow .m{font-size:.78rem;color:var(--muted)}.trow .badge{margin-top:5px}.trow .go{color:var(--gold2)}.trow .closed{font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold2)}
.gal{position:relative}.gal .track{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;padding:2px 0 6px;-webkit-overflow-scrolling:touch}.gal .track::-webkit-scrollbar{display:none}
.gal .track img{flex:none;width:84%;max-width:560px;aspect-ratio:4/5;object-fit:cover;border-radius:22px;scroll-snap-align:center;border:1px solid rgba(201,162,74,.25);box-shadow:0 20px 50px -30px rgba(201,162,74,.5);background:var(--card)}
@media(min-width:720px){.gal .track img{width:46%;aspect-ratio:4/3}}@media(min-width:1100px){.gal .track img{width:31%}}
.gal .dots{display:flex;justify-content:center;gap:6px;margin-top:12px}.gal .dots i{width:6px;height:6px;border-radius:50%;background:var(--fg3);transition:all .3s}.gal .dots i.on{background:var(--gold2);width:18px;border-radius:3px}
.pay .qr{width:168px;height:168px;margin:14px auto 6px;padding:10px;background:#fff;border-radius:14px}.pay .qr svg{width:100%;height:100%;display:block}
.evnext{grid-column:1/-1;position:relative;min-height:340px;border-radius:26px;overflow:hidden;background-size:cover;background-position:center;border:1px solid rgba(201,162,74,.3);display:flex;align-items:flex-end}.evnext::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,12,0) 0%,rgba(10,10,12,.55) 40%,rgba(10,10,12,.97) 75%)}.evnext-in{position:relative;padding:28px 26px 26px;max-width:620px}.evnext-in h3{font-size:clamp(28px,5vw,42px);margin:6px 0 8px;line-height:1.05}.evnext-in .btn{margin-top:16px}
.hent{display:grid;gap:34px;grid-template-columns:1fr;align-items:start}@media(min-width:900px){.hent{grid-template-columns:1.4fr .8fr}}
.hent-ios,.hent-android,.hent-web{margin-top:22px;padding-top:18px;border-top:1px solid rgba(201,162,74,.18)}.hent .eyebrow{margin-bottom:10px}.hent .tiny{margin-top:10px}
.hent .eyebrow svg{vertical-align:-3px;margin-right:4px}.hent .btns{margin-top:4px}.hent-qr{text-align:center;padding:26px}.hent-qr .qr{width:200px;height:200px;margin:14px auto 10px;padding:12px;background:#fff;border-radius:16px}.hent-qr .qr svg{width:100%;height:100%;display:block}
.hent-side{display:grid;gap:14px}.qrcard .btn,.qrcard .btn.ghost{margin:6px auto 0;display:inline-flex}.qrcard .tiny{margin-top:10px}@media(max-width:899px){.hent-side{grid-template-columns:1fr 1fr}.hent-qr{padding:16px}.hent-qr .qr{width:120px;height:120px;padding:8px;margin:10px auto 6px}.hent-qr .eyebrow{font-size:.75rem}}
.hent-ios,.hent-android,.hent-web{display:none}html[data-os=ios] .hent-ios,html[data-os=android] .hent-android,html[data-os=desktop] .hent-web,html[data-os=desktop] .hent-ios,html[data-os=desktop] .hent-android{display:block}
.btn.hbtn{white-space:nowrap}
.bar{position:sticky;top:64px;z-index:20;background:rgba(10,10,11,.8);backdrop-filter:blur(14px);border:1px solid var(--line);border-radius:999px;padding:6px;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin:0 0 28px}.bar::-webkit-scrollbar{display:none}
.bar button{flex:1 0 auto;background:none;border:0;color:var(--muted);border-radius:999px;padding:11px 20px;font-family:inherit;font-size:.9rem;cursor:pointer;transition:all .3s;white-space:nowrap}.bar button.on{color:#161206;background:linear-gradient(135deg,var(--gold2),var(--gold))}
.day{display:none}.day.on{display:grid;grid-template-columns:1fr 1fr;gap:28px}@media(max-width:760px){.day.on{grid-template-columns:1fr}}
.legend{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:0 0 14px}.legend .lg{font-size:.78rem;color:var(--muted);display:inline-flex;align-items:center;gap:6px}.legend .lg:before{content:"";width:12px;height:12px;border-radius:4px;background:rgba(201,162,74,.22);border:1px solid var(--gold3)}.legend .lg.l1:before{background:rgba(255,255,255,.06);border-color:var(--line2)}
.weekcal{display:grid;grid-template-columns:52px repeat(var(--ncols,4),minmax(150px,1fr));gap:0 8px;overflow-x:auto;scrollbar-width:thin;padding-bottom:10px;-webkit-overflow-scrolling:touch}
.weekcal .dh{position:sticky;top:64px;z-index:5;background:var(--bg);font-family:var(--display);font-size:1.25rem;padding:8px 4px 10px;border-bottom:1px solid var(--line);margin-bottom:8px}
.weekcal .axis{position:sticky;left:0;z-index:6;background:var(--bg)}.weekcal .axis .dh{border-color:transparent}
.weekcal .lanes{position:relative}.weekcal .hr{position:absolute;left:0;right:0;border-top:1px dashed rgba(255,255,255,.07)}.weekcal .col .hr span{display:none}.weekcal .axis .hr span{position:absolute;top:-9px;left:0;font-size:.75rem;color:var(--fg3);background:var(--bg);padding-right:6px}
.weekcal .blk{position:absolute;left:0;right:0;display:flex;flex-direction:column;justify-content:center;gap:1px;padding:6px 9px;border-radius:12px;overflow:hidden;text-decoration:none;color:var(--fg);font-size:.78rem;line-height:1.15;background:rgba(201,162,74,.16);border:1px solid rgba(201,162,74,.5);transition:transform .25s var(--ease),background .25s}
.weekcal .blk.l1{background:rgba(255,255,255,.05);border-color:var(--line2)}.weekcal a.blk:hover{transform:scale(1.02);background:rgba(201,162,74,.28);z-index:3}
.weekcal .blk b{font-family:var(--display);font-weight:500;font-size:.98rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.05}.weekcal .blk .tm{color:var(--gold2);font-size:.75rem;letter-spacing:.04em}.weekcal .blk .rm{color:var(--fg3);font-size:.75rem}
.weekcal .blk.na{opacity:.75;cursor:default}
.planbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 14px}.weeknav{display:flex;align-items:center;gap:6px}.weeknav .wk{background:var(--card);border:1px solid var(--line2);color:var(--fg);border-radius:999px;padding:8px 14px;font:inherit;font-size:.85rem;cursor:pointer}.weeknav .wk:hover{border-color:var(--gold3)}.weeknav .wk.today.on{background:var(--gold-soft);border-color:var(--gold3);color:var(--gold2)}.weeknav .wklabel{font-family:var(--display);font-size:1.25rem;margin-left:8px;color:var(--fg)}
.roomchips{display:inline-flex;border:1px solid var(--line2);border-radius:999px;padding:3px;background:var(--card)}.roomchips button{background:none;border:0;color:var(--muted);border-radius:999px;padding:8px 14px;font:inherit;font-size:.85rem;cursor:pointer}.roomchips button.on{background:var(--gold-soft);color:var(--gold2);border:1px solid rgba(201,162,74,.5)}
.weekcal[data-room="0"] .blk.l1,.weekcal[data-room="1"] .blk.l0{display:none}.weekcal[data-room="0"] .blk.half,.weekcal[data-room="1"] .blk.half{left:0;right:0}
.weekcal .blk.cx{opacity:.55;border-style:dashed}.weekcal .blk.cx b{text-decoration:line-through}.weekcal .blk .tag{display:inline-block;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;padding:1px 6px;border-radius:999px;margin-top:2px}.weekcal .blk .tag.cx{background:rgba(224,138,138,.18);color:#e08a8a;border:1px solid rgba(224,138,138,.5)}.weekcal .blk .tag.mv{background:rgba(127,179,213,.18);color:#9cc7e6;border:1px solid rgba(127,179,213,.55)}.weekcal .blk.mv{background:rgba(127,179,213,.14)!important;border-color:rgba(127,179,213,.6)!important}.weekcal .blk.narrow{padding:5px 7px}.weekcal .blk.narrow b{font-size:.86rem}
.legend .lg.cx:before{background:rgba(224,138,138,.18);border-color:#e08a8a}.legend .lg.mv:before{background:rgba(127,179,213,.25);border-color:#9cc7e6}
.wkextras{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:0 0 12px;font-size:.82rem}.wkextras:empty{display:none}.wkextras .lbl{color:var(--gold2);letter-spacing:.14em;text-transform:uppercase;font-size:.75rem}.wkextras .x{display:inline-flex;gap:6px;align-items:center;padding:6px 12px;border-radius:999px;border:1px solid rgba(201,162,74,.45);background:rgba(201,162,74,.12);color:var(--fg);text-decoration:none}.wkextras .x .d{color:var(--gold2)}.wkextras .x .rm{color:var(--fg3);font-size:.75rem}.wkextras .x b{font-weight:500}.weekcal .col.empty .dh{opacity:.45}.weekcal .blk.half.s0{right:51%}.weekcal .blk.half.s1{left:51%}.weekcal .blk.half b{font-size:.86rem}.weekcal .blk.half{padding:5px 7px}
@media(max-width:760px){.weekcal{grid-template-columns:44px repeat(var(--ncols,4),200px)}.weekcal .dh{font-size:1.05rem;top:56px}}
.room h3{font-size:.75rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);font-family:var(--body);font-weight:500;margin:0 0 14px;display:flex;align-items:center;gap:10px}.room h3:after{content:"";flex:1;height:1px;background:var(--line)}
.cls{display:flex;gap:16px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:10px;margin-bottom:10px;color:var(--fg);transition:border-color .3s,transform .5s var(--ease)}
.cls .img{width:92px;height:92px;border-radius:12px;background:center/cover;flex:none;position:relative;overflow:hidden}.cls .img:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent,rgba(10,10,11,.4))}
.cls .t{font-variant-numeric:tabular-nums;color:var(--gold2);font-size:.82rem;letter-spacing:.06em}.cls h4{font-size:1.25rem;margin:2px 0 3px}.cls .tiny{line-height:1.45}
a.cls:hover{border-color:var(--gold3);transform:translateX(4px)}.cls.na{opacity:.8}.cls .go{margin-left:auto;color:var(--fg3);flex:none;padding-right:8px}a.cls:hover .go{color:var(--gold2)}
.cls.hid{display:none}
/* team page */
.facts{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;padding:2px 0 14px;margin:0 0 10px}.facts::-webkit-scrollbar{display:none}.facts div{flex:0 0 auto;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px 16px;min-width:150px;max-width:260px}.facts b{display:block;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:4px}.facts span{font-size:.92rem}
.cols{display:grid;grid-template-columns:1fr 340px;gap:clamp(24px,5vw,64px);align-items:start}@media(max-width:900px){.cols{grid-template-columns:1fr}}
.side{position:sticky;top:90px}.side .card{padding:24px}.side .price{font-family:var(--display);font-size:2.4rem;color:var(--gold2);line-height:1;margin:6px 0 2px}.side ul{padding-left:0;list-style:none;margin:14px 0 0}.side li{display:flex;gap:10px;color:var(--muted);font-size:.9rem;padding:6px 0;border-top:1px solid var(--line)}.side li:before{content:"✓";color:var(--gold)}
.side ol.steps{list-style:none;padding:0;margin:14px 0 0}.side ol.steps li{display:flex;gap:12px;align-items:flex-start;color:var(--muted);font-size:.92rem;line-height:1.5;padding:10px 0;border-top:1px solid var(--line)}.side ol.steps li:before{content:none}.side ol.steps b{flex:none;width:26px;height:26px;border-radius:50%;border:1px solid var(--gold3);color:var(--gold2);display:grid;place-items:center;font-family:var(--display);font-size:.95rem;font-weight:500}.side ol.steps em{color:var(--fg);font-style:normal}
article{max-width:72ch}article h2{font-size:1.9rem;margin:38px 0 10px}article p,article li{color:var(--muted)}article ul{padding-left:18px}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:28px 0}.gallery img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:14px;transition:transform .8s var(--ease)}.gallery img:hover{transform:scale(1.03)}
.stickycta{display:none;position:fixed;left:14px;right:14px;bottom:14px;z-index:30}.stickycta:empty{display:none!important}.stickycta .btn{width:100%;justify-content:center}@media(max-width:900px){.stickycta{display:block}body.hasstk{padding-bottom:80px}}
/* shop / membership / staff / contact */
.prods{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px}.prod{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:6px;min-height:150px;position:relative;overflow:hidden}.prod.img{padding:0}.prod .pimg{aspect-ratio:4/5;background:center/cover;transition:transform 1s var(--ease)}.prod:hover .pimg{transform:scale(1.04)}.prod .pin{padding:14px 16px 16px;display:flex;flex-direction:column;gap:4px;flex:1}.prod.img:before{display:none}.prod:before{content:attr(data-i);position:absolute;right:-6px;top:-18px;font-family:var(--display);font-size:5rem;color:rgba(201,162,74,.08);font-style:italic}.prod h4{font-size:1.2rem}.prod .price{color:var(--gold2);font-family:var(--display);font-size:1.6rem;margin-top:auto}
.acc{border-top:1px solid var(--line)}.acc details{border-bottom:1px solid var(--line)}.acc summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:22px 0;font-family:var(--display);font-size:1.6rem}.acc summary::-webkit-details-marker{display:none}.acc summary:after{content:"+";color:var(--gold);font-family:var(--body);font-size:1.4rem;transition:transform .4s}.acc details[open] summary:after{transform:rotate(45deg)}.acc .b{padding:0 0 22px;color:var(--muted);max-width:70ch;white-space:pre-line}
.staff{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}.staff .card{padding:0;overflow:hidden;scroll-margin-top:90px}.staff .card:target{border-color:var(--gold);box-shadow:0 0 0 2px rgba(201,162,74,.3)}.staff img{width:100%;aspect-ratio:1536/647;object-fit:cover;display:block}.staff .in{padding:16px 18px 20px}
.contact{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px}.map{border-radius:28px;overflow:hidden;border:1px solid var(--line);aspect-ratio:16/7;margin-top:28px;filter:grayscale(1) invert(.92) contrast(.9)}.map iframe{width:100%;height:100%;border:0;display:block}
footer{padding:70px 0 40px;border-top:1px solid var(--line);margin-top:40px}footer .cols3{display:grid;grid-template-columns:1.4fr 1.2fr .8fr;gap:30px}@media(max-width:760px){footer .cols3{grid-template-columns:1fr}}
footer h4{font-family:var(--body);font-size:.75rem;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:12px}footer a{color:var(--muted);display:block;padding:4px 0}footer a:hover{color:var(--fg)}footer .legal{margin-top:40px;padding-top:20px;border-top:1px solid var(--line);color:var(--fg3);font-size:.8rem;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
footer .big{font-family:var(--display);font-size:clamp(2rem,5vw,3.4rem);line-height:1;margin:0 0 14px}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.rv{opacity:1;transform:none}}

/* batch 3: reachable header on phones, compact shop and trainers, contact actions */
@media(max-width:900px){.top .flag{min-width:40px;min-height:44px;display:inline-flex;align-items:center;justify-content:center}.top .btn,.top [data-app]{min-height:44px}.burger{min-height:44px;min-width:44px;justify-content:center}.top .back{width:44px;height:44px}a.btn,button.btn{min-height:44px}}
@media(max-width:640px){.prods{grid-template-columns:1fr 1fr;gap:10px}.prod{padding:12px;min-height:0}.prod h4{font-size:1rem}.prod .buy .btn{width:100%;justify-content:center;padding:10px 12px}.staff{grid-template-columns:1fr 1fr;gap:10px}.staff .bio{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.staff .more{display:inline-block}}
.staff .more{display:none;background:none;border:0;color:var(--gold2);font:inherit;font-size:.8rem;padding:10px 0;cursor:pointer}.staff .open .bio{-webkit-line-clamp:unset;display:block}.staff .open .more{display:none}
.quick{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 18px}.quick .btn{flex:1 1 140px;justify-content:center}
.nf{min-height:60vh;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:14px}
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
document.querySelectorAll(".vid").forEach(v=>{const m=v.querySelector("video");if(!m)return;v.addEventListener("click",e=>{if(v.classList.contains("play")&&e.target===m)return;if(v.classList.contains("play")){if(m.paused)m.play().catch(()=>{});return}v.classList.add("play","loading");m.setAttribute("controls","");m.muted=false;const p=m.play();if(p&&p.catch)p.catch(()=>{m.muted=true;m.play().catch(()=>{v.classList.remove("play","loading")})});m.addEventListener("playing",()=>v.classList.remove("loading"),{once:true})})});
// holdplan: day bar + age filter
document.querySelectorAll(".bar button[data-day]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".bar button[data-day]").forEach(x=>x.classList.toggle("on",x===b));document.querySelectorAll(".day").forEach(d=>d.classList.toggle("on",d.dataset.day===b.dataset.day))}));
const applyAge=a=>{document.querySelectorAll("[data-ages]").forEach(el=>el.classList.toggle("hid",a!=="all"&&!el.dataset.ages.split(" ").includes(a)));document.querySelectorAll(".chips button[data-age]").forEach(x=>x.classList.toggle("on",x.dataset.age===a))};
document.querySelectorAll(".plan .chips button[data-age]").forEach(b=>b.addEventListener("click",()=>applyAge(b.dataset.age)));
// find dit hold (forside)
const fin=document.getElementById("finder");if(fin){const T=JSON.parse(document.getElementById("teams-data").textContent);const CL=EN?"Audition":"Audition",TRY=EN?"Trial · level":"Prøvegange · niveau",TEAMS_W=EN?"teams":"hold",ALLSTYLES=EN?"All styles":"Alle stilarter";
const row=t=>`<a class="trow" href="${BASE}/${t.slug}/"><div class="pic" style="background-image:url(${t.img||artFor(t.slug)})"></div><div class="tx"><h4>${esc(t.title)}</h4><div class="m">${esc(t.years||"")}${t.level?" · "+esc(t.level):""}</div>${t.closed?`<span class="badge aud" title="${esc(t.note||"")}">${CL}</span>`:t.tryout?`<span class="badge try" title="${esc(t.note||"")}">${TRY}</span>`:""}</div><span class="go">›</span></a>`;
const LV=EN?{"Alle niveauer":"All levels","Begynder & let øvet":"Beginner & lightly experienced","Øvet":"Advanced","Øvet+":"Advanced+","Elite":"Elite"}:{};const byLevel=ts=>{const ls=[...new Set(ts.slice().sort((a,b)=>a.lvlRank-b.lvlRank).map(t=>t.lvl))];return ls.map(l=>`<div class="lh">${esc(LV[l]||l)}</div>${ts.filter(t=>t.lvl===l).map(row).join("")}`).join("")};const group=(list,el,single)=>{const cats=single?[single]:[...new Set(list.flatMap(t=>t.cats))];el.innerHTML=cats.map(c=>{const ts=list.filter(t=>t.cats.includes(c));return `<div class="sh"><h3>${esc(c)}</h3><span class="tiny">${ts.length} ${TEAMS_W}</span></div>${byLevel(ts)}`}).join("")||`<p class="muted">${EN?"No teams match – try another age.":"Ingen hold matcher – prøv en anden alder."}</p>`};
const st=document.getElementById("style-teams");document.querySelectorAll(".scard").forEach(b=>b.addEventListener("click",()=>{const on=b.classList.contains("on");document.querySelectorAll(".scard").forEach(x=>x.classList.remove("on"));if(on){st.innerHTML="";return}b.classList.add("on");group(T.filter(t=>t.cats.includes(b.dataset.cat)),st,b.dataset.cat);st.scrollIntoView({behavior:"smooth",block:"nearest"})}));
const at=document.getElementById("age-teams");let curAge="all";const renderAge=a=>{curAge=a;group(T.filter(t=>a==="all"||t.ages.includes(a)),at)};renderAge("all");
q("public_teams").then(rows=>{if(!rows.length)return;for(const t of T){const r=rows.find(x=>x.name===t.db);if(!r)continue;t.closed=r.admission==="audition";t.tryout=r.admission==="tryout";t.note=r.admission_note||"";t.signupOpen=r.signup_open!==false}renderAge(curAge);const on=document.querySelector(".scard.on");if(on)group(T.filter(t=>t.cats.includes(on.dataset.cat)),st,on.dataset.cat)});
document.querySelectorAll("#mode-age .chips button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("#mode-age .chips button").forEach(x=>x.classList.toggle("on",x===b));renderAge(b.dataset.age)}));
document.querySelectorAll("#finder .seg button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("#finder .seg button").forEach(x=>x.classList.toggle("on",x===b));document.getElementById("mode-styles").hidden=b.dataset.mode!=="styles";document.getElementById("mode-age").hidden=b.dataset.mode!=="age"}))}
// sticky cta
if(document.querySelector(".stickycta a"))document.body.classList.add("hasstk");
// live data
(async()=>{const[school]=await q("school",`&slug=eq.${SLUG}`);const f=school?`&school_id=eq.${school.id}`:"";
const eEl=document.getElementById("events");if(eEl){const ev=await q("public_events",f+"&order=starts_at");const CM2=%(catmap)s;const evImg=e=>{const k=e.image_key||"";if(/^https?:/.test(k))return k;if(CM2[k])return `${BASE}/app/art/catalog/${CM2[k]}`;let h=0;for(const c of e.id)h=(h*31+c.charCodeAt(0))>>>0;return `${BASE}/art/${[1,3,4,5,2][h%%5]}.jpg`};const when=e=>{const d=new Date(e.starts_at),t=d.getHours()||d.getMinutes()?` · ${String(d.getHours()).padStart(2,"0")}.${String(d.getMinutes()).padStart(2,"0")}`:"";return `${DOW[d.getDay()]} ${d.getDate()}. ${MON[d.getMonth()]}${t}`};const meta=e=>[L.kinds[e.kind]||"",e.place?esc(e.place):"",e.price_dkk?e.price_dkk+" kr.":(EN?"Free":"Gratis"),e.signup_deadline?(EN?"Sign up by ":"Tilmelding senest ")+new Date(e.signup_deadline).getDate()+". "+MON[new Date(e.signup_deadline).getMonth()]:""].filter(Boolean).join(" · ");
window.__EV=ev;window.__evImg=evImg;window.__evWhen=when;window.__evMeta=meta;const today=new Date().toISOString().slice(0,10);
const canWeb=e=>e.web_signup&&new Date(e.starts_at)>new Date()&&(!e.signup_deadline||e.signup_deadline>=today);const full=e=>e.spots_left===0;
const evBtn=e=>canWeb(e)?(full(e)?`<span class="btn ghost" aria-disabled="true">${EN?"Fully booked":"Fuldt booket"}</span>`:`<a class="btn" href="#" data-evsign="${e.id}">${EN?"Sign up":"Tilmeld"} ${ICON}</a>`):`<a class="btn" href="${BASE}/app/">${EN?"Sign up in the app":"Tilmeld i appen"} ${ICON}</a>`;
// boosted events: big, right under the hero
const bEl=document.getElementById("boost");const feat=ev.filter(e=>e.featured&&(!e.featured_until||e.featured_until>=today));if(bEl&&feat.length){bEl.closest("section").hidden=false;bEl.innerHTML=feat.map(e=>`<article class="boost"><div class="boost-pic" style="background-image:url(${evImg(e)})"></div><div class="boost-in"><div class="eyebrow">${when(e)}${e.place?" · "+esc(e.place):""}</div><h2>${esc(e.title)}</h2><div class="tiny">${meta(e)}${e.spots_left!=null&&e.spots_left>0&&e.spots_left<=5?` · ${EN?"only":"kun"} ${e.spots_left} ${EN?"spots left":"pladser tilbage"}`:""}</div>${e.info?`<p class="small muted">${esc(e.info.length>240?e.info.slice(0,240)+"…":e.info)}</p>`:""}<div class="btns">${evBtn(e)}<a class="btn ghost" href="#" data-evinfo="${e.id}">${EN?"Read more":"Læs mere"}</a></div></div></article>`).join("");if(feat.length>1){bEl.classList.add("multi");const dots=document.createElement("div");dots.className="boostdots";dots.innerHTML=feat.map((_,i)=>`<button type="button" aria-label="${i+1}"${i?"":' class="on"'}></button>`).join("");bEl.after(dots);const cards=[...bEl.children],db=[...dots.children];let cur=0,hold=0;const go=i=>{cur=(i+cards.length)%%cards.length;bEl.scrollTo({left:cards[cur].offsetLeft-(bEl.clientWidth-cards[cur].clientWidth)/2,behavior:"smooth"})};db.forEach((d,i)=>d.onclick=()=>{hold=Date.now();go(i)});bEl.addEventListener("scroll",()=>{const mid=bEl.scrollLeft+bEl.clientWidth/2;let b=0,bd=1e9;cards.forEach((c,i)=>{const d=Math.abs(c.offsetLeft+c.clientWidth/2-mid);if(d<bd){bd=d;b=i}});cur=b;db.forEach((d,i)=>d.classList.toggle("on",i===b))},{passive:true});["pointerdown","touchstart","wheel"].forEach(n=>bEl.addEventListener(n,()=>{hold=Date.now()},{passive:true}));setInterval(()=>{if(Date.now()-hold>12000&&!document.querySelector(".wm.open,.wm[open]")&&!document.hidden)go(cur+1)},7000)}}
eEl.innerHTML=ev.length?ev.map((e,i)=>i===0?`<div class="evnext" style="background-image:url(${evImg(e)})"><div class="evnext-in"><div class="eyebrow">${EN?"Next up":"Næste"} · ${when(e)}</div><h3>${esc(e.title)}</h3><div class="tiny">${meta(e)}</div>${e.team_names?.length?`<div class="tiny" style="margin-top:4px">${esc(e.team_names.join(" · "))}</div>`:""}<div class="btns" style="margin-top:12px">${evBtn(e)}<a class="btn ghost" href="#" data-evinfo="${e.id}">${EN?"Read more":"Læs mere"}</a></div></div></div>`:`<div class="card event" data-evinfo="${e.id}" style="cursor:pointer;background-image:url(${evImg(e)})"><div class="date">${new Date(e.starts_at).getDate()}<small>${MON[new Date(e.starts_at).getMonth()]}</small></div><div><h3>${esc(e.title)}</h3><div class="tiny">${meta(e)}</div></div></div>`).join(""):`<p class="empty">${L.noEvents}</p>`}
const nEl=document.getElementById("news");if(nEl){const ps=await q("public_posts",f+"&order=created_at.desc&limit=3");if(ps.length)nEl.innerHTML=ps.map(p=>{const d=new Date(p.created_at);return`<div class="post"><div class="tiny">${d.getDate()}. ${MON[d.getMonth()]} ${d.getFullYear()}</div>${esc(p.body)}</div>`}).join("");else nEl.closest("section")?.remove()}
// live week calendar (holdplan): sessions from the app for the chosen week; cancelled → AFLYST, off the usual slot → FLYTTET; static plan is the fallback
const wc=document.getElementById("weekcal");if(wc){const T0=+wc.dataset.t0,PX=+wc.dataset.px,DAYS=EN?["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"].slice(0,JSON.parse(wc.dataset.days).length):JSON.parse(wc.dataset.days),ROOMS=JSON.parse(wc.dataset.rooms),STATIC=JSON.parse(wc.dataset.static),TEAMS=JSON.parse(wc.dataset.teams);
const norm=x=>(x||"").toLowerCase().replace(/[^a-z0-9æøå]/g,"");const slugFor=name=>{const n=norm(name);let hit=STATIC.find(c=>c.slug&&norm(c.name)===n)||STATIC.find(c=>c.slug&&(norm(c.name).includes(n)||n.includes(norm(c.name))));if(hit)return hit.slug;const t=TEAMS.find(t=>norm(t.title)===n)||TEAMS.find(t=>norm(t.title).includes(n)||n.includes(norm(t.title)));return t?t.slug:null};
const mins=iso=>{const d=new Date(iso);return d.getHours()*60+d.getMinutes()};const dow=iso=>(new Date(iso).getDay()+6)%%7;
const monday=o=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%%7)+o*7);return d};const fmtD=d=>`${d.getDate()}. ${MON[d.getMonth()]}`;
let off=0,room="all",lastRows=null,lastMon=null;const staticHTML=wc.innerHTML;const lbl=document.getElementById("wklabel");const T1S=T0+Math.round(parseFloat(wc.querySelector(".lanes").style.height)/PX);
// overlapping blocks (same room or both rooms) share the day column side by side
const pack=items=>{const s=[...items].sort((x,y)=>mins(x.starts_at)-mins(y.starts_at)||mins(x.ends_at)-mins(y.ends_at));const out=[];let cl=[],ends=[],cend=-1;const flush=()=>{const n=ends.length||1;for(const c of cl)c.cols=n;out.push(...cl);cl=[];ends=[];cend=-1};
for(const it of s){const a=mins(it.starts_at),b=mins(it.ends_at);if(cl.length&&a>=cend)flush();let col=ends.findIndex(e=>e<=a);if(col<0){col=ends.length;ends.push(b)}else ends[col]=b;cl.push({it,col,cols:1});cend=Math.max(cend,b)}flush();return out};
const render=(sessions,mon)=>{lastRows=sessions;lastMon=mon;const sun=new Date(mon);sun.setDate(sun.getDate()+6);lbl.textContent=`${EN?"Week":"Uge"} ${isoWeek(mon)} · ${fmtD(mon)}–${fmtD(sun)}`;
const vis=room==="all"?sessions:sessions.filter(s=>ROOMS.indexOf(s.room)===+room);
// the regular (weekly) trainings decide the time axis; one-offs outside it (camps, Saturday mornings) are listed above the grid instead of stretching it
const reg=vis.filter(s=>s.weekly_rule_id);const t0=Math.min(T0,...reg.map(s=>Math.floor(mins(s.starts_at)/60)*60)),t1=Math.max(T1S,...reg.map(s=>Math.ceil(mins(s.ends_at)/60)*60));const H=(t1-t0)*PX;
const inside=s=>mins(s.starts_at)>=t0&&mins(s.ends_at)<=t1;const extras=vis.filter(s=>!inside(s));const grid=vis.filter(inside);
let ex=document.getElementById("wkextras");if(!ex){ex=document.createElement("div");ex.id="wkextras";ex.className="wkextras";wc.parentNode.insertBefore(ex,wc)}
ex.innerHTML=extras.length?`<span class="lbl">${EN?"Also this week":"Også denne uge"}</span>`+extras.map(s=>{const d=new Date(s.starts_at);const slug=slugFor(s.name);const txt=`<span class="d">${DOW[d.getDay()]} ${d.getDate()}.</span> ${hm(s.starts_at)}–${hm(s.ends_at)} <b>${esc(s.name)}</b> <span class="rm">${esc(s.room||"")}</span>${s.cancelled?` <span class="tag cx">${EN?"Cancelled":"Aflyst"}</span>`:""}`;return slug&&!s.cancelled?`<a class="x" href="${BASE}/${slug}/">${txt}</a>`:`<span class="x">${txt}</span>`}).join(""):"";
const byDay=[0,1,2,3,4,5,6].map(i=>grid.filter(s=>dow(s.starts_at)===i));const showDays=[0,1,2,3].concat([4,5,6].filter(i=>byDay[i].length));
const hrs=[];for(let h=t0/60;h<=t1/60;h++)hrs.push(h);const axisHTML=`<div class="axis"><div class="dh">&nbsp;</div><div class="lanes" style="height:${H}px">${hrs.map(h=>`<div class="hr" style="top:${((h*60-t0)*PX).toFixed(0)}px"><span>${String(h).padStart(2,"0")}:00</span></div>`).join("")}</div></div>`;
wc.style.setProperty("--ncols",showDays.length);
wc.innerHTML=axisHTML+showDays.map(i=>{const list=byDay[i];const d=new Date(mon);d.setDate(d.getDate()+i);
// rooms keep their side (Store Sal left, Lille Sal right) only while both rooms are busy; same-room overlaps split that space further
const laneOf=s=>Math.max(0,ROOMS.indexOf(s.room));const placed=[];for(const ln of [0,1]){const mine=list.filter(s=>laneOf(s)===ln);for(const {it:s,col,cols} of pack(mine)){const a=mins(s.starts_at),b=mins(s.ends_at);const clash=room==="all"&&list.some(o=>laneOf(o)!==ln&&mins(o.starts_at)<b&&mins(o.ends_at)>a);const base=clash?ln*50:0,span=clash?50:100;placed.push({s,x:base+span*col/cols,w:span/cols,narrow:clash||cols>1})}}
const blocks=placed.map(({s,x,w,narrow})=>{const a=mins(s.starts_at),b=mins(s.ends_at);const top=(a-t0)*PX,h=Math.max(34,(b-a)*PX-4);const lane=laneOf(s);
const moved=!!s.moved;const slug=slugFor(s.name);const inner=`<span class="tm">${hm(s.starts_at)}–${hm(s.ends_at)}</span><b>${esc(s.name)}</b><span class="rm">${esc(s.room||"")}</span>${s.cancelled?`<span class="tag cx">${EN?"Cancelled":"Aflyst"}</span>`:moved?`<span class="tag mv">${EN?"Moved":"Flyttet"}</span>`:""}`;
const cls=`blk l${lane}${narrow?" narrow":""}${s.cancelled?" cx":""}${moved&&!s.cancelled?" mv":""}`;const st=`style="top:${top.toFixed(0)}px;height:${h.toFixed(0)}px;left:calc(${x.toFixed(3)}%% + ${x>0?2:0}px);width:calc(${w.toFixed(3)}%% - ${w<100?2:0}px)"`;return slug&&!s.cancelled?`<a class="${cls}" href="${BASE}/${slug}/" ${st} title="${esc(s.name)}">${inner}</a>`:`<div class="${cls} na" ${st}>${inner}</div>`}).join("");
return `<div class="col${list.length?"":" empty"}"><div class="dh">${DAYS[i]||DOW[(i+1)%%7]} <small class="tiny muted">${d.getDate()}.</small></div><div class="lanes" style="height:${H}px">${hrs.map(h=>`<div class="hr" style="top:${((h*60-t0)*PX).toFixed(0)}px"></div>`).join("")}${blocks}</div></div>`}).join("");wc.dataset.room=room};
const isoWeek=d=>{const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const n=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-n);const y=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil(((x-y)/864e5+1)/7)};
const load=async()=>{const mon=monday(off),end=new Date(mon);end.setDate(end.getDate()+7);let rows=null;try{const r=await fetch(`${SB}/rest/v1/public_schedule?select=*${f}&starts_at=gte.${mon.toISOString()}&starts_at=lt.${end.toISOString()}&order=starts_at`,{headers:{apikey:KEY}});if(r.ok)rows=await r.json()}catch{}
document.querySelectorAll("#weeknav .wk.today").forEach(b=>b.classList.toggle("on",off===0));if(rows&&rows.length)render(rows,mon);else if(!rows||off===0){lastRows=null;const ex0=document.getElementById("wkextras");if(ex0)ex0.innerHTML="";wc.innerHTML=staticHTML;wc.style.removeProperty("--ncols");wc.dataset.room=room;lbl.textContent=(EN?"Season plan":"Sæsonplan")+(rows?"":EN?" · offline":" · offline")}else render([],mon)};
document.querySelectorAll("#weeknav .wk").forEach(b=>b.addEventListener("click",()=>{const k=+b.dataset.wk;off=k===0?0:off+k;load()}));
document.querySelectorAll("#roomchips button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("#roomchips button").forEach(x=>x.classList.toggle("on",x===b));room=b.dataset.room;wc.dataset.room=room;if(lastRows)render(lastRows,lastMon)}));
load()}
})();

// ---- sign up for a team / buy in the shop without the app (anon RPCs → MobilePay with a reference; Line confirms in Admin)
const W=EN?{signup:"Sign up for",who:"Who is dancing?",child:"My child",self:"Myself",dancerFirst:"Dancer's first name",dancerLast:"Dancer's last name",birth:"Date of birth",contact:"Contact (parent)",contactSelf:"Your details",first:"First name",last:"Last name",email:"E-mail",phone:"Phone",plan:"Payment",full:"Full season",half:"Half season",rates:"Instalments",r2:"2 instalments",r4:"4 instalments",r10:"10 instalments",feeNote:"Instalments: 50 kr. per instalment – one fee per instalment, however many teams.",firstRate:"1st instalment",ofN:"of",rateInfo:"The remaining instalments follow – you get a reminder.",noPrice:"This team is signed up without a season fee:",note:"Anything we should know? (optional)",send:"Sign up",sending:"Sending…",thanks:"Registration received – pay to confirm",pend:"You are not signed up until the payment is confirmed. Then you get a confirmation by e-mail.",payHow:"Pay with Vipps MobilePay to",ref:"Write this as reference",ratesText:"The studio contacts you about instalments – nothing to pay right now.",paid:"I have paid",paidOk:"Thanks! The payment is confirmed and the sign-up approved – you'll hear from us.",openMp:"Open Vipps MobilePay",scanQr:"On a computer? Scan the code with your phone – Vipps MobilePay opens with amount and reference filled in.",reqTo:"Or the studio sends a payment request to",noPhone:"your number",buy:"Buy",size:"Size",qty:"Quantity",name:"Name",order:"Order",orderOk:"Order #{n} – now pay",pickup:"The order is final once the payment is confirmed – then you get a receipt, and the items can be collected in the studio at the next training.",err:"Something went wrong – try again or write to",errTeam:"Could not find the team.",errMail:"Check the e-mail address.",errMany:"Too many sign-ups from this e-mail today.",close:"Close",aud:"Apply for audition",audOpen:"Apply for audition",audThanks:"Thanks – you're on the list",audBody:"The studio approves your profile, and you get the requirements, video and date by e-mail and in the app before the audition. Log in to the app with the same e-mail – everything is on your home screen.",audWhen:"Audition",audFree:"Applying is free. Nothing is paid until you are selected.",audClosed:"Audition sign-up opens later",errMember:"Already on this team."}:{signup:"Tilmeld",who:"Hvem skal danse?",child:"Mit barn",self:"Mig selv",dancerFirst:"Danserens fornavn",dancerLast:"Danserens efternavn",birth:"Fødselsdato",contact:"Kontakt (forælder)",contactSelf:"Dine oplysninger",first:"Fornavn",last:"Efternavn",email:"E-mail",phone:"Telefon",plan:"Betaling",full:"Hel sæson",half:"Halv sæson",rates:"Rater",r2:"2 rater",r4:"4 rater",r10:"10 rater",feeNote:"Ratebetaling: 50 kr. pr. rate – kun ét gebyr pr. rate, uanset hvor mange hold.",firstRate:"1. rate",ofN:"af",rateInfo:"Herefter betales de resterende rater løbende – du får besked.",noPrice:"Dette hold tilmeldes uden sæsonbetaling:",note:"Noget vi skal vide? (valgfrit)",send:"Tilmeld",sending:"Sender…",thanks:"Registrering modtaget – betal for at tilmelde",pend:"Du er først tilmeldt, når betalingen er bekræftet. Så får du en bekræftelse på mail.",payHow:"Betal med Vipps MobilePay til",ref:"Skriv dette i beskeden",ratesText:"Danseskolen kontakter dig om rater – du skal ikke betale noget nu.",paid:"Jeg har betalt",paidOk:"Tak! Betalingen bekræftes og tilmeldingen godkendes – du hører fra os.",openMp:"Åbn Vipps MobilePay",scanQr:"Sidder du ved computeren? Scan koden med din telefon – Vipps MobilePay åbner med beløb og besked udfyldt.",reqTo:"Ellers sender danseskolen en betalingsanmodning til",noPhone:"dit nummer",buy:"Køb",size:"Størrelse",qty:"Antal",name:"Navn",order:"Bestil",orderOk:"Ordre #{n} – betal nu",pickup:"Ordren er først gældende, når betalingen er bekræftet – så får du en kvittering, og varerne kan hentes i studiet ved næste træning.",err:"Noget gik galt – prøv igen eller skriv til",errTeam:"Kunne ikke finde holdet.",errMail:"Tjek e-mailadressen.",errMany:"For mange tilmeldinger fra denne e-mail i dag.",close:"Luk",aud:"Meld til audition",audOpen:"Meld til audition",audThanks:"Tak – du er skrevet op",audBody:"Danseskolen godkender profilen, og du får krav, video og dato på mail og i appen inden auditionen. Log ind i appen med samme e-mail – så ligger alt på forsiden.",audWhen:"Audition",audFree:"Det er gratis at melde sig. Der betales først, hvis man bliver udtaget.",audClosed:"Tilmelding til audition åbner senere",errMember:"Er allerede på holdet."};
const rpc=async(fn,body)=>{const r=await fetch(`${SB}/rest/v1/rpc/${fn}`,{method:"POST",headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,"Content-Type":"application/json"},body:JSON.stringify(body)});const j=await r.json().catch(()=>null);if(!r.ok)throw new Error((j&&(j.message||j.hint))||r.statusText);return j};
const amountsOf=p=>(p||"").match(/([0-9][0-9.]*) kr/g)?.map(x=>parseInt(x.replace(/\D/g,""),10))||[];
const kr=n=>n.toLocaleString("da-DK")+" kr.";
let wm=document.querySelector(".wm");if(!wm){wm=document.createElement("div");wm.className="wm";wm.innerHTML='<div class="box"><div class="grab"><div class="handle"></div></div><button class="xclose" aria-label="Luk">\u00d7</button><div class="inner"></div></div>';document.body.appendChild(wm);
  const box=wm.querySelector(".box");const closeIt=()=>{wm.classList.remove("open");box.style.transform=""};wm.addEventListener("click",e=>{if(e.target===wm)closeIt()});wm.querySelector(".xclose").addEventListener("click",closeIt);document.addEventListener("keydown",e=>{if(e.key==="Escape")closeIt()});
  // swipe the handle down to close
  let y0=null;const grab=wm.querySelector(".grab");grab.addEventListener("touchstart",e=>{y0=e.touches[0].clientY},{passive:true});grab.addEventListener("touchmove",e=>{if(y0==null)return;const d=Math.max(0,e.touches[0].clientY-y0);box.style.transform="translateY("+d+"px)"},{passive:true});grab.addEventListener("touchend",e=>{const d=(e.changedTouches[0].clientY-(y0||0));y0=null;if(d>90)closeIt();else box.style.transform=""})}
const box=wm.querySelector(".box"),inner=wm.querySelector(".inner");const openWm=h=>{inner.innerHTML=h;wm.classList.add("open");box.style.transform="";box.scrollTop=0};
const MOBILE=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const payView=(title,amount,ref,mp,phone,extra="",eyebrow=W.thanks,disc=null)=>{const link=amount?`mobilepay://send?phone=${mp}&amount=${amount}&comment=${encodeURIComponent(ref)}`:null;openWm(`<div class="pay"><div class="eyebrow">${eyebrow}</div><h3>${esc(title)}</h3>${amount?`<div class="tiny">${W.payHow} <b>${mp}</b></div><div class="amt">${kr(amount)}</div>${disc&&disc.pct?`<div class="tiny" style="color:var(--gold2)">${EN?"Family discount":"Familierabat"} ${disc.pct} %% · ${EN?"before":"før"} ${kr(disc.before)}</div>`:""}<div class="tiny">${W.ref}</div><div class="ref">${esc(ref)}</div>${MOBILE?`<a class="btn" href="${link}">${W.openMp}</a>`:`<div class="qr" id="wm-qr"></div><p class="tiny">${W.scanQr}</p><p class="tiny">${W.reqTo} <b>${esc(phone||W.noPhone)}</b>.</p>`}`:`<p class="muted">${W.ratesText}</p>`}<p class="tiny" style="margin-top:14px">${extra}</p></div>`);const qe=box.querySelector("#wm-qr");if(qe&&link){try{const qr=qrcode(0,"M");qr.addData(link);qr.make();qe.innerHTML=qr.createSvgTag({cellSize:4,margin:0,scalable:true})}catch{qe.remove()}}};
// team sign-up
const PT=q("public_teams");const OPEN=fetch(`${SB}/rest/v1/rpc/signups_open`,{method:"POST",headers:{apikey:KEY,"Content-Type":"application/json"},body:JSON.stringify({p_school_slug:SLUG})}).then(r=>r.ok?r.json():true).catch(()=>true);
Promise.all([PT,OPEN]).then(([rows,open])=>{document.querySelectorAll("[data-signup]").forEach(el=>{const pt=rows.find(x=>x.name===el.dataset.signup);const aud=pt&&pt.admission==="audition";const closed=open===false||(pt&&pt.signup_open===false)||(aud&&!pt.audition_open);if(closed){const n=document.createElement("span");n.className="btn ghost";n.style.cssText="opacity:.7;cursor:default";n.textContent=aud?W.audClosed:(EN?"Sign-up opens later":"Tilmelding åbner senere");el.replaceWith(n)}else if(aud){el.dataset.aud="1";el.innerHTML="★ "+W.aud+" "+ICON}})});
document.querySelectorAll("[data-signup]").forEach(el=>el.addEventListener("click",async e=>{e.preventDefault();const team=el.dataset.signup;const rows=await PT;const pt=rows.find(x=>x.name===team)||{};const am=pt.price_full?[pt.price_signup||pt.price_full,pt.price_half].filter(Boolean):amountsOf(el.dataset.price);const canRates=pt.installments_allowed!==false&&am.length;const base=am[0];const perRate=(n,b)=>Math.ceil((b+50*n)/n);let self=false,plan=am.length?"full":"none";
const AUD=pt.admission==="audition";
const render=()=>{openWm(`<div class="eyebrow">${AUD?W.aud:W.signup}</div><h3>${esc(team)}</h3>${AUD?`<p class="tiny" style="margin:-6px 0 10px">${W.audFree}</p>`:""}<form id="wm-f"><div class="eyebrow" style="margin-bottom:6px">${W.who}</div><div class="seg"><button type="button" data-w="child" class="${self?"":"on"}">${W.child}</button><button type="button" data-w="self" class="${self?"on":""}">${W.self}</button></div>
${self?"":`<div class="two" style="margin-top:12px"><label>${W.dancerFirst}<input name="df" required></label><label>${W.dancerLast}<input name="dl"></label></div>`}<label style="margin-top:${self?12:0}px">${W.birth}<input name="bd" type="date" required></label>
<div class="eyebrow" style="margin:6px 0">${self?W.contactSelf:W.contact}</div><div class="two"><label>${W.first}<input name="cf" required></label><label>${W.last}<input name="cl" required></label></div><div class="two"><label>${W.email}<input name="em" type="email" required></label><label>${W.phone}<input name="ph" type="tel" ${MOBILE?"":"required"}></label></div>
${AUD?"":am.length?`<div class="eyebrow" style="margin:6px 0">${W.plan}</div><div class="seg"><button type="button" data-p="full" class="${plan==="full"?"on":""}">${W.full} · ${kr(am[0])}</button>${pt.price_half?`<button type="button" data-p="half" class="${plan==="half"?"on":""}">${W.half} · ${kr(pt.price_half)}</button>`:""}${canRates?`<button type="button" data-p="rates2" class="${plan==="rates2"?"on":""}">${W.r2} · 2 × ${kr(perRate(2,base))}</button><button type="button" data-p="rates4" class="${plan==="rates4"?"on":""}">${W.r4} · 4 × ${kr(perRate(4,base))}</button><button type="button" data-p="rates10" class="${plan==="rates10"?"on":""}">${W.r10} · 10 × ${kr(perRate(10,base))}</button>`:""}</div>${pt.price_note?`<p class="tiny" style="margin:8px 0 0">${esc(pt.price_note)}</p>`:""}${canRates?`<p class="tiny" style="margin:6px 0 0">${W.feeNote}</p>`:""}`:`<p class="muted small" style="margin:8px 0 0">${W.noPrice} ${esc(pt.price_note||"")}</p>`}
<label style="margin-top:12px">${W.note}<textarea name="nt" rows="2"></textarea></label><div class="err" id="wm-err"></div><button class="btn" type="submit">${AUD?W.aud:W.send} ${ICON}</button></form>`);
box.querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>{self=b.dataset.w==="self";render()});box.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{plan=b.dataset.p;box.querySelectorAll("[data-p]").forEach(x=>x.classList.toggle("on",x===b))});
box.querySelector("#wm-f").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),g=k=>(f.get(k)||"").toString().trim(),btn=ev.target.querySelector("[type=submit]"),err=box.querySelector("#wm-err");btn.disabled=true;btn.textContent=W.sending;err.textContent="";
try{if(AUD){const r=await rpc("web_audition",{p_school_slug:SLUG,p_team_name:team,p_dancer_first:self?g("cf"):g("df"),p_dancer_last:self?g("cl"):g("dl"),p_birth_date:g("bd"),p_contact_first:g("cf"),p_contact_last:g("cl"),p_email:g("em"),p_phone:g("ph"),p_self:self,p_note:g("nt")});openWm(`<div class="pay"><div class="eyebrow">${W.audThanks}</div><h3>${esc(r.team)} · ${esc(self?g("cf"):g("df"))}</h3>${r.audition_at?`<div class="tiny">${W.audWhen}</div><div class="ref">${esc(r.audition_at)}</div>`:""}<p class="muted" style="margin-top:12px">${W.audBody}</p><a class="btn" style="margin-top:14px" href="${BASE}/app/">Backstage ${ICON}</a></div>`);return}
const r=await rpc("web_signup",{p_school_slug:SLUG,p_team_name:team,p_dancer_first:self?g("cf"):g("df"),p_dancer_last:self?g("cl"):g("dl"),p_birth_date:g("bd"),p_contact_first:g("cf"),p_contact_last:g("cl"),p_email:g("em"),p_phone:g("ph"),p_self:self,p_plan:plan,p_note:g("nt")});
const multi=(r.installments||1)>1;payView(`${r.team} · ${self?g("cf"):g("df")}${multi?` · ${W.firstRate} ${W.ofN} ${r.installments}`:""}`,multi?r.per_rate_dkk:r.amount_dkk,multi?`${r.reference} rate 1/${r.installments}`:r.reference,r.mobilepay,g("ph"),(r.amount_dkk?W.pend+" ":"")+(multi?W.rateInfo+" ":"")+(r.note&&!r.amount_dkk?esc(r.note)+" ":"")+(EN?"Want trainings, messages and the team's photos on your phone? <a href='"+BASE+"/app/'>Get the app</a> – log in with the same e-mail.":"Vil du have træninger, beskeder og holdets billeder på telefonen? <a href='"+BASE+"/app/'>Hent appen</a> – log ind med samme e-mail."),W.thanks,{pct:r.discount_pct,before:r.amount_before_dkk})}
catch(x){const m=String(x.message||"");err.textContent=m.includes("already member")?W.errMember:m.includes("closed")?W.audClosed:m.includes("team")?W.errTeam:m.includes("email")?W.errMail:m.includes("too many")?W.errMany:W.err+" "+SUPPORT;btn.disabled=false;btn.innerHTML=W.send+" "+ICON}}};render()}));
// events: details + sign-up straight from the website (for events Line has opened: "Åben for tilmelding fra websitet").
// A website sign-up is a participant on that one event – not a user. Payment = MobilePay with reference, like everything else.
{const V=EN?{signup:"Sign up",who:"Who is taking part?",child:"My child",self:"Myself",pf:"Participant's first name",pl:"Last name",bd:"Birth date",contact:"Your contact details",contactSelf:"Your details",first:"First name",last:"Last name",email:"E-mail",phone:"Phone",note:"Anything we should know?",send:"Sign up",sending:"Sending…",meet:"Meet at",plan:"Programme",pack:"Bring",price:"Price",free:"Free",deadline:"Sign up by",thanks:"You are signed up",reg:"Registration received – pay to confirm",freeBody:"We look forward to seeing you. A confirmation is on its way by e-mail.",payExtra:"Thank you for registering. You are signed up once the payment is confirmed – then you get a confirmation by e-mail.",full:"The event is fully booked.",closed:"Sign-up has closed.",already:"This participant is already signed up with that e-mail.",errMail:"Check the e-mail address.",err:"Something went wrong. Write to",inApp:"Sign up in the app"}:{signup:"Tilmelding",who:"Hvem deltager?",child:"Mit barn",self:"Mig selv",pf:"Deltagerens fornavn",pl:"Efternavn",bd:"Fødselsdato",contact:"Dine kontaktoplysninger",contactSelf:"Dine oplysninger",first:"Fornavn",last:"Efternavn",email:"E-mail",phone:"Telefon",note:"Andet vi bør vide?",send:"Tilmeld",sending:"Sender…",meet:"Mødetid",plan:"Program",pack:"Husk",price:"Pris",free:"Gratis",deadline:"Tilmelding senest",thanks:"Du er tilmeldt",reg:"Registrering modtaget – betal for at tilmelde",freeBody:"Vi glæder os til at se jer. Du får en bekræftelse på mail.",payExtra:"Tak for din registrering. Du er først tilmeldt, når betalingen er bekræftet – så får du en bekræftelse på mail.",full:"Eventet er fuldt booket.",closed:"Tilmeldingen er lukket.",already:"Deltageren er allerede tilmeldt med den e-mail.",errMail:"Tjek e-mailadressen.",err:"Noget gik galt. Skriv til",inApp:"Tilmeld i appen"};
const today=()=>new Date().toISOString().slice(0,10);const canWeb=e=>e.web_signup&&new Date(e.starts_at)>new Date()&&(!e.signup_deadline||e.signup_deadline>=today())&&e.spots_left!==0;
const evInfo=e=>{const plan=(e.plan||[]).map(p=>`<li>${p.time?`<b>${esc(p.time)}</b> `:""}${esc(p.text)}</li>`).join("");const pack=(e.pack_list||[]).map(x=>`<li>${esc(x)}</li>`).join("");const dl=e.signup_deadline?new Date(e.signup_deadline):null;
openWm(`<div class="evpic" style="background-image:url(${window.__evImg(e)})"></div><div class="eyebrow">${window.__evWhen(e)}${e.place?" · "+esc(e.place):""}</div><h3>${esc(e.title)}</h3><div class="tiny" style="margin:-4px 0 10px">${[e.meet_time?V.meet+" "+esc(e.meet_time):"",V.price+": "+(e.price_dkk?kr(e.price_dkk):V.free),dl?V.deadline+" "+dl.getDate()+". "+MON[dl.getMonth()]:""].filter(Boolean).join(" · ")}</div>${e.info?`<p class="small" style="white-space:pre-line">${esc(e.info)}</p>`:""}${plan?`<div class="eyebrow" style="margin:12px 0 4px">${V.plan}</div><ul class="small evul">${plan}</ul>`:""}${pack?`<div class="eyebrow" style="margin:12px 0 4px">${V.pack}</div><ul class="small evul">${pack}</ul>`:""}<div style="margin-top:16px">${canWeb(e)?`<a class="btn" href="#" data-evsign="${e.id}">${V.send} ${ICON}</a>`:e.spots_left===0?`<p class="tiny">${V.full}</p>`:`<a class="btn" href="${BASE}/app/">${V.inApp} ${ICON}</a>`}</div>`)};
const evSign=e=>{let self=false;const render=()=>{openWm(`<div class="eyebrow">${V.signup}</div><h3>${esc(e.title)}</h3><div class="tiny" style="margin:-4px 0 10px">${window.__evWhen(e)} · ${e.price_dkk?kr(e.price_dkk):V.free}</div><form id="wm-e"><div class="eyebrow" style="margin-bottom:6px">${V.who}</div><div class="seg"><button type="button" data-w="child" class="${self?"":"on"}">${V.child}</button><button type="button" data-w="self" class="${self?"on":""}">${V.self}</button></div>
${self?"":`<div class="two" style="margin-top:12px"><label>${V.pf}<input name="df" required></label><label>${V.pl}<input name="dl"></label></div>`}<label style="margin-top:${self?12:0}px">${V.bd}<input name="bd" type="date"></label>
<div class="eyebrow" style="margin:6px 0">${self?V.contactSelf:V.contact}</div><div class="two"><label>${V.first}<input name="cf" required></label><label>${V.last}<input name="cl" required></label></div><div class="two"><label>${V.email}<input name="em" type="email" required></label><label>${V.phone}<input name="ph" type="tel" ${MOBILE||!e.price_dkk?"":"required"}></label></div>
<label style="margin-top:12px">${V.note}<textarea name="nt" rows="2"></textarea></label><div class="err" id="wm-err"></div><button class="btn" type="submit">${V.send} ${ICON}</button></form>`);
box.querySelectorAll("[data-w]").forEach(b=>b.onclick=()=>{self=b.dataset.w==="self";render()});
box.querySelector("#wm-e").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),g=k=>(f.get(k)||"").toString().trim(),btn=ev.target.querySelector("[type=submit]"),err=box.querySelector("#wm-err");btn.disabled=true;btn.textContent=V.sending;err.textContent="";const first=self?g("cf"):g("df");
try{const r=await rpc("web_event_signup",{p_school_slug:SLUG,p_event_id:e.id,p_first:first,p_last:self?g("cl"):(g("dl")||g("cl")),p_birth_date:g("bd")||null,p_contact_first:g("cf"),p_contact_last:g("cl"),p_email:g("em"),p_phone:g("ph"),p_note:g("nt")||null});
if(r.amount_dkk)payView(`${r.title} · ${first}`,r.amount_dkk,r.reference,r.mobilepay,g("ph"),V.payExtra,V.reg);else openWm(`<div class="pay"><div class="eyebrow">${V.thanks}</div><h3>${esc(r.title)} · ${esc(first)}</h3><p class="muted" style="margin-top:12px">${V.freeBody}</p></div>`)}
catch(x){const m=String(x.message||"");err.textContent=m.includes("full")?V.full:m.includes("closed")||m.includes("not open")?V.closed:m.includes("already")?V.already:m.includes("email")?V.errMail:V.err+" "+SUPPORT;btn.disabled=false;btn.innerHTML=V.send+" "+ICON}}};render()};
document.addEventListener("click",c=>{const a=c.target.closest("[data-evsign],[data-evinfo]");if(!a)return;const sign=c.target.closest("[data-evsign]");const id=sign?sign.dataset.evsign:a.dataset.evinfo;const e=(window.__EV||[]).find(x=>x.id===id);if(!e)return;c.preventDefault();sign?evSign(e):evInfo(e)})}
// backstage: apply for access (existing dancers/parents without a login)
document.querySelectorAll("[data-access]").forEach(el=>el.addEventListener("click",async e=>{e.preventDefault();const teams=(await q("public_teams","&order=name")).map(t=>t.name);let kids=[];const A=EN?{t:"Apply for access",sub:"For dancers and parents who are already part of LL Dance Studio. The school approves you and you get an e-mail.",first:"First name",last:"Last name",email:"E-mail",phone:"Phone",birth:"Your birth date",teams:"Your team(s) – if you dance yourself",kidsT:"I am a parent of",add:"+ Add child",kname:"Child's first name",kbirth:"Birth date",kteams:"Team(s)",note:"Anything else we should know?",send:"Send application",sending:"Sending…",young:"You are under 13 – please ask a parent to apply for access for both of you.",thanks:"Thank you – your application is in",body:"The school approves you, usually within a few days, and you get an e-mail. Then you log in to the app with your e-mail (a code is sent – no password).",errMail:"Check the e-mail address.",hasLogin:"That e-mail already has a login – just open the app and log in.",err:"Something went wrong. Write to"}:{t:"Ansøg om adgang",sub:"For dansere og forældre, der allerede er en del af LL Dance Studio. Danseskolen godkender dig, og du får en mail.",first:"Fornavn",last:"Efternavn",email:"E-mail",phone:"Telefon",birth:"Din fødselsdato",teams:"Dit/dine hold – hvis du selv danser",kidsT:"Jeg er forælder til",add:"+ Tilføj barn",kname:"Barnets fornavn",kbirth:"Fødselsdato",kteams:"Hold",note:"Andet vi bør vide?",send:"Send ansøgning",sending:"Sender…",young:"Du er under 13 – bed en forælder om at ansøge om adgang for jer begge.",thanks:"Tak – din ansøgning er modtaget",body:"Danseskolen godkender dig – typisk inden for et par dage – og du får en mail. Derefter logger du ind i appen med din e-mail (du får en kode på mail, ingen adgangskode).",errMail:"Tjek e-mailadressen.",hasLogin:"Den e-mail har allerede et login – åbn appen og log ind.",err:"Noget gik galt. Skriv til"};
const checks=(name)=>`<div class="tchecks">${teams.map(t=>`<label class="tcheck"><input type="checkbox" name="${name}" value="${esc(t)}"><span>${esc(t)}</span></label>`).join("")}</div>`;const kid=(k,i)=>`<div class="kid" data-k="${i}" style="border-top:1px solid rgba(255,255,255,.08);padding-top:10px;margin-top:10px"><div class="two"><label>${A.kname}<input name="kn${i}" value="${esc(k.n||"")}" required></label><label>${A.kbirth}<input name="kb${i}" type="date" value="${k.b||""}" required></label></div><div class="eyebrow" style="margin:6px 0 4px">${A.kteams}</div>${checks("kt"+i)}</div>`;
const render=()=>{openWm(`<div class="eyebrow">Backstage</div><h3>${A.t}</h3><p class="tiny" style="margin:-6px 0 10px">${A.sub}</p><form id="wm-a"><div class="two"><label>${A.first}<input name="fn" required></label><label>${A.last}<input name="ln" required></label></div><div class="two"><label>${A.email}<input name="em" type="email" required></label><label>${A.phone}<input name="ph" type="tel"></label></div><label>${A.birth}<input name="bd" type="date"></label><div class="eyebrow" style="margin:10px 0 4px">${A.teams}</div>${checks("tm")}<div class="eyebrow" style="margin:12px 0 0">${A.kidsT}</div><div id="kids">${kids.map(kid).join("")}</div><button type="button" class="btn ghost" id="addkid" style="margin-top:8px">${A.add}</button><label style="margin-top:12px">${A.note}<textarea name="nt" rows="2"></textarea></label><div class="err" id="wm-err"></div><button class="btn" type="submit">${A.send} ${ICON}</button></form>`);
box.querySelector("#addkid").onclick=()=>{kids.push({n:"",b:""});box.querySelector("#kids").insertAdjacentHTML("beforeend",kid(kids[kids.length-1],kids.length-1));box.querySelector(`[name=kn${kids.length-1}]`)?.focus()};
box.querySelector("#wm-a").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),g=k=>(f.get(k)||"").toString().trim(),sel=n=>f.getAll(n).map(String).join("; "),btn=ev.target.querySelector("[type=submit]"),err=box.querySelector("#wm-err");const children=kids.map((_,i)=>({first_name:g("kn"+i),birth_date:g("kb"+i),teams:sel("kt"+i)})).filter(k=>k.first_name);
const bd=g("bd");if(bd&&!children.length){const a=(Date.now()-new Date(bd).getTime())/31557600000;if(a<13){err.textContent=A.young;return}}
btn.disabled=true;btn.textContent=A.sending;err.textContent="";
try{await rpc("web_access_request",{p_school_slug:SLUG,p_first:g("fn"),p_last:g("ln"),p_email:g("em"),p_phone:g("ph"),p_birth_date:bd||null,p_teams:sel("tm")||null,p_children:children,p_note:g("nt")||null});openWm(`<div class="pay"><div class="eyebrow">${A.thanks}</div><h3>${esc(g("fn"))}</h3><p class="muted" style="margin-top:12px">${A.body}</p><a class="btn" style="margin-top:14px" href="${BASE}/app/">Backstage ${ICON}</a></div>`)}
catch(x){const m=String(x.message||"");err.textContent=m.includes("too young")?A.young:m.includes("has login")?A.hasLogin:m.includes("email")?A.errMail:A.err+" "+SUPPORT;btn.disabled=false;btn.innerHTML=A.send+" "+ICON}}};render()}));
// shop: buy a product
const buyBtns=document.querySelectorAll("[data-buy]");if(buyBtns.length){const prodsP=q("public_products");buyBtns.forEach(el=>el.addEventListener("click",async e=>{e.preventDefault();const prods=await prodsP;const pr=prods.find(x=>x.name===el.dataset.buy);if(!pr){openWm(`<p class="muted">${W.err} ${SUPPORT}</p>`);return}let qty=1,size=pr.sizes?.[0]||"";
openWm(`<div class="eyebrow">${W.buy}</div><h3>${esc(pr.name)}</h3><form id="wm-b">${pr.sizes?.length?`<div class="eyebrow" style="margin-bottom:6px">${W.size}</div><div class="seg">${pr.sizes.map(z=>`<button type="button" data-z="${esc(z)}" class="${z===size?"on":""}">${esc(z)}</button>`).join("")}</div>`:""}
<div class="eyebrow" style="margin:12px 0 6px">${W.qty}</div><div class="qty"><button type="button" id="wm-m">−</button><b id="wm-q">1</b><button type="button" id="wm-pl">+</button><span class="muted" style="margin-left:auto" id="wm-t">${kr(pr.price_dkk)}</span></div>
<div class="two" style="margin-top:12px"><label>${W.name}<input name="nm" required></label><label>${W.phone}<input name="ph" type="tel" ${MOBILE?"":"required"}></label></div><label>${W.email}<input name="em" type="email" required></label><div class="err" id="wm-err"></div><button class="btn" type="submit">${W.order} ${ICON}</button></form>`);
const upd=()=>{box.querySelector("#wm-q").textContent=qty;box.querySelector("#wm-t").textContent=kr(qty*pr.price_dkk)};box.querySelector("#wm-m").onclick=()=>{qty=Math.max(1,qty-1);upd()};box.querySelector("#wm-pl").onclick=()=>{qty=Math.min(10,qty+1);upd()};box.querySelectorAll("[data-z]").forEach(b=>b.onclick=()=>{size=b.dataset.z;box.querySelectorAll("[data-z]").forEach(x=>x.classList.toggle("on",x===b))});
box.querySelector("#wm-b").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),g=k=>(f.get(k)||"").toString().trim(),btn=ev.target.querySelector("[type=submit]"),err=box.querySelector("#wm-err");btn.disabled=true;btn.textContent=W.sending;err.textContent="";
try{const r=await rpc("web_order",{p_school_slug:SLUG,p_name:g("nm"),p_email:g("em"),p_phone:g("ph"),p_lines:[{product_id:pr.id,size,qty}]});payView(W.orderOk.replace("{n}",r.number),r.total_dkk,r.reference,r.mobilepay,g("ph"),W.pickup,W.buy)}
catch(x){const m=String(x.message||"");err.textContent=m.includes("email")?W.errMail:m.includes("too many")?W.errMany:W.err+" "+SUPPORT;btn.disabled=false;btn.innerHTML=W.order+" "+ICON}}}))}

// Hent appen: show the right store for the visitor's phone; everything on desktop + QR to this page
{const ua=navigator.userAgent,os=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)?"ios":/Android/i.test(ua)?"android":"desktop";document.documentElement.dataset.os=os;
const ab=document.querySelector("[data-app]");if(ab){let has=false;try{has=Object.keys(localStorage).some(k=>k.startsWith("sb-"))}catch{}const open=has||os==="desktop";ab.classList.add(open?"is-open":"is-get");if(open)ab.href=ab.href.replace(/backstage\/$/,"app/")}
document.querySelectorAll(".qrcard").forEach(hq=>{try{const qr=qrcode(0,"M");qr.addData(hq.dataset.url);qr.make();hq.querySelector(".qr").innerHTML=qr.createSvgTag({cellSize:4,margin:0,scalable:true})}catch{hq.remove()}});}
// page overrides from Tilpas appen → Websitets sider: texts (Danish pages) and pictures per page, keyed by data-e / data-ei
{const pg=document.body.dataset.pg;if(pg&&document.querySelector("[data-e],[data-ei]"))q("school",`&slug=eq.${SLUG}`).then(rows=>{const p=((rows[0]&&rows[0].appearance||{}).pages||{})[pg];if(!p)return;const CM=%(catmap)s;const res=r=>/^https?:|^data:/.test(r)?r:r.startsWith("art/")?`${BASE}/${r}`:CM[r]?`${BASE}/app/art/catalog/${CM[r]}`:null;
if(!EN)document.querySelectorAll("[data-e]").forEach(el=>{const v=(p.texts||{})[el.dataset.e];if(typeof v==="string"&&v.trim())el.textContent=v});
document.querySelectorAll("[data-ei]").forEach(el=>{const v=(p.images||{})[el.dataset.ei];const u=v?res(v):null;if(!u)return;if(el.tagName==="IMG")el.src=u;else el.style.backgroundImage=`url(${u})`})})}
// photo carousel on the front page: Line picks the images in the app (Admin → Tilpas appen → Billedkarrusel); falls back to her team photos
const gal=document.getElementById("gallery");if(gal){const CM=%(catmap)s;const resolve=r=>/^https?:|^data:/.test(r)?r:r.startsWith("art/")?`${BASE}/${r}`:CM[r]?`${BASE}/app/art/catalog/${CM[r]}`:null;
const render=list=>{const tr=gal.querySelector(".track"),dots=gal.querySelector(".dots");tr.innerHTML=list.map((u,i)=>`<img src="${esc(u)}" alt="" loading="${i<2?"eager":"lazy"}">`).join("");dots.innerHTML=list.map((_,i)=>`<i class="${i?"":"on"}"></i>`).join("");
let idx=0,timer=0;const go=i=>{idx=(i+list.length)%%list.length;const el=tr.children[idx];if(el)tr.scrollTo({left:el.offsetLeft-(tr.clientWidth-el.clientWidth)/2,behavior:"smooth"});dots.querySelectorAll("i").forEach((d,k)=>d.classList.toggle("on",k===idx))};
const auto=()=>{clearInterval(timer);timer=setInterval(()=>{if(document.visibilityState==="visible"&&gal.getBoundingClientRect().top<innerHeight)go(idx+1)},4200)};auto();
tr.addEventListener("scroll",()=>{const c=tr.scrollLeft+tr.clientWidth/2;let best=0,bd=1e9;[...tr.children].forEach((el,k)=>{const d=Math.abs(el.offsetLeft+el.clientWidth/2-c);if(d<bd){bd=d;best=k}});if(best!==idx){idx=best;dots.querySelectorAll("i").forEach((d,k)=>d.classList.toggle("on",k===idx))}},{passive:true});
tr.addEventListener("pointerdown",()=>clearInterval(timer));tr.addEventListener("pointerup",auto);dots.querySelectorAll("i").forEach((d,k)=>d.addEventListener("click",()=>{go(k);auto()}))};
const def=JSON.parse(gal.dataset.default||"[]");render(def);
q("school",`&slug=eq.${SLUG}`).then(rows=>{const ap=rows[0]&&rows[0].appearance||{};
// admin overrides from Tilpas appen → Website: texts (plain, keep <em> when the text has none), images and the front-page video
if(!EN){const tx=ap.texts||{};document.querySelectorAll("[data-txt]").forEach(el=>{const v=tx["site."+el.dataset.txt];if(typeof v==="string"&&v.trim()){const em=el.querySelector("em");const parts=v.split("|");if(parts.length>1&&em){el.innerHTML=esc(parts[0])+" <em>"+esc(parts.slice(1).join("|").trim())+"</em>"}else el.textContent=v}})}
const ws=ap.website||{};document.querySelectorAll("[data-cz]").forEach(el=>{const v=ws[el.dataset.cz];const u=v?resolve(v):null;if(u)el.style.backgroundImage=`url(${u})`});
const vid=document.querySelector("[data-cz-video]");if(vid&&ws.video){vid.src=ws.video}
const g=ap.websiteGallery;if(Array.isArray(g)&&g.length){const l=g.map(resolve).filter(Boolean);if(l.length)render(l)}})}
"""

# ---- Editable content (Admin → Tilpas appen → Websitets sider). Every plain text block and picture in a page body gets a
# stable key (hash of the default); site.js applies school.appearance.pages[<page>].texts/images live, and the app gets the
# manifest (page → keys + defaults) bundled as src/domain/llds/lib/site-manifest.generated.json.
import hashlib
EDIT_T, EDIT_I = {}, {}
_ek = lambda v: hashlib.sha1(v.encode("utf-8")).hexdigest()[:8]
_ETAG = re.compile(r"<(h1|h2|h3|h4|p|li|blockquote|figcaption|summary|dd)((?:\s[^<>]*)?)>((?:[^<]|</?(?:em|b|strong|i)>|<br\s*/?>)+?)</\1>")
def tag_editable(h):
    def t(m):
        tag, attrs, inner = m.group(1), m.group(2) or "", m.group(3)
        if "data-txt" in attrs or "data-e=" in attrs or 'class="empty"' in attrs or "hidden" in attrs: return m.group(0)
        plain_ = html.unescape(re.sub(r"<br\s*/?>", " ", re.sub(r"</?(?:em|b|strong|i)>", "", inner))).strip()
        if len(plain_) < 4 or not re.search(r"[A-Za-zÆØÅæøå]{3}", plain_): return m.group(0)
        k = _ek(plain_); EDIT_T[k] = plain_
        return f'<{tag}{attrs} data-e="{k}">{inner}</{tag}>'
    h = _ETAG.sub(t, h)
    def bg(m):
        if "data-cz" in m.group(0) or "data-ei" in m.group(0): return m.group(0)
        k = _ek(m.group(2)); EDIT_I[k] = m.group(2)
        return f'{m.group(1)} data-ei="{k}"'
    h = re.sub(r'(<(?:div|section|a|figure|span)\b[^<>]*style="[^"]*background-image:url\(([^)"]+)\)[^"]*")', bg, h)
    def im(m):
        if "data-ei" in m.group(0) or "brand/" in m.group(2): return m.group(0)
        k = _ek(m.group(2)); EDIT_I[k] = m.group(2)
        return f'{m.group(1)} data-ei="{k}"'
    h = re.sub(r'(<img\b[^<>]*\bsrc="([^"]+)"[^<>]*?)(?=/?>)', im, h)
    return h
MANIFEST = []

def page(title, body, desc, active="", hero=None, hero_title=None, hero_sub=None, hero_lead=None, small=True, extra="", sticky=""):
    if len(title) > 60: title = title.replace(" – LL Dance Studio", " | LL Dance")
    if len(title) > 60: title = title.replace(" | LL Dance", "")
    body = tag_editable(body)
    pill = "".join(f'<a href="{BASE}{h}" class="{"on" if h == active else ""}">{l}</a>' for l, h, _ in NAV)
    big = "".join(f'<a class="big" href="{BASE}{h}" style="transition-delay:{80+i*60}ms"><small>0{i+1}</small>{l}<span>{d}</span></a>' for i, (l, h, d) in enumerate(NAV))
    heroh = f'<div class="hero{" small" if small else ""}"><div class="bg" {"data-cz=hero " if active == "/" else ""}style="background-image:url({hero})"></div><div class="wrap">{"<div class=eyebrow>" + E(hero_sub) + "</div>" if hero_sub else ""}<h1{" data-txt=heroTitle" if active == "/" else ""}>{hero_title}</h1>{("<p class=lead" + (" data-txt=heroLead" if active == "/" else "") + ">" + hero_lead + "</p>") if hero_lead else ""}{extra}</div></div>' if hero else ""
    heroh = tag_editable(heroh)
    return f"""<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{E(title)}</title><meta name="description" content="{E(desc)}"><meta name="theme-color" content="#0a0a0b"><meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}">{f'<meta property="og:image" content="{hero}">' if hero else ""}
<link rel="icon" href="{BASE}/favicon.png" type="image/png"><link rel="apple-touch-icon" href="{BASE}/icons/apple-touch-icon.png"><link rel="stylesheet" href="{BASE}/style.css?v={BUILD}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Outfit:wght@300;400;500&display=swap"></head><body>
<header class="top"><div class="wrap">{'' if active in ("", "/") else f'<a class="back" href="{BASE}/" aria-label="Tilbage" onclick="if(history.length>1&&document.referrer.indexOf(location.host)>-1){{history.back();return false}}">{ICON_BACK}</a>'}<a class="logo" href="{BASE}/">{LOGO}</a><nav class="pill">{pill}</nav><div class="hr"><div class="langs"><a href="__DA__" class="flag on" title="Dansk" aria-label="Dansk">🇩🇰</a><a href="__EN__" class="flag" title="English" aria-label="English">🇬🇧</a></div><a class="btn sm hbtn" href="{BASE}/backstage/" data-app><span class="ico">{ICON_LOCK}</span><span class="lbl get">Hent Backstage</span><span class="lbl open">Åbn Backstage</span></a><button class="burger" aria-label="Menu"><i></i><span>Menu</span></button></div></div></header>
<div class="menu"><div class="l"><a class="big" href="{BASE}/" style="transition-delay:40ms"><small>00</small>Forside<span>LL Dance Studio</span></a>{big}<div class="foot"><a class="btn ghost" href="tel:{C["phone"].replace(" ", "")}">{E(C["phone"])}</a><a class="btn ghost" href="mailto:{C["email"]}">{C["email"]}</a></div></div><div class="r" style="background-image:url({ART(6)})"><div><div class="eyebrow">Ulstrup</div><h3>Dans med hjertet.<br><em>Vind med holdet.</em></h3></div></div></div>
{heroh}{body}
<footer><div class="wrap"><div class="cols3"><div><img src="{BASE}/brand/logo-white.png" alt="LL Dance Studio" style="width:180px;margin-bottom:14px"><p class="muted small">{E(C["address"])}<br><a href="tel:{C["phone"].replace(" ", "")}" style="display:inline">{E(C["phone"])}</a> · {E(C["hours"])}<br><a href="mailto:{C["email"]}" style="display:inline">{C["email"]}</a></p></div>
<div><h4>Backstage</h4><p class="muted small" style="margin:0 0 8px">Appen for dansere, forældre og trænere i LL Dance Studio.</p><a href="{BASE}/backstage/">Sådan får du adgang</a><a href="{BASE}/support/">Hjælp &amp; FAQ</a></div>
<div><h4>Praktisk</h4><a href="{BASE}/solo-duo/">Solo / Duo</a><a href="{BASE}/privacy/">Privatlivspolitik</a><a href="{BASE}/terms/">Vilkår</a></div></div>
<div class="legal"><span>© {date.today().year} {E(C["name"])}</span><span>App og website af <a href="https://ilumie.com/" style="display:inline">Ilumie</a></span></div></div></footer>
<div class="stickycta">{sticky}</div>
<script src="{BASE}/site.js?v={BUILD}" defer></script></body></html>"""

EN = json.load(open(os.path.join(ROOT, "site", "en.json")))
UI = json.load(open(os.path.join(ROOT, "site", "en-ui.json")))
TXT = json.load(open(os.path.join(ROOT, "site", "en-text.json")))   # full-sentence translations (team texts, pages)
_ALL = {html.escape(html.unescape(k)): v for k, v in {**EN, **UI, **TXT}.items() if k != "_tokens"}
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
    out = re.sub(r"\bkl\. ?", "", out).replace("angivet som", "listed as").replace("angivet på siden", "as listed")
    return out
def translate_html(h, rel):
    keep = []   # slugs inside inline JSON are URLs, not text – "voksen" → "adult" in a slug gave six dead links on /en/
    def hold(m): keep.append(m.group(0)); return f"\x00{len(keep) - 1}\x00"
    h = re.sub(r'"(?:slug|db)": "[^"]*"', hold, h)
    h = re.sub(r">([^<>]+)<", lambda m: ">" + translate_text(m.group(1)) + "<", h)
    h = re.sub(r"\x00(\d+)\x00", lambda m: keep[int(m.group(1))], h)
    h = re.sub(r'(placeholder|alt|title|aria-label|content|data-price|data-note)="([^"]*)"', lambda m: f'{m.group(1)}="{translate_text(m.group(2))}"', h)
    h = h.replace('<html lang="da">', '<html lang="en">')
    h = re.sub(r'href="' + re.escape(BASE) + r'/(?!en/|style\.css|site\.js|brand/|icons/|art/|favicon|app/)', f'href="{BASE}/en/', h)
    h = h.replace('class="tiny en-only" hidden', 'class="tiny en-only"')
    return h
def write(rel, content):
    d = rel.rsplit("/", 1)[0] + "/" if "/" in rel else ""
    if rel.endswith(".html") and "<body>" in content:
        pg = d.rstrip("/") or "home"; content = content.replace("<body>", f'<body data-pg="{pg}">', 1)
        tk = list(dict.fromkeys(re.findall(r'data-e="([0-9a-f]{8})"', content))); ik = list(dict.fromkeys(re.findall(r'data-ei="([0-9a-f]{8})"', content)))
        if (tk or ik) and pg not in ("privacy", "terms", "hent"):
            tt = re.search(r"<title>([^<]*)</title>", content)
            MANIFEST.append({"key": pg, "title": html.unescape(tt.group(1)).replace(" – LL Dance Studio", "") if tt else pg, "path": d,
                             "texts": [{"k": k, "d": EDIT_T[k]} for k in tk if k in EDIT_T], "images": [{"k": k, "src": EDIT_I[k]} for k in ik if k in EDIT_I]})
    if rel.endswith(".html") and "</head>" in content:
        def head(lang_prefix):
            url = f"{SITE}{BASE}/{lang_prefix}{d}"
            x = f'<link rel="canonical" href="{url}"><link rel="alternate" hreflang="da" href="{SITE}{BASE}/{d}"><link rel="alternate" hreflang="en" href="{SITE}{BASE}/en/{d}"><link rel="alternate" hreflang="x-default" href="{SITE}{BASE}/{d}"><meta property="og:url" content="{url}"><meta property="og:type" content="website">'
            if 'property="og:image"' not in content: x += f'<meta property="og:image" content="{SITE}{BASE}/art/1.jpg">'
            if d == "": x += '<script type="application/ld+json">' + json.dumps({"@context": "https://schema.org", "@type": "DanceSchool", "name": C["name"], "url": f"{SITE}{BASE}/", "telephone": C["phone"], "email": C.get("email"), "address": {"@type": "PostalAddress", "streetAddress": C["address"].split(",")[0].strip(), "addressLocality": "Ulstrup", "postalCode": "8860", "addressCountry": "DK"}, "image": f"{SITE}{BASE}/art/1.jpg"}, ensure_ascii=False) + "</script>"
            return x
        # images without a description get the page's name; purely decorative ones stay empty on purpose (class ph/bg)
        ttl = re.search(r"<title>([^<]*)</title>", content); nm = html.escape(html.unescape(ttl.group(1)).replace(" – LL Dance Studio", "")) if ttl else ""
        content = re.sub(r'(<img\b(?![^>]*\bclass="(?:ph|bg|deco)")[^>]*?)\balt=""', lambda m: f'{m.group(1)}alt="{nm} – LL Dance Studio"', content)
        content_en_head = head("en/"); content = content.replace("</head>", "__HEAD__</head>", 1)
    else: content_en_head = ""
    da = content.replace("__HEAD__", head("") if "__HEAD__" in content else "").replace("__DA__", f"{BASE}/{d}").replace("__EN__", f"{BASE}/en/{d}")
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "w").write(da)
    if rel.endswith(".html"):
        en = content.replace('class="flag on" title="Dansk"', 'class="flag" title="Dansk"').replace('class="flag" title="English"', 'class="flag on" title="English"')
        en = translate_html(en, rel).replace("__HEAD__", content_en_head).replace("__DA__", f"{BASE}/{d}").replace("__EN__", f"{BASE}/en/{d}")
        p2 = os.path.join(OUT, "en", rel); os.makedirs(os.path.dirname(p2), exist_ok=True); open(p2, "w").write(en)

def tcard(t):
    slug = t["slug"].strip("/"); f = t.get("facts") or {}; img = team_img(slug)
    inner = f'<img src="{img}" alt="{E(short_title(t["title"]))} – hold hos LL Dance Studio" loading="lazy">' if img else f'<div class="ph" style="background-image:url({ART(1)})"></div>'
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
<section class="tight"><div class="wrap split"><div class="rv"><div class="eyebrow">Velkommen</div><h2 data-txt="welcomeTitle">{E(H["welcome_title"]).replace("LL Dance Studio", "<em>LL Dance Studio</em>")}</h2><p class="lead" data-txt="welcome">{E(H["welcome"])}</p><div class="btns"><a class="btn" href="{BASE}/medlemsskab/">Bliv medlem {ICON_ARROW}</a><a class="btn ghost" href="{BASE}/om-os/">Mød os</a></div></div>
<div class="tiles rv">{"".join(f'<a class="tile" href="{BASE}{t["href"]}"><div class="bg" style="background-image:url({t["image"]})"></div><div class="in"><h3>{E(t["label"])}</h3><span class="ar">{ICON_ARROW}</span></div></a>' for t in H["tiles"])}</div></div></section>
<section class="tight"><div class="wrap"><div class="vid rv" data-cz="videoPoster" style="background-image:url({team_img("the-axis-25-26", 1) or H["hero"]})"><video src="{H["video"]}" data-cz-video playsinline preload="none" loop></video><div class="pl"><b>Afspil</b></div><div class="cap"><div class="eyebrow" data-txt="videoTitle">{E(H["universe_title"])}</div><div class="tiny" style="color:var(--muted);margin-top:4px">Se videoen fra studiet · tryk for at afspille med lyd</div></div></div></div></section>
<section class="tight gal-sec"><div class="wrap"><div class="head rv"><div><div class="eyebrow">Øjeblikke</div><h2>Fra gulvet, scenen <em>og backstage</em></h2></div></div><div class="gal rv" id="gallery" data-default='{json.dumps(default_gallery, ensure_ascii=False)}'><div class="track"></div><div class="dots"></div></div></div></section>
<section class="tight"><div class="wrap"><div class="head rv"><div><div class="eyebrow">Kalender</div><h2>Events, shows <em>&amp; workshops</em></h2></div><span class="tiny muted">Tilmelding sker i Backstage-appen</span></div><div class="grid rv" id="events"><p class="empty">Henter…</p></div></div></section>
<section class="tight"><div class="wrap"><div class="eyebrow">Fra studiet</div><h2>Nyt</h2><div id="news"></div></div></section>
<section class="tight"><div class="wrap"><div class="head rv"><div><div class="eyebrow">Om os</div><h2>Trænerne bag <em>holdene</em></h2></div><a class="btn ghost" href="{BASE}/om-os/#traenere">Mød os alle {ICON_ARROW}</a></div>
<div class="scroller rv">{"".join(f'<a class="tr" href="{BASE}/om-os/#{slugify(s["name"])}"><img src="{s["image"]}" alt="{E(s["name"])}" loading="lazy"><div class="in"><h4>{E(s["name"])}</h4><div class="tiny">{E(s["role"])}</div></div></a>' for s in P["staff"])}</div></div></section>
<section class="tight"><div class="wrap"><div class="app rv"><div class="txt"><div class="eyebrow">LL Dance Studio-appen</div><h2 data-txt="appTitle">Alt det praktiske – <em>i lommen</em></h2><p class="muted" data-txt="appLead">Dansere, forældre og trænere har hvert deres rum. Tilmelding, afbud, koreografi-videoer, holdets billeder, beskeder fra træneren, events og Stjerneshoppen – ét sted.</p>
<ul class="feat"><li>Ugens træninger og afbud med ét tryk</li><li>Koreografi og musik til øvning hjemme</li><li>Holdets billeder og videoer – kun for holdet</li><li>Beskeder, aflysninger og vikarer</li><li>Tilmelding og betaling til events</li><li>Klippekort og Stjerneshoppen</li></ul>
<div class="btns"><a class="btn" href="{BASE}/backstage/">{ICON_LOCK} Backstage – sådan får du adgang</a></div></div><div class="pic" data-cz="app" style="background-image:url({ART(5)})"></div></div></div></section>
<section class="tight"><div class="wrap grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))"><div class="band rv"><div class="bg" style="background-image:url({H["shop_image"]})"></div><div><div class="eyebrow">Merchandise</div><h2>{E(H["shop_title"])}</h2><p class="muted small">{E(H["shop_text"])}</p><a class="btn" href="{BASE}/merchandise/">Se Stjerneshoppen {ICON_ARROW}</a></div></div>
<div class="band rv"><div class="bg" data-cz="band" style="background-image:url({H["welcome_band_image"]})"></div><div><div class="eyebrow">Kom forbi</div><h2 data-txt="bandTitle">{E(H["welcome_band_title"])}</h2><p class="muted small" data-txt="band">{E(H["welcome_band"])}</p><a class="btn ghost" href="{BASE}/kontakt/">Kontakt os {ICON_ARROW}</a></div></div></div></section>
<script type="application/json" id="teams-data">{teams_data}</script>
"""
home = '<section class="tight boostsec" hidden><div class="wrap"><div id="boost" class="boosts"></div></div></section>' + home
write("index.html", page("LL Dance Studio – danseskole i Ulstrup", home, "Showdance, hip hop, contemporary, disco, ballet og spring for alle aldre i Ulstrup. Find dit hold, bliv medlem og følg med i appen.", "/", hero=H["hero"], hero_title="Dans med hjertet.<br><em>Vind med holdet.</em>", hero_sub="LL Dance Studio · Ulstrup", hero_lead="Danseskole for alle aldre – fra de allermindste til elitehold, der stiller op til DM. Showdance, hip hop, contemporary, disco, ballet og spring.", small=False, extra=f'<div class="btns" style="margin-top:6px"><a class="btn" href="#finder">Find dit hold {ICON_ARROW}</a></div>{stats}<div class="cue"></div>'))

# ---------------- holdplan
days = "".join(f'<button data-day="{i}" class="{"on" if i == 0 else ""}">{d}</button>' for i, d in enumerate(SCHED["days"]))
def cls(c):
    img = team_img(c.get("slug")) or ART(3 if "Mini" in c["age"] else 1); ages = " ".join(sorted(age_tokens(c["age"])))
    sub = f'{E(c["age"])} · {E(c["level"])}' + (' · <span class="chip gold" style="margin:0;padding:1px 8px">Lukket hold</span>' if c.get("closed") else "")
    body = f'<div class="img" style="background-image:url({img})"></div><div><div class="t">{E(c["time"])}</div><h4>{E(c["name"])}</h4><div class="tiny">{sub}{("<br>" + E(c["note"])) if c.get("note") else ""}</div></div>'
    return f'<a class="cls" href="{BASE}/{c["slug"]}/" data-ages="{ages}">{body}<span class="go">{ICON_ARROW}</span></a>' if c.get("slug") else f'<div class="cls na" data-ages="{ages}">{body}</div>'
# --- week calendar: days as columns, rooms as lanes inside each day, blocks positioned by time (public: official teams only)
def _mins(t):
    h, m = t.strip().replace(".", ":").split(":"); return int(h) * 60 + int(m)
def _span(tm):
    a, b = [x.strip() for x in tm.replace("-", "–").split("–")[:2]]; return _mins(a), _mins(b)
_all = [c for c in SCHED["classes"] if "–" in c["time"] or "-" in c["time"]]
T0 = min(_span(c["time"])[0] for c in _all) // 60 * 60; T1 = (max(_span(c["time"])[1] for c in _all) + 59) // 60 * 60
PX = 1.8  # px per minute
def _block(c):
    a, b = _span(c["time"]); top = (a - T0) * PX; h = max(34, (b - a) * PX - 4)
    lane = SCHED["rooms"].index(c["room"]) if c["room"] in SCHED["rooms"] else 0
    # another room at the same time on the same day → share the column (left/right), otherwise full width
    clash = any(o is not c and o["day"] == c["day"] and o["room"] != c["room"] and o in _all and _span(o["time"])[0] < b and _span(o["time"])[1] > a for o in SCHED["classes"])
    if clash: lane_cls = f"l{lane} half s{lane}"
    else: lane_cls = f"l{lane}"
    inner = f'<span class="tm">{E(c["time"])}</span><b>{E(c["name"])}</b><span class="rm">{E(c["room"])}</span>'
    st = f'style="top:{top:.0f}px;height:{h:.0f}px"'
    return (f'<a class="blk {lane_cls}" href="{BASE}/{c["slug"]}/" {st} title="{E(c["name"])}">{inner}</a>' if c.get("slug") else f'<div class="blk {lane_cls} na" {st} title="{E(c["name"])}">{inner}</div>')
hours = "".join(f'<div class="hr" style="top:{(h*60-T0)*PX:.0f}px"><span>{h:02d}</span></div>' for h in range(T0 // 60, T1 // 60 + 1))
cols = "".join(f'<div class="col"><div class="dh">{d}</div><div class="lanes" style="height:{(T1-T0)*PX:.0f}px">{hours}{"".join(_block(c) for c in SCHED["classes"] if c["day"] == i and c in _all)}</div></div>' for i, d in enumerate(SCHED["days"]))
legend = "".join(f'<span class="lg l{i}">{E(r)}</span>' for i, r in enumerate(SCHED["rooms"]))
monthly = "".join(cls({**m, "time": "Én gang om måneden"}) for m in SCHED["monthly"])
holdplan = f"""
<section class="tight plan" style="margin-top:-20px"><div class="wrap">
<div class="planbar"><div class="weeknav" id="weeknav"><button type="button" class="wk" data-wk="-1" aria-label="Forrige uge">‹</button><button type="button" class="wk today" data-wk="0">Denne uge</button><button type="button" class="wk" data-wk="1" aria-label="Næste uge">›</button><span class="wklabel" id="wklabel"></span></div>
<div class="roomchips" id="roomchips"><button type="button" class="on" data-room="all">Begge sale</button>{"".join(f'<button type="button" data-room="{i}">{E(r)}</button>' for i, r in enumerate(SCHED["rooms"]))}</div></div>
<div class="legend">{legend}<span class="lg cx">Aflyst</span><span class="lg mv">Flyttet</span><span class="tiny muted">Tryk på et hold for beskrivelse, pris og tilmelding</span></div>
<div class="weekcal" id="weekcal" data-t0="{T0}" data-px="{PX}" data-days="{E(json.dumps(SCHED["days"]))}" data-rooms="{E(json.dumps(SCHED["rooms"]))}" data-static="{E(json.dumps([dict(day=c["day"], room=c["room"], time=c["time"], name=c["name"], slug=c.get("slug")) for c in _all]))}" data-teams="{E(json.dumps([dict(slug=t["slug"].strip("/"), title=short_title(t["title"])) for t in TEAMS]))}"><div class="axis"><div class="dh">&nbsp;</div><div class="lanes" style="height:{(T1-T0)*PX:.0f}px">{"".join(f'<div class="hr" style="top:{(h*60-T0)*PX:.0f}px"><span>{h:02d}:00</span></div>' for h in range(T0 // 60, T1 // 60 + 1))}</div></div>{cols}</div>
<p class="tiny muted" style="margin-top:14px">Kalenderen følger appen: aflysninger og flytninger vises her samme dag. Hold, der træner sjældnere (fx No Addiction én gang om måneden), dukker op i de uger, de har træning.</p>
</div></section>
"""
write("saeson-26-27/index.html", page("Holdplan – Sæson 26/27 – LL Dance Studio", holdplan, "Ugekalender for alle hold i sæson 26/27 – dag, tid og sal. Tryk på et hold for beskrivelse, pris og tilmelding.", "/saeson-26-27/", hero=team_img("sky-stars", 1) or H["hero"], hero_title="Sæson <em>26/27</em>", hero_sub="Holdplan", hero_lead="Træning mandag–torsdag i Store Sal og Lille Sal på Vinkelvej 17. Her ser du, hvornår de enkelte hold ligger – tryk på et hold for beskrivelse, pris og tilmelding."))

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
    side = f'<aside class="side"><div class="card"><div class="eyebrow">Pris</div><div class="price">{p1}</div><div class="tiny">{p2}</div>{(("<div class=muted style=margin-top:10px;font-size:.9rem>" + E(t["payment"]) + "</div>") if t.get("payment") else "")}{inc}<div class="btns" style="margin-top:18px;flex-direction:column;align-items:stretch"><button class="btn" style="justify-content:center" data-signup="{E(short_name)}" data-price="{E(f.get("price") or "")}">Tilmeld holdet {ICON_ARROW}</button><a class="btn ghost" style="justify-content:center" href="{BASE}/medlemsskab/">Rater og familierabat</a></div><p class="tiny" style="margin:10px 0 0">Har du appen? <a href="{BASE}/app/">Tilmeld dig dér</a> – så er profilen klar med det samme.</p><p class="tiny" style="margin:14px 0 0">{"Optagelse via audition – meld dig til her, når der er åbnet. Det er gratis; der betales først ved udtagelse." if f.get("closed") else ("Klippekort – køb klip og mød op, ingen binding." if slug == "hit-fit-dance" else "2 gratis prøvetimer – start når som helst i sæsonen.")}</p></div></aside>'
    body = f"""<section class="tight"><div class="wrap"><div class="facts rv">{factsh}</div><div class="cols"><article class="rv">{"<p class=lead>" + E(t["intro"]) + "</p>" if t.get("intro") else ""}{'<p class="tiny en-only" hidden>Holdbeskrivelsen herunder er på dansk – skriv til os på engelsk, så hjælper vi.</p>' if secs else ""}{secs}{docsh}{gal}</article>{side}</div></div></section>{relh}"""
    write(f"{slug}/index.html", page(f"{short_title(t['title'])} – LL Dance Studio", body, (t.get("intro") or t["title"])[:155], "/saeson-26-27/", hero=imgs[0] if imgs else ART(1), hero_title=E(short_title(t["title"])), hero_sub=" · ".join(x for x in [f.get("style"), f.get("level"), f.get("years")] if x) or "Hold", extra=f'<div class="btns"><button class="btn" data-signup="{E(short_name)}" data-price="{E(f.get("price") or "")}">Tilmeld holdet {ICON_ARROW}</button><a class="btn ghost" href="{BASE}/saeson-26-27/">Holdplanen</a></div>', sticky=f'<a class="btn" href="#" data-signup="{E(short_name)}" data-price="{E(f.get("price") or "")}">Tilmeld holdet · {p1}</a>'))

# ---------------- medlemsskab
acc = "".join(f'<details{" open" if i == 0 else ""}><summary>{E(s["title"])}</summary><div class="b">{E(s["body"])}</div></details>' for i, s in enumerate(M["sections"]))
mem = f"""<section class="tight"><div class="wrap cols"><div><p class="lead rv">{E(M["intro"])}</p><div class="acc rv">{acc}</div></div>
<aside class="side"><div class="card"><div class="eyebrow">Sådan gør du</div><ol class="steps"><li><b>1</b><span>Find dit hold under <a href="{BASE}/saeson-26-27/">Holdplan</a> – på forsiden kan du også søge på stilart eller alder.</span></li><li><b>2</b><span>Tryk <em>Tilmeld holdet</em> på holdets side, udfyld navn og alder, og betal med MobilePay. Familierabat trækkes automatisk fra.</span></li><li><b>✓</b><span>Er I allerede medlem? Så tilmelder I nye hold direkte i Backstage: <em>Hjem → + Tilmeld nyt hold</em>.</span></li><li><b>3</b><span>Tilmeldingen godkendes, typisk samme dag, og I får en kvittering på e-mail. Så er I på holdet.</span></li></ol><a class="btn" style="margin-top:18px;width:100%;justify-content:center" href="{BASE}/saeson-26-27/">Find dit hold {ICON_ARROW}</a><p class="tiny" style="margin:12px 0 0">Elitehold optages via audition – meld dig til på holdets side, når der er åbnet for audition. Det er gratis.</p></div></aside></div></section>"""
write("medlemsskab/index.html", page("Medlemsskab – LL Dance Studio", mem, "Priser, betaling i rater, familierabat, prøvetimer og fortrydelsesret.", "/medlemsskab/", hero=M["image"], hero_title="Bliv en del af <em>studiet</em>", hero_sub="Medlemsskab"))

# ---------------- stjerneshoppen
PRODUCTS = json.load(open(os.path.join(ROOT, "site", "products.json")))
prods = "".join(f'<div class="prod{" img" if p["images"] else ""}" data-i="{i+1:02d}">{("<div class=pimg style=\"background-image:url(" + p["images"][0] + ")\"></div>") if p["images"] else ""}<div class="pin"><h4>{E(p["name"])}</h4><div class="tiny">{" · ".join(E(x) for x in p["sizes"]) if p["sizes"] else "One size"}</div><div class="price">{p["price"]} kr.</div><div class="buy"><button class="btn" data-buy="{E(p["name"])}">Køb {ICON_ARROW}</button></div></div></div>' for i, p in enumerate(PRODUCTS))
shop = f"""<section class="tight"><div class="wrap"><div class="head rv"><p class="lead" style="margin:0">{E(S["intro"])}</p><a class="btn ghost" href="{BASE}/backstage/">{ICON_LOCK} Medlem? Bestil i Backstage</a></div>
<div class="eyebrow">Sortiment</div><div class="prods rv">{prods}</div><p class="tiny" style="margin-top:16px">Priser i kr. inkl. moms. Betales med Vipps MobilePay – her på siden eller i appen – og udleveres i studiet ved næste træning.</p></div></section>"""
write("merchandise/index.html", page("Stjerneshoppen – LL Dance Studio", shop, "Merchandise fra LL Dance Studio: tøj, tasker, drikkedunke – bestil i appen.", "/merchandise/", hero=S["image"], hero_title="Stjerne<em>shoppen</em>", hero_sub="Merchandise"))

# ---------------- om os: the people and the story (trainers used to live under /backstage/, which is now the app)
staff = "".join(f'<div class="card rv" id="{slugify(s["name"])}"><img src="{s["image"]}" alt="{E(s["name"])}" loading="lazy"><div class="in"><h3>{E(s["name"])}</h3><div class="tiny" style="color:var(--gold)">{E(s["role"])}</div>{("<div class=tiny style=margin-top:4px>" + E(s["teaches"]) + "</div>") if s.get("teaches") else ""}<p class="small muted bio" style="margin:10px 0 0">{E(s["bio"])}</p><button type="button" class="more" onclick="this.closest(\'.card\').classList.add(\'open\')">Læs mere</button></div></div>' for s in P["staff"])
about = f"""<section class="tight"><div class="wrap split"><div class="rv"><div class="eyebrow">Historien</div><h2>{E(H["welcome_title"]).replace("LL Dance Studio", "<em>LL Dance Studio</em>")}</h2><p class="lead">{E(H["welcome"])}</p><div class="btns"><a class="btn" href="{BASE}/medlemsskab/">Bliv medlem {ICON_ARROW}</a><a class="btn ghost" href="{BASE}/kontakt/">Kom forbi</a></div></div>
<div class="tiles rv" style="grid-template-columns:1fr"><div class="tile" style="pointer-events:none;min-height:360px"><div class="bg" style="background-image:url({H["tiles"][0]["image"]})"></div></div></div></div></section>
<section class="tight" id="traenere"><div class="wrap"><div class="head rv"><div><div class="eyebrow">Trænerne</div><h2>Menneskene bag <em>holdene</em></h2></div><span class="tiny muted">{len(P["staff"])} trænere · dansere med erfaring fra konkurrencer, shows og mange års undervisning</span></div><div class="staff">{staff}</div></div></section>
<section class="tight"><div class="wrap"><div class="band rv"><div class="bg" style="background-image:url({H["welcome_band_image"]})"></div><div><div class="eyebrow">Kom forbi</div><h2>{E(H["welcome_band_title"])}</h2><p class="muted small">{E(H["welcome_band"])}</p><a class="btn ghost" href="{BASE}/kontakt/">Find os {ICON_ARROW}</a></div></div></div></section>"""
write("om-os/index.html", page("Om os – LL Dance Studio", about, "Historien bag LL Dance Studio og de trænere, der står for holdene i Ulstrup.", "/om-os/", hero=P["staff"][0]["image"], hero_title="Mød <em>os</em>", hero_sub="Om os", hero_lead="Et danseunivers i Ulstrup – bygget af dansere, drevet af hjerte og med hold for alle aldre."))

# ---------------- kontakt
kon = f"""<section class="tight"><div class="wrap"><div class="quick rv"><a class="btn" href="tel:{C["phone"].replace(" ", "")}">Ring til os</a><a class="btn ghost" href="mailto:{C.get("email") or ""}">Skriv en mail</a><a class="btn ghost" href="{C["map"]}" target="_blank" rel="noreferrer">Find vej</a></div><div class="contact rv"><div class="card"><div class="eyebrow">Adresse</div><h3>{E(C["address"]).replace(", ", "<br>")}</h3><a href="{C["map"]}" target="_blank" rel="noreferrer">Åbn i Google Maps</a></div><div class="card"><div class="eyebrow">Telefon</div><h3><a href="tel:{C["phone"].replace(" ", "")}" style="color:inherit">{E(C["phone"])}</a></h3><p class="tiny" style="margin:4px 0 0">{E(C["hours"])}</p></div><div class="card"><div class="eyebrow">E-mail</div><h3 style="font-size:1.2rem;word-break:break-all"><a href="mailto:{C["email"]}" style="color:inherit">{C["email"]}</a></h3></div><div class="card"><div class="eyebrow">Tilmelding</div><p class="muted small" style="margin:0 0 10px">Opret dig i Backstage-appen og vælg hold – tilmeldingen godkendes inden for en dag.</p><a class="linkarrow" href="{BASE}/backstage/">Sådan får du adgang {ICON_ARROW}</a></div></div>
<div class="map rv"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q={E(C["address"]).replace(" ", "+")}&output=embed"></iframe></div></div></section>"""
write("kontakt/index.html", page("Kontakt – LL Dance Studio", kon, "Kontakt LL Dance Studio i Ulstrup – adresse, telefon, e-mail og telefontid.", "/kontakt/", hero=C["image"], hero_title="Kom <em>forbi</em>", hero_sub="Kontakt", hero_lead=E(H["welcome_band"])))

# ---------------- privacy / terms / support
def plain(title, inner, desc): return page(title, f'<section class="tight" style="padding-top:110px"><div class="wrap"><article>{inner}</article></div></section>', desc)
PRIVACY = f"""<h1 style="font-size:2.6rem">Privatlivspolitik</h1><p class="muted">Sidst opdateret {TODAY}</p>
<p>LL Dance Studio-appen og dette website drives af Ilumie (Therkildsen Group, CVR 46203798) for LL Dance Studio, {E(C["address"])}. LL Dance Studio er dataansvarlig for medlemsdata; Ilumie er databehandler.</p>
<h2>Hvad vi gemmer</h2><ul><li><b>Profil:</b> navn, e-mail, telefon, fødselsår, hold og rolle (danser, forælder, træner). Børn under 13 har ingen egen konto – deres profil ligger under forælderens. Børn på 10–12 år kan få et begrænset login, som forælderen opretter og kan lukke igen.</li>
<li><b>Træning:</b> afbud, fremmøde, bookinger af sale, klippekort og tilmeldinger til events.</li><li><b>Indhold:</b> opslag, kommentarer, billeder og videoer i holdets rum. Kun synligt for holdet, forældre og trænere – aldrig offentligt, medmindre administratoren udtrykkeligt markerer et opslag som offentligt.</li>
<li><b>Køb:</b> ordrer i shoppen og klippekort. Betaling sker via MobilePay direkte til LL Dance Studio – appen gemmer ingen betalingsoplysninger.</li><li><b>Teknisk:</b> login-tidspunkter og en logbog over administrative handlinger.</li></ul>
<h2>Hvor data ligger</h2><p>Alle data gemmes hos Supabase i EU (Irland). Login-mails sendes via Resend (EU). Der bruges ingen tracking, annoncer eller analyseværktøjer. Kortet på kontaktsiden indlæses fra Google Maps.</p>
<h2>Hvem kan se hvad</h2><p>Adgang styres pr. hold: dansere ser deres eget hold, forældre ser deres børns hold, trænere ser de hold de underviser, og administratoren ser hele studiet. Fotos af børn kan fravælges (fotosamtykke) i profilen.</p>
<h2 id="slet-konto">Slet din konto i LL Dance Studio-appen</h2><p><b>I appen:</b> Mere → Indstillinger → Konto → <em>Slet min konto</em> → bekræft. Kontoen, din profil, dine børns profiler uden eget login og dit login slettes med det samme.</p><p><b>Uden appen:</b> skriv til <a href="mailto:{SUPPORT}">{SUPPORT}</a> fra den e-mail, du er registreret med, eller til danseskolen – så slettes kontoen senest 30 dage efter.</p><p><b>Det slettes:</b> navn, e-mail, telefon, fødselsdato, profilbillede, notifikationsvalg, opslag og kommentarer, billeder i holdets mapper, beskeder og tilmeldinger. <b>Det gemmes i en periode:</b> betalingsoplysninger om køb (beløb, reference, dato) i 5 år efter bogføringsloven – uden kobling til din profil, når den er slettet.</p>
<h2>Dine rettigheder</h2><p>Du har ret til indsigt, berigtigelse, sletning og dataportabilitet efter GDPR. Klager kan rettes til Datatilsynet.</p>"""
TERMS = f"""<h1 style="font-size:2.6rem">Vilkår for brug</h1><p class="muted">Sidst opdateret {TODAY}</p>
<h2>Konto</h2><p>Appen er for medlemmer af LL Dance Studio, deres forældre og trænere. Danseskolen godkender alle profiler. Egen konto kræver, at du er fyldt 13 år; yngre dansere er under en forælders profil.</p>
<h2>God tone</h2><p>Holdets rum er et trygt sted. Vær sød og respektfuld – ingen mobning, ingen deling af andres billeder uden for appen. Trænere og administrator læser med, og alt kan anmeldes med ét tryk. Indhold, der bryder reglerne, fjernes, og gentagne brud kan føre til lukning af kontoen.</p>
<h2>Billeder og video</h2><p>Billeder og koreografi-videoer tilhører LL Dance Studio og må kun bruges til egen øvelse – ikke deles på sociale medier uden aftale.</p>
<h2>Køb og medlemsskab</h2><p>Priser er i danske kroner inkl. moms. Shop og klippekort betales via MobilePay; ordren bekræftes, når LL Dance Studio har registreret betalingen. Klippekort gælder 12 måneder fra aktivering. Sæsonpris, rater, prøvetimer og fortrydelsesret: se <a href="{BASE}/medlemsskab/">Medlemsskab</a>.</p>
<h2>Drift</h2><p>Appen leveres som den er; vi tilstræber høj oppetid, men garanterer den ikke. Ilumie kan opdatere appen og disse vilkår – væsentlige ændringer meldes i appen.</p><p>Kontakt: <a href="mailto:{SUPPORT}">{SUPPORT}</a></p>"""
SUPPORTP = f"""<h1 style="font-size:2.6rem">Hjælp</h1>
<h2>Sådan kommer du i gang</h2>
<p><b>Ny hos LL Dance Studio?</b> Tilmeld dig på <a href="{BASE}/">forsiden</a> (Find dit hold → Tilmeld). Du betaler med Vipps MobilePay, og når betalingen er registreret, får du en kvittering på mail med et link til appen. Er du i tvivl om hold, så kontakt os først.</p>
<p><b>Allerede medlem, men kan ikke logge ind?</b> <a href="{BASE}/backstage/#adgang">Ansøg om adgang til Backstage</a> – danseskolen godkender dig, og du får en mail.</p>
<p><b>Allerede medlem?</b> Så er du oprettet. <a href="{BASE}/backstage/">Åbn Backstage</a> og log ind med den e-mail, du er registreret med – du får en 6-cifret kode på mail (tjek spam første gang). Ingen adgangskode at huske.</p>
<p><b>Har du fået en invitation?</b> Brug linket i mailen eller gå til <a href="{BASE}/backstage/">Hent Backstage-appen</a>, og log ind med din e-mail.</p>
<h2>Hent appen</h2>
<p>Appen virker på telefon, tablet og computer. <b>Telefon:</b> <a href="{BASE}/backstage/">Hent Backstage-appen</a> – i App Store og Google Play, når den er udgivet; indtil da føjer du den til hjemmeskærmen (iPhone: Safari → Del → “Føj til hjemmeskærm”, Android: menuen ⋮ → “Installér app”). <b>Computer:</b> <a href="{BASE}/app/">åbn appen i browseren</a> – samme login, samme indhold.</p>
<h2>Ofte stillede spørgsmål</h2>
<p><b>Jeg får ingen kode.</b> Tjek spam/kampagner og stavningen. Koden gælder i 1 time. Bruger du en anden e-mail end den, du er registreret med? Så kan appen ikke finde dig – skriv til danseskolen.</p>
<p><b>Jeg kan logge ind, men ser ingen hold.</b> Danseskolen skal godkende dig først – typisk samme dag. Du får besked i appen, når det er sket.</p>
<p><b>Hvordan melder jeg afbud?</b> I appen: tryk på træningen under Hjem → Din uge (eller i Kalender) og vælg “Meld afbud”. Træneren får besked med det samme.</p>
<p><b>Hvem skriver jeg til – og hvor?</b> Beskeder fra danseskolen ligger under Hjem. Under Hold finder du trænerens beskeder og “Skriv til træneren”. Social er holdets eget opslag-rum.</p>
<p><b>Mit barn er 13–17 år – kan det få sit eget login?</b> Ja: menuen bag dit billede → Mine børn → “Giv login”. Børn under 13 bruger appen gennem en forælder.</p>
<p><b>Jeg ser ikke koreografi-videoer.</b> På junior- og voksenhold er videoer kun for danserne selv.</p>
<p><b>Betaling.</b> Hold, klippekort og shop betales med Vipps MobilePay til studiets nummer med den reference, du får vist. På telefonen åbner appen MobilePay direkte; på computeren scanner du en QR-kode. Når betalingen er registreret, får du en kvittering på mail.</p>
<p><b>Slet min konto.</b> Mere → Indstillinger → Slet konto. Dine data slettes med det samme.</p>
<h2>Kontakt</h2><p>Hold, priser og betaling: Line Lund Olesen, {E(C["phone"])}. Tekniske problemer: <a href="mailto:{SUPPORT}">{SUPPORT}</a>.</p>"""

write("privacy/index.html", plain("Privatlivspolitik – LL Dance Studio", PRIVACY, "Sådan behandler LL Dance Studio-appen dine data."))
write("terms/index.html", plain("Vilkår – LL Dance Studio", TERMS, "Vilkår for brug af LL Dance Studio-appen."))

STORE = P.get("store", {})
_badge = lambda url, label: (f'<a class="btn" href="{url}" rel="noopener">{label} {ICON_ARROW}</a>' if url else f'<span class="btn ghost" style="opacity:.6;cursor:default">{label} · kommer snart</span>')
FEATS = ["Ugens træninger og afbud med ét tryk", "Beskeder fra træneren – og svar direkte", "Koreografi, musik og formationer til øvning hjemme", "Holdets billeder og videoer – kun for holdet", "Events, tilmelding og betaling med MobilePay", "Stjerneshoppen og klippekort"]
BACKSTAGE = f"""<section class="tight" style="padding-top:150px"><div class="wrap"><div class="hent"><div><div class="eyebrow">{ICON_LOCK} Kun for medlemmer</div><h1>Backstage <em>– appen</em></h1><p class="lead">Træninger, afbud, beskeder fra træneren, koreografi, holdets billeder og betalinger – ét sted, kun for dansere, forældre og trænere i LL Dance Studio.</p>
<div class="btns" style="margin:18px 0 6px"><a class="btn" href="{BASE}/app/" data-open>Åbn appen {ICON_ARROW}</a><a class="btn ghost" href="{BASE}/app/?web=1" data-open-web>Brug appen i browseren</a></div>
<p class="tiny muted">“Åbn appen” åbner den rigtige app, hvis den er installeret på din telefon – ellers webudgaven. Begge dele er samme login og samme indhold.</p>
<div class="card" style="margin-top:22px"><div class="eyebrow">Sådan logger du ind</div><ol class="small" style="margin:8px 0 0;padding-left:20px;line-height:1.6"><li>Tryk <b>Åbn appen</b>.</li><li>Skriv den e-mail, du er registreret med hos danseskolen – du får en 6-cifret kode på mail. Ingen adgangskode.</li><li>Færdig. Forældre ser børnenes hold gennem barnet.</li></ol><p class="tiny muted" style="margin:10px 0 0"><b>Ikke medlem endnu?</b> <a href="{BASE}/saeson-26-27/">Tilmeld dig et hold</a> først – adgangen åbnes, når tilmeldingen er godkendt.</p></div>
<div class="card" id="adgang" style="margin-top:14px"><div class="eyebrow">Mangler du adgang?</div><p class="small" style="margin:6px 0 10px">Er du allerede danser eller forælder hos LL Dance Studio, men kan ikke logge ind? Så ansøg om adgang her – danseskolen godkender dig, og du får en mail, når du kan logge ind.</p><a class="btn ghost" href="#adgang" data-access>Ansøg om adgang {ICON_ARROW}</a></div>
<ul class="feat" style="margin-top:22px">{"".join(f"<li>{E(x)}</li>" for x in FEATS)}</ul>
<p class="tiny" style="margin-top:18px"><a href="{BASE}/support/">Hjælp &amp; FAQ</a> · <a href="{BASE}/privacy/">Privatlivspolitik</a></p></div>
<div class="hent-side"><div class="hent-qr card qrcard" data-url="{STORE.get("app_store") or STORE.get("testflight") or "https://ilumie.com" + BASE + "/app/"}"><div class="eyebrow">iPhone &amp; iPad</div><div class="qr"></div>{_badge(STORE.get("app_store"), "App Store") if STORE.get("app_store") else (f'<a class="btn sm" href="{STORE["testflight"]}">Hent via TestFlight</a>' if STORE.get("testflight") else "")}<p class="tiny">{"Scan med kameraet – åbner App Store." if STORE.get("app_store") else ("Testudgave: installér først <b>TestFlight</b> fra App Store, scan så koden (eller tryk på knappen på telefonen) og vælg Install." if STORE.get("testflight") else "Scan – åbn i Safari → Del → “Føj til hjemmeskærm”. App Store-udgaven kommer snart.")}</p></div>
<div class="hent-qr card qrcard" data-url="{STORE.get("play") or STORE.get("play_test") or "https://ilumie.com" + BASE + "/app/"}"><div class="eyebrow">Android</div><div class="qr"></div>{_badge(STORE.get("play"), "Google Play") if STORE.get("play") else (f'<a class="btn sm" href="{STORE["play_test"]}">Hent via Google Play (test)</a>' if STORE.get("play_test") else "")}<p class="tiny">{"Scan med kameraet – åbner Google Play." if STORE.get("play") else ("Testudgave: scan koden, tryk <b>Bliv tester</b> og derefter <b>Download i Google Play</b>. Log ind med den Google-konto, du bruger på telefonen." if STORE.get("play_test") else "Scan – åbn i Chrome → menuen ⋮ → “Installér app”. Google Play-udgaven kommer snart.")}</p></div></div></div></div></section>"""
write("backstage/index.html", page("Backstage – appen – LL Dance Studio", BACKSTAGE, "Backstage er LL Dance Studios app for dansere, forældre og trænere – hent den eller åbn den i browseren.", "/backstage/"))
write("404.html", page("Siden findes ikke – LL Dance Studio", f'<section class="tight"><div class="wrap nf"><div class="eyebrow">404</div><h2>Den side findes <em>ikke</em></h2><p class="lead">Måske er holdet flyttet, eller linket er gammelt. Her er de to steder, de fleste leder efter.</p><div class="btns"><a class="btn" href="{BASE}/#finder">Find dit hold {ICON_ARROW}</a><a class="btn ghost" href="{BASE}/saeson-26-27/">Se holdplanen</a><a class="btn ghost" href="{BASE}/kontakt/">Kontakt os</a></div></div></section>', "Siden findes ikke.", "", small=True))
write("hent/index.html", f'<!doctype html><html lang="da"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={BASE}/backstage/"><link rel="canonical" href="https://ilumie.com{BASE}/backstage/"><title>Backstage</title></head><body><a href="{BASE}/backstage/">Backstage</a></body></html>')
write("support/index.html", plain("Hjælp – LL Dance Studio", SUPPORTP, "Kom i gang med LL Dance Studio-appen."))

# manifest for the app (main pages first, then team pages alphabetically)
_MAIN = ["home", "om-os", "medlemsskab", "saeson-26-27", "merchandise", "backstage", "kontakt", "solo-duo", "support", "privacy", "terms"]
MANIFEST.sort(key=lambda m: (_MAIN.index(m["key"]) if m["key"] in _MAIN else 99, m["title"]))
json.dump(MANIFEST, open(os.path.join(ROOT, "src", "domain", "llds", "lib", "site-manifest.generated.json"), "w", encoding="utf-8"), ensure_ascii=False)
write("style.css", CSS)
write("site.js", JS % {"url": SB_URL, "key": SB_KEY, "slug": SLUG, "base": BASE, "support": SUPPORT, "icon": ICON_ARROW.replace("%", "%%"), "catmap": json.dumps(CATALOG_MAP), "qrlib": QRLIB})
shutil.copy(os.path.join(ROOT, "public", "favicon.png"), os.path.join(OUT, "favicon.png"))
os.makedirs(os.path.join(OUT, "brand"), exist_ok=True); os.makedirs(os.path.join(OUT, "icons"), exist_ok=True)
for n in os.listdir(os.path.join(ROOT, "public", "brand")): shutil.copy(os.path.join(ROOT, "public", "brand", n), os.path.join(OUT, "brand", n))
for n in os.listdir(os.path.join(ROOT, "public", "icons")): shutil.copy(os.path.join(ROOT, "public", "icons", n), os.path.join(OUT, "icons", n))
os.makedirs(os.path.join(OUT, "art"), exist_ok=True)
for n in range(1, 7): shutil.copy(os.path.join(ROOT, "public", "art", f"{n}.jpg"), os.path.join(OUT, "art", f"{n}.jpg"))
print(f"site written to {OUT}: {len(TEAMS)} team pages")
