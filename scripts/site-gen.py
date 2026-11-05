#!/usr/bin/env python3
"""Generate the public website for LL Dance Studio – same structure, menus and URLs as lldancestudio.dk, so it can move
to Line's domain unchanged. Static content comes from site/*.json (scraped from the current site); live content
(events, news, products, the week's schedule) is read client-side from Supabase public views.
Usage: python3 scripts/site-gen.py [out_dir] [--base /llds]
"""
import json, os, shutil, sys, html
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
TEAMS = json.load(open(os.path.join(ROOT, "site", "teams.json"))) if os.path.exists(os.path.join(ROOT, "site", "teams.json")) else []
TEAMS = [t for t in TEAMS if "error" not in t]
C = P["contact"]
E = lambda x: html.escape(html.unescape(str(x)))

LOGO = """<svg class="mark" viewBox="-30 0 300 230" role="img" aria-label="LL Dance Studio"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3dc9a"/><stop offset=".35" stop-color="#c9a24a"/><stop offset=".55" stop-color="#8c6c25"/><stop offset=".8" stop-color="#e6c87a"/><stop offset="1" stop-color="#a8832f"/></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#e6c87a"/><stop offset="1" stop-color="#b48a35"/></linearGradient></defs><g fill="url(#g2)"><path d="M120 6l3.6 7.6 8.3 1.1-6.1 5.7 1.6 8.2-7.4-4.1-7.4 4.1 1.6-8.2-6.1-5.7 8.3-1.1z"/><path d="M93 12l3 6.1 6.7.9-4.9 4.6 1.3 6.6-6.1-3.3-6.1 3.3 1.3-6.6-4.9-4.6 6.7-.9z"/><path d="M147 12l3 6.1 6.7.9-4.9 4.6 1.3 6.6-6.1-3.3-6.1 3.3 1.3-6.6-4.9-4.6 6.7-.9z"/><path d="M69 24l2.5 5 5.5.8-4 3.8 1 5.4-5-2.7-5 2.7 1-5.4-4-3.8 5.5-.8z"/><path d="M171 24l2.5 5 5.5.8-4 3.8 1 5.4-5-2.7-5 2.7 1-5.4-4-3.8 5.5-.8z"/></g><circle cx="120" cy="105" r="62" fill="url(#g1)"/><g font-family="Cormorant Garamond,Georgia,serif" font-weight="600" font-size="72" fill="#0c0b0a"><g transform="matrix(-1 0 0 1 240 0)"><text x="124" y="129">L</text></g><text x="124" y="129">L</text></g><rect x="119" y="72" width="2" height="66" fill="#0c0b0a"/><text x="120" y="212" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-weight="600" font-size="34" fill="url(#g2)" letter-spacing="4">DANCE STUDIO</text></svg>"""

NAV = [("LLDS", "/"), ("Holdplan", "/saeson-26-27/"), ("Medlemsskab", "/medlemsskab/"), ("Stjerneshoppen", "/merchandise/"), ("Backstage", "/backstage/"), ("Kontakt", "/kontakt/")]

