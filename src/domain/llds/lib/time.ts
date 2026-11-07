/** Small date helpers. All display is da-DK; storage is ISO UTC. */
/** Exact age from birth_date, else from birth_year (older profiles). */
export function ageOf(p: { birth_date?: string | null; birth_year: number | null } | null | undefined): number | null {
  if (!p) return null;
  if (p.birth_date) { const b = new Date(p.birth_date); const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; }
  return p.birth_year ? new Date().getFullYear() - p.birth_year : null;
}
export const DAY_NAMES = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
export const DAY_LONG = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
export const DAY_SHORT = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];

export function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function mondayOf(d: Date) { return addDays(startOfDay(d), -((d.getDay() + 6) % 7)); }
export function hm(iso: string) { const d = new Date(iso); return d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" }); }
export function dayLabel(d: Date) { return `${DAY_NAMES[(d.getDay() + 6) % 7]} ${d.getDate()}.`; }
export function dateLabel(iso: string) { const d = new Date(iso); return d.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" }); }
export function sameDay(a: Date, b: Date) { return a.toDateString() === b.toDateString(); }
export function isoDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
export function atTime(day: Date, hmStr: string) { const [h, m] = hmStr.split(":").map(Number); const d = new Date(day); d.setHours(h, m, 0, 0); return d; }
export function overlaps(aS: string, aE: string, bS: string, bE: string) { return aS < bE && bS < aE; }
export const SEASON_END = "2027-06-20";
export function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 6e4);
  if (m < 1) return "nu"; if (m < 60) return `${m} min`; const h = Math.round(m / 60); if (h < 24) return `${h} t`;
  const d = Math.round(h / 24); if (d < 7) return `${d} d`; return new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "short" });
}

/** HH:MM for <input type="time"> (hm() gives the Danish "16.00" display form, which the input rejects). */
export function hhmm(iso: string) { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }
