import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Order, type OrderLine, type Product } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Sheet, Toast } from "../components/Sheet";
import { PaySheet } from "../components/Pay";
import { ago } from "../lib/time";

/** Simple shop: pick product + size → order → MobilePay → "I have paid" → Line marks paid/handed out. No card payments, no stock sync beyond a number. */
export function Shop({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const viewing = useAuth((s) => s.viewing)!;
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [pick, setPick] = useState<Product | null>(null);
  const [pay, setPay] = useState<Order | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => { const [p, o] = await Promise.all([api.listProducts(), api.listOrders()]); setProducts(p); setOrders(o); }, []);
  useEffect(() => { void load(); }, [load]);
  const total = cart.reduce((s, l) => s + l.qty * l.price_dkk, 0);
  const checkout = async () => { const o = await api.createOrder(viewing.personId, cart); setCart([]); await load(); setPay(o); };
  const who = viewing.isChild ? me.children.find((c) => c.id === viewing.personId)?.first_name : me.person.first_name;
  return (
    <section className="screen">
      <button className="linklike" onClick={onBack}>‹ {t("nav.more")}</button>
      <header className="topbar"><h1 className="display">{t("shop.title")}</h1></header>
      <div className="shop-grid">
        {products.map((p) => <button key={p.id} className="product" onClick={() => setPick(p)} data-testid="product"><div className="cover">{p.image_url ? <img src={p.image_url} alt="" /> : <span className="display">{p.name[0]}</span>}</div><div className="small">{p.name}</div><div className="tiny gold">{p.price_dkk} kr.{p.stock != null && p.stock <= 0 ? ` · ${t("shop.soldOut")}` : ""}</div></button>)}
        {!products.length && <p className="muted">{t("shop.empty")}</p>}
      </div>
      {cart.length > 0 && (
        <div className="card" data-testid="cart"><div className="eyebrow">{t("shop.cart")} · {who}</div>
          {cart.map((l, i) => <div key={i} className="row between small"><span>{l.qty} × {l.name}{l.size ? ` (${l.size})` : ""}</span><span>{l.qty * l.price_dkk} kr. <button className="linklike tiny" onClick={() => setCart(cart.filter((_, j) => j !== i))}>×</button></span></div>)}
          <div className="row between"><strong>{t("shop.total")}: {total} kr.</strong><button className="small" id="checkout" onClick={() => void checkout()}>{t("shop.order")}</button></div>
        </div>
      )}
      {orders.length > 0 && (
        <div className="sec"><h2>{t("shop.myOrders")}</h2><div className="card list">
          {orders.map((o) => <div key={o.id} className="item" data-testid="order"><span className="grow">#{o.number} · {o.lines.map((l) => `${l.qty}× ${l.name}${l.size ? ` (${l.size})` : ""}`).join(", ")}<div className="tiny">{o.person_name} · {ago(o.created_at)} · {o.total_dkk} kr.</div></span>
            {o.status === "awaiting_payment" ? (o.claimed_paid_at ? <span className="chip warn small">{t("shop.status.claimed")}</span> : <button className="small" onClick={() => setPay(o)}>{t("shop.pay")}</button>) : <span className={"chip small " + (o.status === "cancelled" ? "warn" : "ok")}>{t(`shop.status.${o.status}`)}</span>}</div>)}
        </div></div>
      )}
      <p className="tiny">{t("shop.hint")}</p>
      {pick && (
        <Sheet onClose={() => setPick(null)} eyebrow={`${pick.price_dkk} kr.`} title={pick.name}>
          {pick.image_url && <img src={pick.image_url} alt="" style={{ width: "100%", borderRadius: 12 }} />}
          <SizePicker product={pick} onAdd={(size, qty) => { setCart([...cart, { product_id: pick.id, name: pick.name, size, qty, price_dkk: pick.price_dkk }]); setPick(null); say(t("shop.added")); }} />
        </Sheet>
      )}
      {pay && <PaySheet amount={pay.total_dkk} reference={`LLDS #${pay.number}`} title={t("shop.payTitle", { n: pay.number })} onClose={() => setPay(null)} onPaid={async () => { await api.claimPaid(pay.id); setPay(null); say(t("shop.claimed")); void load(); }} />}
      <Toast msg={toast} />
    </section>
  );
}

function SizePicker({ product, onAdd }: { product: Product; onAdd: (size: string | null, qty: number) => void }) {
  const { t } = useTranslation();
  const [size, setSize] = useState<string | null>(product.sizes[0] ?? null); const [qty, setQty] = useState(1);
  return (
    <>
      {product.sizes.length > 0 && <div className="field"><span>{t("shop.size")}</span><div className="chips">{product.sizes.map((s) => <button key={s} className={"chip" + (size === s ? " on" : "")} onClick={() => setSize(s)}>{s}</button>)}</div></div>}
      <div className="field"><span>{t("shop.qty")}</span><div className="chips">{[1, 2, 3].map((n) => <button key={n} className={"chip" + (qty === n ? " on" : "")} onClick={() => setQty(n)}>{n}</button>)}</div></div>
      <button className="cta" id="add-to-cart" disabled={product.stock != null && product.stock <= 0} onClick={() => onAdd(size, qty)}>{t("shop.addToCart")}</button>
    </>
  );
}
