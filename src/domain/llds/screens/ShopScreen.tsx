import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type PunchCard, type PunchCardType } from "@/core/api";
import { useAuth } from "@/core/auth";
import { useNav } from "@/core/nav";
import { Shop } from "./Shop";
import { PaySheet } from "../components/Pay";
import { Toast } from "../components/Sheet";

/** Stjerneshoppen as its own screen (bag icon top right): merchandise + punch cards for the teams that use them. */
const SEEN = "llds_shop_seen";
export const markShopSeen = () => { try { localStorage.setItem(SEEN, new Date().toISOString()); } catch { /* ignore */ } };
export const shopSeenAt = () => { try { return localStorage.getItem(SEEN) ?? ""; } catch { return ""; } };

export function ShopScreen() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const viewing = useAuth((s) => s.viewing)!;
  const back = useNav((s) => s.back);
  const [types, setTypes] = useState<PunchCardType[]>([]);
  const [cards, setCards] = useState<PunchCard[]>([]);
  const [pay, setPay] = useState<PunchCard | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => { const [ty, c] = await Promise.all([api.listPunchCardTypes(), api.listPunchCards()]); setTypes(ty.filter((x) => x.active)); setCards(c); }, []);
  useEffect(() => { void load(); markShopSeen(); }, [load]);
  const punchTeams = me.teams.filter((x) => x.punch_card_open).map((x) => x.name);
  const who = viewing.isChild ? me.children.find((c) => c.id === viewing.personId)?.first_name : me.person.first_name;
  const buy = async (ty: PunchCardType) => { const c = await api.buyPunchCard(ty.id, viewing.personId); await load(); setPay(c); };
  return (
    <section className="screen" data-testid="shop-screen">
      <button className="linklike" onClick={back}>‹ {t("common.back")}</button>
      <header className="topbar"><h1 className="display">{t("shop.title")}</h1></header>
      <Shop embedded />
      {(types.length > 0 || cards.length > 0) && (
        <div className="sec" data-testid="shop-punch"><h2>{t("punch.title")}</h2>
          <p className="small muted" style={{ marginTop: 0 }}>{t("punch.forTeams")} <strong>{punchTeams.join(", ") || "–"}</strong>. {t("punch.notForOthers")}</p>
          {cards.map((c) => <div key={c.id} className="card punchcard" data-testid="punchcard">
            <div className="row between"><strong>{c.type_name}</strong><span className={"chip small " + (c.status === "active" ? "ok" : c.status === "expired" ? "" : "warn")}>{t(`punch.status.${c.status === "awaiting_payment" && c.claimed_paid_at ? "claimed" : c.status}`)}</span></div>
            <div className="tiny">{c.person_name} · {t("punch.validUntil")} {new Date(c.expires_on).toLocaleDateString("da-DK")}</div>
            <div className="punches">{Array.from({ length: c.punches_total }, (_, i) => <span key={i} className={"punch" + (i < c.punches_total - c.punches_left ? " used" : "")} />)}</div>
            <div className="tiny">{t("punch.left", { n: c.punches_left, total: c.punches_total })}</div>
            {c.status === "awaiting_payment" && !c.claimed_paid_at && <button className="small" onClick={() => setPay(c)}>{t("shop.pay")} · {c.price_dkk} kr.</button>}
          </div>)}
          <div className="card list">{types.map((ty) => <div key={ty.id} className="item"><span className="grow">{ty.name}<div className="tiny">{ty.punches} {t("punch.punches")} · {t("punch.valid", { days: ty.valid_days })} · {ty.price_dkk} kr. · {punchTeams.join(", ")}</div></span><button className="small" data-testid="buy-card" onClick={() => void buy(ty)}>{t("punch.buyBtn")} · {who}</button></div>)}</div>
        </div>
      )}
      {pay && <PaySheet amount={pay.price_dkk} reference={`Klippekort ${pay.person_name.split(" ")[0]}`} title={pay.type_name} onClose={() => setPay(null)} onPaid={async () => { await api.claimPunchCardPaid(pay.id); setPay(null); say(t("punch.claimed")); await load(); }} />}
      <Toast msg={toast} />
    </section>
  );
}
