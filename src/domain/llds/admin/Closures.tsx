import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Closure, type Team } from "@/core/api";
import { humanize } from "@/core/errors";
import { Sheet } from "../components/Sheet";
import { isoDate, loc } from "../lib/time";

const span = (c: { from_date: string; to_date: string }) => { const f = (x: string) => new Date(x + "T12:00:00").toLocaleDateString(loc(), { day: "numeric", month: "short", year: "numeric" }); return c.from_date === c.to_date ? f(c.from_date) : `${f(c.from_date)} – ${f(c.to_date)}`; };

/** Admin → Sæsonplan → Ferier og fridage: periods without fixed trainings, for the whole school or chosen teams.
 *  Saving removes the coming fixed trainings in the period (the count is shown first); deleting the period can put them back. New weekly series skip the periods. */
export function Closures({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [list, setList] = useState<Closure[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [edit, setEdit] = useState<{ id: string | null; name: string; from: string; to: string; all: boolean; teamIds: string[] } | null>(null);
  const [preview, setPreview] = useState<{ sessions: number; teams: number } | null>(null);
  const [del, setDel] = useState<Closure | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => setList(await api.listClosures().catch(() => [])), []);
  useEffect(() => { void load(); void api.listTeams().then((ts) => setTeams(ts)); }, [load]);
  const valid = !!edit && !!edit.name.trim() && !!edit.from && !!edit.to && edit.to >= edit.from && (edit.all || edit.teamIds.length > 0);
  // how many fixed trainings the period removes – shown before saving
  useEffect(() => { if (!edit || !valid) { setPreview(null); return; } let on = true; const h = setTimeout(() => { void api.closurePreview(edit.from, edit.to, edit.all ? null : edit.teamIds).then((r) => { if (on) setPreview(r); }).catch(() => { if (on) setPreview(null); }); }, 250); return () => { on = false; clearTimeout(h); }; }, [edit, valid]);
  const save = async () => { if (!edit || !valid) return; setBusy(true); setErr(null);
    try { const r = await api.saveClosure({ id: edit.id, name: edit.name.trim(), from_date: edit.from, to_date: edit.to, team_ids: edit.all ? null : edit.teamIds }); setMsg(t("closures.saved", { count: r.removed })); setEdit(null); await load(); onChanged(); }
    catch (e) { setErr(humanize((e as Error).message)); } finally { setBusy(false); } };
  const remove = async (restore: boolean) => { if (!del) return; setBusy(true); setErr(null);
    try { const r = await api.deleteClosure(del.id, restore); setMsg(restore ? t("closures.deletedRestored", { count: r.restored }) : t("closures.deleted")); setDel(null); await load(); onChanged(); }
    catch (e) { setErr(humanize((e as Error).message)); } finally { setBusy(false); } };
  const teamNames = (ids: string[] | null) => ids ? ids.map((i) => teams.find((x) => x.id === i)?.name).filter(Boolean).join(", ") : t("closures.wholeSchool");
  const today = isoDate(new Date());
  return (
    <Sheet onClose={onClose} eyebrow={t("admin.season")} title={t("closures.title")}>
      {!edit && !del && (<>
        <p className="small muted" style={{ margin: 0 }}>{t("closures.intro")}</p>
        {msg && <p className="small ok" role="status" data-testid="cl-msg" style={{ margin: 0 }}>{msg}</p>}
        <div className="card list" data-testid="closures">
          {list === null ? <p className="muted">…</p> : !list.length ? <p className="muted">{t("closures.none")}</p> : list.map((c) => (
            <div key={c.id} className={"item actrow" + (c.to_date < today ? " off" : "")} data-testid="closure">
              <span className="grow">{c.name}<div className="tiny">{span(c)} · {teamNames(c.team_ids)}</div>{c.removed_count > 0 && <div className="tiny">{t("closures.removedCount", { count: c.removed_count })}</div>}</span>
              <div className="payacts"><button type="button" className="chip small" data-testid="cl-edit" onClick={() => { setMsg(null); setErr(null); setEdit({ id: c.id, name: c.name, from: c.from_date, to: c.to_date, all: !c.team_ids, teamIds: c.team_ids ?? [] }); }}>{t("common.edit")}</button><button type="button" className="chip small" data-testid="cl-delete" onClick={() => { setMsg(null); setErr(null); setDel(c); }}>{t("common.delete")}</button></div>
            </div>))}
        </div>
        <button type="button" className="cta" data-testid="cl-new" onClick={() => { setMsg(null); setErr(null); setEdit({ id: null, name: "", from: "", to: "", all: true, teamIds: [] }); }}>+ {t("closures.add")}</button>
      </>)}
      {edit && (<>
        <label className="field"><span>{t("closures.name")}</span><input value={edit.name} placeholder={t("closures.namePh")} data-testid="cl-name" onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
        <div className="two"><label className="field"><span>{t("closures.from")}</span><input type="date" value={edit.from} data-testid="cl-from" onChange={(e) => setEdit({ ...edit, from: e.target.value, to: edit.to && edit.to >= e.target.value ? edit.to : e.target.value })} /></label>
          <label className="field"><span>{t("closures.to")}</span><input type="date" value={edit.to} min={edit.from || undefined} data-testid="cl-to" onChange={(e) => setEdit({ ...edit, to: e.target.value })} /></label></div>
        <div className="field"><span>{t("closures.who")}</span><div className="seg2"><button type="button" className={edit.all ? "on" : ""} data-testid="cl-all" onClick={() => setEdit({ ...edit, all: true })}>{t("closures.wholeSchool")}</button><button type="button" className={!edit.all ? "on" : ""} data-testid="cl-some" onClick={() => setEdit({ ...edit, all: false })}>{t("closures.someTeams")}</button></div>
          {!edit.all && <div className="chips" style={{ marginTop: 8 }} data-testid="cl-teams">{teams.map((x) => <button type="button" key={x.id} className={"chip" + (edit.teamIds.includes(x.id) ? " on" : "")} onClick={() => setEdit({ ...edit, teamIds: edit.teamIds.includes(x.id) ? edit.teamIds.filter((i) => i !== x.id) : [...edit.teamIds, x.id] })}>{x.name}</button>)}</div>}
        </div>
        <div className="card" data-testid="cl-preview"><strong>{t("closures.effectTitle")}</strong>
          <p className="small muted" style={{ margin: "6px 0 0" }}>{!valid ? t("closures.effectFill") : preview === null ? "…" : preview.sessions ? t("closures.effect", { count: preview.sessions, teams: preview.teams }) : t("closures.effectNone")}</p>
          <p className="tiny muted" style={{ margin: "6px 0 0" }}>{t("closures.effectNote")}</p></div>
        {err && <p className="small" role="alert" style={{ margin: 0, color: "#e08a8a" }}>{err}</p>}
        <button type="button" className="cta" disabled={busy || !valid} data-testid="cl-save" onClick={() => void save()}>{t("common.save")}</button>
        <button type="button" className="ghost" onClick={() => setEdit(null)}>{t("common.cancel")}</button>
      </>)}
      {del && (<>
        <div className="card"><strong>{t("closures.deleteTitle", { name: del.name })}</strong><p className="small muted" style={{ margin: "6px 0 0" }}>{del.removed_count ? t("closures.deleteBody", { count: del.removed_count }) : t("closures.deleteBodyNone")}</p></div>
        {err && <p className="small" role="alert" style={{ margin: 0, color: "#e08a8a" }}>{err}</p>}
        {del.removed_count > 0 && <button type="button" className="cta" disabled={busy} data-testid="cl-del-restore" onClick={() => void remove(true)}>{t("closures.deleteRestore")}</button>}
        <button type="button" className={del.removed_count > 0 ? "ghost" : "cta"} disabled={busy} data-testid="cl-del-keep" onClick={() => void remove(false)}>{del.removed_count > 0 ? t("closures.deleteKeep") : t("common.delete")}</button>
        <button type="button" className="ghost" onClick={() => setDel(null)}>{t("common.cancel")}</button>
      </>)}
    </Sheet>
  );
}
