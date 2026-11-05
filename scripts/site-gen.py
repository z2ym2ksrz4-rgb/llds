#!/usr/bin/env python3
"""Generate the public website for LL Dance Studio into a target folder (default ../ilumie-site/llds).
Pages: index (dynamic: teams, timetable, events, news, shop from Supabase public views), privacy, terms, support.
Usage: python3 scripts/site-gen.py [out_dir] [--base /llds]
"""
import json, os, shutil, sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg = json.load(open(os.path.join(ROOT, "app.config.json")))
OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else os.path.join(ROOT, "..", "ilumie-site", "llds")
BASE = "/llds"
if "--base" in sys.argv: BASE = sys.argv[sys.argv.index("--base") + 1]
SB_URL, SB_KEY = cfg["supabase"]["url"], cfg["supabase"]["anonKey"]
SLUG = cfg["schoolSlug"]; SUPPORT = cfg["supportEmail"]; TODAY = date.today().strftime("%-d. %B %Y").replace("November", "november")
MONTHS = ["januar","februar","marts","april","maj","juni","juli","august","september","oktober","november","december"]
TODAY = f"{date.today().day}. {MONTHS[date.today().month-1]} {date.today().year}"

LOGO = """<svg class="mark" viewBox="-30 0 300 230" role="img" aria-label="LL Dance Studio"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3dc9a"/><stop offset=".35" stop-color="#c9a24a"/><stop offset=".55" stop-color="#8c6c25"/><stop offset=".8" stop-color="#e6c87a"/><stop offset="1" stop-color="#a8832f"/></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4"/><stop offset=".5" stop-color="#e6c87a"/><stop offset="1" stop-color="#b48a35"/></linearGradient></defs><g fill="url(#g2)"><path d="M120 6l3.6 7.6 8.3 1.1-6.1 5.7 1.6 8.2-7.4-4.1-7.4 4.1 1.6-8.2-6.1-5.7 8.3-1.1z"/><path d="M93 12l3 6.1 6.7.9-4.9 4.6 1.3 6.6-6.1-3.3-6.1 3.3 1.3-6.6-4.9-4.6 6.7-.9z"/><path d="M147 12l3 6.1 6.7.9-4.9 4.6 1.3 6.6-6.1-3.3-6.1 3.3 1.3-6.6-4.9-4.6 6.7-.9z"/><path d="M69 24l2.5 5 5.5.8-4 3.8 1 5.4-5-2.7-5 2.7 1-5.4-4-3.8 5.5-.8z"/><path d="M171 24l2.5 5 5.5.8-4 3.8 1 5.4-5-2.7-5 2.7 1-5.4-4-3.8 5.5-.8z"/></g><circle cx="120" cy="105" r="62" fill="url(#g1)"/><g font-family="Cormorant Garamond,Georgia,serif" font-weight="600" font-size="72" fill="#0c0b0a"><g transform="matrix(-1 0 0 1 240 0)"><text x="124" y="129">L</text></g><text x="124" y="129">L</text></g><rect x="119" y="72" width="2" height="66" fill="#0c0b0a"/><text x="120" y="212" text-anchor="middle" font-family="Cormorant Garamond,Georgia,serif" font-weight="600" font-size="34" fill="url(#g2)" letter-spacing="4">DANCE STUDIO</text></svg>"""

