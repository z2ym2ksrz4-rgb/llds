/** Small date helpers. All display is da-DK; storage is ISO UTC. */
export const DAY_NAMES = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
export const DAY_LONG = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

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
