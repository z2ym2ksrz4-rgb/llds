// Anonymises the mock state for store screenshots (VITE_ANON=1): no real people, team names, phones or venues.
// Applied once to the whole seeded state – covers posts, messages, schedule, events, notes etc.

const PEOPLE: [string, string, string, string][] = [
  // [first, last, newFirst, newLast]
  ["Line", "Lund Olesen", "Anna", "Holm"],
  ["Maja", "Kristensen", "Mette", "Krogh"],
  ["Sofie", "Dahl", "Sara", "Dam"],
  ["Steffen", "Therkildsen", "Peter", "Vang"],
  ["Freja", "Therkildsen", "Ella", "Vang"],
  ["Noah", "Jensen", "Oscar", "Friis"],
  ["Karin", "Nielsen", "Lene", "Mørk"],
  ["Alma", "Nielsen", "Clara", "Mørk"],
  ["Pia", "Testperson", "Birgit", "Lind"],
  ["Tilde", "Testperson", "Marie", "Brandt"],
  ["Milo", "Testperson", "Elias", "Lind"],
  ["Ida", "Testperson", "Nora", "Lind"],
  ["Rasmus", "Testperson", "Mikkel", "Skov"],
  ["Helle", "Testperson", "Louise", "Toft"],
  ["Jonas", "Testperson", "Victor", "Bach"],
  ["Sanne", "Testperson", "Trine", "Kjær"],
  ["Noor", "Testperson", "Lea", "Kjær"],
  ["Camilla", "Testperson", "Signe", "Rask"],
];

const TEAMS: [string, string][] = [
  ["Hip Hop Junior & Voksen Begynder", "Hip Hop Begynder"],
  ["Hip Hop Junior & Voksen Elite", "Hip Hop Elite"],
  ["Styrketræning Junior & Voksen", "Styrketræning"],
  ["Satellite Stars", "Comet Kids"],
  ["Shining Stars", "Solis Kids"],
  ["Sky Stars", "Luna Kids"],
  ["Mini Stjernetrin", "Mini Trin"],
  ["Danse Stjerner", "Dansespirer"],
  ["Mini Angels", "Mini Sparks"],
  ["Mini Cuties", "Mini Buds"],
  ["The AXIS", "Nova"],
  ["Apexion", "Aurora"],
  ["New Age", "Horizon"],
  ["Division", "Orbit"],
  ["Empire", "Vertex"],
  ["Control", "Pulse"],
  ["Airy", "Lumen"],
];

const MISC: [string, string][] = [
  ["Ulstrup Hallen, Vinkelvej 17, 8860 Ulstrup", "Byhallen, Hovedgaden 1, 8000 Aarhus"],
  ["Vejle Musikteater", "Musikhuset"],
  ["i Vejle", "i Aarhus"],
  ["+45 22 44 01 55", "+45 12 34 56 78"],
  ["Therkildsen", "Vang"],
  ["Testperson", "Demo"],
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rule = (from: string, to: string): [RegExp, string] => [new RegExp(`(?<![\\p{L}])${esc(from)}(?![\\p{L}])`, "gu"), to];

const RULES: [RegExp, string][] = [
  ...PEOPLE.map(([f, l, nf, nl]) => rule(`${f} ${l}`, `${nf} ${nl}`)),
  ...TEAMS.map(([a, b]) => rule(a, b)),
  ...MISC.map(([a, b]) => rule(a, b)),
  ...PEOPLE.map(([f, , nf]) => rule(f, nf)),
];

const text = (s: string) => RULES.reduce((acc, [re, to]) => acc.replace(re, to), s);

export function anonymize<T>(v: T): T {
  if (typeof v === "string") return text(v) as T;
  if (Array.isArray(v)) return v.map(anonymize) as T;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.first_name === "string" && typeof o.last_name === "string") {
      const hit = PEOPLE.find(([f, l]) => f === o.first_name && l === o.last_name);
      if (hit) { o.first_name = hit[2]; o.last_name = hit[3]; }
    }
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) out[k] = k === "email" || k === "id" || k === "user_id" ? o[k] : anonymize(o[k]);
    return out as T;
  }
  return v;
}

export const ANON = import.meta.env.VITE_ANON === "1";