CSS = """
:root{--bg:#0a0a0b;--bg2:#121214;--card:#18181b;--line:#2a2a2f;--fg:#f2efe8;--muted:#a7a39b;--fg3:#6f6c66;--gold:#c9a24a;--gold2:#e6c87a;--gold3:#8c6c25;--gold-soft:rgba(201,162,74,.10);--display:"Cormorant Garamond",Georgia,serif;--body:"Outfit",system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--body);font-weight:300;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:var(--gold2)}h1,h2,h3,h4{font-family:var(--display);font-weight:500;margin:0;letter-spacing:.005em;text-wrap:balance}
h1{font-size:clamp(2.2rem,6vw,4rem);line-height:1.02}h1 em{font-style:italic;font-weight:400;color:var(--gold2)}
h2{font-size:clamp(1.7rem,3.5vw,2.4rem);margin:0 0 18px}h3{font-size:1.35rem}
.wrap{max-width:1100px;margin:0 auto;padding:0 20px}
header.top{position:sticky;top:0;z-index:5;background:linear-gradient(var(--bg) 70%,transparent);padding:14px 0}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{display:flex;align-items:center;gap:10px;color:var(--fg);text-decoration:none}.logo .mark{width:52px;height:40px}
nav{display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:flex-end}
nav a{color:var(--muted);text-decoration:none;padding:6px 10px;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;border-radius:999px}nav a:hover,nav a.on{color:var(--gold2)}
nav a.app{color:var(--gold2);border:1px solid var(--gold3);padding:7px 14px;margin-left:6px}
.burger{display:none;background:none;border:1px solid var(--line);color:var(--fg);border-radius:10px;padding:8px 10px;font-size:1rem}
@media(max-width:820px){nav{display:none;position:absolute;left:0;right:0;top:64px;background:var(--bg);border-bottom:1px solid var(--line);flex-direction:column;align-items:stretch;padding:10px 20px 18px}nav.open{display:flex}nav a{padding:12px 6px;font-size:.95rem;border-bottom:1px solid var(--line)}nav a.app{margin:12px 0 0;text-align:center}.burger{display:block}}
.hero{position:relative;min-height:72vh;display:flex;align-items:flex-end;padding:60px 0;background:center/cover;overflow:hidden}
.hero:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,11,.15) 0%,rgba(10,10,11,.55) 55%,var(--bg) 100%)}
.hero .wrap{position:relative}.hero.small{min-height:46vh}
.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:10px}
.lead{font-size:1.15rem;color:var(--muted);max-width:60ch;margin:16px 0 26px}
.btn{display:inline-block;background:linear-gradient(135deg,var(--gold2),var(--gold));color:#161206;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:500;letter-spacing:.02em}
.btn.ghost{background:none;color:var(--fg);border:1px solid var(--line);margin-left:8px}
section{padding:56px 0;border-top:1px solid var(--line)}section.flush{border-top:0;padding-top:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}.grid.two{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}.tiny{font-size:.78rem;color:var(--fg3)}.muted{color:var(--muted)}.small{font-size:.9rem}
.chip{display:inline-block;font-size:.75rem;padding:3px 10px;border:1px solid var(--line);border-radius:999px;color:var(--muted);margin:2px 4px 0 0}.chip.gold{color:var(--gold2);border-color:var(--gold3)}
.tile{position:relative;display:block;aspect-ratio:4/5;border-radius:18px;overflow:hidden;background:center/cover;text-decoration:none;color:var(--fg)}
.tile:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,rgba(10,10,11,.9))}
.tile span{position:absolute;left:14px;right:10px;bottom:14px;font-family:var(--display);font-size:clamp(1rem,1.6vw,1.35rem);line-height:1.15;letter-spacing:.03em}
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}@media(max-width:760px){.tiles{margin-top:20px}}
.band{position:relative;min-height:320px;border-radius:20px;overflow:hidden;display:flex;align-items:flex-end;padding:28px;background:center/cover}
.band:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,11,.1),rgba(10,10,11,.85))}.band>*{position:relative}.band h2{margin:0 0 6px}
video.uni{width:100%;border-radius:20px;display:block;background:#000}
.event{display:flex;gap:16px;align-items:flex-start;position:relative;overflow:hidden;background:center/cover}.event:before{content:"";position:absolute;inset:0;background:rgba(10,10,11,.8)}.event>*{position:relative}
.event .date{font-family:var(--display);font-size:1.6rem;line-height:1;color:var(--gold2);min-width:64px;text-align:center}.event .date small{display:block;font-family:var(--body);font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-top:4px}
.post{border-left:2px solid var(--gold3);padding-left:14px;margin-bottom:18px;white-space:pre-wrap}
/* holdplan */
.daytabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 20px}.daytabs button{background:none;border:1px solid var(--line);color:var(--muted);border-radius:999px;padding:8px 16px;font-family:inherit;font-size:.9rem;cursor:pointer}.daytabs button.on{color:var(--gold2);border-color:var(--gold3);background:var(--gold-soft)}
.day{display:none}.day.on{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:760px){.day.on{grid-template-columns:1fr}}
.room h3{font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-family:var(--body);font-weight:500;margin:0 0 10px}
.cls{display:flex;gap:14px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:10px;margin-bottom:10px;text-decoration:none;color:var(--fg)}
.cls .img{width:84px;height:84px;border-radius:10px;background:center/cover;flex:none}.cls .t{font-variant-numeric:tabular-nums;color:var(--gold2);font-size:.85rem}.cls h4{font-size:1.15rem;margin:2px 0}.cls .tiny{line-height:1.4}
a.cls:hover{border-color:var(--gold3)}.cls.na{opacity:.85}
/* team page */
.facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin:18px 0}.facts div{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px}.facts b{display:block;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:4px}
article{max-width:72ch;padding:30px 0 60px}article h1{font-size:2.4rem;margin-bottom:6px}article h2{font-size:1.5rem;margin:30px 0 10px}article p,article li{color:var(--muted)}article img{width:100%;border-radius:16px;margin:12px 0}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:18px 0}.gallery img{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:12px;margin:0}
.price{color:var(--gold2)}.table{width:100%;border-collapse:collapse}.table td{padding:10px 8px;border-bottom:1px solid var(--line)}.table td:last-child{text-align:right;color:var(--gold2)}
.staff{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}.staff .card{padding:0;overflow:hidden}.staff img{width:100%;aspect-ratio:1536/647;object-fit:cover;display:block}.staff .in{padding:14px 16px}
.contact{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
footer{padding:36px 0 50px;border-top:1px solid var(--line);color:var(--fg3);font-size:.82rem}footer a{color:var(--muted);margin-right:14px}
.empty{color:var(--fg3);font-size:.9rem}
"""

