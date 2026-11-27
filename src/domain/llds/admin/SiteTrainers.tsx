import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type SiteTrainer } from "@/core/api";
import { humanize } from "@/core/errors";
import { ImagePicker } from "../components/ImagePicker";
import { Sheet } from "../components/Sheet";
import { resolveImage } from "../lib/catalog";

/** Admin → Website → Trænere: the people on the website's "Om os" and in the trainer row on the front page.
 *  They are the app's own people – shown or hidden, ordered, each with title, photo and text. Changes are live on the website at once. */
export function SiteTrainers({ teamPhotos }: { teamPhotos: string[] }) {
  const { t } = useTranslation();
  const [list, setList] = useState<SiteTrainer[] | null>(null);
  const [edit, setEdit] = useState<SiteTrainer | null>(null);
  const [adding, setAdding] = useState(false); const [nf, setNf] = useState(""); const [nl, setNl] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => { try { setList(await api.listSiteTrainers()); } catch (e) { setList([]); setErr(humanize((e as Error).message)); } }, []);
  useEffect(() => { void load(); }, [load]);
  const shown = (list ?? []).filter((x) => x.show).sort((a, b) => a.sort - b.sort); const hidden = (list ?? []).filter((x) => !x.show);
  const run = async (f: () => Promise<unknown>, ok?: string) => { setBusy(true); setErr(null); try { await f(); if (ok) setMsg(ok); await load(); } catch (e) { setErr(humanize((e as Error).message)); } finally { setBusy(false); } };
  const move = (id: string, d: -1 | 1) => { const ids = shown.map((x) => x.id); const i = ids.indexOf(id), j = i + d; if (j < 0 || j >= ids.length) return; [ids[i], ids[j]] = [ids[j], ids[i]]; void run(() => api.orderSiteTrainers(ids)); };
  const save = () => { if (!edit) return; const e = edit; void run(async () => { await api.saveSiteTrainer(e.id, { show: e.show, title: e.title, bio: e.bio, photo: e.photo }); setEdit(null); }, t("siteTrainers.saved")); };
  const add = () => void run(async () => { const id = await api.addSiteTrainer(nf.trim(), nl.trim()); setAdding(false); setNf(""); setNl(""); const fresh = await api.listSiteTrainers(); setList(fresh); const p = fresh.find((x) => x.id === id); if (p) setEdit(p); });
  const img = (ref: string | null) => (ref ? resolveImage(ref) ?? ref : null);
  return (
    <div className="sec" data-testid="site-trainers">
      <h2>{t("siteTrainers.title")}</h2>
      <p className="tiny muted" style={{ marginTop: 0 }}>{t("siteTrainers.intro")}</p>
      {msg && <p className="small ok" role="status" style={{ margin: "0 0 8px" }}>{msg}</p>}
      {err && <p className="small" role="alert" style={{ margin: "0 0 8px", color: "#e08a8a" }}>{err}</p>}
      {list === null ? <p className="muted">…</p> : (<>
        <div className="trainercards" data-testid="st-shown">
          {shown.map((p, i) => (
            <div key={p.id} className="card trainercard" data-testid="st-card">
              <div className="thumb" style={img(p.photo) ? { backgroundImage: `url(${img(p.photo)})` } : undefined}>{!p.photo && <span className="tiny muted">{t("siteTrainers.noPhoto")}</span>}</div>
              <div className="tc-body"><strong>{p.name}</strong>{p.title && <div className="tiny" style={{ color: "var(--gold2)" }}>{p.title}</div>}{p.teaches && <div className="tiny">{p.teaches}</div>}
                <p className="small muted tc-bio">{p.bio ?? p.app_bio ?? t("siteTrainers.noBio")}</p></div>
              <div className="payacts"><button type="button" className="chip small" aria-label={t("customize.up")} disabled={busy || i === 0} onClick={() => move(p.id, -1)}>↑</button><button type="button" className="chip small" aria-label={t("customize.down")} disabled={busy || i === shown.length - 1} onClick={() => move(p.id, 1)}>↓</button>
                <button type="button" className="chip small" data-testid="st-edit" onClick={() => { setMsg(null); setEdit({ ...p }); }}>{t("common.edit")}</button><button type="button" className="chip small" data-testid="st-hide" disabled={busy} onClick={() => void run(() => api.saveSiteTrainer(p.id, { show: false, title: p.title, bio: p.bio, photo: p.photo }), t("siteTrainers.hidden", { name: p.name }))}>{t("siteTrainers.hide")}</button></div>
            </div>))}
          {!shown.length && <p className="muted small">{t("siteTrainers.none")}</p>}
        </div>
        {hidden.length > 0 && <details className="fold" data-testid="st-hidden"><summary><h3 className="eyebrow" style={{ margin: 0 }}>{t("siteTrainers.notShown", { count: hidden.length })}</h3></summary>
          <div className="card list">{hidden.map((p) => <div key={p.id} className="item actrow"><span className="grow">{p.name}{p.teaches && <div className="tiny">{p.teaches}</div>}</span><div className="payacts"><button type="button" className="chip small" data-testid="st-show" disabled={busy} onClick={() => void run(() => api.saveSiteTrainer(p.id, { show: true, title: p.title, bio: p.bio, photo: p.photo }), t("siteTrainers.shownMsg", { name: p.name }))}>{t("siteTrainers.show")}</button></div></div>)}</div></details>}
        <button type="button" className="ghost" style={{ marginTop: 10 }} data-testid="st-add" onClick={() => { setMsg(null); setErr(null); setAdding(true); }}>+ {t("siteTrainers.add")}</button>
      </>)}
      {adding && (
        <Sheet onClose={() => setAdding(false)} eyebrow={t("siteTrainers.title")} title={t("siteTrainers.add")}>
          <p className="small muted" style={{ margin: 0 }}>{t("siteTrainers.addHint")}</p>
          <div className="two"><label className="field"><span>{t("register.firstName")}</span><input value={nf} data-testid="st-first" onChange={(e) => setNf(e.target.value)} /></label><label className="field"><span>{t("register.lastName")}</span><input value={nl} data-testid="st-last" onChange={(e) => setNl(e.target.value)} /></label></div>
          {err && <p className="small" role="alert" style={{ margin: 0, color: "#e08a8a" }}>{err}</p>}
          <button type="button" className="cta" disabled={busy || !nf.trim()} data-testid="st-add-save" onClick={add}>{t("siteTrainers.addGo")}</button>
        </Sheet>)}
      {edit && (
        <Sheet onClose={() => setEdit(null)} eyebrow={t("siteTrainers.title")} title={edit.name}>
          <div className="field"><span>{t("siteTrainers.photo")}</span><ImagePicker tag="post" label=" " own={teamPhotos} value={edit.photo} onChange={(v) => setEdit({ ...edit, photo: v })} /></div>
          <label className="field"><span>{t("siteTrainers.titleField")}</span><input value={edit.title ?? ""} placeholder={t("siteTrainers.titlePh")} data-testid="st-title" onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
          <label className="field"><span>{t("siteTrainers.bio")}</span><textarea rows={7} value={edit.bio ?? ""} placeholder={edit.app_bio ?? t("siteTrainers.bioPh")} data-testid="st-bio" onChange={(e) => setEdit({ ...edit, bio: e.target.value })} /></label>
          <p className="tiny muted" style={{ margin: 0 }}>{edit.teaches ? t("siteTrainers.teachesHint", { teams: edit.teaches }) : t("siteTrainers.teachesNone")}</p>
          {err && <p className="small" role="alert" style={{ margin: 0, color: "#e08a8a" }}>{err}</p>}
          <button type="button" className="cta" disabled={busy} data-testid="st-save" onClick={save}>{t("common.save")}</button>
        </Sheet>)}
    </div>
  );
}
