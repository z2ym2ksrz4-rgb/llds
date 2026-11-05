import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type PunchCard, type PunchCardType } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Toast } from "../components/Sheet";
import { PaySheet } from "../components/Pay";

/** Punch cards for drop-in teams (Hit Fit Dance): buy → MobilePay → Line activates → a punch is used automatically when the trainer marks you present. */
export function PunchCards({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const viewing = useAuth((s) => s.viewing)!;
  const [types, setTypes] = useState<PunchCardType[]>([]);
  const [cards, setCards] = useState<PunchCard[]>([]);
  const [pay, setPay] = useState<PunchCard | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => { const [ty, c] = await Promise.all([api.listPunchCardTypes(), api.listPunchCards()]); setTypes(ty.filter((x) => x.active)); setCards(c); }, []);
  useEffect(() => { void load(); }, [load]);
  const openTeams = me.teams.filter((x) => x.punch_card_open).map((x) => x.name);
  const who = viewing.isChild ? me.children.find((c) => c.id === viewing.personId)?.first_name : me.person.first_name;
  const buy = async (ty: PunchCardType) => { const c = await api.buyPunchCard(ty.id, viewing.personId); await load(); setPay(c); };
  return (
    <section className="screen">
      <button className="linklike" onClick={onBack}>‹ {t("nav.more")}</button>
      <header className="topbar"><h1 className="display">{t("punch.title")}</h1></header>
      <p className="small muted">{t("punch.intro", { teams: openTeams.join(", ") || "–" })}</p>
      {cards.length > 0 && <div className="sec"><h2>{t("punch.mine")}</h2>
        {cards.map((c) => <div key={c.id} className="card punchcard" data-testid="punchcard">
          <div className="row between"><strong>{c.type_name}</strong><span className={"chip small " + (c.status === "active" ? "ok" : c.status === "expired" ? "" : "warn")}>{c.status === "awaiting_payment" && c.claimed_paid_at ? t("punch.status.claimed") : t(`punch.status.${c.status}`)}</span></div>
          <div className="tiny">{c.person_name} · {t("punch.validUntil")} {new Date(c.expires_on).toLocaleDateString("da-DK")}</div>
          <div className="punches">{Array.from({ length: c.punches_total }, (_, i) => <span key={i} className={"punch" + (i < c.punches_total - c.punches_left ? " used" : "")} />)}</div>
          <div className="tiny">{t("punch.left", { n: c.punches_left, total: c.punches_total })}</div>
          {c.status === "awaiting_payment" && !c.claimed_paid_at && <button className="small" onClick={() => setPay(c)}>{t("shop.pay")} · {c.price_dkk} kr.</button>}
        </div>)}
      </div>}
      <div className="sec"><h2>{t("punch.buy")} · {who}</h2>
        <div className="card list">{types.map((ty) => <div key={ty.id} className="item"><span className="grow">{ty.name}<div className="tiny">{ty.punches} {t("punch.punches")} · {t("punch.valid", { days: ty.valid_days })} · {ty.price_dkk} kr.</div></span><button className="small" data-testid="buy-card" onClick={() => void buy(ty)}>{t("punch.buyBtn")}</button></div>)}
          {!types.length && <p className="muted">{t("punch.none")}</p>}</div>
      </div>
      <p className="tiny">{t("punch.hint")}</p>
      {pay && <PaySheet amount={pay.price_dkk} reference={`Klippekort ${pay.person_name.split(" ")[0]}`} title={pay.type_name} onClose={() => setPay(null)} onPaid={async () => { await api.claimPunchCardPaid(pay.id); setPay(null); say(t("punch.claimed")); void load(); }} />}
      <Toast msg={toast} />
    </section>
  );
}
