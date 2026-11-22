import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Team, type WebSignup } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Sheet, Toast } from "../components/Sheet";
import { PaySheet } from "../components/Pay";
import { ageOf, ago, loc } from "../lib/time";

/** Season price text → [full, half] in kr. ("2.400 kr. for hel sæson, eller 1.750 kr. for halv sæson") */
export const priceAmounts = (p: string | null | undefined): number[] => (p ?? "").match(/([0-9][0-9.]*) kr/g)?.map((x) => parseInt(x.replace(/\D/g, ""), 10)) ?? [];
export const kr = (n: number | null | undefined) => (n == null ? "–" : n.toLocaleString(loc()) + " kr.");
export type Plan = "full" | "half" | "rates2" | "rates4" | "rates10";
export const RATE_FEE = 50;
/** Client-side preview of what season_quote() returns (server is authoritative). */
export function quote(team: Pick<Team, "price_full" | "price_half" | "price_signup" | "installments_allowed">, plan: Plan, discountPct = 0, feeAlreadyPaid = false) {
  const n = plan === "rates2" ? 2 : plan === "rates4" ? 4 : plan === "rates10" ? 10 : 1;
  const base = plan === "half" && team.price_half ? team.price_half : team.price_signup ?? team.price_full ?? null;
  if (base == null) return null;
  const net = Math.round(base * (100 - discountPct) / 100); const fee = n > 1 && team.installments_allowed !== false && !feeAlreadyPaid ? RATE_FEE * n : 0;
  return { base, n, fee, total: net + fee, perRate: n > 1 ? Math.ceil((net + fee) / n) : net + fee };
}
export function PlanChips({ team, plan, setPlan }: { team: Pick<Team, "price_full" | "price_half" | "price_signup" | "installments_allowed">; plan: Plan; setPlan: (p: Plan) => void }) {
  const { t } = useTranslation();
  const opts: Plan[] = ["full", ...(team.price_half ? ["half" as Plan] : []), ...(team.installments_allowed !== false ? ["rates2", "rates4", "rates10"] as Plan[] : [])];
  return <div className="chips">{opts.map((p) => { const q = quote(team, p); return <button key={p} className={"chip" + (plan === p ? " on" : "")} onClick={() => setPlan(p)} data-testid={`plan-${p}`}>{t(`pay.plan.${p}`)}{q ? ` · ${q.n > 1 ? `${q.n} × ${kr(q.perRate)}` : kr(q.total)}` : ""}</button>; })}</div>;
}

/** My season payments (web sign-ups + admin requests): pay with MobilePay, "Jeg har betalt". Used on Home (open ones) and under Mere. */
export function MyPayments({ onBack, embedded }: { onBack?: () => void; embedded?: boolean }) {
  const { t } = useTranslation();
  const [list, setList] = useState<WebSignup[]>([]);
  const [pay, setPay] = useState<WebSignup | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => setList(await api.listMyPayments().catch(() => [])), []);
  useEffect(() => { void load(); }, [load]);
  const shown = embedded ? list.filter((p) => p.status === "awaiting_payment") : list;
  if (embedded && !shown.length) return null;
  return (
    <section className={embedded ? "stack" : "screen"}>
      {!embedded && <><button className="linklike" onClick={onBack}>‹ {t("nav.more")}</button><header className="topbar"><h1 className="display">{t("pay.title")}</h1></header></>}
      <div className="card list" data-testid="my-payments">
        {shown.map((p) => <PaymentRow key={p.id} p={p} onPay={() => setPay(p)} />)}
        {!shown.length && <p className="muted">{t("pay.none")}</p>}
      </div>
      {pay && pay.amount_dkk != null && <PaySheet amount={(pay.installments ?? 1) > 1 ? pay.per_rate_dkk ?? pay.amount_dkk : pay.amount_dkk} reference={(pay.installments ?? 1) > 1 ? `${pay.reference} rate ${(pay.rates_paid ?? 0) + 1}/${pay.installments}` : pay.reference} title={`${pay.team_name} · ${pay.dancer_name.split(" ")[0]}`} onClose={() => setPay(null)} onPaid={async () => { await api.claimPaymentPaid(pay.id); setPay(null); say(t("pay.claimed")); await load(); }} />}
      {!embedded && <Toast msg={toast} />}
    </section>
  );
}

