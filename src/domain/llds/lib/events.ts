import type { Event, Me } from "@/core/api";

/** Which events concern this household? Staff/admin see everything; a dancer/parent sees events for everyone,
 *  for a team someone in the household dances on, or aimed at someone in the household (solo/duo). */
export function eventsFor(events: Event[], me: Me, viewing: { personId: string; isChild: boolean } | null): Event[] {
  const isStaff = me.person.is_admin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer");
  if (isStaff && !viewing?.isChild) return events;
  const people = viewing?.isChild ? [viewing.personId] : [me.person.id, ...me.children.map((c) => c.id)];
  const teams = new Set(me.memberships.filter((m) => people.includes(m.person_id)).map((m) => m.team_id));
  return events.filter((e) => {
    const pids = e.person_ids ?? [];
    if (!e.team_ids.length && !pids.length) return true;                 // everyone
    if (pids.length && pids.some((id) => people.includes(id))) return true;
    return !pids.length && e.team_ids.some((id) => teams.has(id));       // team event; a person-list narrows it to those people
  });
}
