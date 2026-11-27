import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet } from "./Sheet";
import { calUrl, type CalItem } from "../lib/calendar";

/** "Føj til min kalender": first a short note that the phone's calendar is a copy that does not follow later changes, then the calendar page opens in the phone's browser. */
export function CalendarAdd({ items, label, series, testid = "cal-add", className = "linklike small" }: { items: CalItem[]; label: string; series?: boolean; testid?: string; className?: string }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (<>
    <button type="button" className={className} data-testid={testid} onClick={() => setOpen(true)}>{label}</button>
    {open && (
      <Sheet onClose={() => setOpen(false)} eyebrow={t("cal.eyebrow")} title={t(series ? "cal.titleSeries" : "cal.titleOne")}>
        <div className="card" data-testid="cal-note"><strong>{t("cal.noteTitle")}</strong><p className="small muted" style={{ margin: "6px 0 0" }}>{t(series ? "cal.noteSeries" : "cal.noteOne")}</p></div>
        <a className="cta calgo" href={calUrl(items, i18n.language)} target="_blank" rel="noopener" data-testid="cal-go" onClick={() => setTimeout(() => setOpen(false), 400)}>{t("cal.go")}</a>
        <button type="button" className="ghost" onClick={() => setOpen(false)}>{t("cal.skip")}</button>
      </Sheet>
    )}
  </>);
}