JS = r"""
const SB = "%(url)s", KEY = "%(key)s", SLUG = "%(slug)s", BASE = "%(base)s";
const q = async (view, extra = "") => { try { const r = await fetch(`${SB}/rest/v1/${view}?select=*${extra}`, { headers: { apikey: KEY } }); return r.ok ? await r.json() : []; } catch { return []; } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MON = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
const hm = (iso) => new Date(iso).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
document.querySelector(".burger")?.addEventListener("click", () => document.querySelector("nav").classList.toggle("open"));
document.querySelectorAll(".daytabs button").forEach((b) => b.addEventListener("click", () => { document.querySelectorAll(".daytabs button").forEach((x) => x.classList.toggle("on", x === b)); document.querySelectorAll(".day").forEach((d) => d.classList.toggle("on", d.dataset.day === b.dataset.day)); }));
(async () => {
  const [school] = await q("school", `&slug=eq.${SLUG}`); const f = school ? `&school_id=eq.${school.id}` : "";
  const eEl = document.getElementById("events");
  if (eEl) { const events = await q("public_events", f + "&order=starts_at");
    eEl.innerHTML = events.length ? events.map((e) => { const d = new Date(e.starts_at); return `<div class="card event"><div class="date">${d.getDate()}<small>${MON[d.getMonth()]}</small></div><div><h3>${esc(e.title)}</h3><div class="tiny">${{competition:"Konkurrence",show:"Show",workshop:"Workshop",social:"Socialt"}[e.kind] || ""}${e.place ? " · " + esc(e.place) : ""}${e.price_dkk ? " · " + e.price_dkk + " kr." : ""}</div>${e.info ? `<p class="small muted">${esc(e.info)}</p>` : ""}</div></div>`; }).join("") : '<p class="empty">Ingen kommende events lige nu – følg med her.</p>'; }
  const nEl = document.getElementById("news");
  if (nEl) { const posts = await q("public_posts", f + "&order=created_at.desc&limit=3");
    nEl.innerHTML = posts.length ? posts.map((p) => { const d = new Date(p.created_at); return `<div class="post"><div class="tiny">${d.getDate()}. ${MON[d.getMonth()]} ${d.getFullYear()}</div>${esc(p.body)}</div>`; }).join("") : ""; if (!posts.length) nEl.closest("section")?.remove(); }
  const pEl = document.getElementById("live-products");
  if (pEl) { const products = await q("public_products", f + "&order=name"); if (products.length) pEl.innerHTML = `<h2>I appen lige nu</h2><div class="grid">${products.map((p) => `<div class="card"><h3>${esc(p.name)}</h3><div class="price">${p.price_dkk} kr.</div>${p.sizes?.length ? `<div class="tiny">${p.sizes.map(esc).join(" · ")}</div>` : ""}</div>`).join("")}</div>`; }
  const sEl = document.getElementById("live-note");
  if (sEl) { const sched = await q("public_schedule", f + "&order=starts_at"); if (sched.length) sEl.innerHTML = `<div class="card"><div class="eyebrow">Denne uge</div>${sched.map((s) => `<div class="small"><span class="price">${hm(s.starts_at)}–${hm(s.ends_at)}</span> ${esc(s.name)}${s.room ? ` <span class="tiny">· ${esc(s.room)}</span>` : ""}</div>`).join("")}<p class="tiny" style="margin:8px 0 0">Aflysninger og vikarer vises i appen.</p></div>`; }
})();
"""

def page(title, body, desc, active="", hero=None, hero_title=None, hero_sub=None, small=False):
    navh = "".join(f'<a href="{BASE}{h}" class="{"on" if h == active else ""}">{l}</a>' for l, h in NAV)
    heroh = f'<div class="hero{" small" if small else ""}" style="background-image:url({hero})"><div class="wrap">{"<div class=eyebrow>" + E(hero_sub) + "</div>" if hero_sub else ""}<h1>{hero_title}</h1></div></div>' if hero else ""
    return f"""<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{E(title)}</title><meta name="description" content="{E(desc)}"><meta name="theme-color" content="#0a0a0b">
<link rel="icon" href="{BASE}/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="{BASE}/style.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Outfit:wght@300;400;500&display=swap"></head><body>
<header class="top"><div class="wrap"><a class="logo" href="{BASE}/">{LOGO}</a><button class="burger" aria-label="Menu">☰</button><nav>{navh}<a class="app" href="{BASE}/app/">Åbn appen</a></nav></div></header>
{heroh}{body}
<footer><div class="wrap"><a href="{BASE}/privacy/">Privatlivspolitik</a><a href="{BASE}/terms/">Vilkår</a><a href="{BASE}/support/">Hjælp</a><div style="margin-top:10px">© {C["name"]} · {C["address"]} · {C["phone"]} · <a href="mailto:{C["email"]}">{C["email"]}</a></div><div style="margin-top:6px">App og website drives af <a href="https://ilumie.com/">Ilumie</a></div></div></footer>
<script src="{BASE}/site.js" defer></script></body></html>"""

def write(rel, content):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, "w").write(content)

team_by_slug = {t["slug"].strip("/"): t for t in TEAMS}
def team_img(slug):
    t = team_by_slug.get(slug or ""); return (t.get("images") or [None])[0] if t else None

# ---------------- forside
H = P["home"]
home = f"""
<section class="flush"><div class="wrap" style="padding-top:40px"><div class="grid two" style="align-items:center"><div><div class="eyebrow">Ulstrup · Showdance · Hip Hop · Contemporary · Disco · Ballet</div><h2>{E(H["welcome_title"])}</h2><p class="lead" style="margin-bottom:18px">{E(H["welcome"])}</p><a class="btn" href="{BASE}/saeson-26-27/">Se holdplanen</a><a class="btn ghost" href="{BASE}/app/">Log ind i appen</a></div>
<div class="tiles">{"".join(f'<a class="tile" href="{BASE}{t["href"]}" style="background-image:url({t["image"]})"><span>{E(t["label"])}</span></a>' for t in H["tiles"])}</div></div></div></section>
<section><div class="wrap"><div class="eyebrow">{E(H["universe_title"])}</div><video class="uni" src="{H["video"]}" controls muted playsinline preload="metadata"></video></div></section>
<section><div class="wrap"><div class="eyebrow">Kommende</div><h2>Events, shows &amp; workshops</h2><div class="grid" id="events"><p class="empty">Henter…</p></div><p class="tiny" style="margin-top:12px">Tilmelding og betaling sker i appen.</p></div></section>
<section><div class="wrap"><div class="eyebrow">Fra studiet</div><h2>Nyt</h2><div id="news"></div></div></section>
<section><div class="wrap"><div class="band" style="background-image:url({H["shop_image"]})"><div><div class="eyebrow">Merchandise</div><h2>{E(H["shop_title"])}</h2><p class="muted small" style="margin:0 0 12px;max-width:52ch">{E(H["shop_text"])}</p><a class="btn" href="{BASE}/merchandise/">Se Stjerneshoppen</a></div></div></div></section>
<section><div class="wrap"><div class="band" style="background-image:url({H["welcome_band_image"]});min-height:380px"><div><h2>{E(H["welcome_band_title"])}</h2><p class="muted small" style="margin:0 0 12px;max-width:52ch">{E(H["welcome_band"])}</p><a class="btn ghost" style="margin:0" href="{BASE}/kontakt/">Kontakt os</a></div></div></div></section>
"""
write("index.html", page("LL Dance Studio – danseskole i Ulstrup", home, "Showdance, hip hop, contemporary, disco og ballet for alle aldre i Ulstrup. Holdplan, medlemsskab, Stjerneshoppen og appen.", "/", hero=H["hero"], hero_title="Dans med hjertet.<br><em>Vind med holdet.</em>", hero_sub="LL Dance Studio · Ulstrup"))