CSS = """
:root{--bg:#0a0a0b;--bg2:#121214;--card:#18181b;--line:#2a2a2f;--fg:#f2efe8;--muted:#a7a39b;--fg3:#6f6c66;--gold:#c9a24a;--gold2:#e6c87a;--gold3:#8c6c25;--gold-soft:rgba(201,162,74,.10);--display:"Cormorant Garamond",Georgia,serif;--body:"Outfit",system-ui,-apple-system,"Segoe UI",sans-serif}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--body);font-weight:300;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:var(--gold2)}h1,h2,h3{font-family:var(--display);font-weight:500;margin:0;letter-spacing:.005em;text-wrap:balance}
h1{font-size:clamp(2.4rem,7vw,4.4rem);line-height:1.02}h1 em{font-style:italic;font-weight:400;color:var(--gold2)}
h2{font-size:clamp(1.7rem,3.5vw,2.4rem);margin:0 0 18px}h3{font-size:1.35rem}
.wrap{max-width:1100px;margin:0 auto;padding:0 20px}
header.top{position:sticky;top:0;z-index:5;background:linear-gradient(var(--bg) 70%,transparent);padding:14px 0}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{display:flex;align-items:center;gap:10px;color:var(--fg);text-decoration:none;font-family:var(--display);font-size:1.2rem;letter-spacing:.06em}
.logo .mark{width:46px;height:36px}
nav a{color:var(--muted);text-decoration:none;margin-left:18px;font-size:.85rem;letter-spacing:.08em;text-transform:uppercase}nav a:hover{color:var(--gold2)}
nav a.app{color:var(--gold2);border:1px solid var(--gold3);border-radius:999px;padding:7px 14px}
@media(max-width:640px){nav a:not(.app){display:none}}
.hero{position:relative;padding:60px 0 70px;overflow:hidden}
.hero:before{content:"";position:absolute;inset:0;background:radial-gradient(60% 60% at 70% 0%,rgba(201,162,74,.28),transparent 70%),linear-gradient(180deg,#15120d,transparent 70%);pointer-events:none}
.hero .wrap{position:relative;display:grid;grid-template-columns:1.2fr .8fr;gap:40px;align-items:center}
@media(max-width:800px){.hero .wrap{grid-template-columns:1fr}}
.hero .mark{width:min(260px,70vw);filter:drop-shadow(0 12px 32px rgba(201,162,74,.3));justify-self:center}
.eyebrow{font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:10px}
.lead{font-size:1.15rem;color:var(--muted);max-width:52ch;margin:16px 0 26px}
.btn{display:inline-block;background:linear-gradient(135deg,var(--gold2),var(--gold));color:#161206;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:500;letter-spacing:.02em}
.btn.ghost{background:none;color:var(--fg);border:1px solid var(--line);margin-left:8px}
section{padding:48px 0;border-top:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
.card h3{margin-bottom:4px}.tiny{font-size:.78rem;color:var(--fg3)}.muted{color:var(--muted)}.small{font-size:.9rem}
.chip{display:inline-block;font-size:.75rem;padding:3px 10px;border:1px solid var(--line);border-radius:999px;color:var(--muted);margin:2px 4px 0 0}
.chip.gold{color:var(--gold2);border-color:var(--gold3)}
.cat{margin-top:28px}.cat:first-child{margin-top:0}
.cat h3{font-size:1rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-family:var(--body);font-weight:500;margin-bottom:10px}
.tt{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.tt .day h4{margin:0 0 8px;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:500}
.tt .blk{border:1px solid var(--line);border-left:2px solid var(--gold);border-radius:8px;padding:6px 9px;font-size:.8rem;margin-bottom:6px;background:var(--card)}
.tt .blk b{display:block;font-weight:500}.tt .blk span{color:var(--muted);font-size:.72rem}
.event{display:flex;gap:16px;align-items:flex-start}.event .date{font-family:var(--display);font-size:1.6rem;line-height:1;color:var(--gold2);min-width:64px;text-align:center}
.event .date small{display:block;font-family:var(--body);font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-top:4px}
.post{border-left:2px solid var(--gold3);padding-left:14px;margin-bottom:18px;white-space:pre-wrap}
.product .img{aspect-ratio:1/1;border-radius:12px;background:linear-gradient(135deg,#1c1a14,#0f0f11);display:grid;place-items:center;color:var(--gold3);font-family:var(--display);font-size:2.4rem;margin-bottom:10px;overflow:hidden}.product .img img{width:100%;height:100%;object-fit:cover}
.price{color:var(--gold2)}
.contact{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
footer{padding:36px 0 50px;border-top:1px solid var(--line);color:var(--fg3);font-size:.82rem}footer a{color:var(--muted);margin-right:14px}
article{max-width:70ch;padding:30px 0 60px}article h1{font-size:2.4rem;margin-bottom:6px}article h2{font-size:1.5rem;margin:30px 0 10px}article p,article li{color:var(--muted)}
.empty{color:var(--fg3);font-size:.9rem}
.install{background:var(--gold-soft);border:1px solid var(--gold3);border-radius:16px;padding:18px 20px}
"""

