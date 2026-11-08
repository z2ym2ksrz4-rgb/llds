import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Order, type PunchCard } from "@/core/api";
import { useAuth } from "@/core/auth";
import { useNav } from "@/core/nav";
import { PaySheet } from "../components/Pay";
import { Toast } from "../components/Sheet";
import { ago } from "../lib/time";

/** One punch card as a small card with its punches. */
export function PunchCardView({ card: c, onPay }: { card: PunchCard; onPay?: (c: PunchCard) => void }) {
  const { t } = useTranslation();
  return (
    <div className="card punchcard" data-testid="punchcard">
      <div className="row between"><strong>{c.type_name}</strong><span className={"chip small " + (c.status === "active" ? "ok" : c.status === "expired" ? "" : c.claimed_paid_at ? "pend" : "warn")}>{t(`punch.status.${c.status === "awaiting_payment" && c.claimed_paid_at ? "claimed" : c.status}`)}</span></div>
      <div className="tiny">{c.person_name} · {t("punch.validUntil")} {new Date(c.expires_on).toLocaleDateString("da-DK")}</div>
      <div className="punches">{Array.from({ length: c.punches_total }, (_, i) => <span key={i} className={"punch" + (i < c.punches_total - c.punches_left ? " used" : "")} />)}</div>
      <div className="tiny">{t("punch.left", { n: c.punches_left, total: c.punches_total })}</div>
      {c.status === "awaiting_payment" && !c.claimed_paid_at && onPay && <button className="small" onClick={() => onPay(c)}>{t("shop.pay")} · {c.price_dkk} kr.</button>}
    </div>
  );
}

/** One order row (shop history). */
export function OrderRow({ order: o, onPay }: { order: Order; onPay?: (o: Order) => void }) {
  const { t } = useTranslation();
  return (
    <div className="item" data-testid="order"><span className="grow">#{o.number} · {o.lines.map((l) => `${l.qty}× ${l.name}${l.size ? ` (${l.size})` : ""}`).join(", ")}<div className="tiny">{o.person_name} · {ago(o.created_at)} · {o.total_dkk} kr.</div></span>
      {o.status === "awaiting_payment" ? (o.claimed_paid_at ? <span className="chip pend small">{t("shop.status.claimed")}</span> : onPay ? <button className="small" onClick={() => onPay(o)}>{t("shop.pay")}</button> : <span className="chip warn small">{t("shop.status.awaiting_payment")}</span>) : <span className={"chip small " + (o.status === "cancelled" ? "" : "ok")}>{t(`shop.status.${o.status}`)}</span>}
    </div>
  );
}

/** Settings → "Klippekort og køb": my (and my children's) punch cards + order history, with a way into the shop. */
export function MyWallet() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me);
  const setTab = useNav((s) => s.setTab);
  const [cards, setCards] = useState<PunchCard[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pay, setPay] = useState<{ amount: number; ref: string; title: string; done: () => Promise<void> } | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => { const [c, o] = await Promise.all([api.listPunchCards().catch(() => []), api.listOrders().catch(() => [])]); setCards(c); setOrders(o); }, []);
  useEffect(() => { void load(); }, [load]);
  if (!me) return null;
  const openTeams = me.teams.filter((x) => x.punch_card_open).map((x) => x.name);
  return (
    <div className="sec" data-testid="wallet"><h2>{t("wallet.title")}</h2>
      <p className="tiny muted" style={{ marginTop: 0 }}>{t("punch.intro", { teams: openTeams.join(", ") || "–" })}</p>
      {cards.map((c) => <PunchCardView key={c.id} card={c} onPay={(x) => setPay({ amount: x.price_dkk, ref: `Klippekort ${x.person_name.split(" ")[0]}`, title: x.type_name, done: async () => { await api.claimPunchCardPaid(x.id); say(t("punch.claimed")); } })} />)}
      {!cards.length && <p className="tiny muted">{t("wallet.noCards")}</p>}
      {orders.length > 0 && <div className="card list" style={{ marginTop: 8 }}><div className="eyebrow" style={{ padding: "4px 0" }}>{t("shop.myOrders")}</div>
        {orders.map((o) => <OrderRow key={o.id} order={o} onPay={(x) => setPay({ amount: x.total_dkk, ref: `LLDS #${x.number}`, title: t("shop.payTitle", { n: x.number }), done: async () => { await api.claimPaid(x.id); say(t("shop.claimed")); } })} />)}</div>}
      <button className="ghost small" style={{ alignSelf: "flex-start", marginTop: 8 }} onClick={() => setTab("shop")} data-testid="wallet-shop">{t("wallet.toShop")}</button>
      {pay && <PaySheet amount={pay.amount} reference={pay.ref} title={pay.title} onClose={() => setPay(null)} onPaid={async () => { await pay.done(); setPay(null); await load(); }} />}
      <Toast msg={toast} />
    </div>
  );
}

/** Session sheet, drop-in teams: how many punches the viewed person has – and what is left after this class. */
export function PunchStatus({ personId }: { personId: string }) {
  const { t } = useTranslation();
  const setTab = useNav((s) => s.setTab);
  const [cards, setCards] = useState<PunchCard[] | null>(null);
  useEffect(() => { let on = true; api.listPunchCards().then((c) => { if (on) setCards(c.filter((x) => x.person_id === personId)); }).catch(() => setCards([])); return () => { on = false; }; }, [personId]);
  if (!cards) return null;
  const active = cards.filter((c) => c.status === "active" && c.punches_left > 0).sort((a, b) => a.expires_on.localeCompare(b.expires_on));
  const pending = cards.find((c) => c.status === "awaiting_payment");
  const left = active.reduce((n, c) => n + c.punches_left, 0);
  return (
    <div className={"card punchstatus" + (left ? "" : " warn")} style={{ margin: 0 }} data-testid="punch-status">
      <div className="eyebrow">{t("punch.title")}</div>
      {left > 0 ? (
        <><strong>{t("punch.haveLeft", { n: left })}</strong><div className="tiny">{t("punch.afterThis", { n: left - 1 })}{active[0] ? ` · ${t("punch.validUntil")} ${new Date(active[0].expires_on).toLocaleDateString("da-DK")}` : ""}</div>
          {left <= 2 && <button className="linklike small" onClick={() => setTab("shop")}>{t("punch.buyNew")} →</button>}</>
      ) : pending ? (
        <><strong>{t("punch.pendingCard")}</strong><div className="tiny">{pending.claimed_paid_at ? t("punch.status.claimed") : t("punch.status.awaiting_payment")} · {pending.type_name}</div></>
      ) : (
        <><strong>{t("punch.noCard")}</strong><div className="tiny">{t("punch.noCardSub")}</div><button className="small" onClick={() => setTab("shop")} data-testid="punch-buy-link">{t("punch.buyNew")} →</button></>
      )}
    </div>
  );
}