# ---------------- holdplan (sæson 26/27)
days = "".join(f'<button data-day="{i}" class="{"on" if i == 0 else ""}">{d}</button>' for i, d in enumerate(SCHED["days"]))
def cls(c):
    img = team_img(c.get("slug")); sub = f'{E(c["age"])} · {E(c["level"])}' + (" · <span class=\"chip gold\" style=\"margin:0\">Lukket hold</span>" if c.get("closed") else "")
    inner = f'<div class="img" style="background-image:url({img})"></div>' if img else '<div class="img" style="background:linear-gradient(135deg,#1c1a14,#0f0f11)"></div>'
    body = f'{inner}<div><div class="t">{E(c["time"])}</div><h4>{E(c["name"])}</h4><div class="tiny">{sub}{("<br>" + E(c["note"])) if c.get("note") else ""}</div></div>'
    return f'<a class="cls" href="{BASE}/{c["slug"]}/">{body}</a>' if c.get("slug") else f'<div class="cls na">{body}</div>'
dayblocks = ""
for i, d in enumerate(SCHED["days"]):
    rooms = "".join(f'<div class="room"><h3>{r}</h3>{"".join(cls(c) for c in SCHED["classes"] if c["day"] == i and c["room"] == r)}</div>' for r in SCHED["rooms"])
    dayblocks += f'<div class="day{" on" if i == 0 else ""}" data-day="{i}">{rooms}</div>'
monthly = "".join(f'<a class="cls" href="{BASE}/{m["slug"]}/"><div class="img" style="background-image:url({team_img(m["slug"])})"></div><div><div class="t">Én gang om måneden</div><h4>{E(m["name"])}</h4><div class="tiny">{E(m["age"])} · {E(m["level"])}<br>{E(m["note"])}</div></div></a>' for m in SCHED["monthly"])
holdplan = f"""
<section class="flush"><div class="wrap" style="padding-top:30px"><p class="lead">Træning mandag–torsdag i Store Sal og Lille Sal på Vinkelvej 17. Tryk på et hold for beskrivelse, pris og tilmelding.</p>
<div class="daytabs">{days}</div>{dayblocks}
<div style="margin-top:28px"><div class="room"><h3>Månedligt</h3>{monthly}</div></div>
<div id="live-note" style="margin-top:28px"></div>
<p class="tiny" style="margin-top:18px">Ferie og kalender for alle hold findes i appen. Aflysninger og vikarer meldes dér.</p></div></section>
"""
write("saeson-26-27/index.html", page("Holdplan – Sæson 26/27 – LL Dance Studio", holdplan, "Ugeplan for alle hold i sæson 26/27: dag, tid, sal, alder og niveau.", "/saeson-26-27/", hero=team_img("the-axis-25-26") or H["hero"], hero_title="Sæson 26/27", hero_sub="Holdplan", small=True))

