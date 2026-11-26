import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { Appearance } from "@/core/api";
import { ImagePicker } from "../components/ImagePicker";
import { catalogUrl } from "../lib/catalog";
import appConfig from "../../../../app.config.json";

type PageDef = { key: string; title: string; path: string; texts: { k: string; d: string }[]; images: { k: string; src: string }[] };
type Pages = NonNullable<Appearance["pages"]>;

/** Admin → Website → Sider: every text block and picture on every website page, with the current text as the default.
 *  Empty field = the default stays. The website reads the overrides live (no rebuild). The page list is generated with the site
 *  (scripts/site-gen.py → site-manifest.generated.json) and loaded on demand – only admins ever open this. */
export function SitePages({ pages, teamPhotos, onChange, homeExtra, homeCount = 0, onOpen }: { pages: Pages; teamPhotos: string[]; onChange: (p: Pages) => void; homeExtra?: ReactNode; homeCount?: number; onOpen?: (key: string | null) => void }) {
  const { t } = useTranslation();
  const [defs, setDefs] = useState<PageDef[] | null>(null);
  const [open, setOpenRaw] = useState<string | null>(null);
  const setOpen = (k: string | null) => { setOpenRaw(k); onOpen?.(k); window.scrollTo({ top: 0 }); document.querySelector("main")?.scrollTo?.({ top: 0 }); };
  const [q, setQ] = useState("");
  useEffect(() => { void import("../lib/site-manifest.generated.json").then((m) => setDefs((m.default ?? m) as PageDef[])).catch(() => setDefs([])); }, []);
  if (!defs) return <p className="muted small">…</p>;
  const cur = defs.find((d) => d.key === open);
  const count = (key: string) => Object.keys(pages[key]?.texts ?? {}).length + Object.keys(pages[key]?.images ?? {}).length + (key === "home" ? homeCount : 0);
  const setText = (key: string, k: string, v: string) => { const p = { ...(pages[key] ?? {}) }; const texts = { ...(p.texts ?? {}) }; if (v.trim()) texts[k] = v; else delete texts[k]; onChange({ ...pages, [key]: { ...p, texts } }); };
  const setImage = (key: string, k: string, v: string | null) => { const p = { ...(pages[key] ?? {}) }; const images = { ...(p.images ?? {}) }; if (v) images[k] = v; else delete images[k]; onChange({ ...pages, [key]: { ...p, images } }); };
  const site = appConfig.siteUrl;
  const name = (d: PageDef) => (d.key === "home" ? t("sitePages.home") : d.title);
  if (cur) { const o = pages[cur.key] ?? {}; return (
    <div className="sitepage" data-testid="sitepage">
      <div className="row between"><button type="button" className="linklike" onClick={() => setOpen(null)}>‹ {t("sitePages.all")}</button><a className="linklike small" href={`${site}${cur.path}`} target="_blank" rel="noreferrer">{t("sitePages.view")} ↗</a></div>
      <h3 className="display" style={{ margin: "6px 0 2px" }}>{name(cur)}</h3>
      <p className="tiny muted" style={{ marginTop: 0 }}>{t("sitePages.pageHint")}</p>
      {cur.key === "home" && homeExtra}
      {cur.images.length > 0 && <div className="sec"><h2>{t(cur.key === "home" && homeExtra ? "sitePages.moreImages" : "sitePages.images", { n: cur.images.length })}</h2>
        <div className="siteimgs">{cur.images.map((im) => { const v = o.images?.[im.k] ?? null; const shown = v ? (catalogUrl(v) ?? v) : im.src.startsWith("http") ? im.src : `${site.replace(/\/llds\/$/, "")}${im.src}`; return (
          <div key={im.k} className="card siteimg" data-testid="site-img"><div className="thumb" style={{ backgroundImage: `url(${shown})` }} />{v && <span className="chip small gold">{t("sitePages.changed")}</span>}
            <ImagePicker tag="event" label=" " own={teamPhotos} value={v} onChange={(nv) => setImage(cur.key, im.k, nv)} /></div>); })}</div></div>}
      {cur.texts.length > 0 && <div className="sec"><h2>{t(cur.key === "home" && homeExtra ? "sitePages.moreTexts" : "sitePages.texts", { n: cur.texts.length })}</h2>
        {cur.texts.map((tx) => { const v = o.texts?.[tx.k] ?? ""; const long = tx.d.length > 70; return (
          <label key={tx.k} className={"field sitetext" + (v ? " changed" : "")}><span className="tiny muted">{tx.d.length > 60 ? tx.d.slice(0, 60) + "…" : tx.d}</span>
            {long ? <textarea rows={Math.min(8, Math.ceil(tx.d.length / 60))} value={v} placeholder={tx.d} onChange={(e) => setText(cur.key, tx.k, e.target.value)} data-testid="site-text" />
              : <input value={v} placeholder={tx.d} onChange={(e) => setText(cur.key, tx.k, e.target.value)} data-testid="site-text" />}
          </label>); })}</div>}
    </div>); }
  const list = defs.filter((d) => name(d).toLowerCase().includes(q.toLowerCase()));
  return (
    <div data-testid="sitepages">
      <input placeholder={t("sitePages.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      {(() => { const Row = (d: PageDef) => { const n = count(d.key); return (
        <button key={d.key} type="button" className="item" data-testid={`sitepage-${d.key}`} onClick={() => setOpen(d.key)}><span className="grow">{name(d)}<div className="tiny">{t("sitePages.counts", { texts: d.texts.length, images: d.images.length })}</div></span>{n > 0 && <span className="chip small gold">{t("sitePages.nChanged", { count: n })}</span>}<span className="gold">›</span></button>); };
        const FIXED = ["home", "om-os", "medlemsskab", "saeson-26-27", "merchandise", "backstage", "kontakt", "solo-duo", "support"];
        const changed = list.filter((d) => count(d.key) > 0); const fixed = list.filter((d) => FIXED.includes(d.key)).sort((a, b) => FIXED.indexOf(a.key) - FIXED.indexOf(b.key)); const teamPages = list.filter((d) => !FIXED.includes(d.key));
        return (<>
          {changed.length > 0 && !q && <div data-testid="sitepages-changed"><div className="eyebrow" style={{ margin: "12px 0 6px" }}>{t("sitePages.groupChanged")}</div><div className="card list">{changed.map(Row)}</div></div>}
          {fixed.length > 0 && <div><div className="eyebrow" style={{ margin: "12px 0 6px" }}>{t("sitePages.groupFixed")}</div><div className="card list">{fixed.map(Row)}</div></div>}
          {teamPages.length > 0 && <details className="fold" open={!!q} data-testid="sitepages-teams"><summary><span className="eyebrow">{t("sitePages.groupTeams", { n: teamPages.length })}</span></summary><div className="card list">{teamPages.map(Row)}</div></details>}
        </>); })()}
    </div>
  );
}
