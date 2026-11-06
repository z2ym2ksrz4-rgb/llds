/** Emblem catalogue – mirrored in supabase/migrations/0009_badges.sql (keys must match). Auto emblems are awarded by the
 * attendance trigger (streak = consecutive registered trainings present, broken by an absence or a "not present").
 * Manual emblems are given by trainers from the dancers list; "monthly" ones can be given once per month per dancer. */
export type BadgeDef = { key: string; emoji: string; name: string; desc: string; kind: "auto" | "manual"; monthly?: boolean; rule?: { streak?: number; total?: number } };
export const BADGES: BadgeDef[] = [
  { key: "streak10", emoji: "🔥", name: "10 i træk", desc: "10 træninger i træk uden fravær", kind: "auto", rule: { streak: 10 } },
  { key: "streak25", emoji: "⚡", name: "25 i træk", desc: "25 træninger i træk uden fravær", kind: "auto", rule: { streak: 25 } },
  { key: "total50", emoji: "🏅", name: "50 træninger", desc: "50 registrerede træninger", kind: "auto", rule: { total: 50 } },
  { key: "total100", emoji: "💯", name: "100 træninger", desc: "100 registrerede træninger", kind: "auto", rule: { total: 100 } },
  { key: "teammate", emoji: "🤝", name: "Månedens holdkammerat", desc: "Valgt af træneren – for at løfte holdet", kind: "manual", monthly: true },
  { key: "fighter", emoji: "💪", name: "Fighter", desc: "Blev ved, da det var svært", kind: "manual" },
  { key: "smile", emoji: "😊", name: "Smilet", desc: "Spredte godt humør på holdet", kind: "manual" },
  { key: "helper", emoji: "🫶", name: "Hjælpsom", desc: "Hjalp en holdkammerat videre", kind: "manual" },
  { key: "star", emoji: "🌟", name: "Scenestjerne", desc: "Strålede på scenen", kind: "manual" },
  { key: "firstcomp", emoji: "🏆", name: "Første konkurrence", desc: "Første stævne gennemført", kind: "manual" },
  { key: "firstshow", emoji: "🎭", name: "Første show", desc: "Første show gennemført", kind: "manual" },
  { key: "yearbest", emoji: "⭐", name: "Årets danser", desc: "Sæsonens danser på holdet", kind: "manual" },
];
export const badgeDef = (key: string) => BADGES.find((b) => b.key === key);
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
/** Training-count emblems continue every 50 after 100 (150, 200 …) – generated on the fly, mirrored in SQL. */
export const totalBadge = (n: number): BadgeDef => n === 50 ? BADGES[2] : n === 100 ? BADGES[3] : { key: `total${n}`, emoji: "🥇", name: `${n} træninger`, desc: `${n} registrerede træninger`, kind: "auto", rule: { total: n } };
