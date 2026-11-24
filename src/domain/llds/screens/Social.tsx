import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Post } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Feed, PostList } from "../components/Feed";
import { TabNews } from "../components/TabNews";
import { TopRight } from "../components/ProfileMenu";
import { useScene } from "../components/Scene";
import { useAppearance } from "@/core/appearance";
import { catalogUrl, resolveImage } from "../lib/catalog";
import { artFor } from "../lib/art";

/** Social = the teams' own community: everyone on a team (dancers, trainers, parents) posts to their own team and comments.
 *  Official messages live on Home, trainer messages and conversations on the team page – not here. */
export function Social() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const isStaff = me.person.is_admin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer");
  const [filter, setFilter] = useState<string>("all"); // all | trainers | <team id>
  const appearance = useAppearance((a) => a.a);
  const firstTeam = me.teams.find((x) => me.memberships.some((m) => m.team_id === x.id));
  useScene(resolveImage(firstTeam?.photos?.[1] ?? null) ?? catalogUrl(appearance.images?.hero) ?? artFor("social", ["studio", "group"]));
  const [posts, setPosts] = useState<Post[]>([]);
  const [moreChips, setMoreChips] = useState(false);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  // RLS limits a real user; in "Vis appen som" the real account reads, so the viewed person's rights are applied here too
  const visible = useCallback((p: Post) => me.person.is_admin || p.channel === "school" || (p.channel === "trainers" ? isStaff : !p.team_id || me.memberships.some((m) => m.team_id === p.team_id)), [me, isStaff]);
  const load = useCallback(async () => setPosts((await api.listFeed()).filter(visible)), [visible]);
  useEffect(() => { void load(); }, [load]);
  const myTeams = me.teams.filter((x) => me.memberships.some((m) => m.team_id === x.id));
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("nav.social")}</h1><div className="row" style={{ gap: 8 }}>{myTeams.length > 0 && <button className="small" data-testid="new-post" onClick={() => { if (filter === "all") setFilter(myTeams[0].id); setTimeout(() => { const el = document.getElementById("post-body"); el?.scrollIntoView({ block: "center", behavior: "smooth" }); el?.focus(); }, 120); }}>+ {t("social.newPost")}</button>}<TopRight /></div></header>
      <TabNews tab="social" />
      <p className="tiny muted" style={{ margin: "0 0 6px" }}>{t("social.intro")}</p>
      {(() => { const LIMIT = 3; const shownTeams = moreChips ? myTeams : myTeams.slice(0, LIMIT); const hidden = myTeams.length - shownTeams.length; return (
      <div className="chips" style={{ margin: "6px 0 10px" }}>
        <button className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>{t("social.all")}</button>
        {shownTeams.map((x) => <button key={x.id} className={"chip" + (filter === x.id ? " on" : "")} onClick={() => setFilter(x.id)}>{x.name}</button>)}
        {hidden > 0 && !moreChips && <button className="chip" onClick={() => setMoreChips(true)} data-testid="chips-more">{t("social.moreTeams", { count: hidden })} ⌄</button>}
        {isStaff && (moreChips || myTeams.length <= LIMIT) && <button className={"chip" + (filter === "trainers" ? " on" : "")} onClick={() => setFilter("trainers")}>{t("feed.channel.trainers")}</button>}
      </div>); })()}
      {filter === "trainers" ? <Feed teamId={null} channels={["trainers"]} toast={say} /> : filter !== "all" ? <Feed teamId={filter} channels={["team"]} toast={say} /> : <PostList posts={posts} onChanged={() => void load()} toast={say} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </section>
  );
}
