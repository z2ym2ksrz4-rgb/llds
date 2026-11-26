import type { ClientError } from "@/core/api";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Feedback, type Insights } from "@/core/api";
import { ScrollList } from "../components/ScrollList";
import { ago, loc } from "../lib/time";

const MOOD: Record<Feedback["mood"], string> = { love: "😍", ok: "🙂", meh: "😕" };

/** Admin → App insights: who uses the app (live / active / never / inactive), members without a team, social activity, and the feedback list. */
export function InsightsPage() {
  const { t } = useTranslation();
  const [errs, setErrs] = useState<ClientError[]>([]);
  useEffect(() => { void api.listClientErrors().then(setErrs).catch(() => setErrs([])); }, []);
  const [d, setD] = useState<Insights | null>(null);
  const [fb, setFb] = useState<Feedback[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const [i, f] = await Promise.all([api.appInsights(), api.listFeedback().catch(() => [] as Feedback[])]); setD(i); setFb(f); setErr(null); }
    catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const tile = (n: number, label: string, hot = false) => <div className={"tile6" + (hot && n ? " hot" : "")}><b>{n}</b><span>{label}</span></div>;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(loc(), { day: "numeric", month: "short" });
  return (
    <section className="screen" data-testid="insights">
      <header className="topbar"><h1 className="display">{t("insights.title")}</h1></header>
      <p className="muted small">{t("insights.intro")}</p>
      {err && <p className="small" style={{ color: "var(--danger)" }}>{/function|does not exist/i.test(err) ? t("insights.needsMigration") : err}</p>}
      {d && (<>
        <div className="sec"><h2>{t("insights.users")}</h2>
          <div className="card tiles6" data-testid="insights-users">
            {tile(d.members, t("insights.members"))}{tile(d.with_login, t("insights.withLogin"))}{tile(d.live_24h, t("insights.live24"), true)}
            {tile(d.active_7d, t("insights.active7"))}{tile(d.never_logged_in, t("insights.never"), true)}{tile(d.inactive_30d, t("insights.inactive"), true)}
          </div>
        </div>
        {d.no_team_list.length > 0 && <div className="sec"><h2>{t("insights.noTeam")} · {d.no_team}</h2><p className="tiny muted" style={{ marginTop: 0 }}>{t("insights.noTeamSub")}</p>
          <ScrollList testId="insights-noteam">{d.no_team_list.map((p) => <div key={p.id} className="item"><span className="grow">{p.name}</span></div>)}</ScrollList></div>}
        {d.never_list.length > 0 && <div className="sec"><h2>{t("insights.never")} · {d.never_logged_in}</h2><p className="tiny muted" style={{ marginTop: 0 }}>{t("insights.neverSub")}</p>
          <ScrollList testId="insights-never">{d.never_list.map((p) => <div key={p.id} className="item"><span className="grow">{p.name}</span><span className="tiny">{t("insights.since")} {fmt(p.since)}</span></div>)}</ScrollList></div>}
        {d.inactive_list.length > 0 && <div className="sec"><h2>{t("insights.inactive")} · {d.inactive_30d}</h2>
          <ScrollList testId="insights-inactive">{d.inactive_list.map((p) => <div key={p.id} className="item"><span className="grow">{p.name}</span><span className="tiny">{t("insights.lastSeen")} {fmt(p.last)}</span></div>)}</ScrollList></div>}
        <div className="sec"><h2>{t("insights.social")}</h2><p className="tiny muted" style={{ marginTop: 0 }}>{t("insights.last30")}</p>
          <div className="card tiles6" data-testid="insights-social">
            {tile(d.posts_30d, t("insights.posts"))}{tile(d.comments_30d, t("insights.comments"))}{tile(d.messages_30d, t("insights.messages"))}
            {tile(d.threads_30d, t("insights.threads"))}{tile(d.bookings_30d, t("insights.bookings"))}{tile(d.absences_30d, t("insights.absences"))}
          </div>
        </div>
      </>)}
      <div className="sec" data-testid="insights-errors"><h2>{t("insights.errors")} · {errs.length}</h2><p className="tiny muted" style={{ marginTop: 0 }}>{t("insights.errorsSub")}</p>
        {errs.length ? <div className="card list">{errs.slice(0, 20).map((e) => <details key={e.id} className="item" style={{ display: "block" }}><summary className="small">{new Date(e.created_at).toLocaleString(loc())} · {e.message}</summary><pre className="tiny" style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{[e.url, e.app_version, e.ua, e.stack].filter(Boolean).join("\n")}</pre></details>)}</div> : <p className="muted small" style={{ margin: 0 }}>{t("insights.errorsNone")}</p>}
      </div>
      <div className="sec"><h2>{t("insights.feedback")} · {fb.length}</h2><p className="tiny muted" style={{ marginTop: 0 }}>{t("insights.feedbackSub")}</p>
        {fb.length === 0 ? <p className="muted small">{t("insights.noFeedback")}</p> : (
          <ScrollList testId="insights-feedback" rows={5}>
            {fb.map((f) => <div key={f.id} className={"item" + (f.read_at ? "" : " unread")} data-testid="feedback-row">
              <span className="avatar small">{MOOD[f.mood]}</span>
              <span className="grow"><div><b>{f.person_name ?? t("insights.anonymous")}</b> <span className="tiny">· {ago(f.created_at)}{f.context ? ` · ${f.context}` : ""}</span></div><div className="small" style={{ whiteSpace: "pre-wrap" }}>{f.body}</div></span>
              {!f.read_at && <button type="button" className="chip small" onClick={async () => { await api.markFeedbackRead(f.id); await load(); }}>{t("insights.markRead")}</button>}
            </div>)}
          </ScrollList>)}
      </div>
    </section>
  );
}
