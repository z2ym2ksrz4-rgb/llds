import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Message, type Post, type Team, type Thread } from "@/core/api";
import { useAuth } from "@/core/auth";
import { ago } from "../lib/time";
import { Sheet } from "./Sheet";
import { Skeleton } from "./Skeleton";
import { Composer, Feed, PostList } from "./Feed";
import { MessageComposer, MessageSheet } from "./Messages";
import { ThreadComposer, ThreadSheet } from "./Threads";

/** Everything that is said on a team, in one stream – colour coded by who writes to whom:
 *  school → everyone (gold) · trainer → the team (the team's colour) · the team's own posts (neutral) · private with the trainer (blue).
 *  One "Skriv" button asks who the text is for. Replaces the Social tab and the three message groups the team page used to have. */
type Kind = "school" | "trainer" | "team" | "private";
type Item = { key: string; kind: Kind; at: string; due: boolean; msg?: Message; post?: Post; thread?: Thread };
const SHOWN = 4;

export function TeamStream({ team, lead, staff, toast, onChanged }: { team: Team; lead: boolean; staff: boolean; toast: (m: string) => void; onChanged?: () => void }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const isAdmin = me.person.is_admin;
  const [msgs, setMsgs] = useState<Message[]>([]); const [posts, setPosts] = useState<Post[]>([]); const [threads, setThreads] = useState<Thread[]>([]);
  const [loaded, setLoaded] = useState(false); const [all, setAll] = useState(false);
  const [openMsg, setOpenMsg] = useState<Message | null>(null); const [openThread, setOpenThread] = useState<Thread | null>(null);
  const [write, setWrite] = useState<null | "pick" | "post" | "school" | "private" | "message" | "trainers">(null);
  const load = useCallback(async () => {
    const [m, p, ps, th] = await Promise.all([api.listMessages().catch(() => [] as Message[]), api.listPosts("team", team.id).catch(() => [] as Post[]), api.listPosts("school").catch(() => [] as Post[]), api.listThreads().catch(() => [] as Thread[])]);
    setMsgs(m.filter((x) => x.audience.all || x.audience.teams?.includes(team.id)));
    setPosts([...p, ...ps]);
    setThreads(th.filter((x) => x.team_id === team.id)); setLoaded(true);
  }, [team.id]);
  useEffect(() => { setLoaded(false); setAll(false); void load(); }, [load]);
  const changed = () => { void load(); onChanged?.(); };

  const items: Item[] = [
    ...msgs.map((m): Item => ({ key: "m" + m.id, kind: m.audience.all ? "school" : "trainer", at: m.created_at, due: !m.acted_at, msg: m })),
    ...posts.map((p): Item => ({ key: "p" + p.id, kind: p.channel === "school" ? "school" : "team", at: p.created_at, due: false, post: p })),
    ...threads.map((th): Item => ({ key: "t" + th.id, kind: "private", at: th.last_at, due: th.unread, thread: th })),
  ].sort((a, b) => (a.due === b.due ? b.at.localeCompare(a.at) : a.due ? -1 : 1));   // what still needs me first, then newest
  const shown = all ? items : items.slice(0, Math.max(SHOWN, items.filter((x) => x.due).length));
  const first = (n: string | null | undefined) => (n ?? "").split(" ")[0];
  const others = (th: Thread) => th.participant_names.filter((_, i) => th.participants[i] !== me.person.id).map(first).join(", ");
  const label = (it: Item) => it.kind === "school" ? t("stream.who.school") : it.kind === "trainer" ? t("stream.who.trainer", { name: first(it.msg!.author_name), team: team.name }) : it.kind === "team" ? t("stream.who.team", { team: team.name }) : t("stream.who.private", { names: others(it.thread!) || t("stream.trainer") });
  const myTeamsStaff = isAdmin ? me.teams : me.teams.filter((x) => me.memberships.some((m) => m.person_id === me.person.id && m.team_id === x.id && m.role !== "dancer"));

  return (
    <div className="sec stream" data-testid="team-stream">
      <div className="row between"><h2>{t("stream.title")}</h2><button className="small" data-testid="stream-write" onClick={() => setWrite("pick")}>+ {t("stream.write")}</button></div>
      <div className="streamkey tiny" aria-hidden>{(["school", "trainer", "team", "private"] as Kind[]).map((k) => <span key={k} className={"k-" + k}><i />{t(`stream.key.${k}`)}</span>)}</div>
      {!loaded ? <Skeleton rows={2} /> : !items.length ? <p className="tiny muted" data-testid="stream-empty" style={{ margin: "6px 0 0" }}>{t(lead ? "stream.emptyStaff" : "stream.empty")}</p> : (
        <div className="streamlist">
          {shown.map((it) => (
            <div key={it.key} className={"sitem k-" + it.kind + (it.due ? " due" : "")} data-testid={`stream-${it.kind}`}>
              <div className="swho tiny"><i aria-hidden />{label(it)}{it.due && <em className="sdot" aria-label={t("stream.new")} />}</div>
              {it.msg && <button type="button" className="sbody" data-testid="team-msg" onClick={() => setOpenMsg(it.msg!)}>
                <span className="grow"><strong>{it.msg.title}</strong><span className="tiny sline">{it.msg.body.slice(0, 90)}{it.msg.body.length > 90 ? "…" : ""}</span><span className="tiny muted">{ago(it.msg.created_at)}</span></span>
                {it.msg.acted_at ? <span className="chip ok small">{t(`msg.done.${it.msg.needs}`)}</span> : <span className="chip warn small">{t(`msg.needs.${it.msg.needs}`)}</span>}
              </button>}
              {it.thread && <button type="button" className="sbody" data-testid="team-thread" onClick={() => setOpenThread(it.thread!)}>
                <span className="grow"><strong>{it.thread.subject}</strong><span className="tiny sline">{it.thread.last_sender_name ? first(it.thread.last_sender_name) + ": " : ""}{(it.thread.last_body ?? "").slice(0, 80)}</span><span className="tiny muted">{ago(it.thread.last_at)}</span></span><span aria-hidden>›</span>
              </button>}
              {it.post && <PostList posts={[it.post]} onChanged={changed} toast={toast} />}
            </div>
          ))}
          {items.length > shown.length && <button type="button" className="linklike small" data-testid="stream-all" onClick={() => setAll(true)}>{t("stream.showAll", { count: items.length })}</button>}
        </div>
      )}
      {staff && <button type="button" className="linklike tiny muted" data-testid="stream-trainers" style={{ marginTop: 8 }} onClick={() => setWrite("trainers")}>{t("stream.trainerRoom")} ›</button>}

      {write === "pick" && (
        <Sheet onClose={() => setWrite(null)} title={t("stream.writeTitle")} eyebrow={team.name}>
          <div className="writepick">
            <button type="button" className="wp k-team" data-testid="new-post" onClick={() => setWrite("post")}><i aria-hidden /><span><strong>{t("stream.to.team")}</strong><span className="tiny">{t("stream.to.teamSub", { team: team.name })}</span></span></button>
            <button type="button" className="wp k-private" data-testid="write-trainer" onClick={() => setWrite("private")}><i aria-hidden /><span><strong>{t(staff ? "stream.to.privateStaff" : "stream.to.private")}</strong><span className="tiny">{t(staff ? "stream.to.privateStaffSub" : "stream.to.privateSub")}</span></span></button>
            {lead && <button type="button" className="wp k-trainer" data-testid="write-team" onClick={() => setWrite("message")}><i aria-hidden /><span><strong>{t("stream.to.message")}</strong><span className="tiny">{t("stream.to.messageSub")}</span></span></button>}
            {isAdmin && <button type="button" className="wp k-school" data-testid="write-school" onClick={() => setWrite("school")}><i aria-hidden /><span><strong>{t("stream.to.school")}</strong><span className="tiny">{t("stream.to.schoolSub")}</span></span></button>}
          </div>
        </Sheet>
      )}
      {(write === "post" || write === "school") && (
        <Sheet onClose={() => setWrite(null)} title={write === "post" ? t("stream.to.team") : t("stream.to.school")} eyebrow={write === "post" ? team.name : t("stream.who.school")}>
          <Composer teamId={write === "post" ? team.id : null} channel={write === "post" ? "team" : "school"} isStaff={staff} isAdmin={isAdmin} onPosted={() => { setWrite(null); toast(t("feed.posted")); changed(); }} />
        </Sheet>
      )}
      {write === "trainers" && <Sheet onClose={() => setWrite(null)} title={t("stream.trainerRoom")} eyebrow={t("stream.trainerRoomSub")}><Feed teamId={null} channels={["trainers"]} toast={toast} /></Sheet>}
      {write === "private" && <ThreadComposer teamId={team.id} teamName={team.name} onClose={() => setWrite(null)} onSent={() => changed()} toast={toast} />}
      {write === "message" && <MessageComposer teams={myTeamsStaff} defaultTeam={team.id} onClose={() => { setWrite(null); changed(); }} toast={toast} />}
      {openMsg && <MessageSheet message={openMsg} onClose={() => { setOpenMsg(null); changed(); }} toast={toast} />}
      {openThread && <ThreadSheet thread={openThread} onClose={() => { setOpenThread(null); changed(); }} toast={toast} />}
    </div>
  );
}
