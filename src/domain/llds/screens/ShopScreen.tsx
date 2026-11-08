import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Order, type Product, type PunchCard, type PunchCardType } from "@/core/api";
import { useAuth } from "@/core/auth";
import { useNav } from "@/core/nav";
import { PaySheet } from "../components/Pay";
import { Sheet, Toast } from "../components/Sheet";
import { Icon } from "../components/Icons";
import { useCart } from "../lib/cart";
import { OrderRow, PunchCardView } from "./PunchCards";

/** Stjerneshoppen (bag icon top right) – laid out like a normal web shop: products in a grid (punch cards are products too),
 *  basket and history as two icons at the top. Pay with MobilePay → "I have paid" → Line marks paid/handed out. */
const SEEN = "llds_shop_seen";
export const markShopSeen = () => { try { localStorage.setItem(SEEN, new Date().toISOString()); } catch { /* ignore */ } };
export const shopSeenAt = () => { try { return localStorage.getItem(SEEN) ?? ""; } catch { return ""; } };

type Pay = { amount: number; ref: string; title: string; done: () => Promise<void> };

export function ShopScreen() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const viewing = useAuth((s) => s.viewing)!;
  const back = useNav((s) => s.back);
  const cart = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [types, setTypes] = useState<PunchCardType[]>([]);
  const [cards, setCards] = useState<PunchCard[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pick, setPick] = useState<Product | null>(null);
  const [pickCard, setPickCard] = useState<PunchCardType | null>(null);
  const [panel, setPanel] = useState<"cart" | "history" | null>(null);
  const [pay, setPay] = useState<Pay | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => {
    const [p, ty, c, o] = await Promise.all([api.listProducts(), api.listPunchCardTypes().catch(() => []), api.listPunchCards().catch(() => []), api.listOrders().catch(() => [])]);
    setProducts(p); setTypes(ty.filter((x) => x.active)); setCards(c); setOrders(o);
  }, []);
  useEffect(() => { void load(); markShopSeen(); }, [load]);
  const punchTeams = me.teams.filter((x) => x.punch_card_open).map((x) => x.name);
  const who = viewing.isChild ? me.children.find((c) => c.id === viewing.personId)?.first_name : me.person.first_name;
  const total = cart.lines.reduce((s, l) => s + l.qty * l.price_dkk, 0);
  const openCount = orders.filter((o) => o.status === "awaiting_payment").length + cards.filter((c) => c.status === "awaiting_payment").length;
  const checkout = async () => {
    const o = await api.createOrder(viewing.personId, cart.lines); cart.clear(); setPanel(null); await load();
    setPay({ amount: o.total_dkk, ref: `LLDS #${o.number}`, title: t("shop.payTitle", { n: o.number }), done: async () => { await api.claimPaid(o.id); say(t("shop.claimed")); } });
  };
  const buyCard = async (ty: PunchCardType) => {
    const c = await api.buyPunchCard(ty.id, viewing.personId); setPickCard(null); await load();
    setPay({ amount: c.price_dkk, ref: `Klippekort ${c.person_name.split(" ")[0]}`, title: c.type_name, done: async () => { await api.claimPunchCardPaid(c.id); say(t("punch.claimed")); } });
  };
  return (
    <section className="screen" data-testid="shop-screen">
      <button className="linklike" onClick={back}>‹ {t("common.back")}</button>
      <header className="topbar shophead"><h1 className="display">{t("shop.title")}</h1>
        <div className="row" style={{ gap: 8 }}>
          <button className="iconbtn" aria-label={t("shop.history")} data-testid="shop-history" onClick={() => setPanel("history")}><Icon name="clock" />{openCount > 0 && <span className="tabbadge">{openCount}</span>}</button>
          <button className="iconbtn" aria-label={t("shop.cart")} data-testid="shop-cart" onClick={() => setPanel("cart")}><Icon name="bag" />{cart.lines.length > 0 && <span className="tabbadge">{cart.lines.reduce((n, l) => n + l.qty, 0)}</span>}</button>
        </div>
      </header>
      <p className="tiny muted" style={{ marginTop: -6 }}>{t("shop.buyingAs", { name: who })}</p>
      <div className="shop-grid">
        {products.map((p) => <button key={p.id} className="product" onClick={() => setPick(p)} data-testid="product"><div className="cover">{p.image_url ? <img src={p.image_url} alt="" /> : <span className="display">{p.name[0]}</span>}</div><div className="small"><strong>{p.name}</strong><div className="tiny">{p.price_dkk} kr.{p.stock != null && p.stock <= 0 ? ` · ${t("shop.soldOut")}` : ""}</div></div></button>)}
        {types.map((ty) => <button key={ty.id} className="product punchprod" onClick={() => setPickCard(ty)} data-testid="buy-card"><div className="cover punchcover"><span className="display">{ty.punches}</span><span className="tiny">{t("punch.punches")}</span></div><div className="small"><strong>{ty.name}</strong><div className="tiny">{ty.price_dkk} kr. · {t("punch.valid", { days: ty.valid_days })}</div></div></button>)}
        {!products.length && !types.length && <p className="muted">{t("shop.empty")}</p>}
      </div>
      <p className="tiny">{t("shop.hint")}</p>

      {pick && (
        <Sheet onClose={() => setPick(null)} eyebrow={`${pick.price_dkk} kr.`} title={pick.name}>
          {pick.image_url && <img src={pick.image_url} alt="" style={{ width: "100%", borderRadius: 12 }} />}
          <SizePicker product={pick} onAdd={(size, qty) => { cart.add({ product_id: pick.id, name: pick.name, size, qty, price_dkk: pick.price_dkk }); setPick(null); say(t("shop.added")); }} />
        </Sheet>
      )}
      {pickCard && (
        <Sheet onClose={() => setPickCard(null)} eyebrow={`${pickCard.price_dkk} kr.`} title={pickCard.name}>
          <p className="small" style={{ margin: 0 }}>{pickCard.punches} {t("punch.punches")} · {t("punch.valid", { days: pickCard.valid_days })}</p>
          <p className="small muted" style={{ margin: 0 }}>{t("punch.forTeams")} <strong>{punchTeams.join(", ") || "–"}</strong>. {t("punch.notForOthers")}</p>
          <p className="tiny muted" style={{ margin: 0 }}>{t("punch.hint")}</p>
          <button className="cta" data-testid="buy-card-confirm" onClick={() => void buyCard(pickCard)}>{t("punch.buyBtn")} · {who}</button>
        </Sheet>
      )}
      {panel === "cart" && (
        <Sheet onClose={() => setPanel(null)} eyebrow={who ?? ""} title={t("shop.cart")}>
          <div className="list" data-testid="cart">
            {cart.lines.map((l, i) => <div key={i} className="item"><span className="grow">{l.qty} × {l.name}{l.size ? ` (${l.size})` : ""}</span><span>{l.qty * l.price_dkk} kr.</span><button className="chip small danger" aria-label={t("common.remove")} onClick={() => cart.remove(i)}>×</button></div>)}
            {!cart.lines.length && <p className="muted">{t("shop.cartEmpty")}</p>}
          </div>
          {cart.lines.length > 0 && <div className="row between"><strong>{t("shop.total")}: {total} kr.</strong><button className="cta" id="checkout" onClick={() => void checkout()}>{t("shop.order")}</button></div>}
        </Sheet>
      )}
      {panel === "history" && (
        <Sheet onClose={() => setPanel(null)} eyebrow={t("shop.title")} title={t("shop.history")}>
          {cards.length > 0 && <><div className="eyebrow">{t("punch.title")}</div>{cards.map((c) => <PunchCardView key={c.id} card={c} onPay={(x) => { setPanel(null); setPay({ amount: x.price_dkk, ref: `Klippekort ${x.person_name.split(" ")[0]}`, title: x.type_name, done: async () => { await api.claimPunchCardPaid(x.id); say(t("punch.claimed")); } }); }} />)}</>}
          <div className="eyebrow">{t("shop.myOrders")}</div>
          <div className="list">{orders.map((o) => <OrderRow key={o.id} order={o} onPay={(x) => { setPanel(null); setPay({ amount: x.total_dkk, ref: `LLDS #${x.number}`, title: t("shop.payTitle", { n: x.number }), done: async () => { await api.claimPaid(x.id); say(t("shop.claimed")); } }); }} />)}
            {!orders.length && !cards.length && <p className="muted">{t("shop.noHistory")}</p>}</div>
        </Sheet>
      )}
      {pay && <PaySheet amount={pay.amount} reference={pay.ref} title={pay.title} onClose={() => setPay(null)} onPaid={async () => { await pay.done(); setPay(null); await load(); }} />}
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
