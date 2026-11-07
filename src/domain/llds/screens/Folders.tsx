import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Folder, type MediaItem } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Sheet } from "../components/Sheet";
import { ago } from "../lib/time";

/** Team folders: photos and clips, private to the team (and its parents). Staff-only folders for trainers. */
export function Folders({ teamId, staff, onBack, toast }: { teamId: string; staff: boolean; onBack: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const [folders, setFolders] = useState<Folder[]>([]);
  const [open, setOpen] = useState<Folder | null>(null);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ name: "", staffOnly: false });
  const load = useCallback(async () => setFolders(await api.listFolders(teamId)), [teamId]);
  useEffect(() => { void load(); }, [load]);
  if (open) return <FolderView folder={open} staff={staff} canUpload={!me.person.supervised_by} onBack={() => { setOpen(null); void load(); }} toast={toast} />;
  return (
    <section className="screen">
      <button className="linklike" onClick={onBack}>‹ {t("team.myTeam")}</button>
      <header className="topbar"><h1 className="display">{t("team.folders")}</h1>{staff && <button className="ghost small" onClick={() => setCreating(true)}>+ {t("folders.new")}</button>}</header>
      <div className="folder-grid">
        {folders.map((x) => <button key={x.id} className="folder" onClick={() => setOpen(x)} data-testid="folder">
          <div className="cover">{x.cover_url ? <img src={x.cover_url} alt="" /> : <span className="display">{x.name[0]}</span>}</div>
          <div className="small">{x.name}{x.staff_only && <span className="chip small gold" style={{ marginLeft: 6 }}>{t("folders.staffOnly")}</span>}</div><div className="tiny">{t("folders.count", { n: x.media_count })}</div>
        </button>)}
      </div>
      {!folders.length && <p className="muted">{t("folders.empty")}</p>}
      {creating && (
        <Sheet onClose={() => setCreating(false)} eyebrow={t("team.folders")} title={t("folders.new")}>
          <label className="field"><span>{t("folders.name")}</span><input id="folder-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="DM 2026" /></label>
          <label className="check"><input type="checkbox" checked={f.staffOnly} onChange={(e) => setF({ ...f, staffOnly: e.target.checked })} />{t("folders.staffOnlyHint")}</label>
          <button className="cta" disabled={!f.name.trim()} onClick={async () => { await api.createFolder(teamId, f.name.trim(), f.staffOnly); setCreating(false); setF({ name: "", staffOnly: false }); toast(t("folders.created")); void load(); }}>{t("common.save")}</button>
        </Sheet>
      )}
    </section>
  );
}

function FolderView({ folder, staff, canUpload, onBack, toast }: { folder: Folder; staff: boolean; canUpload: boolean; onBack: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const refresh = useAuth((s) => s.refresh);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<MediaItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => setItems(await api.listMedia(folder.id)), [folder.id]);
  useEffect(() => { void load(); }, [load]);
  const upload = async (files: File[]) => {
    if (!files.length) return;
    setBusy(t("folders.uploading", { n: files.length }));
    try { await api.uploadMedia(folder.id, files); toast(t("folders.uploaded", { n: files.length })); void load(); }
    catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <section className="screen">
      <button className="linklike" onClick={onBack}>‹ {t("team.folders")}</button>
      <header className="topbar"><h1 className="display">{folder.name}</h1>{canUpload && <button className="ghost small" onClick={() => fileRef.current?.click()}>+ {t("folders.upload")}</button>}</header>
      <input ref={fileRef} id="media-files" type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { void upload(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      {busy && <p className="small gold">{busy}</p>}
      <div className="media-grid n3">
        {items.map((m) => <button key={m.id} className="media" onClick={() => setView(m)} data-testid="media">{m.kind === "video" ? <video src={m.url} muted playsInline /> : <img src={m.url} alt="" loading="lazy" />}</button>)}
      </div>
      {!items.length && <p className="muted">{t("folders.noMedia")}</p>}
      <p className="tiny">{t("folders.privacy")}</p>
      {view && (
        <div className="lightbox" onClick={() => setView(null)}>
          {view.kind === "video" ? <video src={view.url} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} /> : <img src={view.url} alt="" />}
          <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
            <span className="tiny">{view.uploader_name} · {ago(view.created_at)}</span>
            {staff && view.kind === "image" && (
              <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                <button className="ghost small gold" data-testid="make-cover" onClick={async () => { await api.setTeamCover(folder.team_id, view.storage_path); toast(t("folders.coverSet")); await refresh(); }}>★ {t("folders.makeCover")}</button>
                <button className="ghost small" data-testid="move-first" onClick={async () => { const ids = [view.id, ...items.filter((x) => x.id !== view.id).map((x) => x.id)]; await api.setMediaOrder(folder.id, ids); await load(); toast(t("folders.moved")); }}>⇤ {t("folders.moveFirst")}</button>
                <button className="ghost small" onClick={async () => { const i = items.findIndex((x) => x.id === view.id); if (i <= 0) return; const ids = items.map((x) => x.id); [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; await api.setMediaOrder(folder.id, ids); await load(); }}>←</button>
                <button className="ghost small" onClick={async () => { const i = items.findIndex((x) => x.id === view.id); if (i < 0 || i >= items.length - 1) return; const ids = items.map((x) => x.id); [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]]; await api.setMediaOrder(folder.id, ids); await load(); }}>→</button>
              </div>
            )}
            <div className="row"><a className="ghost small" href={view.url} download target="_blank" rel="noreferrer">{t("folders.download")}</a>
              {(staff || view.uploader_id === me.person.id) && <button className="ghost small danger" onClick={async () => { await api.deleteMedia(view.id); setView(null); void load(); }}>{t("common.delete")}</button>}</div>
          </div>
        </div>
      )}
    </section>
  );
}