JS = """
const SB = "%(url)s", KEY = "%(key)s", SLUG = "%(slug)s";
const q = async (view, extra = "") => { try { const r = await fetch(`${SB}/rest/v1/${view}?select=*${extra}`, { headers: { apikey: KEY } }); return r.ok ? await r.json() : []; } catch { return []; } };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const DAYS = ["Mandag","Tirsdag","Onsdag","Torsdag","Fredag","Lørdag","Søndag"]; const MON = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
const hm = (iso) => new Date(iso).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
const CAT = { mini: "Mini (3–6 år)", kids: "Børn", junior: "Junior", adult: "Voksen", mixed: "Junior & Voksen" };
(async () => {
  const [school] = await q("school", `&slug=eq.${SLUG}`); const sid = school?.id;
  if (school) { const s = school.settings || {}; document.querySelectorAll("[data-contact]").forEach((el) => { el.textContent = s[el.dataset.contact] || ""; }); }
  const f = sid ? `&school_id=eq.${sid}` : "";
  // teams by category
  const teams = await q("public_teams", f + "&order=sort");
  const tEl = document.getElementById("teams");
  if (teams.length) {
    const cats = ["mini", "kids", "junior", "adult", "mixed"].filter((c) => teams.some((t) => t.category === c));
    tEl.innerHTML = cats.map((c) => `<div class="cat"><h3>${CAT[c]}</h3><div class="grid">${teams.filter((t) => t.category === c).map((t) => `<div class="card"><h3>${esc(t.name)}</h3><div class="tiny">${esc(t.style || "")}${t.level ? " · " + esc(t.level) : ""}</div>${t.description ? `<p class="small muted">${esc(t.description)}</p>` : ""}<div>${t.closed ? '<span class="chip gold">Lukket hold – audition</span>' : '<span class="chip">Åbent for tilmelding</span>'}${t.punch_card_open ? '<span class="chip">Klippekort</span>' : ""}</div></div>`).join("")}</div></div>`).join("");
  } else tEl.innerHTML = '<p class="empty">Holdene for sæsonen er på vej.</p>';
  // timetable
  const sched = await q("public_schedule", f + "&order=starts_at");
  const sEl = document.getElementById("timetable");
  if (sched.length) {
    const byDay = {}; for (const s of sched) { const d = (new Date(s.starts_at).getDay() + 6) %% 7; (byDay[d] ||= []).push(s); }
    sEl.innerHTML = Object.keys(byDay).sort().map((d) => `<div class="day"><h4>${DAYS[d]}</h4>${byDay[d].map((s) => `<div class="blk"><b>${esc(s.name)}</b><span>${hm(s.starts_at)}–${hm(s.ends_at)}${s.room ? " · " + esc(s.room) : ""}</span></div>`).join("")}</div>`).join("");
  } else sEl.innerHTML = '<p class="empty">Ugeskemaet offentliggøres, når sæsonplanen er lagt.</p>';
  // events
  const events = await q("public_events", f + "&order=starts_at");
  const eEl = document.getElementById("events");
  eEl.innerHTML = events.length ? events.map((e) => { const d = new Date(e.starts_at); return `<div class="card event"><div class="date">${d.getDate()}<small>${MON[d.getMonth()]}</small></div><div><h3>${esc(e.title)}</h3><div class="tiny">${{competition:"Konkurrence",show:"Show",workshop:"Workshop",social:"Socialt"}[e.kind] || ""}${e.place ? " · " + esc(e.place) : ""}${e.team_names?.length ? " · " + e.team_names.map(esc).join(", ") : ""}</div>${e.info ? `<p class="small muted">${esc(e.info)}</p>` : ""}</div></div>`; }).join("") : '<p class="empty">Ingen kommende events lige nu.</p>';
  // news
  const posts = await q("public_posts", f + "&order=created_at.desc&limit=4");
  const nEl = document.getElementById("news");
  nEl.innerHTML = posts.length ? posts.map((p) => { const d = new Date(p.created_at); return `<div class="post"><div class="tiny">${d.getDate()}. ${MON[d.getMonth()]} ${d.getFullYear()}${p.team_name ? " · " + esc(p.team_name) : ""}</div>${esc(p.body)}</div>`; }).join("") : '<p class="empty">Følg med her – nyheder fra studiet kommer løbende.</p>';
  // shop
  const products = await q("public_products", f + "&order=name");
  const pEl = document.getElementById("shop");
  pEl.innerHTML = products.length ? products.map((p) => `<div class="card product"><div class="img">${p.image_path ? `<img src="${SB}/storage/v1/object/public/public/${esc(p.image_path)}" alt="">` : esc(p.name[0])}</div><h3>${esc(p.name)}</h3><div class="price">${p.price_dkk} kr.</div>${p.sizes?.length ? `<div class="tiny">${p.sizes.map(esc).join(" · ")}</div>` : ""}</div>`).join("") : '<p class="empty">Merchandise kommer snart.</p>';
})();
"""

