import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Event, type EventInput, type EventSignup, type Result } from "@/core/api";
import { useAuth } from "@/core/auth";
import { ImagePicker } from "../components/ImagePicker";
import { catalogUrl } from "../lib/catalog";
import { Sheet, Toast } from "../components/Sheet";
import { PaySheet } from "../components/Pay";
import { dateLabel, hm, isoDate } from "../lib/time";
import { artFor } from "../lib/art";
import { TopRight } from "../components/ProfileMenu";

const KINDS = ["competition", "show", "workshop", "social"] as const;

/** Events tab like the demo: Kommende (photo cards) · Resultater (trophies) · Stjerneshoppen (shop). */
export function Events({ admin }: { admin?: boolean }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"upcoming" | "results" | "shop">("upcoming");
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("events.title")}</h1>{!admin && <TopRight />}</header>
      <div className="subtabs"><button className={tab === "upcoming" ? "on" : ""} onClick={() => setTab("upcoming")}>{t("events.upcoming")}</button><button className={tab === "results" ? "on" : ""} onClick={() => setTab("results")}>{t("events.results")}</button></div>
      {tab === "upcoming" && <EventsList admin={admin} />}
      {tab === "results" && <Results />}
    </section>
  );
}

function Results() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const isStaff = me.person.is_admin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer");
  const [list, setList] = useState<Result[]>([]);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ team_id: me.teams[0]?.id ?? "", event_title: "", placed: "", held_on: isoDate(new Date()), pub: true });
  const load = useCallback(async () => setList(await api.listResults()), []);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="stack" style={{ marginTop: 10 }}>
      {isStaff && <button className="ghost small" onClick={() => setAdding(true)}>+ {t("events.addResult")}</button>}
      <div className="card list">
        {list.map((r) => <div key={r.id} className="item" data-testid="result"><span className="time">{new Date(r.held_on).toLocaleDateString("da-DK", { month: "short", year: "numeric" })}</span><span className="grow">{r.event_title}<div className="tiny">{r.team_name ?? ""}{r.visibility === "public" ? ` · ${t("feed.publicChip")}` : ""}</div></span><span className="chip gold small">{r.placed}</span>{isStaff && <button className="linklike tiny" onClick={async () => { await api.deleteResult(r.id); void load(); }}>×</button>}</div>)}
        {!list.length && <p className="muted">{t("events.noResults")}</p>}
      </div>
      {adding && (
        <Sheet onClose={() => setAdding(false)} eyebrow={t("events.results")} title={t("events.addResult")}>
          <div className="field"><span>{t("events.teams")}</span><div className="chips">{me.teams.map((x) => <button key={x.id} className={"chip" + (f.team_id === x.id ? " on" : "")} onClick={() => setF({ ...f, team_id: x.id })}>{x.name}</button>)}</div></div>
          <label className="field"><span>{t("events.name")}</span><input id="res-title" value={f.event_title} onChange={(e) => setF({ ...f, event_title: e.target.value })} placeholder="DM Showdance – finale" /></label>
          <div className="grid2"><label className="field"><span>{t("events.placed")}</span><input id="res-placed" value={f.placed} onChange={(e) => setF({ ...f, placed: e.target.value })} placeholder="1. plads 🥇" /></label><label className="field"><span>{t("events.date")}</span><input type="date" value={f.held_on} onChange={(e) => setF({ ...f, held_on: e.target.value })} /></label></div>
          <label className="check"><input type="checkbox" checked={f.pub} onChange={(e) => setF({ ...f, pub: e.target.checked })} />{t("events.publicResult")}</label>
          <button className="cta" id="res-save" disabled={!f.event_title.trim() || !f.placed.trim()} onClick={async () => { await api.addResult({ team_id: f.team_id || null, event_title: f.event_title.trim(), placed: f.placed.trim(), held_on: f.held_on, visibility: f.pub ? "public" : "private" }); setAdding(false); void load(); }}>{t("common.save")}</button>
        </Sheet>
      )}
    </div>
  );
}

