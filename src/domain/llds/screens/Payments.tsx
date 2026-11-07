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
      {pay && pay.amount_dkk != null && <PaySheet amount={pay.amount_dkk} reference={pay.reference} title={`${pay.team_name} · ${pay.dancer_name.split(" ")[0]}`} onClose={() => setPay(null)} onPaid={async () => { await api.claimPaymentPaid(pay.id); setPay(null); say(t("pay.claimed")); await load(); }} />}
      {!embedded && <Toast msg={toast} />}
    </section>
  );
}

function PaymentRow({ p, onPay }: { p: WebSignup; onPay: () => void }) {
  const { t } = useTranslation();
  const plan = p.plan === "full" ? t("pay.plan.full") : p.plan === "half" ? t("pay.plan.half") : p.plan === "rates" ? t("pay.plan.rates") : p.plan ?? "";
  return (
    <div className="item" data-testid="payment">
      <span className="avatar small">💳</span>
      <span className="grow">{p.team_name} · {p.dancer_name.split(" ")[0]}<div className="tiny">{plan}{p.discount_pct ? ` · ${t("pay.discount", { pct: p.discount_pct })}${p.amount_before_dkk ? ` (${kr(p.amount_before_dkk)})` : ""}` : ""}{p.message ? ` · “${p.message}”` : ""} · {ago(p.created_at)}</div></span>
      {p.status === "paid" ? <span className="chip ok small">{t("shop.status.paid")}</span> : p.status === "cancelled" ? <span className="chip small">{t("pay.cancelled")}</span> : p.claimed_paid_at ? <span className="chip warn small">{t("shop.status.claimed")}</span> : p.amount_dkk != null ? <button className="small" onClick={onPay} data-testid="pay-btn">{t("shop.pay")} · {kr(p.amount_dkk)}</button> : <span className="chip small">{t("pay.plan.rates")}</span>}
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
  const [plan, setPlan] = useState<"full" | "half" | "rates">("full");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string; reference: string; amount_dkk: number | null; discount_pct: number; team: string } | null>(null);
  useEffect(() => { void api.listTeams().then((ts) => setTeams(ts.filter((x) => x.visibility !== "private"))); }, []);
  const memberOf = new Set(me.memberships.filter((m) => m.person_id === who).map((m) => m.team_id));
  const amounts = priceAmounts(team?.price);
  const submit = async () => { if (!team) return; setBusy(true); try { const r = await api.appSignupTeam(team.id, who, plan); setDone(r); } catch (e) { toast((e as Error).message.includes("already") ? t("pay.already") : (e as Error).message); } finally { setBusy(false); } };
  if (done) return <PaySheet amount={done.amount_dkk ?? 0} reference={done.reference} title={`${done.team} · ${people.find((p) => p.id === who)?.first_name ?? ""}${done.discount_pct ? ` · ${t("pay.discount", { pct: done.discount_pct })}` : ""}`} onClose={onClose} onPaid={async () => { await api.claimPaymentPaid(done.id); toast(t("pay.claimed")); onClose(); }} />;
  return (
    <Sheet onClose={onClose} eyebrow={t("pay.joinEyebrow")} title={t("pay.join")}>
      {people.length > 1 && <div className="field"><span>{t("pay.who")}</span><div className="chips">{people.map((p) => <button key={p.id} className={"chip" + (who === p.id ? " on" : "")} onClick={() => { setWho(p.id); setTeam(null); }}>{p.first_name}</button>)}</div></div>}
      <div className="field"><span>{t("pay.team")}</span>
        <div className="teamgrid" data-testid="join-teams">{teams.filter((x) => !memberOf.has(x.id)).map((x) => <button key={x.id} className={"item" + (team?.id === x.id ? " on" : "")} onClick={() => setTeam(x)} data-testid="join-team"><span className="grow">{x.name}<div className="tiny">{[x.style, x.years, x.level].filter(Boolean).join(" · ")}{x.admission === "audition" ? ` · ${t("admin.admissionKind.audition")}` : ""}</div></span>{x.price && <span className="tiny">{priceAmounts(x.price)[0] ? kr(priceAmounts(x.price)[0]) : x.price}</span>}</button>)}</div>
      </div>
      {team && (
        <div className="field"><span>{t("pay.planLabel")}</span>
          <div className="chips">{amounts[0] ? <button className={"chip" + (plan === "full" ? " on" : "")} onClick={() => setPlan("full")}>{t("pay.plan.full")} · {kr(amounts[0])}</button> : null}{amounts[1] ? <button className={"chip" + (plan === "half" ? " on" : "")} onClick={() => setPlan("half")}>{t("pay.plan.half")} · {kr(amounts[1])}</button> : null}<button className={"chip" + (plan === "rates" ? " on" : "")} onClick={() => setPlan("rates")}>{t("pay.plan.rates")}</button></div>
          <p className="tiny">{t("pay.familyHint")}</p>
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
            <span className="grow"><strong style={{ fontWeight: 500 }}>{p.dancer_name}</strong> · {p.team_name}<div className="tiny">{p.contact_name}{p.email ? ` · ${p.email}` : ""} · {p.source === "web" ? t("pay.srcWeb") : p.source === "app" ? t("pay.srcApp") : t("pay.srcAdmin")} · {ago(p.created_at)}{p.discount_pct ? ` · ${t("pay.discount", { pct: p.discount_pct })}` : ""}{p.note ? ` · “${p.note}”` : ""}</div><div className="small">{kr(p.amount_dkk)}{p.amount_before_dkk && p.discount_pct ? <span className="tiny"> ({kr(p.amount_before_dkk)})</span> : null} · {t("pay.ref")}: {p.reference}</div></span>
            {p.status === "paid" ? <span className="chip ok small">{t("shop.status.paid")}</span> : p.status === "cancelled" ? <span className="chip small">{t("pay.cancelled")}</span> : (
              <div className="row" style={{ gap: 4 }}><button className={"chip small" + (p.claimed_paid_at ? " warn" : "")} data-testid="pay-mark-paid" onClick={async () => { await api.setWebSignupStatus(p.id, "paid"); say(t("pay.marked")); await load(); }}>{p.claimed_paid_at ? t("shop.status.claimed") + " → " : ""}{t("events.markPaid")}</button><button className="chip small" onClick={async () => { await api.setWebSignupStatus(p.id, "cancelled"); await load(); }}>✕</button></div>
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
  const amounts = priceAmounts(team?.price);
  const base = plan === "full" ? amounts[0] ?? 0 : plan === "half" ? amounts[1] ?? amounts[0] ?? 0 : Number(custom) || 0;
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
          <div className="chips">{amounts[0] ? <button className={"chip" + (plan === "full" ? " on" : "")} onClick={() => setPlan("full")}>{t("pay.plan.full")} · {kr(amounts[0])}</button> : null}{amounts[1] ? <button className={"chip" + (plan === "half" ? " on" : "")} onClick={() => setPlan("half")}>{t("pay.plan.half")} · {kr(amounts[1])}</button> : null}<button className={"chip" + (plan === "custom" ? " on" : "")} onClick={() => setPlan("custom")}>{t("pay.plan.custom")}</button></div>
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