function PaymentRow({ p, onPay }: { p: WebSignup; onPay: () => void }) {
  const { t } = useTranslation();
  const n = p.installments ?? 1; const paid = p.rates_paid ?? 0;
  const plan = p.plan && ["full", "half", "rates2", "rates4", "rates10", "rates"].includes(p.plan) ? t(`pay.plan.${p.plan}`) : p.plan ?? "";
  return (
    <div className="item" data-testid="payment">
      <span className="avatar small">💳</span>
      <span className="grow">{p.team_name} · {p.dancer_name.split(" ")[0]}<div className="tiny">{plan}{n > 1 ? ` · ${t("pay.ratesPaid", { paid, n })} · ${kr(p.per_rate_dkk)} ${t("pay.perRate")}${p.fee_dkk ? ` (${t("pay.feeIncl", { fee: p.fee_dkk })})` : ""}` : ""}{p.price_note ? ` · ${p.price_note}` : ""}{p.discount_pct ? ` · ${t("pay.discount", { pct: p.discount_pct })}${p.amount_before_dkk ? ` (${kr(p.amount_before_dkk)})` : ""}` : ""}{p.message ? ` · “${p.message}”` : ""} · {ago(p.created_at)}</div></span>
      {p.status === "paid" ? <span className="chip ok small">{t("shop.status.paid")}</span> : p.status === "cancelled" ? <span className="chip small">{t("pay.cancelled")}</span> : p.claimed_paid_at ? <span className="chip warn small">{t("shop.status.claimed")}</span> : p.amount_dkk != null ? <button className="small" onClick={onPay} data-testid="pay-btn">{n > 1 ? `${t("pay.rateN", { k: paid + 1 })} · ${kr(p.per_rate_dkk)}` : `${t("shop.pay")} · ${kr(p.amount_dkk)}`}</button> : <span className="chip small">{p.price_note ? t("pay.seeNote") : t("pay.plan.rates")}</span>}
    </div>
  );
}