/** Upcoming events: photo cards with sign-up status, sheet with plan/pack list/sign-up/payment; staff create/edit. */
function EventsList({ admin }: { admin?: boolean }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const isStaff = useAuth((s) => s.isStaff)();
  const staff = admin || isStaff;
  const [events, setEvents] = useState<Event[]>([]);
  const [past, setPast] = useState(false);
  const [open, setOpen] = useState<Event | null>(null);
  const [edit, setEdit] = useState<Event | "new" | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => { const e = await api.listEvents(past); setEvents(e); setOpen((o) => (o ? e.find((x) => x.id === o.id) ?? null : null)); }, [past]);
  useEffect(() => { void load(); }, [load]);
  const mine = new Set(me.memberships.map((m) => m.team_id));
  return (
    <div className="stack" style={{ marginTop: 10 }}>
      {staff && <button className="ghost small" id="event-new" onClick={() => setEdit("new")}>+ {t("events.new")}</button>}
      {events.map((e) => { const relevant = !e.team_ids.length || e.team_ids.some((id) => mine.has(id)); return (
        <button key={e.id} className="hero tap photo evcard" data-testid="event" onClick={() => setOpen(e)} style={{ backgroundImage: `url(${catalogUrl(e.image_key) ?? artFor(e.id)})` }}>
          <div><div className="eyebrow">{dateLabel(e.starts_at)} · {t(`events.kind.${e.kind}`)}</div><h2 className="display">{e.title}</h2>
            <div className="row between"><span className="small muted">{e.place ?? ""}{e.team_names?.length ? ` · ${e.team_names.join(", ")}` : ` · ${t("events.allTeams")}`}</span>
              {e.mySignups && e.mySignups > 0 ? (e.myUnpaid ? <span className="chip warn small" data-testid="ev-awaiting">{t("events.unpaid")}</span> : e.myClaimed ? <span className="chip small pend" data-testid="ev-claimed">{t("events.claimed")}</span> : <span className="chip ok small">{t("events.on")}</span>) : relevant && (e.signup_deadline || e.price_dkk) ? <span className="chip gold small">{t("events.openSignup")}</span> : null}</div></div>
        </button>); })}
      {!events.length && <p className="muted">{t("events.empty")}</p>}
      <button className="linklike small" onClick={() => setPast(!past)}>{past ? t("events.hidePast") : t("events.showPast")}</button>
      {open && <EventSheet event={open} staff={staff} onClose={() => { setOpen(null); void load(); }} onEdit={() => { setEdit(open); setOpen(null); }} onChanged={() => void load()} toast={say} />}
      {edit && <EventEditor event={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void load(); say(t("common.saved")); }} />}
      <Toast msg={toast} />
    </div>
  );
}