def page(title, body, desc, path_depth=0, extra_head=""):
    return f"""<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><meta name="description" content="{desc}"><meta name="theme-color" content="#0a0a0b">
<link rel="icon" href="{BASE}/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="{BASE}/style.css">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Outfit:wght@300;400;500&display=swap">{extra_head}</head><body>
<header class="top"><div class="wrap"><a class="logo" href="{BASE}/">{LOGO}</a><nav><a href="{BASE}/#hold">Hold</a><a href="{BASE}/#skema">Skema</a><a href="{BASE}/#events">Events</a><a href="{BASE}/#shop">Shop</a><a href="{BASE}/#kontakt">Kontakt</a><a class="app" href="{BASE}/app/">Åbn appen</a></nav></div></header>
{body}
<footer><div class="wrap"><a href="{BASE}/privacy/">Privatlivspolitik</a><a href="{BASE}/terms/">Vilkår</a><a href="{BASE}/support/">Hjælp</a><div style="margin-top:10px">© LL Dance Studio · Vinkelvej 17, 8860 Ulstrup · App og website drives af <a href="https://ilumie.com/">Ilumie</a></div></div></footer>
</body></html>"""

INDEX = f"""
<div class="hero"><div class="wrap"><div><div class="eyebrow">Ulstrup · Showdance · Hip Hop · Contemporary · Ballet</div><h1>Dans med hjertet.<br><em>Vind med holdet.</em></h1>
<p class="lead">LL Dance Studio er danseskolen i Ulstrup for alle fra 3 år til voksne – fra Mini Cuties til DM-hold. Her er plads til at lære, lege og konkurrere.</p>
<a class="btn" href="#hold">Se holdene</a><a class="btn ghost" href="{BASE}/app/">Log ind i appen</a></div>{LOGO}</div></div>
<section id="hold"><div class="wrap"><div class="eyebrow">Sæson 26/27</div><h2>Vores hold</h2><div id="teams"><p class="empty">Henter hold…</p></div></div></section>
<section id="skema"><div class="wrap"><div class="eyebrow">Ugens træninger</div><h2>Skema</h2><div class="tt" id="timetable"><p class="empty">Henter skema…</p></div><p class="tiny" style="margin-top:14px">Skemaet viser den kommende uge og opdateres automatisk fra studiets planlægning. Aflysninger og vikarer meldes i appen.</p></div></section>
<section id="events"><div class="wrap"><div class="eyebrow">Konkurrencer & shows</div><h2>Events</h2><div class="grid" id="events"><p class="empty">Henter events…</p></div></div></section>
<section id="nyt"><div class="wrap"><div class="eyebrow">Fra studiet</div><h2>Nyt</h2><div id="news"></div></div></section>
<section id="shop"><div class="wrap"><div class="eyebrow">Merchandise</div><h2>Shop</h2><div class="grid" id="shop"></div><p class="tiny" style="margin-top:14px">Bestilling og betaling (MobilePay) sker i appen – varerne udleveres i studiet.</p></div></section>
<section id="app"><div class="wrap"><div class="install"><div class="eyebrow">Appen</div><h2>Alt om dit hold – ét sted</h2><p class="muted">Træninger, afbud, koreografi-video, holdets mapper, beskeder fra Line, bookinger af salene, klippekort og shop. Dansere, forældre og trænere logger ind med deres e-mail – ingen adgangskode.</p>
<a class="btn" href="{BASE}/app/">Åbn appen</a><p class="tiny" style="margin-top:12px">På iPhone: åbn linket i Safari → Del → “Føj til hjemmeskærm”. På Android: menuen → “Installér app”. Butiksversioner følger.</p></div></div></section>
<section id="kontakt"><div class="wrap"><div class="eyebrow">Kontakt</div><h2>Find os</h2><div class="contact">
<div class="card"><h3>Adresse</h3><p class="muted" data-contact="address">Vinkelvej 17, 8860 Ulstrup</p></div>
<div class="card"><h3>Telefon</h3><p class="muted" data-contact="phone"></p></div>
<div class="card"><h3>E-mail</h3><p class="muted" data-contact="email"></p></div>
<div class="card"><h3>Tilmelding</h3><p class="muted">Opret dig i appen, vælg hold – Line godkender inden for en dag.</p></div></div></div></section>
<script src="{BASE}/site.js" defer></script>
"""