# ---------------- team pages (same slugs as lldancestudio.dk)
FACT_LABELS = [("day_time", "Dag og tid"), ("style", "Stilart"), ("level", "Niveau"), ("years", "Årgang / alder"), ("trainer", "Træner"), ("assistant", "Hjælpetræner"), ("location", "Sted"), ("season", "Sæson"), ("price", "Pris"), ("audition", "Optagelse")]
for t in TEAMS:
    slug = t["slug"].strip("/"); facts = t.get("facts") or {}; imgs = t.get("images") or []
    factsh = "".join(f'<div><b>{l}</b>{E(str(facts[k]))}</div>' for k, l in FACT_LABELS if facts.get(k))
    secs = "".join(f'<h2>{E(s["title"])}</h2><p>{E(s["body"]).replace(chr(10), "<br>")}</p>' for s in (t.get("sections") or []) if s.get("body") and not any(k in s["title"].lower() for k in ("tilmeldingsprisen","rater","familierabat","kontakt os")))
    inc = f'<h2>Inkluderet i prisen</h2><ul>{"".join(f"<li>{E(x)}</li>" for x in t["included"])}</ul>' if t.get("included") else ""
    pay = f'<h2>Betaling</h2><p>{E(t["payment"])}</p>' if t.get("payment") else ""
    docs = [("Kalender (PDF)", t["calendar_pdf"])] if t.get("calendar_pdf") else []
    docs += [((d.get("title") or "Dokument"), d["url"]) if isinstance(d, dict) else (d.rsplit("/", 1)[-1].replace("-", " ").rsplit(".", 1)[0], d) for d in (t.get("documents") or [])]
    pay += f'<h2>Dokumenter</h2><ul>{"".join(f"<li><a href=\"{u}\" target=\"_blank\" rel=\"noreferrer\">{E(n)}</a></li>" for n, u in docs)}</ul>' if docs else ""
    gal = f'<div class="gallery">{"".join(f"<img src=\"{u}\" alt=\"\" loading=\"lazy\">" for u in imgs[1:5])}</div>' if len(imgs) > 1 else ""
    body = f"""<main class="wrap"><article style="max-width:80ch">{"<p class=lead>" + E(t["intro"]) + "</p>" if t.get("intro") else ""}
<div class="facts">{factsh}</div>
<p><a class="btn" href="{BASE}/app/">Tilmeld via appen</a><a class="btn ghost" href="{BASE}/saeson-26-27/">Tilbage til holdplanen</a></p>
{secs}{inc}{pay}{gal}
<p class="tiny" style="margin-top:24px">2 gratis prøvetimer for alle hold undtagen elitehold. Se <a href="{BASE}/medlemsskab/">Medlemsskab</a> for betaling i rater og familierabat.</p></article></main>"""
    write(f"{slug}/index.html", page(f"{t['title']} – LL Dance Studio", body, (t.get("intro") or t["title"])[:150], "/saeson-26-27/", hero=imgs[0] if imgs else H["hero"], hero_title=E(t["title"]), hero_sub=" · ".join(x for x in [facts.get("style"), facts.get("level")] if x) or "Hold", small=True))

# ---------------- medlemsskab
M = P["membership"]
mem = f"""<main class="wrap"><article><p class="lead">{E(M["intro"])}</p>{"".join(f'<h2>{E(s["title"])}</h2><p>{E(s["body"])}</p>' for s in M["sections"])}
<h2>Sådan gør du</h2><ol><li>Find dit hold under <a href="{BASE}/saeson-26-27/">Holdplan</a> og læs om det.</li><li>Åbn <a href="{BASE}/app/">appen</a>, log ind med din e-mail og opret din (og dine børns) profil med ønsket hold.</li><li>Line godkender – så er I på holdet, og I kan se træninger, koreografi, beskeder og meget mere.</li></ol>
<p><a class="btn" href="{BASE}/app/">Tilmeld via appen</a></p></article></main>"""
write("medlemsskab/index.html", page("Medlemsskab – LL Dance Studio", mem, "Priser, betaling i rater, familierabat, prøvetimer og fortrydelsesret.", "/medlemsskab/", hero=M["image"], hero_title="Medlemsskab", hero_sub="Sådan bliver du en del af LL Dance Studio", small=True))

# ---------------- stjerneshoppen
S = P["shop"]
rows = "".join(f'<tr><td>{E(n)}<div class="tiny">{E(sz)}</div></td><td>{p} kr.</td></tr>' for n, p, sz in S["products"])
shop = f"""<main class="wrap"><article style="max-width:80ch"><p class="lead">{E(S["intro"])}</p><p><a class="btn" href="{BASE}/app/">Bestil i appen</a></p>
<div id="live-products"></div>
<h2>Sortiment</h2><table class="table">{rows}</table><p class="tiny" style="margin-top:14px">Priser i kr. inkl. moms. Udleveres i studiet ved næste træning.</p></article></main>"""
write("merchandise/index.html", page("Stjerneshoppen – LL Dance Studio", shop, "Merchandise fra LL Dance Studio: tøj, tasker, drikkedunke – bestil i appen.", "/merchandise/", hero=S["image"], hero_title="Stjerneshoppen", hero_sub="DanseSkolens merchandise", small=True))

