import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Feedback } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Sheet, Toast } from "./Sheet";

const KEY = "llds_feedback";           // per device: { at, state: "later" | "done" | "never" }
const SESSIONS_KEY = "llds_sessions";  // per device + person: number of app sessions (one per 6 h)
const FIRST_AFTER_DAYS = 30;           // ask the first time after a month of use …
const FIRST_AFTER_SESSIONS = 10;       // … and at least ten sessions
const AGAIN_AFTER_DAYS = 90;           // "Senere" → ask again after three months
const YEARLY_DAYS = 365;               // answered → ask again a year later

/** Counts app sessions per device (at most one per 6 hours); returns { count, first } */
function bumpSessions(personId: string): { count: number; first: number } {
  try {
    const k = SESSIONS_KEY + ":" + personId; const st = JSON.parse(localStorage.getItem(k) ?? "null") as { count: number; first: number; last: number } | null;
    const now = Date.now();
    if (!st) { const v = { count: 1, first: now, last: now }; localStorage.setItem(k, JSON.stringify(v)); return v; }
    if (now - st.last > 6 * 36e5) { st.count += 1; st.last = now; localStorage.setItem(k, JSON.stringify(st)); }
    return st;
  } catch { return { count: 0, first: Date.now() }; }
}

/** Feedback sheet: how is the app for you, what should be better, what is broken. The answer is tied to the person (admin sees who wrote it). */
export function FeedbackSheet({ onClose, context }: { onClose: (sent: boolean) => void; context: string }) {
  const { t } = useTranslation();
  const [mood, setMood] = useState<Feedback["mood"] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => { setBusy(true); try { await api.sendFeedback(mood ?? "ok", body.trim(), context); onClose(true); } finally { setBusy(false); } };
  return (
    <Sheet onClose={() => onClose(false)} eyebrow={t("feedback.eyebrow")} title={t("feedback.title")}>
      <p className="small muted" style={{ margin: 0 }}>{t("feedback.intro")}</p>
      <div className="chips" data-testid="feedback-mood">
        {(["love", "ok", "meh"] as const).map((m) => <button key={m} type="button" className={"chip" + (mood === m ? " on" : "")} onClick={() => setMood(m)}>{{ love: "😍", ok: "🙂", meh: "😕" }[m]} {t(`feedback.mood.${m}`)}</button>)}
      </div>
      <label className="field"><span>{t("feedback.bodyLabel")}</span><textarea rows={5} value={body} placeholder={t("feedback.placeholder")} data-testid="feedback-body" onChange={(e) => setBody(e.target.value)} /></label>
      <p className="tiny muted" style={{ margin: 0 }}>{t("feedback.named")}</p>
      <div className="row" style={{ gap: 8 }}>
        <button className="cta grow" disabled={busy || (!mood && !body.trim())} data-testid="feedback-send" onClick={() => void send()}>{t("feedback.send")}</button>
        <button className="ghost" onClick={() => onClose(false)}>{t("feedback.later")}</button>
      </div>
    </Sheet>
  );
}

/** Asks for feedback once the person has been a member for a while – once per device, "Senere" asks again in three months. Never in a preview. */
export function FeedbackPrompt() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me); const phase = useAuth((s) => s.phase); const viewAs = useAuth((s) => s.viewAs);
  const [show, setShow] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (phase !== "ready" || !me || viewAs) return;
    let st: { at?: number; state?: string } | null = null; try { st = JSON.parse(localStorage.getItem(KEY + ":" + me.person.id) ?? "null"); } catch { /* ignore */ }
    const sessions = bumpSessions(me.person.id);
    if (st?.state === "never") return;
    if (st?.state === "done" && st.at && Date.now() - st.at < YEARLY_DAYS * 864e5) return;
    if (st?.state === "later" && st.at && Date.now() - st.at < AGAIN_AFTER_DAYS * 864e5) return;
    // first time: a month of real use on this device and at least ten sessions (not "member since" – many were imported long before they logged in)
    const usingSince = Math.max(new Date(me.person.first_seen_at ?? me.person.created_at).getTime(), sessions.first);
    if (!st && (Date.now() - usingSince < FIRST_AFTER_DAYS * 864e5 || sessions.count < FIRST_AFTER_SESSIONS)) return;
    let notifAsked = false; try { notifAsked = !!localStorage.getItem("llds_notif_asked") || !!localStorage.getItem("llds_notif_asked:" + me.person.id) || !!me.person.notify_prefs?.asked; } catch { /* ignore */ }
    if (!notifAsked) return;   // one prompt at a time – notifications first
    const tm = setTimeout(() => setShow(true), 2500); return () => clearTimeout(tm);
  }, [phase, me, viewAs]);
  if (!show || !me) return null;
  const mark = (state: string) => { try { localStorage.setItem(KEY + ":" + me.person.id, JSON.stringify({ at: Date.now(), state })); } catch { /* ignore */ } };
  return (<>
    <FeedbackSheet context={`auto · ${navigator.platform || "web"}`} onClose={(sent) => { mark(sent ? "done" : "later"); setShow(false); if (sent) { setToast(t("feedback.thanks")); setTimeout(() => setToast(null), 2600); } }} />
    <Toast msg={toast} />
  </>);
}
