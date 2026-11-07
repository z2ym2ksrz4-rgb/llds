import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type TeamStaff, type Thread, type ThreadMessage } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Sheet } from "./Sheet";
import { ago, hm, dateLabel } from "../lib/time";

/** "Skriv til træneren": pick any combination of the team's trainer(s), assistant(s) and the admin, then subject + message. */
export function ThreadComposer({ teamId, teamName, onClose, onSent, toast }: { teamId: string; teamName: string; onClose: () => void; onSent?: (t: Thread) => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const [staff, setStaff] = useState<TeamStaff[] | null>(null);
  const [to, setTo] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState(""); const [body, setBody] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { void api.teamStaff(teamId).then((s) => { const list = s.filter((x) => x.person_id !== me.person.id); setStaff(list); setTo(new Set(list.filter((x) => x.role === "trainer").map((x) => x.person_id))); }); }, [teamId, me.person.id]);
  const toggle = (id: string) => setTo((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const send = async () => {
    setBusy(true);
    try { const th = await api.createThread({ team_id: teamId, subject: subject.trim() || t("threads.defaultSubject", { team: teamName }), body: body.trim(), participant_ids: [...to] }); toast(t("threads.sent")); onSent?.(th); onClose(); }
    catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const roleLabel = (r: TeamStaff["role"]) => t(`threads.role.${r}`);
  return (
    <Sheet onClose={onClose} eyebrow={teamName} title={t("threads.writeTo")}>
      <div className="field"><span>{t("threads.to")}</span>
        <div className="chips" data-testid="thread-to">
          {staff?.map((p) => <button key={p.person_id} className={"chip" + (to.has(p.person_id) ? " on" : "")} onClick={() => toggle(p.person_id)} data-testid={`to-${p.role}`}>{p.name} · {roleLabel(p.role)}</button>)}
          {staff && !staff.length && <span className="muted small">{t("threads.noStaff")}</span>}
        </div>
        <p className="tiny">{t("threads.toHint")}</p>
      </div>
      <label className="field"><span>{t("threads.subject")}</span><input value={subject} placeholder={t("threads.defaultSubject", { team: teamName })} onChange={(e) => setSubject(e.target.value)} data-testid="thread-subject" /></label>
      <label className="field"><span>{t("threads.message")}</span><textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} data-testid="thread-body" /></label>
      <button className="cta" disabled={busy || !to.size || !body.trim()} onClick={() => void send()} data-testid="thread-send">{t("threads.send")}</button>
    </Sheet>
  );
}

/** Inbox list (Social → Samtaler). */
export function ThreadList({ threads, onOpen }: { threads: Thread[]; onOpen: (t: Thread) => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  return (
    <div className="card list" style={{ marginTop: 10 }} data-testid="threads">
      {threads.map((th) => (
        <button key={th.id} className={"item" + (th.unread ? " unread" : "")} onClick={() => onOpen(th)} data-testid="thread">
          <span className="avatar small">{th.unread ? "●" : "✉️"}</span>
          <span className="grow"><strong style={{ fontWeight: th.unread ? 500 : 400 }}>{th.subject}</strong><div className="tiny">{th.participant_names.filter((n) => n !== `${me.person.first_name} ${me.person.last_name}`).join(", ")}</div>{th.last_body && <div className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{th.last_sender_name?.split(" ")[0]}: {th.last_body}</div>}</span>
          <span className="tiny">{ago(th.last_at)}</span>
        </button>
      ))}
      {!threads.length && <p className="muted">{t("threads.none")}</p>}
    </div>
  );
}

/** One conversation: messages as bubbles + reply box. Opening marks it read. */
export function ThreadSheet({ thread, onClose, toast }: { thread: Thread; onClose: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const [msgs, setMsgs] = useState<ThreadMessage[]>([]); const [body, setBody] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => setMsgs(await api.listThreadMessages(thread.id)), [thread.id]);
  useEffect(() => { void load(); void api.markThreadRead(thread.id); }, [load, thread.id]);
  const reply = async () => { setBusy(true); try { await api.replyThread(thread.id, body.trim()); setBody(""); await load(); toast(t("threads.sent")); } catch (e) { toast((e as Error).message); } finally { setBusy(false); } };
  return (
    <Sheet onClose={onClose} eyebrow={thread.participant_names.join(" · ")} title={thread.subject}>
      <div className="bubbles" data-testid="bubbles">
        {msgs.map((m) => <div key={m.id} className={"bubble" + (m.sender_id === me.person.id ? " me" : "")}><div className="tiny">{m.sender_name} · {dateLabel(m.created_at)} {hm(m.created_at)}</div><div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div></div>)}
      </div>
      <div className="row"><textarea rows={2} className="grow" value={body} placeholder={t("threads.replyPlaceholder")} onChange={(e) => setBody(e.target.value)} data-testid="thread-reply" /><button className="cta small" disabled={busy || !body.trim()} onClick={() => void reply()} data-testid="thread-reply-send">{t("threads.reply")}</button></div>
    </Sheet>
  );
}
