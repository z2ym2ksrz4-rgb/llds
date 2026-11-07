import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type CatalogEntry } from "@/core/api";
import { Sheet, Toast } from "../components/Sheet";
import { CATALOG, catalogUrl } from "../lib/catalog";

/** Admin → Billedkatalog: the school's own images in folders (upload, rename folder, delete) + the bundled illustrations (read-only). */
export function CatalogAdmin() {
  const { t } = useTranslation();
  const [own, setOwn] = useState<CatalogEntry[]>([]);
  const [folder, setFolder] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [rename, setRename] = useState<string | null>(null); const [renameTo, setRenameTo] = useState("");
  const [open, setOpen] = useState<CatalogEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => setOwn(await api.listCatalog()), []);
  useEffect(() => { void load(); }, [load]);
  const folders = [...new Set(own.map((o) => o.folder))];
  const target = folder ?? newFolder.trim() ?? "";
  const upload = async (files: FileList | null) => {
    if (!files?.length) return; const list = Array.from(files); const f = (folder ?? newFolder.trim()) || t("catalog.ownFolder"); setBusy(true);
    try { await api.uploadCatalog(list, f); setNewFolder(""); setFolder(f); await load(); say(t("catalog.uploaded", { n: list.length, folder: f })); } finally { setBusy(false); }
  };
  const shown = folder ? own.filter((o) => o.folder === folder) : own;
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("catalog.adminTitle")}</h1></header>
      <p className="muted small">{t("catalog.adminSub")}</p>
      <div className="chips" data-testid="catalog-folders">
        <button className={"chip" + (folder === null ? " on" : "")} onClick={() => setFolder(null)}>{t("catalog.all")} ({own.length})</button>
        {folders.map((f) => <button key={f} className={"chip" + (folder === f ? " on" : "")} onClick={() => setFolder(f)}>{f} ({own.filter((o) => o.folder === f).length})</button>)}
      </div>
      <div className="card" style={{ gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {folder === null && <input placeholder={t("catalog.folderName")} value={newFolder} onChange={(e) => setNewFolder(e.target.value)} style={{ flex: 1, minWidth: 160 }} data-testid="catalog-folder-input" />}
          <button className="cta" disabled={busy} onClick={() => fileRef.current?.click()} data-testid="catalog-admin-upload">{busy ? "…" : t("catalog.uploadTo", { folder: target || t("catalog.ownFolder") })}</button>
          {folder && <button className="ghost small" onClick={() => { setRename(folder); setRenameTo(folder); }}>{t("catalog.rename")}</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
      </div>
      <div className="imgpick" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))" }} data-testid="catalog-grid">
        {shown.map((o) => <button key={o.id} className="ip" style={{ backgroundImage: `url(${o.url})` }} onClick={() => setOpen(o)} title={o.title ?? ""}><small>{o.title ?? ""}<br /><span style={{ opacity: .7 }}>{o.folder}</span></small></button>)}
      </div>
      {!own.length && <p className="muted small">{t("catalog.empty")}</p>}
      {folder === null && (
        <div className="sec"><h2>{t("catalog.bundled")}</h2><p className="tiny">{t("catalog.bundledHint")}</p>
          <div className="imgpick" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))" }}>{CATALOG.map((c) => <div key={c.key} className="ip" style={{ backgroundImage: `url(${catalogUrl(c.key)})` }}><small>{c.title}</small></div>)}</div>
        </div>
      )}
      {open && (
        <Sheet onClose={() => setOpen(null)} eyebrow={open.folder} title={open.title ?? ""}>
          <img src={open.url} alt="" style={{ width: "100%", borderRadius: 12 }} />
          <button className="ghost danger" onClick={async () => { await api.deleteCatalog(open.id); setOpen(null); await load(); say(t("common.deleted")); }}>{t("catalog.delete")}</button>
        </Sheet>
      )}
      {rename && (
        <Sheet onClose={() => setRename(null)} eyebrow={t("catalog.rename")} title={rename}>
          <input value={renameTo} onChange={(e) => setRenameTo(e.target.value)} />
          <button className="cta" disabled={!renameTo.trim()} onClick={async () => { await api.renameCatalogFolder(rename, renameTo.trim()); setFolder(renameTo.trim()); setRename(null); await load(); }}>{t("common.save")}</button>
        </Sheet>
      )}
      <Toast msg={toast} />
    </section>
  );
}