/** "Tilmeld nyt hold" for signed-in members: pick dancer + team + plan → payment request with automatic family discount. */
export function JoinTeam({ onClose, toast, initialTeam }: { onClose: () => void; toast: (m: string) => void; initialTeam?: string | null }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const [teams, setTeams] = useState<Team[]>([]);
  const [openAll, setOpenAll] = useState(true);
  // who may be signed up: me (unless I am a child account – parents sign children up) + my children
  const childLogin = !!me.person.supervised_by || (ageOf(me.person) ?? 99) < 15;   // child logins: parents sign children up
  const people = childLogin ? [] : [me.person, ...me.children];
  const [who, setWho] = useState(people[0]?.id ?? "");
  const [team, setTeam] = useState<Team | null>(null);
  const [plan, setPlan] = useState<Plan>("full");
  const [q, setQ] = useState<{ before: number | null; discount_pct: number; amount: number | null; installments: number; fee: number; per_rate: number | null; note: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [done, setDone] = useState<{ id: string; reference: string; amount_dkk: number | null; discount_pct: number; team: string; installments?: number; per_rate_dkk?: number | null; note?: string | null } | null>(null);
  useEffect(() => { void api.listTeams().then((ts) => { const vis = ts.filter((x) => x.visibility !== "private"); setTeams(vis); if (initialTeam) setTeam(vis.find((x) => x.id === initialTeam) ?? null); }); void api.signupsOpen().then(setOpenAll).catch(() => setOpenAll(true)); }, [initialTeam]);
  useEffect(() => { setApplied(false); }, [team?.id, who]);
  useEffect(() => { if (!team) { setQ(null); return; } let on = true; api.myQuote(team.id, plan).then((r) => { if (on) setQ(r); }).catch(() => setQ(null)); return () => { on = false; }; }, [team, plan]);
  const memberOf = new Set(me.memberships.filter((m) => m.person_id === who).map((m) => m.team_id));
  const state = (x: Team) => (!openAll || x.signup_open === false ? "closed" : x.admission === "audition" ? "audition" : "open");   // the window also closes auditions
  const submit = async () => { if (!team) return; setBusy(true); try { const r = await api.appSignupTeam(team.id, who, plan); setDone(r); } catch (e) { const m = (e as Error).message; toast(m.includes("already") ? t("pay.already") : m.includes("closed") ? t("pay.closedToast") : m.includes("audition") ? t("pay.auditionToast") : m); } finally { setBusy(false); } };
  if (done && done.amount_dkk == null) return <Sheet onClose={onClose} eyebrow={done.team} title={t("pay.requested")}><p className="small">{done.note ?? t("pay.ratesText")}</p><button className="cta" onClick={onClose}>{t("common.ok")}</button></Sheet>;
  if (done) return <PaySheet amount={(done.installments ?? 1) > 1 ? done.per_rate_dkk ?? done.amount_dkk ?? 0 : done.amount_dkk ?? 0} reference={(done.installments ?? 1) > 1 ? `${done.reference} rate 1/${done.installments}` : done.reference} title={`${done.team}${(done.installments ?? 1) > 1 ? ` · ${t("pay.firstRate")} 1/${done.installments}` : ""}`} onClose={onClose} onPaid={async () => { await api.claimPaymentPaid(done.id); toast(t("pay.claimed")); onClose(); }} />;
  if (childLogin) return <Sheet onClose={onClose} eyebrow={t("pay.joinEyebrow")} title={t("pay.join")}><p className="small">{t("pay.childCannot")}</p><button className="cta" onClick={onClose}>{t("common.ok")}</button></Sheet>;
  const st = team ? state(team) : "open";
  return (
    <Sheet onClose={onClose} eyebrow={t("pay.joinEyebrow")} title={team ? team.name : t("pay.join")}>
      {!openAll && <p className="small" style={{ margin: 0, color: "var(--gold2)" }}>{t("pay.allClosed")}</p>}
      {people.length > 1 && <div className="field"><span>{t("pay.who")}</span><div className="chips">{people.map((p) => <button key={p.id} className={"chip" + (who === p.id ? " on" : "")} onClick={() => { setWho(p.id); }}>{p.first_name}</button>)}</div></div>}
      {!team && <div className="field"><span>{t("pay.team")}</span>
        <div className="teamgrid" data-testid="join-teams">{teams.filter((x) => !memberOf.has(x.id)).map((x) => { const sx = state(x); return <button key={x.id} className={"item" + (sx !== "open" ? " off" : "")} onClick={() => setTeam(x)} data-testid="join-team"><span className="grow">{x.name}<div className="tiny">{x.style} · {x.level}{x.day_time ? ` · ${x.day_time}` : ""}{sx === "closed" ? ` · ${t("pay.closedChip")}` : sx === "audition" ? ` · ${t("admin.admissionKind.audition")}` : ""}</div></span><span className="gold">›</span></button>; })}</div>
      </div>}
      {team && (<>
        <button className="linklike small" style={{ alignSelf: "flex-start" }} onClick={() => setTeam(null)}>‹ {t("pay.otherTeam")}</button>
        {team.description && <p className="small muted" style={{ margin: 0 }}>{team.description.slice(0, 280)}{team.description.length > 280 ? "…" : ""}</p>}
        <div className="tiny">{[team.day_time, team.years, team.level].filter(Boolean).join(" · ")}</div>
        {st === "closed" && <div className="card" data-testid="join-closed"><strong>{t("pay.closedTitle")}</strong><p className="small muted" style={{ margin: "4px 0 0" }}>{t("pay.closedBody")}</p></div>}
        {st === "audition" && <div className="card" data-testid="join-audition"><strong>{t("pay.auditionTitle")}</strong><p className="small muted" style={{ margin: "4px 0 0" }}>{team.admission_note || t("pay.auditionBody")}</p>
          {applied ? <p className="small ok" style={{ margin: "8px 0 0" }}>{t("audition.appliedThanks")}</p> : <button className="cta" style={{ marginTop: 10 }} disabled={busy || !who} data-testid="audition-apply" onClick={async () => { setBusy(true); try { await api.applyAudition(team.id, who); setApplied(true); dispatchEvent(new Event("llds:audition")); toast(t("audition.appliedToast")); } catch (e) { const m = (e as Error).message; toast(m.includes("closed") ? t("pay.closedToast") : m.includes("already") ? t("pay.already") : m); } finally { setBusy(false); } }}>{t("audition.apply")}</button>}</div>}
        {st === "open" && (<>
          <div className="field"><span>{t("pay.planLabel")}</span>
            {team.price_full ? <PlanChips team={team} plan={plan} setPlan={setPlan} /> : <p className="small muted">{team.price_note}</p>}
          </div>
          <div className="card" data-testid="join-quote">
            <div className="eyebrow">{t("pay.quoteTitle", { name: people.find((p) => p.id === who)?.first_name })}</div>
            {q && q.amount != null ? (<>
              <div className="row between"><span className="small">{t(`pay.plan.${plan}`)}</span><strong>{kr(q.amount)}</strong></div>
              {q.discount_pct > 0 && <div className="row between tiny"><span>{t("pay.quoteDiscount", { pct: q.discount_pct })}</span><span>{kr(q.before)} → {kr(q.amount)}</span></div>}
              {q.installments > 1 && <div className="tiny">{t("pay.quoteRates", { n: q.installments, per: kr(q.per_rate), fee: kr(q.fee) })}</div>}
              {q.note && <div className="tiny">{q.note}</div>}
            </>) : <div className="tiny">{q?.note ?? team.price_note ?? t("pay.quoteLoading")}</div>}
            <p className="tiny muted" style={{ margin: "6px 0 0" }}>{t("pay.quoteNext")}</p>
          </div>
          <button className="cta" disabled={busy || !who} onClick={() => void submit()} data-testid="join-send">{t("pay.joinConfirm")}</button>
        </>)}
      </>)}
    </Sheet>
  );
}

/** Admin → Betalinger: all season payments + send payment requests with optional discount. */
export function PaymentsAdmin() {
  const { t } = useTranslation();
  const [list, setList] = useState<WebSignup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [compose, setCompose] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => { const [l, ts] = await Promise.all([api.listWebSignups(), api.listTeams()]); setList(l); setTeams(ts); }, []);
  useEffect(() => { void load(); }, [load]);
  const shown = filter === "open" ? list.filter((p) => p.status === "awaiting_payment") : list;
  const sum = shown.reduce((s, p) => s + (p.status !== "cancelled" ? p.amount_dkk ?? 0 : 0), 0);
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("pay.adminTitle")}</h1><button className="small" onClick={() => setCompose(true)} data-testid="pay-new">+ {t("pay.request")}</button></header>
      <div className="row between"><div className="subtabs" style={{ margin: 0 }}><button className={filter === "open" ? "on" : ""} onClick={() => setFilter("open")}>{t("pay.openFilter")}</button><button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>{t("pay.all")}</button></div><span className="tiny">{shown.length} · {kr(sum)}</span></div>
      <div className="card list" data-testid="admin-payments">
        {shown.map((p) => (
          <div key={p.id} className="item" data-testid="admin-payment">
            <span className="grow"><strong style={{ fontWeight: 500 }}>{p.dancer_name}</strong> · {p.team_name}<div className="tiny">{p.contact_name}{p.email ? ` · ${p.email}` : ""} · {p.source === "web" ? t("pay.srcWeb") : p.source === "app" ? t("pay.srcApp") : t("pay.srcAdmin")} · {ago(p.created_at)}{p.discount_pct ? ` · ${t("pay.discount", { pct: p.discount_pct })}` : ""}{p.note ? ` · “${p.note}”` : ""}</div><div className="small">{kr(p.amount_dkk)}{(p.installments ?? 1) > 1 ? ` · ${t("pay.ratesPaid", { paid: p.rates_paid ?? 0, n: p.installments })} à ${kr(p.per_rate_dkk)}` : ""}{p.amount_before_dkk && p.discount_pct ? <span className="tiny"> ({kr(p.amount_before_dkk)})</span> : null} · {t("pay.ref")}: {p.reference}</div></span>
            {p.status === "paid" ? <span className="chip ok small">{t("shop.status.paid")}</span> : p.status === "cancelled" ? <span className="chip small">{t("pay.cancelled")}</span> : (
              <div className="row" style={{ gap: 4 }}><button className={"chip small" + (p.claimed_paid_at ? " warn" : "")} data-testid="pay-mark-paid" onClick={async () => { await api.setWebSignupStatus(p.id, "paid"); say(t("pay.marked")); await load(); }}>{p.claimed_paid_at ? t("shop.status.claimed") + " → " : ""}{(p.installments ?? 1) > 1 ? t("pay.markRate", { k: (p.rates_paid ?? 0) + 1 }) : t("events.markPaid")}</button><button className="chip small" onClick={async () => { await api.setWebSignupStatus(p.id, "cancelled"); await load(); }}>✕</button></div>
            )}
          </div>
        ))}
        {!shown.length && <p className="muted">{t("pay.noneAdmin")}</p>}
      </div>
      <p className="tiny">{t("pay.adminHint")}</p>
      {compose && <RequestSheet teams={teams} onClose={() => setCompose(false)} onSent={(n) => { setCompose(false); say(t("pay.sentN", { n })); void load(); }} />}
      <Toast msg={toast} />
    </section>
  );
}

