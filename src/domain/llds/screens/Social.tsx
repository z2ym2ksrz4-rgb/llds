import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Message, type Post , type Thread } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Feed, PostList } from "../components/Feed";
import { MessageSheet } from "../components/Messages";
import { ThreadList, ThreadSheet } from "../components/Threads";
import { TopRight } from "../components/ProfileMenu";
import { ago } from "../lib/time";

/** Social tab like the demo: Feed (all my rooms + the school, filter chips) and Beskeder (official messages). */
export function Social() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const isStaff = me.person.is_admin || me.memberships.some((m) => m.person_id === me.person.id && m.role !== "dancer");
  const [tab, setTab] = useState<"feed" | "messages" | "threads">("feed");
  const [threads, setThreads] = useState<Thread[]>([]); const [openThread, setOpenThread] = useState<Thread | null>(null);
  const [filter, setFilter] = useState<string>("all"); // all | official | trainers | <team id>
  const [posts, setPosts] = useState<Post[]>([]);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [open, setOpen] = useState<Message | null>(null);
  const [toast, setToast] = useState<string | null>(null); const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const load = useCallback(async () => { const [p, m, th] = await Promise.all([api.listFeed(), api.listMessages(), api.listThreads().catch(() => [] as Thread[])]); setPosts(p); setMsgs(m); setThreads(th); }, []);
  useEffect(() => { void load(); }, [load]);
  const myTeams = me.teams.filter((x) => me.memberships.some((m) => m.team_id === x.id));
  const due = msgs.filter((m) => !m.acted_at).length;
  const shown = filter === "all" ? posts : filter === "official" ? posts.filter((p) => p.official) : posts.filter((p) => p.team_id === filter);
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("nav.social")}</h1><TopRight /></header>
      <div className="subtabs"><button className={tab === "feed" ? "on" : ""} onClick={() => setTab("feed")}>{t("social.feed")}</button><button className={tab === "messages" ? "on" : ""} onClick={() => setTab("messages")}>{t("msg.title")}{due > 0 && <span className="badge inline">{due}</span>}</button><button className={tab === "threads" ? "on" : ""} data-testid="tab-threads" onClick={() => setTab("threads")}>{t("threads.title")}{threads.some((x) => x.unread) && <span className="badge inline">{threads.filter((x) => x.unread).length}</span>}</button></div>
      {tab === "feed" && (
        <>
          <div className="chips" style={{ margin: "10px 0" }}>
            <button className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>{t("social.all")}</button>
            {myTeams.map((x) => <button key={x.id} className={"chip" + (filter === x.id ? " on" : "")} onClick={() => setFilter(x.id)}>{x.name}</button>)}
            <button className={"chip" + (filter === "official" ? " on" : "")} onClick={() => setFilter("official")}>{t("feed.officialChip")}</button>
            {isStaff && <button className={"chip" + (filter === "trainers" ? " on" : "")} onClick={() => setFilter("trainers")}>{t("feed.channel.trainers")}</button>}
          </div>
          {filter === "trainers" ? <Feed teamId={null} channels={["trainers"]} toast={say} /> : filter !== "all" && filter !== "official" ? <Feed teamId={filter} channels={["team"]} toast={say} /> : <PostList posts={shown} onChanged={() => void load()} toast={say} />}
        </>
      )}
      {tab === "messages" && (
        <div className="card list" style={{ marginTop: 10 }}>
          {msgs.map((m) => <button key={m.id} className="item" onClick={() => setOpen(m)}><span className="grow">{m.title}<div className="tiny">{m.author_name} · {ago(m.created_at)}</div></span>{m.acted_at ? <span className="chip ok small">{t(`msg.done.${m.needs}`)}</span> : <span className="chip warn small">{t(`msg.needs.${m.needs}`)}</span>}</button>)}
          {!msgs.length && <p className="muted">{t("msg.none")}</p>}
        </div>
      )}
      {tab === "threads" && <ThreadList threads={threads} onOpen={setOpenThread} />}
      {openThread && <ThreadSheet thread={openThread} onClose={() => { setOpenThread(null); void load(); }} toast={say} />}
      {open && <MessageSheet message={open} onClose={() => { setOpen(null); void load(); }} toast={say} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </section>
  );
}
