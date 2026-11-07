/** Move one occurrence of a weekly series the same way the edited occurrence was moved: same weekday shift, new time of day. */
export function shiftOccurrence(occStart: string, occEnd: string, origStart: string, newStart: string, newEnd: string): { starts_at: string; ends_at: string } {
  const dayMs = 86400000;
  const midnight = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const delta = Math.round((midnight(new Date(newStart)).getTime() - midnight(new Date(origStart)).getTime()) / dayMs);
  const ns = new Date(newStart), ne = new Date(newEnd);
  const s = new Date(occStart); s.setDate(s.getDate() + delta); s.setHours(ns.getHours(), ns.getMinutes(), 0, 0);
  const e = new Date(occEnd); e.setDate(e.getDate() + delta); e.setHours(ne.getHours(), ne.getMinutes(), 0, 0);
  return { starts_at: s.toISOString(), ends_at: e.toISOString() };
}
