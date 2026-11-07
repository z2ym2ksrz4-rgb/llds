import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { api, type Member, type Role, type Team } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Sheet } from "../components/Sheet";

type Props = { member: Member; all: Member[]; teams: Team[]; onClose: () => void; onChanged: () => void; onOpen: (m: Member) => void; toast: (m: string) => void };

const Check = ({ on, children, sub, onChange, testId, disabled }: { on: boolean; children: ReactNode; sub?: string; onChange: () => void; testId?: string; disabled?: boolean }) => (
  <button type="button" className={"checkrow" + (on ? " on" : "") + (disabled ? " off" : "")} role="checkbox" aria-checked={on} aria-disabled={disabled} disabled={disabled} onClick={onChange} data-testid={testId}>
    <span className="box" aria-hidden>{on ? "✓" : ""}</span>
    <span className="grow"><span className="lbl">{children}</span>{sub && <span className="tiny">{sub}</span>}</span>
  </button>
);

const ageOf = (p: { birth_date?: string | null; birth_year?: number | null }) => p.birth_date ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / 31557600000) : p.birth_year ? new Date().getFullYear() - p.birth_year : null;

/** Admin → Medlemmer → one person.
 *  Top: what the person can see in the app (one ✓ per team, with the reason). Then "who is this?" as four check rows
 *  (dancer / parent / trainer / admin – any combination; eligibility by age). Then ONE team list, grouped by style and
 *  alphabetical, where each checked role adds its own chip on every team row: Danser · Forælder (via a child) · Træner · Hjælpetræner.
 *  Then the children (link existing / create new). Everything is saved with Gem. */
