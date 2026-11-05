import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Milestone } from "@/core/api";
import { useAuth } from "@/core/auth";
import { SettingsScreen } from "@/app/SettingsScreen";
import { Events } from "./Events";
import { Shop } from "./Shop";
import { PunchCards } from "./PunchCards";

type Page = "menu" | "events" | "shop" | "punch" | "milestones" | "settings";

/** "Mere": events, shop, punch cards, milestones, settings. */
export function More() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const [page, setPage] = useState<Page>("menu");
  const hasPunch = me.teams.some((x) => x.punch_card_open);
  if (page === "events") return <Events onBack={() => setPage("menu")} />;
  if (page === "shop") return <Shop onBack={() => setPage("menu")} />;
  if (page === "punch") return <PunchCards onBack={() => setPage("menu")} />;
  if (page === "milestones") return <Milestones onBack={() => setPage("menu")} />;
  if (page === "settings") return <div><button className="linklike" onClick={() => setPage("menu")}>‹ {t("nav.more")}</button><SettingsScreen /></div>;
  const items: [Page, string, string][] = [["events", t("events.title"), t("more.eventsSub")], ["shop", t("shop.title"), t("more.shopSub")], ...(hasPunch ? [["punch", t("punch.title"), t("more.punchSub")] as [Page, string, string]] : []), ["milestones", t("milestones.title"), t("more.milestonesSub")], ["settings", t("nav.settings"), t("more.settingsSub")]];
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("nav.more")}</h1></header>
      <div className="card list">{items.map(([k, label, sub]) => <button key={k} className="item" data-testid={`more-${k}`} onClick={() => setPage(k)}><span className="grow">{label}<div className="tiny">{sub}</div></span><span className="gold">›</span></button>)}</div>
    </section>
  );
}

function Milestones({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const [list, setList] = useState<Milestone[]>([]);
  const load = useCallback(async () => setList(await api.listMilestones()), []);
  useEffect(() => { void load(); }, [load]);
  const people = [me.person, ...me.children];
  return (
    <section className="screen">
      <button className="linklike" onClick={onBack}>‹ {t("nav.more")}</button>
      <header className="topbar"><h1 className="display">{t("milestones.title")}</h1></header>
      {people.map((p) => { const ms = list.filter((m) => m.person_id === p.id); if (!ms.length) return null; return (
        <div key={p.id} className="sec"><h2>{p.first_name}</h2>
          {ms.map((m) => <div key={m.id} className="card milestone" data-testid="milestone"><div className="display big">{m.title}</div><div className="tiny">{m.reached_on ? new Date(m.reached_on).toLocaleDateString("da-DK") : ""}{m.team_name ? ` · ${m.team_name}` : ""}{m.given_by_name ? ` · ${t("milestones.by", { name: m.given_by_name })}` : ""}</div></div>)}
        </div>); })}
      {!list.length && <p className="muted">{t("milestones.empty")}</p>}
    </section>
  );
}
