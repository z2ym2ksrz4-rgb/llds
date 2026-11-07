import type { Badge, PersonBadge, SupabaseClient } from "@supabase/supabase-js";
import type { Event, EventInput, EventSignup, Milestone, Notification, Order, OrderLine, Product, PunchCard, PunchCardType } from "./types";
import { downscaleImage } from "./image";

type Fail = (e: { message: string } | null) => void;

/** Phase-4 half of the Supabase API: events, shop, punch cards, milestones, notifications. Triggers in 0004 create the notifications. */
export function supabaseShop(sb: SupabaseClient, fail: Fail, schoolId: () => Promise<string>, myPersonId: () => Promise<string | null>, schoolSlug: string) {
  const pubUrl = (path: string | null) => (path ? (path.startsWith("http") ? path : sb.storage.from("public").getPublicUrl(path).data.publicUrl) : null);
  return {
    async listEvents(includePast = false): Promise<Event[]> {
      let q = sb.from("event_view").select("*").order("starts_at");
      if (!includePast) q = q.gte("starts_at", new Date(Date.now() - 864e5).toISOString());
      const { data, error } = await q; fail(error);
      const { data: mine } = await sb.from("event_signup").select("event_id,person_id"); // RLS: my people (+ staff: all)
      const pid = await myPersonId(); const { data: kids } = await sb.from("guardian").select("child_id").eq("parent_id", pid);
      const people = new Set([pid, ...(kids ?? []).map((k) => k.child_id as string)]);
      return (data ?? []).map((e: Record<string, unknown>) => ({ ...(e as Event), signups: Number(e.signups ?? 0), plan: (e.plan ?? []) as Event["plan"], pack_list: (e.pack_list ?? []) as string[], team_ids: (e.team_ids ?? []) as string[], mySignups: (mine ?? []).filter((s) => s.event_id === e.id && people.has(s.person_id as string)).length }));
    },
    async saveEvent(i: EventInput, id?: string) {
      const row = { ...i, school_id: await schoolId() };
      if (id) { const { error } = await sb.from("event").update(i).eq("id", id); fail(error); }
      else { const { error } = await sb.from("event").insert({ ...row, created_by: await myPersonId() }); fail(error); }
    },
    async deleteEvent(id: string) { const { error } = await sb.from("event").delete().eq("id", id); fail(error); },
    async listSignups(eventId: string): Promise<EventSignup[]> { const { data, error } = await sb.from("event_signup_view").select("*").eq("event_id", eventId).order("person_name"); fail(error); return (data ?? []) as EventSignup[]; },
    async signUp_(eventId: string, personId: string, on: boolean) {
      if (on) { const { error } = await sb.from("event_signup").upsert({ event_id: eventId, person_id: personId }, { onConflict: "event_id,person_id" }); fail(error); }
      else { const { error } = await sb.from("event_signup").delete().eq("event_id", eventId).eq("person_id", personId); fail(error); }
    },
    async setSignupPaid(eventId: string, personId: string, paid: boolean) { const { error } = await sb.from("event_signup").update({ paid }).eq("event_id", eventId).eq("person_id", personId); fail(error); },

    async listProducts(all = false): Promise<Product[]> {
      let q = sb.from("product").select("*").order("name"); if (!all) q = q.eq("active", true);
      const { data, error } = await q; fail(error); return (data ?? []).map((p: Product) => ({ ...p, image_url: pubUrl(p.image_path) }));
    },
    async saveProduct(i: Omit<Product, "id" | "image_url"> & { image?: File | null }, id?: string) {
      const { image, ...rest } = i; let image_path = rest.image_path;
      if (image) { image_path = `${schoolSlug}/shop/${crypto.randomUUID()}.jpg`; const { error } = await sb.storage.from("public").upload(image_path, await downscaleImage(image, 1200), { contentType: "image/jpeg" }); fail(error); }
      const row = { ...rest, image_path };
      if (id) { const { error } = await sb.from("product").update(row).eq("id", id); fail(error); }
      else { const { error } = await sb.from("product").insert({ ...row, school_id: await schoolId() }); fail(error); }
    },
    async listOrders(all = false): Promise<Order[]> {
      let q = sb.from("order_view").select("*").order("created_at", { ascending: false }); if (!all) q = q.in("person_id", [await myPersonId()]);
      const { data, error } = await q; fail(error); return (data ?? []) as Order[];
    },
    async createOrder(personId: string, lines: OrderLine[]): Promise<Order> {
      const total = lines.reduce((s, l) => s + l.qty * l.price_dkk, 0);
      const { data, error } = await sb.from("order").insert({ school_id: await schoolId(), person_id: personId, lines, total_dkk: total }).select("id").single(); fail(error);
      const { data: o } = await sb.from("order_view").select("*").eq("id", data!.id).single(); return o as Order;
    },
    async claimPaid(orderId: string) { const { error } = await sb.from("order").update({ claimed_paid_at: new Date().toISOString() }).eq("id", orderId); fail(error); },
    async setOrderStatus(orderId: string, status: Order["status"]) { const { error } = await sb.from("order").update({ status }).eq("id", orderId); fail(error); },

    async listPunchCardTypes(): Promise<PunchCardType[]> { const { data, error } = await sb.from("punch_card_type").select("*").order("name"); fail(error); return (data ?? []) as PunchCardType[]; },
    async savePunchCardType(i: Omit<PunchCardType, "id">, id?: string) {
      if (id) { const { error } = await sb.from("punch_card_type").update(i).eq("id", id); fail(error); }
      else { const { error } = await sb.from("punch_card_type").insert({ ...i, school_id: await schoolId() }); fail(error); }
    },
    async listPunchCards(all = false): Promise<PunchCard[]> {
      let q = sb.from("punch_card_view").select("*").order("created_at", { ascending: false }); if (!all) q = q.in("person_id", [await myPersonId()]);
      const { data, error } = await q; fail(error); return (data ?? []).map((c: PunchCard) => ({ ...c, used: Number(c.used ?? 0) }));
    },
    async buyPunchCard(typeId: string, personId: string): Promise<PunchCard> {
      const { data: ty } = await sb.from("punch_card_type").select("*").eq("id", typeId).single();
      const { data, error } = await sb.from("punch_card").insert({ type_id: typeId, person_id: personId, punches_left: ty!.punches, expires_on: new Date(Date.now() + ty!.valid_days * 864e5).toISOString().slice(0, 10) }).select("id").single(); fail(error);
      const { data: c } = await sb.from("punch_card_view").select("*").eq("id", data!.id).single(); return c as PunchCard;
    },
    async claimPunchCardPaid(cardId: string) { const { error } = await sb.from("punch_card").update({ claimed_paid_at: new Date().toISOString() }).eq("id", cardId); fail(error); },
    async activatePunchCard(cardId: string) { const { error } = await sb.rpc("activate_punch_card", { p_card: cardId }); fail(error); },

    async listMilestones(personId?: string): Promise<Milestone[]> {
      let q = sb.from("milestone_view").select("*").order("created_at", { ascending: false }); if (personId) q = q.eq("person_id", personId);
      const { data, error } = await q; fail(error); return (data ?? []) as Milestone[];
    },
    async giveMilestone(personId: string, title: string, teamId: string | null) { const { error } = await sb.from("milestone").insert({ person_id: personId, title, team_id: teamId, reached_on: new Date().toISOString().slice(0, 10), given_by: await myPersonId() }); fail(error); },
    async deleteMilestone(id: string) { const { error } = await sb.from("milestone").delete().eq("id", id); fail(error); },

    /* emblems */
    async listBadges() { const { data, error } = await sb.from("badge").select("*").eq("active", true).order("sort"); fail(error); return (data ?? []) as Badge[]; },
    async listPersonBadges(filter) {
      let q = sb.from("person_badge_view").select("*").order("created_at", { ascending: false });
      if (filter?.personId) q = q.eq("person_id", filter.personId); else if (filter?.teamId) q = q.eq("team_id", filter.teamId);
      const { data, error } = await q.limit(200); fail(error); return (data ?? []) as PersonBadge[];
    },
    async giveBadge(personId, badgeId, teamId, note) {
      const { data: b } = await sb.from("badge").select("monthly").eq("id", badgeId).single();
      const period = b?.monthly ? new Date().toISOString().slice(0, 7) : null;
      const { error } = await sb.from("person_badge").insert({ person_id: personId, badge_id: badgeId, team_id: teamId, period, note: note || null, given_by: await myPersonId() }); fail(error);
    },
    async removeBadge(id) { const { error } = await sb.from("person_badge").delete().eq("id", id); fail(error); },

    async listNotifications(): Promise<Notification[]> { const { data, error } = await sb.from("notification").select("*").order("created_at", { ascending: false }).limit(60); fail(error); return (data ?? []) as Notification[]; },
    async markNotificationsRead(ids?: string[]) {
      let q = sb.from("notification").update({ read_at: new Date().toISOString() }).is("read_at", null); if (ids) q = q.in("id", ids);
      const { error } = await q; fail(error);
    },
    async savePushToken(token: string, platform: "ios" | "android" | "web") { const pid = await myPersonId(); if (!pid) return; const { error } = await sb.from("push_token").upsert({ token, person_id: pid, platform, updated_at: new Date().toISOString() }); fail(error); },
  };
}
