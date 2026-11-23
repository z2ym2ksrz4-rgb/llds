import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type CatalogEntry, type Focus } from "@/core/api";
import { useAuth } from "@/core/auth";
import { CATALOG, catalogFor, catalogUrl, resolveImage } from "../lib/catalog";
import { Sheet } from "./Sheet";

type Tag = "event" | "team" | "post";

/** Compact image field: [Automatisk] [Upload] [Vælg…] + the current picture. "Vælg…" opens the shared media library
 *  (own uploads by folder, the team's photos, the built-in catalogue) where you can also upload. value = bundled key, art/catalog path or URL; null = automatic. */
export function ImagePicker({ value, onChange, tag, allowNone = true, label, own: ownUrls = [], focus, onFocus }: { value: string | null; onChange: (ref: string | null) => void; tag: Tag; allowNone?: boolean; label?: string; own?: string[]; focus?: Focus | null; onFocus?: (f: Focus | null) => void }) {
  const { t } = useTranslation();
  const isAdmin = useAuth((s) => !!s.me?.person.is_admin);
  const [lib, setLib] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cur = value ? (catalogUrl(value) ?? resolveImage(value)) : null;
  const upload = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true);
    try { const added = await api.uploadCatalog(Array.from(files), t("catalog.ownFolder")); onChange(added[0].url); } finally { setBusy(false); }
  };
  return (
    <div className="field">{label !== " " && <span>{label ?? t("catalog.pick")}</span>}
      <div className="pickrow" data-testid="image-picker">
        <div className={"pickcur" + (cur ? "" : " none")} style={cur ? { backgroundImage: `url(${cur})` } : undefined} aria-label={cur ? t("catalog.current") : t("catalog.auto")}>{!cur && <span className="auto">✦</span>}</div>
        <div className="chips tight">
          {allowNone && <button type="button" className={"chip" + (value == null ? " on" : "")} onClick={() => onChange(null)}>{t("catalog.auto")}</button>}
          {isAdmin && <button type="button" className="chip" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="catalog-upload">{busy ? "…" : t("catalog.upload")}</button>}
          <button type="button" className="chip" onClick={() => setLib(true)} data-testid="pick-open">{t("catalog.choose")}</button>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
      {onFocus && cur && <FocusPicker url={cur} focus={focus ?? null} onChange={onFocus} />}
      {lib && <MediaLibrary tag={tag} value={value} own={ownUrls} onPick={(ref) => { onChange(ref); setLib(false); }} onClose={() => setLib(false)} />}
    </div>
  );
}

/** The shared media library as a sheet: folders (own uploads), the team's photos, built-in catalogue – and upload into any folder. */
export function MediaLibrary({ tag, value, own: ownUrls = [], onPick, onClose }: { tag: Tag; value: string | null; own?: string[]; onPick: (ref: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const isAdmin = useAuth((s) => !!s.me?.person.is_admin);
  const [own, setOwn] = useState<CatalogEntry[]>([]);
  const [folder, setFolder] = useState<string>("all");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void api.listCatalog().then(setOwn).catch(() => setOwn([])); }, []);
  const bundled = catalogFor(tag).length ? catalogFor(tag) : CATALOG;
  const folders = [...new Set(own.map((o) => o.folder))];
  const upload = async (files: FileList | null) => {
    if (!files?.length) return; setBusy(true);
    try { const added = await api.uploadCatalog(Array.from(files), folders.includes(folder) ? folder : t("catalog.ownFolder")); setOwn([...added, ...own]); onPick(added[0].url); } finally { setBusy(false); }
  };
  const showOwnPhotos = (folder === "all" || folder === "team") && ownUrls.length > 0;
  const showUploads = folder === "all" || folders.includes(folder);
  const showBundled = folder === "all" || folder === "catalog";
  const uploads = folder === "all" ? own : own.filter((o) => o.folder === folder);
  return (
    <Sheet onClose={onClose} eyebrow={t("catalog.libraryEyebrow")} title={t("catalog.library")}>
      <div className="chips" data-testid="media-folders">
        <button type="button" className={"chip" + (folder === "all" ? " on" : "")} onClick={() => setFolder("all")}>{t("catalog.all")}</button>
        {ownUrls.length > 0 && <button type="button" className={"chip" + (folder === "team" ? " on" : "")} onClick={() => setFolder("team")}>{t("catalog.teamPhotos")}</button>}
        {folders.map((f) => <button key={f} type="button" className={"chip" + (folder === f ? " on" : "")} onClick={() => setFolder(f)}>{f}</button>)}
        <button type="button" className={"chip" + (folder === "catalog" ? " on" : "")} onClick={() => setFolder("catalog")}>{t("catalog.builtIn")}</button>
      </div>
      <div className="imgpick" data-testid="media-library">
        {isAdmin && <button type="button" className="ip upload" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="library-upload"><span className="auto">{busy ? "…" : "＋"}</span><small>{t("catalog.upload")}</small></button>}
        {showOwnPhotos && ownUrls.map((u, i) => <button key={"own" + i} type="button" className={"ip" + (value === u ? " on" : "")} style={{ backgroundImage: `url(${u})` }} onClick={() => onPick(u)} data-testid="image-option"><small>{t("catalog.teamPhoto")}</small></button>)}
        {showUploads && uploads.map((o) => <button key={o.id} type="button" className={"ip" + (value === o.url ? " on" : "")} style={{ backgroundImage: `url(${o.url})` }} onClick={() => onPick(o.url)} title={o.title ?? ""} data-testid="image-option"><small>{o.title ?? o.folder}</small></button>)}
        {showBundled && bundled.map((c) => <button key={c.key} type="button" className={"ip" + (value === c.key ? " on" : "")} style={{ backgroundImage: `url(${catalogUrl(c.key)})` }} onClick={() => onPick(c.key)} title={c.title} aria-label={c.title} data-testid="image-option"><small>{c.title}</small></button>)}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
      <p className="tiny muted" style={{ margin: 0 }}>{t("catalog.libraryHint")}</p>
    </Sheet>
  );
}

/** Tap the most important part of the picture (faces): heroes and cards keep that point in view on every screen format. */
export function FocusPicker({ url, focus, onChange }: { url: string; focus: Focus | null; onChange: (f: Focus | null) => void }) {
  const { t } = useTranslation();
  const x = focus?.x ?? 0.5, y = focus?.y ?? 0.35;
  const pick = (e: React.PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); onChange({ x: Math.round(((e.clientX - r.left) / r.width) * 100) / 100, y: Math.round(((e.clientY - r.top) / r.height) * 100) / 100 }); };
  return (
    <div className="focuspick" data-testid="focus-picker">
      <div className="focuspick-img" role="button" aria-label={t("catalog.focusHelp")} style={{ backgroundImage: `url(${url})` }} onPointerDown={pick}>
        <span className="focuspick-dot" style={{ left: `${x * 100}%`, top: `${y * 100}%` }} />
        <span className="focuspick-frame wide" style={{ ["--fx" as string]: `${x * 100}%`, ["--fy" as string]: `${y * 100}%` }} />
      </div>
      <div className="row between tiny muted"><span>{t("catalog.focusHelp")}</span>{focus && <button type="button" className="linklike small" onClick={() => onChange(null)}>{t("catalog.focusReset")}</button>}</div>
    </div>
  );
}