# ---------------- backstage (trænere) + app login
staff = "".join(f'<div class="card"><img src="{s["image"]}" alt="{E(s["name"])}" loading="lazy"><div class="in"><h3>{E(s["name"])}</h3><div class="tiny" style="color:var(--gold)">{E(s["role"])}</div>{("<div class=tiny style=margin-top:4px>" + E(s["teaches"]) + "</div>") if s.get("teaches") else ""}<p class="small muted" style="margin:8px 0 0">{E(s["bio"])}</p></div></div>' for s in P["staff"])
back = f"""<section class="flush"><div class="wrap" style="padding-top:30px"><p class="lead">Mød holdet bag LL Dance Studio. Er du danser, forælder eller træner, finder du alt det praktiske i appen – træninger, afbud, koreografi, beskeder og holdets mapper.</p><p><a class="btn" href="{BASE}/app/">Log ind i appen</a></p>
<h2 style="margin-top:36px">Trænere</h2><div class="staff">{staff}</div></div></section>"""
write("backstage/index.html", page("Backstage – LL Dance Studio", back, "Trænerne bag LL Dance Studio – og indgangen til appen for dansere, forældre og trænere.", "/backstage/", hero=P["staff"][0]["image"], hero_title="Backstage", hero_sub="Trænerne – og appen", small=True))

# ---------------- kontakt
kon = f"""<main class="wrap"><article><div class="contact"><div class="card"><h3>Adresse</h3><p class="muted">{E(C["address"])}</p><a href="{C["map"]}" target="_blank" rel="noreferrer">Åbn i Google Maps</a></div><div class="card"><h3>Telefon</h3><p class="muted"><a href="tel:{C["phone"].replace(" ", "")}">{E(C["phone"])}</a></p><p class="tiny">{E(C["hours"])}</p></div><div class="card"><h3>E-mail</h3><p class="muted"><a href="mailto:{C["email"]}">{E(C["email"])}</a></p></div><div class="card"><h3>Tilmelding</h3><p class="muted">Opret dig i appen, vælg hold – Line godkender inden for en dag.</p><a href="{BASE}/app/">Åbn appen</a></div></div>
<p class="lead" style="margin-top:28px">Du er altid velkommen til at kontakte os, uanset om du ønsker at deltage på et af vores hold, har spørgsmål til programmer eller bare vil vide mere.</p></article></main>"""
write("kontakt/index.html", page("Kontakt – LL Dance Studio", kon, "Kontakt LL Dance Studio i Ulstrup – adresse, telefon, e-mail og telefontid.", "/kontakt/", hero=C["image"], hero_title="Kontakt os", hero_sub="Vi svarer gerne", small=True))

