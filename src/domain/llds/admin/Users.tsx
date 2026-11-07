import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type WebSignup, type PendingPerson, type Role, type Team, type InviteInput } from "@/core/api";
import { useAuth } from "@/core/auth";

type Draft = Record<string, { team_id: string; role: Role }[]>; // personId -> memberships

/** Admin → Brugere: approve self-registered people and put each (adult + children) on teams with a role. */
export function AdminUsers() {
  const { t } = useTranslation();
  const refresh = useAuth((s) => s.refresh);
  const [pending, setPending] = useState<PendingPerson[]>([]);
  const [web, setWeb] = useState<WebSignup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  const [admin, setAdmin] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => { const [p, tm, w] = await Promise.all([api.listPending(), api.listTeams(), api.listWebSignups().catch(() => [] as WebSignup[])]); setPending(p); setTeams(tm); setWeb(w); };
  useEffect(() => { void load(); }, []);

  const toggle = (pid: string, team_id: string, role: Role) => setDraft((d) => {
    const cur = d[pid] ?? [];
    const has = cur.some((m) => m.team_id === team_id && m.role === role);
    return { ...d, [pid]: has ? cur.filter((m) => !(m.team_id === team_id && m.role === role)) : [...cur.filter((m) => m.team_id !== team_id), { team_id, role }] };
  });
  const roleOf = (pid: string, team_id: string) => (draft[pid] ?? []).find((m) => m.team_id === team_id)?.role ?? null;

  const approve = async (p: PendingPerson) => {
    setBusy(p.id);
    try {
      await api.approve(p.id, draft[p.id] ?? [], !!admin[p.id]);
      for (const c of p.children) await api.approve(c.id, draft[c.id] ?? []);
      setMsg(t("admin.approved", { name: p.first_name })); await load(); void refresh();
    } finally { setBusy(null); }
  };
  const reject = async (p: PendingPerson) => { setBusy(p.id); try { await api.reject(p.id); await load(); } finally { setBusy(null); } };

  const rolesFor = (isChild: boolean, wished: string[]): Role[] => isChild ? ["dancer"] : (["dancer", "trainer", "assistant"] as Role[]).filter((r) => wished.includes(r) || r === "dancer" || wished.includes("parent") === false);

  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("admin.users")}</h1></header>
      <p className="muted">{t("admin.usersIntro")}</p>
      {msg && <p className="ok" role="status">{msg}</p>}
      <InviteCard teams={teams} onDone={(name) => { setMsg(t("admin.invited", { name })); void refresh(); }} />
      {!pending.length && <div className="card"><p className="muted">{t("admin.noPending")}</p></div>}
      {pending.map((p) => { const ws = web.filter((w) => w.contact_id === p.id || w.dancer_id === p.id || p.children.some((c) => c.id === w.dancer_id)); return (
        <article className="card stack" key={p.id} data-testid="pending">
          {ws.map((w) => <div key={w.id} className="row between small" data-testid="web-signup" style={{ background: "var(--gold-soft)", borderRadius: 10, padding: "6px 10px" }}><span>🌐 {t("admin.webSignup")}: <b>{w.dancer_name}</b> → {w.team_name} · {w.plan === "rates" ? t("admin.plan.rates") : `${t(`admin.plan.${w.plan}`)} ${w.amount_dkk ?? "?"} kr.`}{w.note ? <div className="tiny">“{w.note}”</div> : null}</span>
            {w.status === "paid" ? <span className="chip ok small">{t("shop.status.paid")}</span> : <button className={"chip small" + (w.claimed_paid_at ? " warn" : "")} onClick={async () => { await api.setWebSignupStatus(w.id, "paid"); await load(); }}>{w.claimed_paid_at ? t("shop.status.claimed") + " · " + t("events.markPaid") : t("events.markPaid")}</button>}</div>)}
          <div className="row between">
            <div><strong>{p.first_name} {p.last_name}</strong><div className="tiny">{p.email} · {p.phone}{p.birth_year ? ` · ${p.birth_year}` : ""}</div></div>
            <span className="chip warn">{t("admin.pending")}</span>
          </div>
          <div className="tiny">{t("admin.wished")}: {p.wished_roles.map((r) => t(`roles.${r}`)).join(", ")}{p.wished_teams ? ` · ${p.wished_teams}` : ""}</div>

          {[{ person: p, isChild: false }, ...p.children.map((c) => ({ person: c, isChild: true }))].map(({ person, isChild }) => (
            <div key={person.id} className="assign">
              <div className="eyebrow">{isChild ? t("admin.child", { name: person.first_name, year: person.birth_year }) : t("admin.adult", { name: person.first_name })}</div>
              {!isChild && p.wished_roles.includes("parent") && !p.wished_roles.some((r) => r !== "parent") && <p className="tiny">{t("admin.parentOnly")}</p>}
              <div className="teamgrid">
                {teams.map((tm) => {
                  const r = roleOf(person.id, tm.id);
                  return (
                    <div key={tm.id} className={"teamrow" + (r ? " on" : "")}>
                      <span className="grow">{tm.name}<span className="tiny"> · {tm.level}</span></span>
                      <div className="chips tight">
                        {rolesFor(isChild, p.wished_roles).map((role) => (
                          <button key={role} className={"chip small" + (r === role ? " on" : "")} onClick={() => toggle(person.id, tm.id, role)}>{t(`roles.${role}`)}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!p.children.length && <label className="check"><input type="checkbox" checked={!!admin[p.id]} onChange={(e) => setAdmin({ ...admin, [p.id]: e.target.checked })} /> {t("admin.makeAdmin")}</label>}
          <div className="row">
            <button className="cta grow" disabled={busy === p.id} onClick={() => void approve(p)}>{t("admin.approve")}</button>
            <button className="ghost danger" disabled={busy === p.id} onClick={() => void reject(p)}>{t("admin.reject")}</button>
          </div>
        </article>
      ); })}
    </section>
  );
}


type ChildDraft = { first_name: string; birth_date: string; team_id: string };

/** Admin → Brugere → "Inviter til appen": create an adult (parent or dancer/trainer) with optional children, all approved, welcome mail with the app link. */
function InviteCard({ teams, onDone }: { teams: Team[]; onDone: (name: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ first_name: "", last_name: "", email: "", phone: "", is_parent: true, message: "" });
  const [adult, setAdult] = useState<{ team_id: string; role: Role }[]>([]);
  const [kids, setKids] = useState<ChildDraft[]>([{ first_name: "", birth_date: "", team_id: "" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggleAdult = (team_id: string, role: Role) => setAdult((cur) => { const has = cur.some((m) => m.team_id === team_id && m.role === role); return has ? cur.filter((m) => !(m.team_id === team_id && m.role === role)) : [...cur.filter((m) => m.team_id !== team_id), { team_id, role }]; });
  const setKid = (i: number, patch: Partial<ChildDraft>) => setKids((ks) => ks.map((k, j) => (j === i ? { ...k, ...patch } : k)));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const children = f.is_parent ? kids.filter((k) => k.first_name.trim()).map((k) => ({ first_name: k.first_name.trim(), birth_date: k.birth_date, memberships: k.team_id ? [{ team_id: k.team_id, role: "dancer" as Role }] : [] })) : [];
    if (!adult.length && !children.some((c) => c.memberships.length)) { setErr(t("admin.inviteNeedTeam")); return; }
    const input: InviteInput = { first_name: f.first_name.trim(), last_name: f.last_name.trim(), email: f.email.trim(), phone: f.phone.trim(), is_parent: f.is_parent, memberships: adult, children, message: f.message.trim() || null };
    setBusy(true);
    try { await api.invitePerson(input); onDone(input.first_name); setOpen(false); setF({ first_name: "", last_name: "", email: "", phone: "", is_parent: true, message: "" }); setAdult([]); setKids([{ first_name: "", birth_date: "", team_id: "" }]); }
    catch (x) { const m = String((x as Error).message || ""); setErr(m.includes("exists") ? t("admin.inviteExists") : m); }
    finally { setBusy(false); }
  };
  return (
    <article className="card stack" data-testid="invite">
      <div className="row between"><div><strong>{t("admin.invite")}</strong><div className="tiny">{t("admin.inviteSub")}</div></div><button className="chip" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? "–" : "+"}</button></div>
      {open && <form className="stack" onSubmit={submit}>
        <div className="seg2"><button type="button" className={f.is_parent ? "on" : ""} onClick={() => setF({ ...f, is_parent: true })}>{t("admin.inviteParent")}</button><button type="button" className={!f.is_parent ? "on" : ""} onClick={() => setF({ ...f, is_parent: false })}>{t("admin.inviteDancer")}</button></div>
        <div className="grid2"><label>{t("register.firstName")}<input required value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></label><label>{t("register.lastName")}<input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></label></div>
        <div className="grid2"><label>E-mail<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label><label>{t("register.phone")}<input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label></div>
        {!f.is_parent && <div className="assign"><div className="eyebrow">{t("admin.inviteTeam")}</div><div className="teamgrid">{teams.map((tm) => { const r = adult.find((m) => m.team_id === tm.id)?.role ?? null; return (
          <div key={tm.id} className={"teamrow" + (r ? " on" : "")}><span className="grow">{tm.name}<span className="tiny"> · {tm.level}</span></span><div className="chips tight">{(["dancer", "trainer", "assistant"] as Role[]).map((role) => <button key={role} type="button" className={"chip small" + (r === role ? " on" : "")} onClick={() => toggleAdult(tm.id, role)}>{t(`roles.${role}`)}</button>)}</div></div>); })}</div></div>}
        {f.is_parent && <div className="assign"><div className="eyebrow">{t("admin.inviteChildren")}</div>
          {kids.map((k, i) => <div key={i} className="kidrow"><label>{t("admin.inviteChildName")}<input value={k.first_name} onChange={(e) => setKid(i, { first_name: e.target.value })} /></label><label>{t("admin.inviteBirth")}<input type="date" value={k.birth_date} onChange={(e) => setKid(i, { birth_date: e.target.value })} /></label><label>{t("admin.inviteTeam")}<select value={k.team_id} onChange={(e) => setKid(i, { team_id: e.target.value })}><option value="">–</option>{teams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}</select></label></div>)}
          <button type="button" className="chip small" onClick={() => setKids((ks) => [...ks, { first_name: "", birth_date: "", team_id: "" }])}>+ {t("admin.inviteAddChild")}</button></div>}
        <label>{t("admin.inviteMessage")}<textarea rows={2} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="primary" type="submit" disabled={busy}>{t("admin.inviteSend")}</button>
      </form>}
    </article>
  );
}
