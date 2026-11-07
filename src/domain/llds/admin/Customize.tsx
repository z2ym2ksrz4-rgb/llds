import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Appearance, CustomBox } from "@/core/api";
import { HOME_SECTIONS, homeOrder, useAppearance } from "@/core/appearance";
import { ImagePicker } from "../components/ImagePicker";
import { Sheet } from "../components/Sheet";
import { CATALOG, catalogUrl, resolveImage } from "../lib/catalog";
import { api, type CatalogEntry } from "@/core/api";
import { useAuth } from "@/core/auth";

const TABS = ["", "home", "rooms", "team", "social", "events", "more"] as const;
const newId = () => Math.random().toString(36).slice(2, 8);

/** Admin → Tilpas appen: reorder/hide Home sections, add text boxes with image + link, change the login and default hero images. */
export function Customize() {
  const { t } = useTranslation();
  const store = useAppearance();
  const [a, setA] = useState<Appearance>(() => ({ ...store.a, hidden: [...(store.a.hidden ?? [])], boxes: [...(store.a.boxes ?? [])], images: { ...(store.a.images ?? {}) } }));
  const [edit, setEdit] = useState<CustomBox | null>(null);
  const [dirty, setDirty] = useState(false); const [saved, setSaved] = useState(false);
  const me = useAuth((x) => x.me);
  const [own, setOwn] = useState<CatalogEntry[]>([]);
  useEffect(() => { void api.listCatalog().then(setOwn).catch(() => setOwn([])); }, []);
  const gallery = a.websiteGallery ?? [];
  const teamPhotos = Array.from(new Set((me?.teams ?? []).flatMap((t) => [...(t.photos ?? []), ...(/^https?:/.test(t.cover_url ?? "") ? [t.cover_url!] : [])])));
  const order = homeOrder(a);
  const upd = (n: Appearance) => { setA(n); setDirty(true); setSaved(false); };
  const toggleG = (ref: string) => upd({ ...a, websiteGallery: gallery.includes(ref) ? gallery.filter((x) => x !== ref) : [...gallery, ref] });
  const move = (k: string, d: -1 | 1) => { const i = order.indexOf(k); const j = i + d; if (j < 0 || j >= order.length) return; const o = [...order]; [o[i], o[j]] = [o[j], o[i]]; upd({ ...a, home: o }); };
  const toggle = (k: string) => { const h = a.hidden ?? []; upd({ ...a, hidden: h.includes(k) ? h.filter((x) => x !== k) : [...h, k] }); };
  const label = (k: string) => k.startsWith("box:") ? (a.boxes?.find((b) => "box:" + b.id === k)?.title || t("customize.untitled")) : t(`customize.sections.${k}`);
  const saveBox = (b: CustomBox) => { const boxes = a.boxes ?? []; const i = boxes.findIndex((x) => x.id === b.id); const nb = i >= 0 ? boxes.map((x) => (x.id === b.id ? b : x)) : [...boxes, b]; upd({ ...a, boxes: nb, home: i >= 0 ? a.home : [...order.filter((k) => k !== "box:" + b.id).slice(0, 1), "box:" + b.id, ...order.slice(1)] }); setEdit(null); };
  const delBox = (id: string) => { upd({ ...a, boxes: (a.boxes ?? []).filter((b) => b.id !== id), home: (a.home ?? []).filter((k) => k !== "box:" + id), hidden: (a.hidden ?? []).filter((k) => k !== "box:" + id) }); setEdit(null); };
  const save = async () => { await store.save(a); setDirty(false); setSaved(true); };
  return (
    <section className="screen" data-testid="customize">
      <header className="topbar"><h1 className="display">{t("customize.title")}</h1></header>
      <p className="muted small">{t("customize.intro")}</p>

      <div className="sec"><div className="row between"><h2>{t("customize.home")}</h2><button className="small" data-testid="cz-newbox" onClick={() => setEdit({ id: newId(), title: "", body: "", image: null, link: null, linkLabel: null, tab: null })}>{t("customize.newBox")}</button></div>
        <div className="card list" data-testid="cz-order">
          {order.map((k, i) => { const hidden = (a.hidden ?? []).includes(k); const isBox = k.startsWith("box:"); return (
            <div key={k} className={"item" + (hidden ? " off" : "")} data-testid={`cz-row-${k}`}>
              <span className="grow">{isBox ? "▣ " : ""}{label(k)}{isBox && <div className="tiny">{t("customize.customBox")}</div>}</span>
              <button className="ghost small" aria-label={t("customize.up")} disabled={i === 0} onClick={() => move(k, -1)}>↑</button>
              <button className="ghost small" aria-label={t("customize.down")} disabled={i === order.length - 1} onClick={() => move(k, 1)}>↓</button>
              <button className="ghost small" onClick={() => toggle(k)}>{hidden ? t("customize.show") : t("customize.hide")}</button>
              {isBox && <button className="ghost small" onClick={() => setEdit(a.boxes!.find((b) => "box:" + b.id === k)!)}>{t("common.edit")}</button>}
            </div>); })}
        </div>
      </div>

      <div className="sec"><h2>{t("customize.images")}</h2>
        <div className="card"><div className="eyebrow">{t("customize.loginImage")}</div><p className="tiny muted">{t("customize.loginImageSub")}</p>
          <ImagePicker tag="post" value={a.images?.login ?? null} onChange={(v) => upd({ ...a, images: { ...(a.images ?? {}), login: v } })} /></div>
        <div className="card"><div className="eyebrow">{t("customize.heroImage")}</div><p className="tiny muted">{t("customize.heroImageSub")}</p>
          <ImagePicker tag="event" value={a.images?.hero ?? null} onChange={(v) => upd({ ...a, images: { ...(a.images ?? {}), hero: v } })} /></div>
      </div>

      <div className="sec"><h2>{t("customize.gallery")}</h2>
        <p className="tiny muted" style={{ marginTop: 0 }}>{t("customize.gallerySub", { n: gallery.length })}</p>
        {[{ key: "line", title: t("customize.galleryLine"), items: teamPhotos.map((u) => ({ ref: u, url: u })) }, { key: "own", title: t("customize.galleryOwn"), items: own.map((c) => ({ ref: c.url, url: c.url })) }, { key: "cat", title: t("customize.galleryCatalog"), items: CATALOG.map((c) => ({ ref: c.key, url: catalogUrl(c.key)! })) }].filter((g) => g.items.length).map((g) => (
          <div key={g.key} style={{ marginBottom: 10 }}><div className="eyebrow">{g.title}</div>
            <div className="galpick" data-testid={`gal-${g.key}`}>{g.items.map((it) => { const i = gallery.indexOf(it.ref); return <button key={it.ref} className={"gthumb" + (i >= 0 ? " on" : "")} style={{ backgroundImage: `url(${it.url})` }} onClick={() => toggleG(it.ref)} aria-pressed={i >= 0}>{i >= 0 && <b>{i + 1}</b>}</button>; })}</div></div>
        ))}
        <div className="row" style={{ gap: 8 }}><button className="ghost small" onClick={() => upd({ ...a, websiteGallery: [] })}>{t("customize.galleryClear")}</button><button className="ghost small" onClick={() => upd({ ...a, websiteGallery: [...gallery].sort(() => Math.random() - 0.5) })}>{t("customize.galleryShuffle")}</button></div>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <button className="cta grow" disabled={!dirty} data-testid="cz-save" onClick={() => void save()}>{t("common.save")}</button>
        <button className="ghost" onClick={() => upd({})}>{t("customize.reset")}</button>
      </div>
      {saved && <p className="ok small" role="status">{t("customize.saved")}</p>}

      {edit && (
        <Sheet onClose={() => setEdit(null)} eyebrow={t("customize.customBox")} title={edit.title || t("customize.newBox")}>
          <label className="field"><span>{t("customize.boxTitle")}</span><input value={edit.title} data-testid="cz-box-title" onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
          <label className="field"><span>{t("customize.boxBody")}</span><textarea rows={4} value={edit.body} data-testid="cz-box-body" onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></label>
          <div className="field"><span>{t("catalog.pick")}</span><ImagePicker tag="post" value={edit.image ?? null} onChange={(v) => setEdit({ ...edit, image: v })} /></div>
          <label className="field"><span>{t("customize.boxTab")}</span>
            <select value={edit.tab ?? ""} onChange={(e) => setEdit({ ...edit, tab: e.target.value || null })}>{TABS.map((x) => <option key={x} value={x}>{x ? t(`nav.${x}`) : t("customize.noTab")}</option>)}</select></label>
          <label className="field"><span>{t("customize.boxLink")}</span><input type="url" placeholder="https://…" value={edit.link ?? ""} onChange={(e) => setEdit({ ...edit, link: e.target.value || null })} /></label>
          <label className="field"><span>{t("customize.boxLinkLabel")}</span><input value={edit.linkLabel ?? ""} onChange={(e) => setEdit({ ...edit, linkLabel: e.target.value || null })} /></label>
          <div className="row" style={{ gap: 8 }}>
            <button className="cta grow" disabled={!edit.title.trim()} data-testid="cz-box-save" onClick={() => saveBox({ ...edit, title: edit.title.trim() })}>{t("common.save")}</button>
            {(a.boxes ?? []).some((b) => b.id === edit.id) && <button className="ghost danger" onClick={() => delBox(edit.id)}>{t("common.delete")}</button>}
          </div>
        </Sheet>
      )}
    </section>
  );
}

/** A custom text box on Home (or anywhere). */
export function CustomBoxCard({ box, onTab }: { box: CustomBox; onTab: (tab: string) => void }) {
  const img = resolveImage(box.image);
  const inner = (<>
    {img && <div className="mood" style={{ backgroundImage: `url(${img})` }} />}
    <div className="eyebrow">{box.title}</div>
    {box.body && <p className="small" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{box.body}</p>}
    {box.link && <a className="linklike small" href={box.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{box.linkLabel || box.link} ↗</a>}
  </>);
  return box.tab ? <button className="card tap custombox" data-testid={`box-${box.id}`} onClick={() => onTab(box.tab!)}>{inner}</button> : <div className="card custombox" data-testid={`box-${box.id}`}>{inner}</div>;
}
export const SECTION_KEYS = HOME_SECTIONS;
