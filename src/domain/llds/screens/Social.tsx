import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Post } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Feed, PostList } from "../components/Feed";
import { TabNews } from "../components/TabNews";
import { TopRight } from "../components/ProfileMenu";

/** Social = the teams' own community: everyone on a team (dancers, trainers, parents) posts to their own team and comments.
 *  Official messages live on Home, trainer messages and conversations on the team page – not here. */
export function Social() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const isStaff = me.person.is_admin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer");
  const [filter, setFilter] = useState<string>("all"); // all | trainers | <team id>
  const [posts, setPosts] = useState<Post[]>([]);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => setPosts(await api.listFeed()), []);
  useEffect(() => { void load(); }, [load]);
  const myTeams = me.teams.filter((x) => me.memberships.some((m) => m.team_id === x.id));
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("nav.social")}</h1><TopRight /></header>
      <TabNews tab="social" />
      <p className="tiny muted" style={{ margin: "0 0 6px" }}>{t("social.intro")}</p>
      <div className="chips" style={{ margin: "6px 0 10px" }}>
        <button className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>{t("social.all")}</button>
        {myTeams.map((x) => <button key={x.id} className={"chip" + (filter === x.id ? " on" : "")} onClick={() => setFilter(x.id)}>{x.name}</button>)}
        {isStaff && <button className={"chip" + (filter === "trainers" ? " on" : "")} onClick={() => setFilter("trainers")}>{t("feed.channel.trainers")}</button>}
      </div>
      {filter === "trainers" ? <Feed teamId={null} channels={["trainers"]} toast={say} /> : filter !== "all" ? <Feed teamId={filter} channels={["team"]} toast={say} /> : <PostList posts={posts} onChanged={() => void load()} toast={say} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </section>
  );
}
