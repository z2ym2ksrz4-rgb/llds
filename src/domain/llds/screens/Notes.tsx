import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Member, type Note } from "@/core/api";
import { useAuth } from "@/core/auth";
import { ago } from "../lib/time";

/** Trainer notes per dancer. Staff of the team write and read all; a dancer (or parent) sees only their own. */
export function Notes({ teamId, staff, onBack }: { teamId: string; staff: boolean; onBack: () => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const viewing = useAuth((s) => s.viewing)!;
  const [notes, setNotes] = useState<Note[]>([]);
  const [dancers, setDancers] = useState<Member[]>([]);
  const [who, setWho] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const load = useCallback(async () => { setNotes(await api.listNotes(teamId, staff ? undefined : viewing.personId)); if (staff) setDancers((await api.listMembers()).filter((m) => m.status === "approved" && m.memberships.some((x) => x.team_id === teamId && x.role === "dancer"))); }, [teamId, staff, viewing.personId]);
  useEffect(() => { void load(); }, [load]);
  const list = who ? notes.filter((n) => n.dancer_id === who) : notes;
  return (
    <section className="screen">
      <button className="linklike" onClick={onBack}>‹ {t("team.myTeam")}</button>
      <header className="topbar"><h1 className="display">{t("notes.title")}</h1></header>
      {staff && <div className="chips" style={{ marginBottom: 10 }}><button className={"chip" + (!who ? " on" : "")} onClick={() => setWho(null)}>{t("notes.all")}</button>{dancers.map((d) => <button key={d.id} className={"chip" + (who === d.id ? " on" : "")} onClick={() => setWho(d.id)}>{d.first_name}</button>)}</div>}
      {staff && who && (
        <div className="card"><textarea id="note-body" rows={3} placeholder={t("notes.placeholder", { name: dancers.find((d) => d.id === who)?.first_name ?? "" })} value={body} onChange={(e) => setBody(e.target.value)} />
          <button className="small" id="note-save" disabled={!body.trim()} onClick={async () => { await api.addNote(teamId, who, body.trim()); setBody(""); void load(); }}>{t("notes.save")}</button></div>
      )}
      <div className="card list">
        {list.map((n) => <div key={n.id} className="item" data-testid="note"><span className="grow"><span className="small">{staff ? n.dancer_name : n.author_name} <span className="tiny">· {ago(n.created_at)}{staff ? ` · ${n.author_name}` : ""}</span></span><div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div></span>{(staff || n.author_id === me.person.id) && <button className="linklike tiny" onClick={async () => { await api.deleteNote(n.id); void load(); }}>{t("common.delete")}</button>}</div>)}
        {!list.length && <p className="muted">{t(staff ? "notes.emptyStaff" : "notes.empty")}</p>}
      </div>
      <p className="tiny">{t(staff ? "notes.hintStaff" : "notes.hint")}</p>
    </section>
  );
}