function RequestSheet({ teams, onClose, onSent }: { teams: Team[]; onClose: () => void; onSent: (n: number) => void }) {
  const { t } = useTranslation();
  const [team, setTeam] = useState<Team | null>(null);
  const [dancers, setDancers] = useState<{ person_id: string; name: string }[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [plan, setPlan] = useState<"full" | "half" | "custom">("full");
  const [custom, setCustom] = useState("");
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!team) return; void api.teamDancers(team.id).then((d) => { setDancers(d); setSel(new Set(d.map((x) => x.person_id))); }); }, [team]);
  const base = plan === "full" ? team?.price_signup ?? team?.price_full ?? 0 : plan === "half" ? team?.price_half ?? team?.price_full ?? 0 : Number(custom) || 0;
  const final = Math.round(base * (100 - pct) / 100);
  const send = async () => { if (!team || !sel.size || !base) return; setBusy(true); try { const n = await api.requestPayment({ team_id: team.id, person_ids: [...sel], plan: plan === "custom" ? t("pay.plan.custom") : plan, amount_dkk: base, discount_pct: pct, message: msg.trim() || null }); onSent(n); } finally { setBusy(false); } };
  return (
    <Sheet onClose={onClose} eyebrow={t("pay.adminTitle")} title={t("pay.request")}>
      <label className="field"><span>{t("pay.team")}</span><select value={team?.id ?? ""} data-testid="req-team" onChange={(e) => setTeam(teams.find((x) => x.id === e.target.value) ?? null)}><option value="">–</option>{teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      {team && (<>
        <div className="field"><span>{t("pay.toWhom")} ({sel.size}/{dancers.length})</span>
          <div className="chips" data-testid="req-dancers">{dancers.map((d) => <button key={d.person_id} className={"chip" + (sel.has(d.person_id) ? " on" : "")} onClick={() => setSel((s) => { const n = new Set(s); if (n.has(d.person_id)) n.delete(d.person_id); else n.add(d.person_id); return n; })}>{d.name.split(" ")[0]}</button>)}{!dancers.length && <span className="muted small">{t("pay.noDancers")}</span>}</div>
          <div className="row" style={{ gap: 8 }}><button className="linklike small" onClick={() => setSel(new Set(dancers.map((d) => d.person_id)))}>{t("pay.selectAll")}</button><button className="linklike small" onClick={() => setSel(new Set())}>{t("pay.selectNone")}</button></div>
        </div>
        <div className="field"><span>{t("pay.amount")}</span>
          <div className="chips">{team.price_full ? <button className={"chip" + (plan === "full" ? " on" : "")} onClick={() => setPlan("full")}>{t("pay.plan.full")} · {kr(team.price_signup ?? team.price_full)}</button> : null}{team.price_half ? <button className={"chip" + (plan === "half" ? " on" : "")} onClick={() => setPlan("half")}>{t("pay.plan.half")} · {kr(team.price_half)}</button> : null}<button className={"chip" + (plan === "custom" ? " on" : "")} onClick={() => setPlan("custom")}>{t("pay.plan.custom")}</button></div>
          {plan === "custom" && <input type="number" inputMode="numeric" value={custom} placeholder="kr." data-testid="req-custom" onChange={(e) => setCustom(e.target.value)} style={{ marginTop: 6 }} />}
        </div>
        <div className="field"><span>{t("pay.discountLabel")}</span>
          <div className="chips">{[0, 10, 15, 20, 25, 50].map((p) => <button key={p} className={"chip" + (pct === p ? " on" : "")} onClick={() => setPct(p)}>{p} %</button>)}<input type="number" inputMode="numeric" min={0} max={100} value={pct} data-testid="req-pct" onChange={(e) => setPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} style={{ width: 70 }} /></div>
        </div>
        <label className="field"><span>{t("pay.message")}</span><input value={msg} placeholder={t("pay.messagePh")} onChange={(e) => setMsg(e.target.value)} data-testid="req-msg" /></label>
        <div className="card" style={{ margin: 0 }}><div className="row between"><span>{t("pay.perDancer")}</span><strong>{kr(final)}{pct ? <span className="tiny"> ({kr(base)} − {pct} %)</span> : null}</strong></div><div className="row between tiny"><span>{t("pay.total", { n: sel.size })}</span><span>{kr(final * sel.size)}</span></div></div>
        <button className="cta" disabled={busy || !sel.size || !base} onClick={() => void send()} data-testid="req-send">{t("pay.send", { n: sel.size })}</button>
      </>)}
    </Sheet>
  );
}