export function MemberSheet({ member: p, all, teams, onClose, onChanged, onOpen, toast }: Props) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const age = ageOf(p);
  const canStaff = !p.supervised_by && (age === null || age >= 15);
  const canParent = !p.supervised_by && (age === null || age >= 18);
  const isSelf = p.id === me.person.id;
  const canAdmin = canParent && !isSelf;
  const why = (ok: boolean, min: number) => (ok ? undefined : isSelf && min === 18 && canParent ? t("admin.notSelf") : age === null ? t("admin.needsAgeUnknown") : t("admin.needsAge", { min }));

  const [dancer, setDancer] = useState(p.memberships.some((m) => m.role === "dancer"));
  const [parent, setParent] = useState(p.children.length > 0);
  const [staff, setStaff] = useState(p.memberships.some((m) => m.role !== "dancer"));
  const [admin, setAdmin] = useState(p.is_admin);
  const [ms, setMs] = useState<{ team_id: string; role: Role }[]>(p.memberships.map((m) => ({ team_id: m.team_id, role: m.role })));
  const [kids, setKids] = useState<string[]>(p.children.map((c) => c.id));
  // children's dancer teams (draft) – edited through the "Forælder" chip on a team row
  const [kidTeams, setKidTeams] = useState<Record<string, string[]>>(() => Object.fromEntries(p.children.map((c) => [c.id, (all.find((x) => x.id === c.id)?.memberships ?? []).filter((m) => m.role === "dancer").map((m) => m.team_id)])));
  const [kidQ, setKidQ] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [newKid, setNewKid] = useState<{ first_name: string; birth_date: string; team_ids: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const teamName = (id: string) => teams.find((x) => x.id === id)?.name ?? "?";
  const byId = (id: string) => all.find((x) => x.id === id);
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const has = (team_id: string, role: Role) => ms.some((m) => m.team_id === team_id && m.role === role);
  const toggleRole = (team_id: string, role: Role) => setMs((cur) => (cur.some((m) => m.team_id === team_id && m.role === role) ? cur.filter((m) => !(m.team_id === team_id && m.role === role)) : [...cur, { team_id, role }]));
  const kidsOn = (team_id: string) => kids.filter((k) => (kidTeams[k] ?? byId(k)?.memberships.filter((m) => m.role === "dancer").map((m) => m.team_id) ?? []).includes(team_id));

  // teams grouped by style, alphabetical
  const groups = useMemo(() => {
    const g = new Map<string, Team[]>();
    for (const tm of [...teams].sort((a, b) => a.name.localeCompare(b.name, "da"))) { const k = tm.style || t("admin.otherStyle"); g.set(k, [...(g.get(k) ?? []), tm]); }
    return [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], "da"));
  }, [teams, t]);

  const candidates = useMemo(() => {
    const q = kidQ.trim().toLowerCase(); if (q.length < 2) return [];
    return all.filter((x) => x.id !== p.id && !kids.includes(x.id) && (!x.user_id || x.supervised_by) && `${x.first_name} ${x.last_name}`.toLowerCase().includes(q)).slice(0, 6);
  }, [kidQ, all, kids, p.id]);

  const access = useMemo(() => {
    const rows: { team: string; via: string }[] = [];
    for (const m of ms) if ((m.role === "dancer" && dancer) || (m.role !== "dancer" && staff)) rows.push({ team: teamName(m.team_id), via: t(`roles.${m.role}`) });
    if (parent) for (const kid of kids) { const c = byId(kid); for (const tid of kidTeams[kid] ?? c?.memberships.filter((m) => m.role === "dancer").map((m) => m.team_id) ?? []) rows.push({ team: teamName(tid), via: t("admin.viaChild", { name: c?.first_name ?? "" }) }); }
    return rows.sort((a, b) => a.team.localeCompare(b.team, "da"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, dancer, staff, parent, kids, kidTeams, all, teams]);

  const save = async () => {
    setBusy(true);
    try {
      await api.setMemberships(p.id, ms.filter((m) => (m.role === "dancer" ? dancer : staff)));
      if (canParent) {
        await api.setGuardians(p.id, parent ? kids : []);
        if (parent) for (const kid of kids) { const c = byId(kid); if (!c || !kidTeams[kid]) continue; const keep = c.memberships.filter((m) => m.role !== "dancer").map((m) => ({ team_id: m.team_id, role: m.role })); await api.setMemberships(kid, [...keep, ...kidTeams[kid].map((team_id) => ({ team_id, role: "dancer" as Role }))]); }
      }
      if (canAdmin && admin !== p.is_admin) await api.setAdmin(p.id, admin);
      toast(t("common.saved")); onChanged(); onClose();
    } catch (x) { toast(t("common.error") + ": " + String((x as Error).message ?? x)); }
    finally { setBusy(false); }
  };
  const createKid = async () => {
    if (!newKid || !newKid.first_name.trim()) return;
    setBusy(true);
    try { const cid = await api.createChild({ parent_id: p.id, first_name: newKid.first_name, last_name: p.last_name, birth_date: newKid.birth_date || null, team_ids: newKid.team_ids }); setKids((k) => [...k, cid]); setKidTeams((k) => ({ ...k, [cid]: newKid.team_ids })); setNewKid(null); onChanged(); toast(t("admin.childCreated", { name: newKid.first_name })); }
    finally { setBusy(false); }
  };

  const login = p.supervised_by ? t("admin.loginChild") : p.user_id ? t("admin.loginOwn", { email: p.email ?? "" }) : p.email ? t("admin.loginPending", { email: p.email }) : p.parents.length ? t("admin.loginNone") : t("admin.loginNoEmail");
  const year = p.birth_date ? new Date(p.birth_date).getFullYear() : p.birth_year;
  const anyRole = dancer || staff || (parent && kids.length > 0);

  return (
    <Sheet onClose={onClose} eyebrow={t("admin.member")} title={`${p.first_name} ${p.last_name}`}>
      <div className="tiny">{[year ? t("admin.born", { year }) : null, p.phone, login].filter(Boolean).join(" · ")}</div>
      {p.parents.length > 0 && <div className="tiny" style={{ marginTop: 4 }}>{t("admin.parents")}: {p.parents.map((g) => <button key={g.id} className="linklike" onClick={() => { const m = byId(g.id); if (m) onOpen(m); }}>{g.first_name} {g.last_name}</button>).reduce<ReactNode[]>((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])}</div>}

      {/* 1. Access summary – first, so the consequence of every tick is visible */}
      <div className="field"><span>{t("admin.accessHead")}</span>
        <div className="card access" data-testid="access">
          {access.length ? access.map((r, i) => <div key={i} className="accessrow"><span className="box on" aria-hidden>✓</span><span className="grow">{r.team}</span><span className="tiny">{r.via}</span></div>) : <p className="tiny muted" style={{ margin: 0 }}>{t("admin.accessNone")}</p>}
          <div className="tiny" style={{ marginTop: 8 }}>{login}{admin ? ` · ${t("admin.accessAdmin")}` : ""}</div>
        </div>
      </div>

      {/* 2. Roles – any combination */}
      <div className="field"><span>{t("admin.rolesHead")}</span>
        <div className="checklist">
          <Check on={dancer} onChange={() => setDancer((v) => !v)} sub={t("admin.roleDancerSub")} testId="role-dancer">{t("roles.dancer")}</Check>
          <Check on={parent} disabled={!canParent} onChange={() => setParent((v) => { const nv = !v; if (nv && !kids.length) { setPickOpen(true); setTimeout(() => document.getElementById("kid-search")?.focus(), 50); } return nv; })} sub={why(canParent, 18) ?? t("admin.roleParentSub")} testId="role-parent">{t("roles.parent")}</Check>
          <Check on={staff} disabled={!canStaff} onChange={() => setStaff((v) => !v)} sub={why(canStaff, 15) ?? t("admin.roleStaffSub")} testId="role-staff">{t("admin.roleStaff")}</Check>
          <Check on={admin} disabled={!canAdmin} onChange={() => setAdmin((v) => !v)} sub={why(canAdmin, 18) ?? t("admin.isAdminHint")} testId="admin-toggle">{t("admin.isAdmin")}</Check>
        </div>
      </div>

      {/* 3. Children – a parent follows the teams where a child is a dancer; nothing is chosen for the parent directly */}
      {parent && canParent && <div className="field" id="kids-sec"><span>{t("admin.childrenHead")}</span>
        <p className="tiny muted" style={{ margin: "0 0 6px" }}>{t("admin.childrenHint")}</p>
        <div className="checklist" data-testid="kids">
          {kids.map((id) => { const c = byId(id); if (!c) return null; const tms = (kidTeams[id] ?? c.memberships.filter((m) => m.role === "dancer").map((m) => m.team_id)).map(teamName); return (
            <div key={id} className="checkrow on static"><span className="box" aria-hidden>✓</span><span className="grow"><span className="lbl">{c.first_name} {c.last_name}</span><span className="tiny">{[c.birth_year ? String(c.birth_year) : null, tms.length ? tms.join(" · ") : t("admin.noTeams")].filter(Boolean).join(" · ")}</span></span>
              <button type="button" className="chip small" onClick={() => onOpen(c)}>{t("admin.editChild")}</button><button type="button" className="chip small danger" aria-label={t("admin.unlink")} onClick={() => setKids((k) => k.filter((x) => x !== id))}>×</button></div>); })}
          {!kids.length && <p className="tiny muted" style={{ margin: "4px 0" }}>{t("admin.noChildrenYet")}</p>}
        </div>
        {!newKid && <div className="row" style={{ marginTop: 8 }}>
          <input id="kid-search" placeholder={t("admin.findChild")} value={kidQ} onChange={(e) => setKidQ(e.target.value)} data-testid="kid-search" autoFocus={pickOpen} />
          <button type="button" className="chip" onClick={() => setNewKid({ first_name: "", birth_date: "", team_ids: [] })}>+ {t("admin.newChild")}</button>
        </div>}
        {candidates.length > 0 && <div className="card list" style={{ marginTop: 6 }}>{candidates.map((c) => <button key={c.id} type="button" className="item" onClick={() => { setKids((k) => [...k, c.id]); setKidQ(""); }}><span className="grow">{c.first_name} {c.last_name}<div className="tiny">{c.memberships.map((m) => teamName(m.team_id)).join(" · ") || t("admin.noTeams")}{c.parents.length ? ` · ${t("admin.parents")}: ${c.parents.map((g) => g.first_name).join(", ")}` : ""}</div></span><span className="gold">+</span></button>)}</div>}
        {newKid && <div className="card stack" style={{ marginTop: 8 }} data-testid="new-kid">
          <div className="grid2"><label>{t("admin.inviteChildName")}<input value={newKid.first_name} onChange={(e) => setNewKid({ ...newKid, first_name: e.target.value })} /></label><label>{t("admin.inviteBirth")}<input type="date" value={newKid.birth_date} onChange={(e) => setNewKid({ ...newKid, birth_date: e.target.value })} /></label></div>
          <div className="eyebrow">{t("admin.dancerOn")}</div>
          <div className="checklist cols">{teams.map((tm) => <Check key={tm.id} on={newKid.team_ids.includes(tm.id)} onChange={() => setNewKid({ ...newKid, team_ids: toggleIn(newKid.team_ids, tm.id) })}>{tm.name}</Check>)}</div>
          <div className="row"><button type="button" className="cta grow" disabled={busy || !newKid.first_name.trim()} onClick={() => void createKid()}>{t("admin.createChild")}</button><button type="button" className="ghost" onClick={() => setNewKid(null)}>{t("common.cancel")}</button></div>
        </div>}
      </div>}

      {/* 4. One team list – chips per checked role */}
      {anyRole && <div className="field"><span>{t("admin.teamsHead")}</span>
        <p className="tiny muted" style={{ margin: "0 0 6px" }}>{(dancer || staff) ? t("admin.teamsHint") : t("admin.teamsParentOnly")}</p>
        <div className="teamlist" data-testid="teamlist">
          {groups.map(([style, list]) => <div key={style} className="tgroup"><div className="eyebrow">{style}</div>
            {list.map((tm) => { const kOn = parent ? kidsOn(tm.id) : []; const on = (dancer && has(tm.id, "dancer")) || (staff && (has(tm.id, "trainer") || has(tm.id, "assistant"))) || kOn.length > 0; return (
              <div key={tm.id} className={"trow" + (on ? " on" : "")} data-team={tm.name}>
                <div className="trow-main"><span className="grow"><span className="tname">{on ? "✓ " : ""}{tm.name}</span><span className="tiny"> · {tm.level}</span></span>
                  <div className="chips tight">
                    {dancer && <button type="button" className={"chip small" + (has(tm.id, "dancer") ? " on" : "")} onClick={() => toggleRole(tm.id, "dancer")}>{t("roles.dancer")}</button>}
                    {parent && kOn.length > 0 && <span className="chip small on static" data-testid="chip-parent">{t("admin.viaChild", { name: kOn.map((k) => byId(k)?.first_name).join(", ") })}</span>}
                    {staff && canStaff && <button type="button" className={"chip small" + (has(tm.id, "trainer") ? " on" : "")} onClick={() => toggleRole(tm.id, "trainer")}>{t("roles.trainer")}</button>}
                    {staff && canStaff && <button type="button" className={"chip small" + (has(tm.id, "assistant") ? " on" : "")} onClick={() => toggleRole(tm.id, "assistant")}>{t("roles.assistant")}</button>}
                  </div></div>
              </div>); })}
          </div>)}
        </div>
      </div>}

      <div className="row"><button className="cta grow" disabled={busy} onClick={() => void save()} data-testid="member-save">{t("common.save")}</button>
        <button className="ghost danger" onClick={async () => { if (!confirmOff) { setConfirmOff(true); setTimeout(() => setConfirmOff(false), 4000); return; } await api.setPersonStatus(p.id, "inactive"); toast(t("admin.deactivated")); onChanged(); onClose(); }}>{confirmOff ? t("admin.deactivateConfirm") : t("admin.deactivate")}</button></div>
    </Sheet>
  );
}
