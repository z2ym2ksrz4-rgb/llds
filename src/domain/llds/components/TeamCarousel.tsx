import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type MediaItem, type Team } from "@/core/api";
import { useAuth } from "@/core/auth";
import { useNav } from "@/core/nav";
import { catalogFor, catalogUrl, resolveImage } from "../lib/catalog";
import { Sheet } from "./Sheet";

/** Pictures for a team's carousel: what admin/trainer chose, else a stable random pick (Line's photos → cover → catalog). */
export function teamSlides(team: Team, seed: number): string[] {
  if (team.gallery?.length) return team.gallery.map((r) => catalogUrl(r) ?? resolveImage(r) ?? "").filter(Boolean);
  const own = [...(team.photos ?? []), ...(team.cover_url && /^https?:/.test(team.cover_url) ? [team.cover_url] : [])];
  const pool = own.length ? own : catalogFor("team").map((c) => catalogUrl(c.key)!);
  let h = seed; for (const c of team.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out: string[] = []; const used = new Set<number>();
  for (let i = 0; i < Math.min(3, pool.length); i++) { h = (h * 1103515245 + 12345) >>> 0; let k = h % pool.length; while (used.has(k)) k = (k + 1) % pool.length; used.add(k); out.push(pool[k]); }
  return out;
}

/** Home: one snap-scrolling strip of the viewed person's teams – a photo per team with the name on it; tap → that team. */
export function TeamCarousel() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me); const viewing = useAuth((s) => s.viewing); const setTeam = useAuth((s) => s.setTeam); const setViewing = useAuth((s) => s.setViewing);
  const setTab = useNav((s) => s.setTab);
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const slides = useMemo(() => {
    if (!me || !viewing) return [];
    const seed = Math.floor(Date.now() / 864e5); // new random pick every day
    const ids = new Set<string>();
    for (const m of me.memberships) if (m.person_id === me.person.id || (me.children.some((c) => c.id === m.person_id) && m.role === "dancer")) ids.add(m.team_id);
    const teams = me.teams.filter((x) => ids.has(x.id));
    return teams.flatMap((team) => teamSlides(team, seed).map((url) => ({ team, url, child: me.children.find((c) => me.memberships.some((m) => m.person_id === c.id && m.team_id === team.id && m.role === "dancer")) })));
  }, [me, viewing]);
  // gentle auto-advance while visible
  useEffect(() => {
    if (slides.length < 2) return;
    const i = setInterval(() => { const el = ref.current; if (!el || document.visibilityState !== "visible") return; const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return; const next = (idx + 1) % slides.length; const c = el.children[next] as HTMLElement | undefined; if (c) el.scrollTo({ left: c.offsetLeft - 16, behavior: "smooth" }); }, 5000);
    return () => clearInterval(i);
  }, [idx, slides.length]);
  if (!slides.length) return null;
  const onScroll = () => { const el = ref.current; if (!el) return; let best = 0, bd = 1e9; Array.from(el.children).forEach((c, k) => { const d = Math.abs((c as HTMLElement).offsetLeft - 16 - el.scrollLeft); if (d < bd) { bd = d; best = k; } }); if (best !== idx) setIdx(best); };
  return (
    <div className="sec" data-testid="team-carousel">
      <div className="tcar" ref={ref} onScroll={onScroll}>
        {slides.map((s, i) => <button key={s.team.id + i} type="button" className="tcar-slide" style={{ backgroundImage: `url(${s.url})` }} onClick={() => { if (s.child) setViewing({ personId: s.child.id, isChild: true }); else if (viewing?.isChild) setViewing({ personId: me!.person.id, isChild: false }); setTeam(s.team.id); setTab("team"); }}>
          <span className="tcar-cap"><span className="eyebrow">{s.team.style ?? ""}{s.child ? ` · ${s.child.first_name}` : ""}</span><b>{s.team.name}</b></span>
        </button>)}
      </div>
      {slides.length > 1 && <div className="tcar-dots" aria-hidden>{slides.map((_, i) => <i key={i} className={i === idx ? "on" : ""} />)}</div>}
      <span className="sr-only">{t("home.carousel")}</span>
    </div>
  );
}

/** Team page (staff): choose the pictures for the Home carousel – Line's photos, the team's folders, the catalog. */
export function GalleryPicker({ team, onClose, onSaved }: { team: Team; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [sel, setSel] = useState<string[]>(team.gallery ?? []);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void (async () => { try { const fs = await api.listFolders(team.id); const all = await Promise.all(fs.map((f) => api.listMedia(f.id).catch(() => [] as MediaItem[]))); setMedia(all.flat().filter((m) => m.kind === "image").slice(0, 60)); } catch { setMedia([]); } })(); }, [team.id]);
  const toggle = (r: string) => setSel((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));
  const groups: { title: string; items: { ref: string; url: string }[] }[] = [
    { title: t("gallery.line"), items: [...(team.photos ?? []), ...(team.cover_url && /^https?:/.test(team.cover_url) ? [team.cover_url] : [])].map((u) => ({ ref: u, url: u })) },
    { title: t("gallery.folders"), items: media.map((m) => ({ ref: m.url, url: m.url })) },
    { title: t("gallery.catalog"), items: catalogFor("team").map((c) => ({ ref: c.key, url: catalogUrl(c.key)! })) },
  ].filter((g) => g.items.length);
  return (
    <Sheet onClose={onClose} eyebrow={team.name} title={t("gallery.title")}>
      <p className="tiny muted" style={{ marginTop: 0 }}>{t("gallery.sub", { n: sel.length })}</p>
      {groups.map((g) => <div key={g.title} style={{ marginBottom: 10 }}><div className="eyebrow">{g.title}</div>
        <div className="galpick">{g.items.map((it) => { const i = sel.indexOf(it.ref); return <button key={it.ref} type="button" className={"gthumb" + (i >= 0 ? " on" : "")} style={{ backgroundImage: `url(${it.url})` }} onClick={() => toggle(it.ref)} aria-pressed={i >= 0}>{i >= 0 && <b>{i + 1}</b>}</button>; })}</div></div>)}
      <div className="row"><button className="cta grow" disabled={busy} onClick={async () => { setBusy(true); try { await api.setTeamGallery(team.id, sel); onSaved(); } finally { setBusy(false); } }} data-testid="gallery-save">{t("common.save")}</button>
        <button className="ghost" onClick={() => setSel([])}>{t("gallery.clear")}</button></div>
      <p className="tiny muted">{t("gallery.emptyHint")}</p>
    </Sheet>
  );
}
