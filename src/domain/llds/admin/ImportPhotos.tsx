import { useState } from "react";
import { useTranslation } from "react-i18next";
import JSZip from "jszip";
import { api, type Team } from "@/core/api";
import { useAuth } from "@/core/auth";

/** Admin → Importér billeder: drop a zip with one folder per team (Line's Drive export). Folders are matched to teams by name; the first image becomes the team cover. */
const ALIASES: Record<string, string> = { "mini-cuites": "Mini Cuties", "the-attitude": "Apexion", "dm-the-axis": "The AXIS" };
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function ImportPhotos() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const refresh = useAuth((s) => s.refresh);
  const [zip, setZip] = useState<JSZip | null>(null);
  const [groups, setGroups] = useState<{ dir: string; files: string[]; teamId: string | null; folder: string; cover: boolean }[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const teams: Team[] = me.teams;
  const guess = (dir: string) => { const alias = ALIASES[dir.toLowerCase()]; const target = norm(alias ?? dir); return teams.find((x) => norm(x.name) === target)?.id ?? teams.find((x) => norm(x.name).includes(target) || target.includes(norm(x.name)))?.id ?? null; };

  const pick = async (f: File) => {
    const z = await JSZip.loadAsync(f); setZip(z);
    const byDir: Record<string, string[]> = {};
    z.forEach((rel, entry) => { if (entry.dir || !/\.(jpe?g|png|webp)$/i.test(rel) || rel.includes("__MACOSX")) return; const parts = rel.split("/").filter(Boolean); const dir = parts.length > 1 ? parts[parts.length - 2] : "(rod)"; (byDir[dir] ||= []).push(rel); });
    setGroups(Object.entries(byDir).map(([dir, files]) => ({ dir, files: files.sort(), teamId: guess(dir), folder: dir.toLowerCase().startsWith("dm") ? "DM 2026" : t("admin.importDefaultFolder"), cover: true })));
  };
  const run = async () => {
    if (!zip) return; let n = 0; const total = groups.filter((g) => g.teamId).reduce((s, g) => s + g.files.length, 0);
    for (const g of groups) {
      if (!g.teamId) continue;
      for (const [i, rel] of g.files.entries()) {
        const blob = await zip.file(rel)!.async("blob"); const nameOnly = rel.split("/").pop()!;
        try { await api.importTeamImage(g.teamId, g.folder, blob, nameOnly, g.cover && i === 0); } catch (e) { console.error(rel, e); }
        n++; setProgress(t("admin.importProgress", { n, total }));
      }
    }
    setProgress(null); setDone(t("admin.importDone", { n })); await refresh();
  };
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("admin.importPhotos")}</h1></header>
      <p className="small muted">{t("admin.importIntro")}</p>
      <input id="import-zip" type="file" accept=".zip,application/zip" onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }} />
      {groups.length > 0 && (
        <div className="card list">
          {groups.map((g, i) => <div key={g.dir} className="item" data-testid="import-group"><span className="grow"><b style={{ fontWeight: 500 }}>{g.dir}</b> <span className="tiny">· {t("folders.count", { n: g.files.length })}</span>
            <div className="row" style={{ marginTop: 6 }}><select value={g.teamId ?? ""} onChange={(e) => setGroups(groups.map((x, j) => j === i ? { ...x, teamId: e.target.value || null } : x))}><option value="">{t("admin.importSkip")}</option>{teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              <input value={g.folder} onChange={(e) => setGroups(groups.map((x, j) => j === i ? { ...x, folder: e.target.value } : x))} /></div>
            <label className="check small" style={{ marginTop: 6 }}><input type="checkbox" checked={g.cover} onChange={(e) => setGroups(groups.map((x, j) => j === i ? { ...x, cover: e.target.checked } : x))} />{t("admin.importCover")}</label></span></div>)}
        </div>
      )}
      {groups.length > 0 && !progress && !done && <button className="cta" id="import-run" onClick={() => void run()}>{t("admin.importRun", { n: groups.filter((g) => g.teamId).reduce((s, g) => s + g.files.length, 0) })}</button>}
      {progress && <p className="gold">{progress}</p>}
      {done && <p className="ok">{done}</p>}
      <p className="tiny">{t("admin.importHint")}</p>
    </section>
  );
}
