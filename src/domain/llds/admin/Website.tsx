import appConfig from "../../../../app.config.json";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Appearance, type CatalogEntry, type Event } from "@/core/api";
import { SITE_TEXT_DEFAULTS, TEXT_KEYS, useAppearance } from "@/core/appearance";
import { useAuth } from "@/core/auth";
import { useNav } from "@/core/nav";
import { ImagePicker } from "../components/ImagePicker";
import { CATALOG, catalogUrl } from "../lib/catalog";
import { loc } from "../lib/time";
import { SitePages } from "./SitePages";

type WebKey = "hero" | "video" | "videoPoster" | "app" | "band";

/** Admin → Website: everything on the public website that does not come from app data.
 *  Pages (texts + pictures, the front page's hero/video on top of its own page), the picture carousel,
 *  and an overview of which events are boosted or open for sign-up from the website. Saved in school.appearance – the site reads it live. */
export function Website() {
  const { t } = useTranslation();
  const store = useAppearance();
  const me = useAuth((x) => x.me);
  const [a, setA] = useState<Appearance>(() => ({ ...store.a, website: { ...(store.a.website ?? {}) }, texts: { ...(store.a.texts ?? {}) }, pages: { ...(store.a.pages ?? {}) } }));
  const [dirty, setDirty] = useState(false); const [saved, setSaved] = useState(false);
  const [openPage, setOpenPage] = useState<string | null>(null);
  const [own, setOwn] = useState<CatalogEntry[]>([]); const [events, setEvents] = useState<Event[]>([]);
  useEffect(() => { void api.listCatalog().then(setOwn).catch(() => setOwn([])); void api.listEvents().then(setEvents).catch(() => setEvents([])); }, []);
  const upd = (n: Appearance) => { setA(n); setDirty(true); setSaved(false); };
  const save = async () => { await store.save(a); setDirty(false); setSaved(true); };
  const site = appConfig.siteUrl; const siteLabel = site.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const teamPhotos = Array.from(new Set((me?.teams ?? []).flatMap((x) => [...(x.photos ?? []), ...(/^https?:/.test(x.cover_url ?? "") ? [x.cover_url!] : [])])));
  const gallery = a.websiteGallery ?? [];
  const toggleG = (ref: string) => upd({ ...a, websiteGallery: gallery.includes(ref) ? gallery.filter((x) => x !== ref) : [...gallery, ref] });
  const setWeb = (k: WebKey, v: string | null) => upd({ ...a, website: { ...(a.website ?? {}), [k]: v } });
  const setText = (k: string, v: string) => { const texts = { ...(a.texts ?? {}) }; if (v.trim()) texts[k] = v; else delete texts[k]; upd({ ...a, texts }); };
  const onSite = events.filter((e) => e.visibility === "public" && (e.featured || e.web_signup));
  const openEvent = (id: string) => useNav.getState().openRef("events", { event_id: id });

  /* The front page's own fixed spots (hero, video, app picture, closing band + their headlines) sit on top of its page in the editor. */
  const homeExtra = (
    <div data-testid="web-home">
      <div className="sec"><h2>{t("website.homeImages")}</h2>
        <div className="siteimgs">
          <div className="card siteimg"><div className="eyebrow">{t("customize.siteHero")}</div><ImagePicker tag="event" label=" " own={teamPhotos} value={a.website?.hero ?? null} onChange={(v) => setWeb("hero", v)} /></div>
          <div className="card siteimg"><div className="eyebrow">{t("customize.videoPoster")}</div><ImagePicker tag="event" label=" " own={teamPhotos} value={a.website?.videoPoster ?? null} onChange={(v) => setWeb("videoPoster", v)} /></div>
          <div className="card siteimg"><div className="eyebrow">{t("customize.siteApp")}</div><ImagePicker tag="post" label=" " own={teamPhotos} value={a.website?.app ?? null} onChange={(v) => setWeb("app", v)} /></div>
          <div className="card siteimg"><div className="eyebrow">{t("customize.siteBand")}</div><ImagePicker tag="post" label=" " own={teamPhotos} value={a.website?.band ?? null} onChange={(v) => setWeb("band", v)} /></div>
        </div>
        <label className="field"><span>{t("customize.videoUrl")}</span><input type="url" placeholder="https://…/video.mp4" value={a.website?.video ?? ""} data-testid="cz-video" onChange={(e) => setWeb("video", e.target.value.trim() || null)} /></label>
      </div>
      <div className="sec"><h2>{t("website.homeTexts")}</h2>
        <p className="tiny muted" style={{ marginTop: 0 }}>{t("website.homeTextsSub")}</p>
        {TEXT_KEYS.filter((x) => !x.appKey).map((x) => { const cur = a.texts?.[x.key] ?? ""; const def = SITE_TEXT_DEFAULTS[x.key] ?? ""; return (
          <label key={x.key} className={"field sitetext" + (cur ? " changed" : "")}><span className="tiny muted">{t(`customize.textKeys.${x.key}`)}</span>
            {x.multiline ? <textarea rows={3} value={cur} placeholder={def} data-testid={`cz-text-${x.key}`} onChange={(e) => setText(x.key, e.target.value)} /> : <input value={cur} placeholder={def} data-testid={`cz-text-${x.key}`} onChange={(e) => setText(x.key, e.target.value)} />}
          </label>); })}
      </div>
    </div>
  );
  const homeCount = Object.values(a.website ?? {}).filter(Boolean).length + TEXT_KEYS.filter((x) => !x.appKey && a.texts?.[x.key]).length;

  return (
    <section className="screen" data-testid="website-admin">
      <header className="topbar"><h1 className="display">{t("website.title")}</h1></header>
      {!openPage && <p className="muted small">{t("website.intro")} <a className="linklike" href={site} target="_blank" rel="noreferrer">{siteLabel} ↗</a></p>}

      {!openPage && <div className="sec" data-testid="web-events"><h2>{t("website.events")}</h2>
        {onSite.length ? <div className="card list">{onSite.map((e) => (
          <button key={e.id} type="button" className="item" data-testid="web-event" onClick={() => openEvent(e.id)}><span className="grow">{e.title}<div className="tiny">{new Date(e.starts_at).toLocaleDateString(loc(), { day: "numeric", month: "short" })}{e.featured ? ` · ★ ${t("events.featuredChip")}` : ""}{e.web_signup ? ` · ${t("events.webChip")} (${e.guests ?? 0})` : ""}</div></span><span className="gold">›</span></button>))}</div>
          : <p className="muted small" style={{ margin: 0 }}>{t("website.eventsEmpty")}</p>}
        <p className="tiny muted">{t("website.eventsHint")}</p>
      </div>}

      <div className="sec" data-testid="web-pages">{!openPage && <><h2>{t("website.pages")}</h2><p className="tiny muted" style={{ marginTop: 0 }}>{t("website.pagesSub")}</p></>}
        <SitePages pages={a.pages ?? {}} teamPhotos={teamPhotos} onChange={(pages) => upd({ ...a, pages })} homeExtra={homeExtra} homeCount={homeCount} onOpen={setOpenPage} />
      </div>

      {!openPage && <details className="sec fold" data-testid="cz-gallery"><summary><h2>{t("customize.gallery")}</h2><span className="tiny muted">{gallery.length ? t("customize.galleryCount", { count: gallery.length }) : t("customize.galleryAuto")}</span></summary>
        <p className="tiny muted" style={{ marginTop: 0 }}>{t("customize.gallerySub", { n: gallery.length })}</p>
        {[{ key: "line", title: t("customize.galleryLine"), items: teamPhotos.map((u) => ({ ref: u, url: u })) }, { key: "own", title: t("customize.galleryOwn"), items: own.map((c) => ({ ref: c.url, url: c.url })) }, { key: "cat", title: t("customize.galleryCatalog"), items: CATALOG.map((c) => ({ ref: c.key, url: catalogUrl(c.key)! })) }].filter((g) => g.items.length).map((g) => (
          <div key={g.key} style={{ marginBottom: 10 }}><div className="eyebrow">{g.title}</div>
            <div className="galpick" data-testid={`gal-${g.key}`}>{g.items.map((it) => { const i = gallery.indexOf(it.ref); return <button key={it.ref} className={"gthumb" + (i >= 0 ? " on" : "")} style={{ backgroundImage: `url(${it.url})` }} onClick={() => toggleG(it.ref)} aria-pressed={i >= 0}>{i >= 0 && <b>{i + 1}</b>}</button>; })}</div></div>
        ))}
        <div className="row" style={{ gap: 8 }}><button className="ghost small" onClick={() => upd({ ...a, websiteGallery: [] })}>{t("customize.galleryClear")}</button><button className="ghost small" onClick={() => upd({ ...a, websiteGallery: [...gallery].sort(() => Math.random() - 0.5) })}>{t("customize.galleryShuffle")}</button></div>
      </details>}

      {(dirty || saved) && <div className="savebar">
        <button className="cta grow" disabled={!dirty} data-testid="web-save" onClick={() => void save()}>{t("common.save")}</button>
        {saved && <span className="ok small" role="status">{t("customize.saved")}</span>}
      </div>}
    </section>
  );
}
