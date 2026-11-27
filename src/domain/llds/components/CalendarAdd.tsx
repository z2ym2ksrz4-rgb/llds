import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "./Sheet";
import { addToPhoneCalendar, calNative, calUrl, type CalEntry } from "../lib/calendar";

/** "Føj til min kalender": first a short note that the phone's calendar is a copy that does not follow later changes.
 *  In the installed app the phone's own "new event" sheet then opens, filled in; in a browser the small calendar page on the website opens. */
export function CalendarAdd({ items, load, label, series, testid = "cal-add", className = "linklike small" }: { items?: CalEntry[]; load?: () => Promise<CalEntry[]>; label: string; series?: boolean; testid?: string; className?: string }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<CalEntry[] | null>(items ?? null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<string | null>(null);
  if (!load && !(items && items.length)) return null;
  const show = async () => { setMsg(null); setOpen(true); if (load) { setList(null); setList(await load().catch(() => [])); } else setList(items ?? []); };
  const native = calNative();
  const go = async () => { if (!list?.length) return; setBusy(true); setMsg(null);
    try { const n = await addToPhoneCalendar(list); if (n > 0) { setMsg(t("cal.saved", { count: n })); setTimeout(() => setOpen(false), 1400); } }
    catch { setMsg(t("cal.failed")); } finally { setBusy(false); } };
  return (<>
    <button type="button" className={className} data-testid={testid} onClick={() => void show()}>{label}</button>
    {open && (
      <Sheet onClose={() => setOpen(false)} eyebrow={t("cal.eyebrow")} title={t(series ? "cal.titleSeries" : "cal.titleOne")}>
        <div className="card" data-testid="cal-note"><strong>{t("cal.noteTitle")}</strong><p className="small muted" style={{ margin: "6px 0 0" }}>{t(series ? "cal.noteSeries" : "cal.noteOne")}</p></div>
        {list === null ? <p className="small muted" style={{ margin: 0 }}>{t("cal.loading")}</p>
          : !list.length ? <p className="small muted" style={{ margin: 0 }} data-testid="cal-none">{t("cal.none")}</p>
          : native ? (<>
              {series && list.length > 1 && <p className="tiny muted" style={{ margin: 0 }}>{t("cal.several", { count: list.length })}</p>}
              <button type="button" className="cta" disabled={busy} data-testid="cal-go" onClick={() => void go()}>{t("cal.go")}</button>
            </>)
          : <a className="cta calgo" href={calUrl(list, i18n.language)} target="_blank" rel="noopener" data-testid="cal-go" onClick={() => setTimeout(() => setOpen(false), 400)}>{t("cal.go")}</a>}
        {msg && <p className="small" role="status" data-testid="cal-msg" style={{ margin: 0 }}>{msg}</p>}
        <button type="button" className="ghost" onClick={() => setOpen(false)}>{t("cal.skip")}</button>
      </Sheet>
    )}
  </>);
}