PRIVACY = f"""<main class="wrap"><article><h1>Privatlivspolitik</h1><p class="muted">Sidst opdateret {TODAY}</p>
<p>LL Dance Studio-appen og dette website drives af Ilumie (Therkildsen Group, CVR 46203798) for LL Dance Studio, Vinkelvej 17, 8860 Ulstrup. LL Dance Studio er dataansvarlig for medlemsdata; Ilumie er databehandler.</p>
<h2>Hvad vi gemmer</h2><ul><li><b>Profil:</b> navn, e-mail, telefon, fødselsår, hold og rolle (danser, forælder, træner). Børn under 13 har ingen egen konto – deres profil ligger under forælderens. Børn på 10–12 år kan få et begrænset login, som forælderen opretter og kan lukke igen.</li>
<li><b>Træning:</b> afbud, fremmøde, bookinger af sale, klippekort og tilmeldinger til events.</li><li><b>Indhold:</b> opslag, kommentarer, billeder og videoer, som medlemmer eller trænere lægger op i holdets rum. Det er kun synligt for holdet, forældre og trænere – aldrig offentligt, medmindre Line udtrykkeligt markerer et opslag som offentligt.</li>
<li><b>Køb:</b> ordrer i shoppen og klippekort. Betaling sker via MobilePay direkte til LL Dance Studio – appen gemmer ingen betalingsoplysninger.</li><li><b>Teknisk:</b> login-tidspunkter og en logbog over administrative handlinger.</li></ul>
<h2>Hvor data ligger</h2><p>Alle data gemmes hos Supabase i EU (Irland). Login-mails sendes via Resend (EU). Der bruges ingen tracking, annoncer eller analyseværktøjer.</p>
<h2>Hvem kan se hvad</h2><p>Adgang styres pr. hold: dansere ser deres eget hold, forældre ser deres børns hold, trænere ser de hold de underviser, og Line (administrator) ser hele studiet. Fotos af børn kan fravælges (fotosamtykke) i profilen.</p>
<h2>Sletning</h2><p>Du kan få din profil og dit indhold slettet ved at skrive til <a href="mailto:{SUPPORT}">{SUPPORT}</a> eller til Line. Data slettes senest 30 dage efter udmeldelse, bortset fra hvad bogføringsloven kræver om køb.</p>
<h2>Dine rettigheder</h2><p>Du har ret til indsigt, berigtigelse, sletning og dataportabilitet efter GDPR. Klager kan rettes til Datatilsynet.</p></article></main>"""