# ---------------- privacy / terms / support (unchanged content)
PRIVACY = f"""<main class="wrap"><article><h1>Privatlivspolitik</h1><p class="muted">Sidst opdateret {TODAY}</p>
<p>LL Dance Studio-appen og dette website drives af Ilumie (Therkildsen Group, CVR 46203798) for LL Dance Studio, {E(C["address"])}. LL Dance Studio er dataansvarlig for medlemsdata; Ilumie er databehandler.</p>
<h2>Hvad vi gemmer</h2><ul><li><b>Profil:</b> navn, e-mail, telefon, fødselsår, hold og rolle (danser, forælder, træner). Børn under 13 har ingen egen konto – deres profil ligger under forælderens. Børn på 10–12 år kan få et begrænset login, som forælderen opretter og kan lukke igen.</li>
<li><b>Træning:</b> afbud, fremmøde, bookinger af sale, klippekort og tilmeldinger til events.</li><li><b>Indhold:</b> opslag, kommentarer, billeder og videoer i holdets rum. Kun synligt for holdet, forældre og trænere – aldrig offentligt, medmindre Line udtrykkeligt markerer et opslag som offentligt.</li>
<li><b>Køb:</b> ordrer i shoppen og klippekort. Betaling sker via MobilePay direkte til LL Dance Studio – appen gemmer ingen betalingsoplysninger.</li><li><b>Teknisk:</b> login-tidspunkter og en logbog over administrative handlinger.</li></ul>
<h2>Hvor data ligger</h2><p>Alle data gemmes hos Supabase i EU (Irland). Login-mails sendes via Resend (EU). Der bruges ingen tracking, annoncer eller analyseværktøjer.</p>
<h2>Hvem kan se hvad</h2><p>Adgang styres pr. hold: dansere ser deres eget hold, forældre ser deres børns hold, trænere ser de hold de underviser, og Line (administrator) ser hele studiet. Fotos af børn kan fravælges (fotosamtykke) i profilen.</p>
<h2>Sletning</h2><p>Skriv til <a href="mailto:{SUPPORT}">{SUPPORT}</a> eller til Line. Data slettes senest 30 dage efter udmeldelse, bortset fra hvad bogføringsloven kræver om køb.</p>
<h2>Dine rettigheder</h2><p>Du har ret til indsigt, berigtigelse, sletning og dataportabilitet efter GDPR. Klager kan rettes til Datatilsynet.</p></article></main>"""
TERMS = f"""<main class="wrap"><article><h1>Vilkår for brug</h1><p class="muted">Sidst opdateret {TODAY}</p>
<h2>Konto</h2><p>Appen er for medlemmer af LL Dance Studio, deres forældre og trænere. Line godkender alle profiler. Egen konto kræver, at du er fyldt 13 år; yngre dansere er under en forælders profil.</p>
<h2>God tone</h2><p>Holdets rum er et trygt sted. Vær sød og respektfuld – ingen mobning, ingen deling af andres billeder uden for appen. Trænere og Line læser med, og alt kan anmeldes med ét tryk. Indhold, der bryder reglerne, fjernes, og gentagne brud kan føre til lukning af kontoen.</p>
<h2>Billeder og video</h2><p>Billeder og koreografi-videoer tilhører LL Dance Studio og må kun bruges til egen øvelse – ikke deles på sociale medier uden aftale.</p>
<h2>Køb og medlemsskab</h2><p>Priser er i danske kroner inkl. moms. Shop og klippekort betales via MobilePay; ordren bekræftes, når LL Dance Studio har registreret betalingen. Klippekort gælder 12 måneder fra aktivering. Sæsonpris, rater, prøvetimer og fortrydelsesret: se <a href="{BASE}/medlemsskab/">Medlemsskab</a>.</p>
<h2>Drift</h2><p>Appen leveres som den er; vi tilstræber høj oppetid, men garanterer den ikke. Ilumie kan opdatere appen og disse vilkår – væsentlige ændringer meldes i appen.</p><p>Kontakt: <a href="mailto:{SUPPORT}">{SUPPORT}</a></p></article></main>"""
SUPPORTP = f"""<main class="wrap"><article><h1>Hjælp</h1>
<h2>Sådan kommer du i gang</h2><ol><li>Åbn <a href="{BASE}/app/">appen</a> og skriv din e-mail – du får en 6-cifret kode (tjek spam første gang).</li><li>Udfyld din profil og dine børn, vælg hold og tryk Send.</li><li>Line godkender – typisk samme dag.</li></ol>
<h2>Føj appen til hjemmeskærmen</h2><p><b>iPhone:</b> åbn linket i Safari → Del → “Føj til hjemmeskærm”. <b>Android:</b> menuen (⋮) → “Installér app”.</p>
<h2>Ofte stillede spørgsmål</h2><p><b>Jeg får ingen kode.</b> Tjek spam/kampagner og stavningen. Koden gælder i 1 time.</p><p><b>Mit barn er 10–12 år – kan det få sit eget login?</b> Ja: Mere → Indstillinger → dit barn → “Giv login”.</p><p><b>Jeg ser ikke koreografi-videoer.</b> På junior- og voksenhold er videoer kun for danserne selv.</p><p><b>Betaling.</b> Shop, klippekort og egenbetaling betales med MobilePay i appen – tryk “Jeg har betalt”, Line bekræfter.</p>
<h2>Kontakt</h2><p>Hold, priser og betaling: Line Lund Olesen, {E(C["phone"])}. Tekniske problemer: <a href="mailto:{SUPPORT}">{SUPPORT}</a>.</p></article></main>"""
write("privacy/index.html", page("Privatlivspolitik – LL Dance Studio", PRIVACY, "Sådan behandler LL Dance Studio-appen dine data."))
write("terms/index.html", page("Vilkår – LL Dance Studio", TERMS, "Vilkår for brug af LL Dance Studio-appen."))
write("support/index.html", page("Hjælp – LL Dance Studio", SUPPORTP, "Kom i gang med LL Dance Studio-appen."))

write("style.css", CSS)
write("site.js", JS % {"url": SB_URL, "key": SB_KEY, "slug": SLUG, "base": BASE})
shutil.copy(os.path.join(ROOT, "public", "favicon.svg"), os.path.join(OUT, "favicon.svg"))
print(f"site written to {OUT}: {len(TEAMS)} team pages")
