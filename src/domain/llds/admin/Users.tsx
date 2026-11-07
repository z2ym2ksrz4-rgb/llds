import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type WebSignup, type PendingPerson, type Role, type Team } from "@/core/api";
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
