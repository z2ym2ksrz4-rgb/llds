import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type CatalogEntry } from "@/core/api";
import { useAuth } from "@/core/auth";
import { CATALOG, catalogFor, catalogUrl } from "../lib/catalog";

/** Grid of catalogue images: bundled illustrations + the school's own uploads (by folder). value = bundled key or image URL; null = automatic.
 * Admins can upload straight from here – the file lands in the catalogue (folder "Egne billeder" or the chosen folder) and is selected. */
export function ImagePicker({ value, onChange, tag, allowNone = true }: { value: string | null; onChange: (ref: string | null) => void; tag: "event" | "team" | "post"; allowNone?: boolean }) {
  const { t } = useTranslation();
  const isAdmin = useAuth((s) => !!s.me?.person.is_admin);
  const [own, setOwn] = useState<CatalogEntry[]>([]);
  const [folder, setFolder] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void api.listCatalog().then(setOwn).catch(() => setOwn([])); }, []);
  const bundled = catalogFor(tag).length ? catalogFor(tag) : CATALOG;
  const folders = [...new Set(own.map((o) => o.folder))];
  const shown = folder ? own.filter((o) => o.folder === folder) : own;
  const upload = async (files: FileList | null) => {
    if (!files?.length) return; const list = Array.from(files); setBusy(true);
    try { const added = await api.uploadCatalog(list, folder || t("catalog.ownFolder")); setOwn([...added, ...own]); onChange(added[0].url); } finally { setBusy(false); }
  };
  return (
    <div className="field"><span>{t("catalog.pick")}</span>
      {(folders.length > 0 || isAdmin) && (
        <div className="chips" style={{ marginTop: 4 }}>
          <button className={"chip" + (!folder ? " on" : "")} onClick={() => setFolder("")}>{t("catalog.all")}</button>
          {folders.map((f) => <button key={f} className={"chip" + (folder === f ? " on" : "")} onClick={() => setFolder(f)}>{f}</button>)}
        </div>
      )}
      <div className="imgpick" data-testid="image-picker">
        {allowNone && <button className={"ip" + (value == null ? " on" : "")} onClick={() => onChange(null)}><span className="auto">✦</span><small>{t("catalog.auto")}</small></button>}
        {isAdmin && <button className="ip upload" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="catalog-upload"><span className="auto">{busy ? "…" : "＋"}</span><small>{t("catalog.upload")}</small></button>}
        {shown.map((o) => <button key={o.id} className={"ip" + (value === o.url ? " on" : "")} style={{ backgroundImage: `url(${o.url})` }} onClick={() => onChange(o.url)} title={o.title ?? ""} data-testid="image-option"><small>{o.title ?? o.folder}</small></button>)}
        {!folder && bundled.map((c) => <button key={c.key} className={"ip" + (value === c.key ? " on" : "")} style={{ backgroundImage: `url(${catalogUrl(c.key)})` }} onClick={() => onChange(c.key)} title={c.title} aria-label={c.title} data-testid="image-option"><small>{c.title}</small></button>)}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
      <div className="tiny">{t("catalog.hint", { n: bundled.length + own.length })}</div>
    </div>
  );
}