TERMS = f"""<main class="wrap"><article><h1>Vilkår for brug</h1><p class="muted">Sidst opdateret {TODAY}</p>
<h2>Konto</h2><p>Appen er for medlemmer af LL Dance Studio, deres forældre og trænere. Line godkender alle profiler. Egen konto kræver, at du er fyldt 13 år; yngre dansere er under en forælders profil.</p>
<h2>God tone</h2><p>Holdets rum er et trygt sted. Vær sød og respektfuld – ingen mobning, ingen deling af andres billeder uden for appen. Trænere og Line læser med, og alt kan anmeldes med ét tryk. Indhold, der bryder reglerne, fjernes, og gentagne brud kan føre til lukning af kontoen.</p>
<h2>Billeder og video</h2><p>Billeder og koreografi-videoer tilhører LL Dance Studio og må kun bruges til egen øvelse. De må ikke deles på sociale medier uden aftale.</p>
<h2>Køb</h2><p>Priser i shoppen og på klippekort er i danske kroner inkl. moms. Betaling sker via MobilePay; ordren bekræftes, når LL Dance Studio har registreret betalingen. Klippekort gælder 12 måneder fra aktivering. Spørgsmål om køb rettes til Line.</p>
<h2>Drift</h2><p>Appen leveres som den er; vi tilstræber høj oppetid, men garanterer den ikke. Ilumie kan opdatere appen og disse vilkår – væsentlige ændringer meldes i appen.</p>
<p>Kontakt: <a href="mailto:{SUPPORT}">{SUPPORT}</a></p></article></main>"""

SUPPORTP = f"""<main class="wrap"><article><h1>Hjælp</h1>
<h2>Sådan kommer du i gang</h2><ol><li>Åbn <a href="{BASE}/app/">appen</a> og skriv din e-mail – du får en 6-cifret kode (tjek spam første gang).</li><li>Udfyld din profil og dine børn, vælg hold og tryk Send.</li><li>Line godkender – typisk samme dag. Så er du inde.</li></ol>
<h2>Føj appen til hjemmeskærmen</h2><p><b>iPhone:</b> åbn linket i Safari → tryk Del-ikonet → “Føj til hjemmeskærm”. <b>Android:</b> menuen (⋮) → “Installér app” / “Føj til startskærm”.</p>
<h2>Ofte stillede spørgsmål</h2><p><b>Jeg får ingen kode.</b> Tjek spam/kampagner, og at e-mailen er stavet rigtigt. Koden gælder i 1 time.</p><p><b>Mit barn er 10–12 år – kan det få sit eget login?</b> Ja: Indstillinger → dit barn → “Giv login”. Du kan altid lukke det igen.</p><p><b>Jeg ser ikke koreografi-videoer.</b> På junior- og voksenhold er videoer kun for danserne selv (ikke forældre).</p><p><b>Betaling.</b> Shop, klippekort og egenbetaling til events betales med MobilePay til LL Dance Studio. Tryk “Jeg har betalt” – Line bekræfter.</p>
<h2>Kontakt</h2><p>Spørgsmål om hold, priser og betaling: Line Lund Olesen, LL Dance Studio. Tekniske problemer: <a href="mailto:{SUPPORT}">{SUPPORT}</a>.</p></article></main>"""

def write(rel, content):
    p = os.path.join(OUT, rel); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w").write(content)

os.makedirs(OUT, exist_ok=True)
write("index.html", page("LL Dance Studio – danseskole i Ulstrup", INDEX, "Showdance, hip hop, contemporary og ballet for børn, unge og voksne i Ulstrup. Se hold, skema, events og log ind i appen."))
write("privacy/index.html", page("Privatlivspolitik – LL Dance Studio", PRIVACY, "Sådan behandler LL Dance Studio-appen dine data."))
write("terms/index.html", page("Vilkår – LL Dance Studio", TERMS, "Vilkår for brug af LL Dance Studio-appen."))
write("support/index.html", page("Hjælp – LL Dance Studio", SUPPORTP, "Kom i gang med LL Dance Studio-appen."))
write("style.css", CSS)
write("site.js", JS % {"url": SB_URL, "key": SB_KEY, "slug": SLUG})
shutil.copy(os.path.join(ROOT, "public", "favicon.svg"), os.path.join(OUT, "favicon.svg"))
print("site written to", OUT)
