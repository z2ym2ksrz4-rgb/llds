import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Team, type WebSignup } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Sheet, Toast } from "../components/Sheet";
import { PaySheet } from "../components/Pay";
import { ago } from "../lib/time";

/** Season price text → [full, half] in kr. ("2.400 kr. for hel sæson, eller 1.750 kr. for halv sæson") */
export const priceAmounts = (p: string | null | undefined): number[] => (p ?? "").match(/([0-9][0-9.]*) kr/g)?.map((x) => parseInt(x.replace(/\D/g, ""), 10)) ?? [];
export const kr = (n: number | null | undefined) => (n == null ? "–" : n.toLocaleString("da-DK") + " kr.");
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
export function JoinTeam({ onClose, toast }: { onClose: () => void; toast: (m: string) => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const [teams, setTeams] = useState<Team[]>([]);
  const people = [me.person, ...me.children];
  const [who, setWho] = useState(people[0].id);
  const [team, setTeam] = useState<Team | null>(null);
  const [plan, setPlan] = useState<Plan>("full");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; reference: string; amount_dkk: number | null; discount_pct: number; team: string; installments?: number; per_rate_dkk?: number | null; note?: string | null } | null>(null);
  useEffect(() => { void api.listTeams().then((ts) => setTeams(ts.filter((x) => x.visibility !== "private"))); }, []);
  const memberOf = new Set(me.memberships.filter((m) => m.person_id === who).map((m) => m.team_id));
  const submit = async () => { if (!team) return; setBusy(true); try { const r = await api.appSignupTeam(team.id, who, plan); setDone(r); } catch (e) { toast((e as Error).message.includes("already") ? t("pay.already") : (e as Error).message); } finally { setBusy(false); } };
  if (done && done.amount_dkk == null) return <Sheet onClose={onClose} eyebrow={done.team} title={t("pay.requested")}><p className="small">{done.note ?? t("pay.ratesText")}</p><button className="cta" onClick={onClose}>{t("common.ok")}</button></Sheet>;
  if (done) return <PaySheet amount={(done.installments ?? 1) > 1 ? done.per_rate_dkk ?? done.amount_dkk ?? 0 : done.amount_dkk ?? 0} reference={(done.installments ?? 1) > 1 ? `${done.reference} rate 1/${done.installments}` : done.reference} title={`${done.team} · ${people.find((p) => p.id === who)?.first_name ?? ""}${done.discount_pct ? ` · ${t("pay.discount", { pct: done.discount_pct })}` : ""}${(done.installments ?? 1) > 1 ? ` · ${t("pay.rateN", { k: 1 })} ${t("pay.ofN", { n: done.installments })}` : ""}`} onClose={onClose} onPaid={async () => { await api.claimPaymentPaid(done.id); toast(t("pay.claimed")); onClose(); }} />;
  return (
    <Sheet onClose={onClose} eyebrow={t("pay.joinEyebrow")} title={t("pay.join")}>
      {people.length > 1 && <div className="field"><span>{t("pay.who")}</span><div className="chips">{people.map((p) => <button key={p.id} className={"chip" + (who === p.id ? " on" : "")} onClick={() => { setWho(p.id); setTeam(null); }}>{p.first_name}</button>)}</div></div>}
      <div className="field"><span>{t("pay.team")}</span>
        <div className="teamgrid" data-testid="join-teams">{teams.filter((x) => !memberOf.has(x.id)).map((x) => <button key={x.id} className={"item" + (team?.id === x.id ? " on" : "")} onClick={() => setTeam(x)} data-testid="join-team"><span className="grow">{x.name}<div className="tiny">{[x.style, x.years, x.level].filter(Boolean).join(" · ")}{x.admission === "audition" ? ` · ${t("admin.admissionKind.audition")}` : ""}</div></span><span className="tiny">{x.price_full ? kr(x.price_full) : x.price_note ? "·" : ""}</span></button>)}</div>
      </div>
      {team && (
        <div className="field"><span>{t("pay.planLabel")}</span>
          {team.price_full ? <PlanChips team={team} plan={plan} setPlan={setPlan} /> : <p className="small muted">{team.price_note}</p>}
          {team.price_note && team.price_full ? <p className="tiny">{team.price_note}</p> : null}
          <p className="tiny">{t("pay.familyHint")} {team.installments_allowed !== false ? t("pay.feeHint", { fee: RATE_FEE }) : ""}</p>
        </div>
      )}
      <button className="cta" disabled={!team || busy} onClick={() => void submit()} data-testid="join-send">{t("pay.joinSend")}</button>
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
      <div className="row between"><div className="subtabs" style={{ margin: 0 }}><button className={filter === "open" ? "on" : ""} onClick={() => setFilter("open")}>{t("pay.open")}</button><button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>{t("pay.all")}</button></div><span className="tiny">{shown.length} · {kr(sum)}</span></div>
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