/** Full event overlay: photo, when/where/who, info, programme, pack list, sign-up & payment, staff list. Closes back to wherever you were. */
export function EventSheet({ event, staff, onClose, onEdit, onChanged, toast }: { event: Event; staff: boolean; onClose: () => void; onEdit?: () => void; onChanged: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const [signups, setSignups] = useState<EventSignup[]>([]);
  const [pay, setPay] = useState<string | null>(null); // person_id paying
  const load = useCallback(async () => setSignups(await api.listSignups(event.id)), [event.id]);
  useEffect(() => { void load(); }, [load]);
  const hats = [me.person, ...me.children].filter((p) => !event.team_ids.length || me.memberships.some((m) => m.person_id === p.id && event.team_ids.includes(m.team_id)));
  const deadlinePassed = !!event.signup_deadline && event.signup_deadline < isoDate(new Date());
  const mine = (pid: string) => signups.find((s) => s.person_id === pid);
  const toggle = async (pid: string) => { const on = !mine(pid); await api.signUp_(event.id, pid, on); toast(on ? (event.price_dkk ? t("events.signedUpPay") : t("events.signedUp")) : t("events.withdrawn")); await load(); onChanged(); if (on && event.price_dkk) setPay(pid); };
  const paid = signups.filter((s) => s.paid).length;
  return (
    <Sheet onClose={onClose} photo={catalogUrl(event.image_key) ?? artFor(event.id)} eyebrow={`${t(`events.kind.${event.kind}`)} · ${dateLabel(event.starts_at)}`} title={event.title}>
      <div className="card list" style={{ margin: 0 }} data-testid="event-facts">
        <div className="item"><span className="avatar small">🕒</span><span className="grow">{dateLabel(event.starts_at)} · {hm(event.starts_at)}{event.ends_at ? `–${hm(event.ends_at)}` : ""}{event.meet_time ? <div className="tiny">{t("events.meet")}: {event.meet_time}</div> : null}</span></div>
        {event.place && <div className="item"><span className="avatar small">📍</span><span className="grow">{event.place}</span><a className="linklike small" href={`https://maps.google.com/?q=${encodeURIComponent(event.place)}`} target="_blank" rel="noreferrer">{t("events.map")}</a></div>}
        <div className="item"><span className="avatar small">👯</span><span className="grow">{event.team_names?.length ? event.team_names.join(", ") : t("events.allTeams")}</span></div>
        {(event.price_dkk || event.signup_deadline) && <div className="item"><span className="avatar small">🎟</span><span className="grow">{event.price_dkk ? `${event.price_dkk} kr.` : t("events.free")}{event.signup_deadline && <div className={"tiny" + (deadlinePassed ? " warn" : "")}>{t("events.deadline")}: {new Date(event.signup_deadline).toLocaleDateString("da-DK")}</div>}</span>{event.signups > 0 && <span className="tiny">{t("events.signups", { n: event.signups })}</span>}</div>}
      </div>
      {event.info && <p className="small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{event.info}</p>}
      {event.plan.length > 0 && <div className="card" style={{ margin: 0 }}><div className="eyebrow">{t("events.plan")}</div>{event.plan.map((p, i) => <div key={i} className="row"><span className="time">{p.time}</span><span>{p.text}</span></div>)}</div>}
      {event.pack_list.length > 0 && <div className="card" style={{ margin: 0 }}><div className="eyebrow">{t("events.pack")}</div><ul className="checklist">{event.pack_list.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
      {/* sign-up for me / my children */}
      {hats.length > 0 && (
        <div className="card" style={{ margin: 0 }}><div className="eyebrow">{t("events.signup")}</div>
          {hats.map((p) => { const s = mine(p.id); return (
            <div key={p.id} className="signrow"><span className="who"><span>{p.first_name}</span>{s ? <span className={"chip small " + (s.paid || !event.price_dkk ? "ok" : s.claimed_paid_at ? "pend" : "warn")}>{s.paid || !event.price_dkk ? t("events.on") : s.claimed_paid_at ? t("events.claimed") : t("events.unpaid")}</span> : null}</span>
              <div className="row">{s && event.price_dkk && !s.paid && !s.claimed_paid_at && <button className="small" onClick={() => setPay(p.id)}>{t("events.payBtn")}</button>}
                <button className={s ? "ghost small" : "small"} data-testid="signup" disabled={deadlinePassed && !s} onClick={() => void toggle(p.id)}>{s ? t("events.withdraw") : t("events.signUp")}</button></div></div>); })}
          {deadlinePassed && <p className="tiny">{t("events.deadlinePassed")}</p>}
        </div>
      )}
      {staff && (
        <div className="card" style={{ margin: 0 }}><div className="row between"><span className="eyebrow">{t("events.signups", { n: signups.length })}{event.price_dkk ? ` · ${t("events.paidN", { n: paid })}` : ""}</span>{onEdit && <button className="linklike small" onClick={onEdit}>{t("common.edit")}</button>}</div>
          <div className="list">{signups.map((s) => <div key={s.person_id} className="item" style={{ padding: "6px 0" }}><span className="grow">{s.person_name}<span className="tiny"> · {s.team_name ?? ""}</span></span>{event.price_dkk ? <button className={"chip small" + (s.paid ? " ok" : s.claimed_paid_at ? " pend" : " warn")} onClick={async () => { await api.setSignupPaid(event.id, s.person_id, !s.paid); void load(); }}>{s.paid ? t("events.paid") : s.claimed_paid_at ? t("events.claimedShort") : t("events.markPaid")}</button> : null}</div>)}</div>
        </div>
      )}
      {pay && event.price_dkk && <PaySheet amount={event.price_dkk} reference={`${event.title.slice(0, 20)} ${hats.find((h) => h.id === pay)?.first_name ?? ""}`} title={t("events.payTitle")} onClose={() => setPay(null)} onPaid={async () => { const pid = pay; setPay(null); try { await api.claimSignupPaid(event.id, pid); } catch { /* ignore */ } toast(t("events.paidClaimed")); await load(); onChanged(); }} />}
    </Sheet>
  );
}

function EventEditor({ event, onClose, onSaved }: { event: Event | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const d0 = event ? new Date(event.starts_at) : new Date(Date.now() + 14 * 864e5);
  const [image, setImage] = useState<string | null>(event?.image_key ?? null);
  const [f, setF] = useState({ title: event?.title ?? "", kind: event?.kind ?? "competition", date: isoDate(d0), time: event ? hm(event.starts_at) : "10:00", place: event?.place ?? "", meet_time: event?.meet_time ?? "", team_ids: event?.team_ids ?? [], plan: event?.plan.map((p) => `${p.time} ${p.text}`).join("\n") ?? "", pack: event?.pack_list.join("\n") ?? "", info: event?.info ?? "", deadline: event?.signup_deadline ?? "", price: event?.price_dkk?.toString() ?? "", pub: event?.visibility === "public" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const starts = new Date(`${f.date}T${f.time}:00`);
      const input: EventInput = { title: f.title.trim(), kind: f.kind as Event["kind"], starts_at: starts.toISOString(), ends_at: null, place: f.place || null, meet_time: f.meet_time || null, team_ids: f.team_ids,
        plan: f.plan.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^(\d{1,2}[.:]\d{2})\s+(.*)$/); return m ? { time: m[1].replace(".", ":"), text: m[2] } : { time: "", text: l }; }),
        pack_list: f.pack.split("\n").map((l) => l.trim()).filter(Boolean), info: f.info || null, signup_deadline: f.deadline || null, price_dkk: f.price ? Number(f.price) : null, visibility: f.pub ? "public" : "private", image_key: image };
      await api.saveEvent(input, event?.id); onSaved();
    } finally { setBusy(false); }
  };
  const toggleTeam = (id: string) => setF({ ...f, team_ids: f.team_ids.includes(id) ? f.team_ids.filter((x) => x !== id) : [...f.team_ids, id] });
  return (
    <Sheet onClose={onClose} eyebrow={t("events.title")} title={event ? t("common.edit") : t("events.new")}>
      <label className="field"><span>{t("events.name")}</span><input id="ev-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
      <ImagePicker tag="event" value={image} onChange={setImage} />
      <div className="field"><span>{t("events.kindLabel")}</span><div className="chips">{KINDS.map((k) => <button key={k} className={"chip" + (f.kind === k ? " on" : "")} onClick={() => setF({ ...f, kind: k })}>{t(`events.kind.${k}`)}</button>)}</div></div>
      <div className="grid2"><label className="field"><span>{t("events.date")}</span><input id="ev-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label><label className="field"><span>{t("events.time")}</span><input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label></div>
      <div className="grid2"><label className="field"><span>{t("events.place")}</span><input value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} /></label><label className="field"><span>{t("events.meet")}</span><input value={f.meet_time} onChange={(e) => setF({ ...f, meet_time: e.target.value })} placeholder="07:15 ved studiet" /></label></div>
      <div className="field"><span>{t("events.teams")}</span><div className="chips"><button className={"chip" + (!f.team_ids.length ? " on" : "")} onClick={() => setF({ ...f, team_ids: [] })}>{t("events.allTeams")}</button>{me.teams.map((x) => <button key={x.id} className={"chip" + (f.team_ids.includes(x.id) ? " on" : "")} onClick={() => toggleTeam(x.id)}>{x.name}</button>)}</div></div>
      <label className="field"><span>{t("events.planField")}</span><textarea rows={3} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} placeholder={"07:15 Afgang fra Ulstrup\n09:30 Gennemløb"} /></label>
      <label className="field"><span>{t("events.packField")}</span><textarea rows={3} value={f.pack} onChange={(e) => setF({ ...f, pack: e.target.value })} placeholder={"Kostume\nMadpakke"} /></label>
      <label className="field"><span>{t("events.info")}</span><textarea rows={3} value={f.info} onChange={(e) => setF({ ...f, info: e.target.value })} /></label>
      <div className="grid2"><label className="field"><span>{t("events.deadline")}</span><input type="date" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></label><label className="field"><span>{t("events.price")}</span><input type="number" inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="0" /></label></div>
      <label className="check"><input type="checkbox" checked={f.pub} onChange={(e) => setF({ ...f, pub: e.target.checked })} />{t("events.public")}</label>
      <div className="row"><button className="cta grow" id="ev-save" disabled={busy || !f.title.trim()} onClick={() => void save()}>{t("common.save")}</button>{event && <button className="ghost danger" onClick={async () => { await api.deleteEvent(event.id); onSaved(); }}>{t("common.delete")}</button>}</div>
    </Sheet>
  );
}
