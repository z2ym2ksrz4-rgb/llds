import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Audience, type Message, type MessageStatus, type Team } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Sheet } from "./Sheet";
import { ScrollList } from "./ScrollList";
import { ago } from "../lib/time";

/** Official messages from Line/trainers that must be read or accepted. The banner shows the ones you still owe an answer. */
export function MessageBanner({ toast }: { toast: (m: string) => void }) {
  const { t } = useTranslation();
  const [list, setList] = useState<Message[]>([]);
  const [open, setOpen] = useState<Message | null>(null);
  const load = useCallback(async () => setList(await api.listMessages()), []);
  useEffect(() => { void load(); }, [load]);
  const due = list.filter((m) => !m.acted_at);
  const [history, setHistory] = useState(false);
  const done = list.filter((m) => m.acted_at);
  return (
    <>
      {due.length > 0 && (
        <div className="sec" data-testid="msg-banner"><h2>{t("msg.needsYou", { n: due.length })}</h2>
          <ScrollList testId="msg-list">{due.map((m) => <button key={m.id} className="item due" onClick={() => setOpen(m)}><span className="grow">{m.title}<div className="tiny">{m.author_name} · {ago(m.created_at)} · {t(`msg.needs.${m.needs}`)}</div></span><span className="gold">● ›</span></button>)}</ScrollList>
        </div>
      )}
      {due.length === 0 && (
        <button type="button" className={"msg-none" + (history ? " open" : "")} data-testid="msg-none" onClick={() => setHistory((h) => !h)} aria-expanded={history}>
          <span className="dot" aria-hidden /><span className="grow">{t("msg.noneNew")}</span>{done.length > 0 && <span className="tiny">{t("msg.history", { n: done.length })} <i className="caret">{history ? "⌃" : "⌄"}</i></span>}
        </button>
      )}
      {history && done.length > 0 && (
        <ScrollList testId="msg-history">{done.map((m) => <button key={m.id} className="item" onClick={() => setOpen(m)}><span className="grow">{m.title}<div className="tiny">{m.author_name} · {ago(m.created_at)} · {t(`msg.done.${m.needs}`)}</div></span><span className="gold">›</span></button>)}</ScrollList>
      )}
      {open && <MessageSheet message={open} onClose={() => { setOpen(null); void load(); }} toast={toast} />}
    </>
  );
}

export function MessageSheet({ message, onClose, toast }: { message: Message; onClose: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const isStaff = useAuth((s) => s.isStaff)();
  const [status, setStatus] = useState<MessageStatus[] | null>(null);
  const [acted, setActed] = useState(message.acted_at);
  const ack = async () => { await api.ackMessage(message.id); setActed(new Date().toISOString()); toast(t(`msg.acked.${message.needs}`)); };
  // "read" messages are marked read the moment they are opened – no button; only "accept" asks for a tap
  useEffect(() => { if (message.needs === "read" && !message.acted_at) void api.ackMessage(message.id).then(() => setActed(new Date().toISOString())).catch(() => { /* ignore */ }); }, [message.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = status?.filter((s) => s.acted_at).length ?? 0;
  const [showMissing, setShowMissing] = useState(true);
  return (
    <Sheet onClose={onClose} eyebrow={`${message.author_name} · ${ago(message.created_at)}`} title={message.title}>
      <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{message.body}</p>
      {acted ? <span className="chip ok">{t(`msg.done.${message.needs}`)} · {ago(acted)}</span>
        : message.needs === "accept" ? <button className="cta" id="msg-ack" onClick={() => void ack()}>{t(`msg.ackBtn.${message.needs}`)}</button> : null}
      {isStaff && (status ? (
        <div className="card" style={{ margin: 0 }}>
          <div className="eyebrow">{t("msg.status", { done, total: status.length })}</div>
          <div className="seg2" style={{ margin: "8px 0" }} data-testid="msg-status-seg">
            <button type="button" className={showMissing ? "on" : ""} onClick={() => setShowMissing(true)}>{t("msg.missing")} · {status.length - done}</button>
            <button type="button" className={!showMissing ? "on" : ""} onClick={() => setShowMissing(false)}>{t(`msg.doneList.${message.needs}`)} · {done}</button>
          </div>
          {(() => { const list = status.filter((s) => (showMissing ? !s.acted_at : !!s.acted_at)); return list.length
            ? <div className="chips">{list.map((s) => <span key={s.person_id} className={"chip small" + (s.acted_at ? " ok" : " warn")}>{s.name}{s.acted_at ? <span className="tiny"> · {ago(s.acted_at)}</span> : null}</span>)}</div>
            : <p className="tiny muted" style={{ margin: 0 }}>{showMissing ? t("msg.nobodyMissing") : t("msg.nobodyYet")}</p>; })()}
        </div>
      ) : <button className="ghost small" onClick={async () => setStatus(await api.messageStatus(message.id))}>{t("msg.showStatus")}</button>)}
    </Sheet>
  );
}

/** Staff: write a message to teams or the whole school. */
export function MessageComposer({ teams, defaultTeam, onClose, toast }: { teams: Team[]; defaultTeam?: string | null; onClose: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const isAdmin = useAuth((s) => s.isAdmin)();
  const [f, setF] = useState<{ title: string; body: string; needs: "read" | "accept"; all: boolean; teams: string[] }>({ title: "", body: "", needs: "read", all: false, teams: defaultTeam ? [defaultTeam] : [] });
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { const audience: Audience = f.all ? { all: true } : { teams: f.teams }; await api.sendMessage({ title: f.title.trim(), body: f.body.trim(), audience, needs: f.needs }); toast(t("msg.sent")); onClose(); }
    finally { setBusy(false); }
  };
  const toggle = (id: string) => setF({ ...f, teams: f.teams.includes(id) ? f.teams.filter((x) => x !== id) : [...f.teams, id] });
  return (
    <Sheet onClose={onClose} eyebrow={t("msg.eyebrow")} title={t("msg.new")}>
      <label className="field"><span>{t("msg.titleField")}</span><input id="msg-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <label className="field"><span>{t("msg.bodyField")}</span><textarea id="msg-body" rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
      <div className="field"><span>{t("msg.needsField")}</span><div className="chips">{(["read", "accept"] as const).map((n) => <button key={n} className={"chip" + (f.needs === n ? " on" : "")} onClick={() => setF({ ...f, needs: n })}>{t(`msg.needsOpt.${n}`)}</button>)}</div></div>
      <div className="field"><span>{t("msg.to")}</span>
        <div className="chips">
          {isAdmin && <button className={"chip" + (f.all ? " on" : "")} onClick={() => setF({ ...f, all: !f.all })}>{t("msg.everyone")}</button>}
          {!f.all && teams.map((x) => <button key={x.id} className={"chip" + (f.teams.includes(x.id) ? " on" : "")} onClick={() => toggle(x.id)}>{x.name}</button>)}
        </div>
      </div>
      <p className="tiny">{t("msg.parentsToo")}</p>
      <button className="cta" id="msg-send" disabled={busy || !f.title.trim() || !f.body.trim() || (!f.all && !f.teams.length)} onClick={() => void send()}>{t("msg.sendBtn")}</button>
    </Sheet>
  );
}
