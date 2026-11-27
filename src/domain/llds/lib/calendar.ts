import appConfig from "../../../../app.config.json";
import { Capacitor } from "@capacitor/core";
import type { Session } from "@/core/api";

/** One entry for the family calendar. Times are Copenhagen wall-clock ("20261201T154500") so a weekly series keeps its hour across summer time. */
export type CalItem = { t: string; s: string; e: string; p?: string; d?: string; u?: string };
/** The same entry with real instants – what the phone's own calendar sheet needs inside the installed app (never sent in the link). */
export type CalEntry = CalItem & { si: string; ei: string; ui?: string };

const TZ = "Europe/Copenhagen";
/** ISO instant → Copenhagen wall-clock in the compact calendar format. */
export function wall(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const g = (k: string) => parts.find((x) => x.type === k)?.value ?? "00";
  return `${g("year")}${g("month")}${g("day")}T${g("hour")}${g("minute")}00`;
}

/** The team's coming trainings as weekly series: one per fixed weekday + time + room, running until that slot's last training. Cancelled ones are left out. */
export function teamCalItems(teamName: string, sessions: Session[], place: string): CalEntry[] {
  const now = Date.now(); const groups = new Map<string, Session[]>();
  for (const x of sessions) {
    if (x.cancelled || new Date(x.starts_at).getTime() < now) continue;
    const w = wall(x.starts_at); const day = new Date(x.starts_at).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short" });
    const k = [day, w.slice(9, 13), wall(x.ends_at).slice(9, 13), x.room_name ?? ""].join("|");
    groups.set(k, [...(groups.get(k) ?? []), x]);
  }
  return [...groups.values()].filter((g) => g.length >= 2).map((g) => g.sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
    .sort((a, b) => a[0].starts_at.localeCompare(b[0].starts_at))
    .map((g) => ({ t: teamName, s: wall(g[0].starts_at), e: wall(g[0].ends_at), p: [g[0].room_name, place].filter(Boolean).join(", "), u: wall(g[g.length - 1].starts_at).slice(0, 8), si: g[0].starts_at, ei: g[0].ends_at, ui: g[g.length - 1].ends_at }));
}

/** Link to the small calendar page on the website. It runs in the phone's own browser, which is what can hand an entry to the calendar – the app's own web view cannot. */
export function calUrl(items: CalItem[], lang: string): string {
  const json = JSON.stringify({ l: lang.startsWith("da") ? "da" : "en", i: items.map(({ t, s, e, p, d, u }) => ({ t, s, e, p, d, u })) });
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return appConfig.siteUrl.replace(/\/$/, "") + "/kalender/#" + b64;
}

/** A single event (not a series) as a calendar entry. */
export function oneCalEntry(title: string, startIso: string, endIso: string | null, place?: string | null, info?: string | null): CalEntry {
  const end = endIso ?? new Date(new Date(startIso).getTime() + 2 * 3600e3).toISOString();
  return { t: title, s: wall(startIso), e: wall(end), p: place ?? undefined, d: info ? info.slice(0, 400) : undefined, si: startIso, ei: end };
}

export const calNative = () => Capacitor.isNativePlatform();
/** Inside the installed app: the phone's own "new event" sheet, filled in, one per entry – the person presses Add. Returns how many were saved; throws if the phone refuses. */
export async function addToPhoneCalendar(items: CalEntry[]): Promise<number> {
  const { CapacitorCalendar } = await import("@ebarooni/capacitor-calendar");
  const ios = Capacitor.getPlatform() === "ios"; const v = ios ? Number((navigator.userAgent.match(/OS (\d+)_/) ?? [])[1] ?? 17) : 0;
  if (ios && v < 17) { const r = await CapacitorCalendar.requestWriteOnlyCalendarAccess(); if (r.result !== "granted") throw new Error("calendar denied"); }   // iOS 17+ needs no permission for its own sheet
  let saved = 0;
  for (const x of items) {
    const r = await CapacitorCalendar.createEventWithPrompt({ title: x.t, startDate: new Date(x.si).getTime(), endDate: new Date(x.ei).getTime(), location: x.p, description: x.d, isAllDay: false,
      recurrence: x.ui ? { frequency: "weekly", interval: 1, end: new Date(x.ui).getTime() } : undefined });
    if (r?.id) saved++;
  }
  return saved;
}
