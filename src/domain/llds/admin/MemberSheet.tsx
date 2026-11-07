import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { api, type Member, type Role, type Team } from "@/core/api";
import { useAuth } from "@/core/auth";
import { Sheet } from "../components/Sheet";

type Props = { member: Member; all: Member[]; teams: Team[]; onClose: () => void; onChanged: () => void; onOpen: (m: Member) => void; toast: (m: string) => void };

const Check = ({ on, children, sub, onChange, testId }: { on: boolean; children: ReactNode; sub?: string; onChange: () => void; testId?: string }) => (
  <button type="button" className={"checkrow" + (on ? " on" : "")} role="checkbox" aria-checked={on} onClick={onChange} data-testid={testId}>
    <span className="box" aria-hidden>{on ? "✓" : ""}</span>
    <span className="grow"><span className="lbl">{children}</span>{sub && <span className="tiny">{sub}</span>}</span>
  </button>
);

/** Admin → Medlemmer → one person. Roles are explicit check boxes (dancer / parent / trainer / admin); each role opens its own
 *  section (teams as dancer, teams as trainer or assistant, linked children). A summary at the bottom lists exactly what the
 *  person can see in the app, so Line never has to guess. */
export function MemberSheet({ member: p, all, teams, onClose, onChanged, onOpen, toast }: Props) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const isChild = !p.user_id || !!p.supervised_by;
  const canStaff = !isChild;

  const [dancer, setDancer] = useState(p.memberships.some((m) => m.role === "dancer"));
  const [parent, setParent] = useState(p.children.length > 0);
  const [staff, setStaff] = useState(p.memberships.some((m) => m.role !== "dancer"));
  const [dancerTeams, setDancerTeams] = useState<string[]>(p.memberships.filter((m) => m.role === "dancer").map((m) => m.team_id));
  const [staffTeams, setStaffTeams] = useState<{ team_id: string; role: Role }[]>(p.memberships.filter((m) => m.role !== "dancer").map((m) => ({ team_id: m.team_id, role: m.role })));
  const [kids, setKids] = useState<string[]>(p.children.map((c) => c.id));
  const [kidQ, setKidQ] = useState("");
  const [newKid, setNewKid] = useState<{ first_name: string; birth_date: string; team_ids: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  const teamName = (id: string) => teams.find((x) => x.id === id)?.name ?? "?";
  const byId = (id: string) => all.find((x) => x.id === id);
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const setStaffRole = (team_id: string, role: Role | null) => setStaffTeams((cur) => { const rest = cur.filter((m) => m.team_id !== team_id); return role ? [...rest, { team_id, role }] : rest; });

  // candidates for "add existing child": approved persons without their own adult login, not already linked, not the person
  const candidates = useMemo(() => {
    const q = kidQ.trim().toLowerCase(); if (q.length < 2) return [];
    return all.filter((x) => x.id !== p.id && !kids.includes(x.id) && (!x.user_id || x.supervised_by) && `${x.first_name} ${x.last_name}`.toLowerCase().includes(q)).slice(0, 6);
  }, [kidQ, all, kids, p.id]);

  // what the person will be able to see after save
  const access = useMemo(() => {
    const rows: { team: string; via: string }[] = [];
    if (dancer) for (const id of dancerTeams) rows.push({ team: teamName(id), via: t("roles.dancer") });
    if (staff) for (const m of staffTeams) rows.push({ team: teamName(m.team_id), via: t(`roles.${m.role}`) });
    if (parent) for (const kid of kids) { const c = byId(kid); for (const m of c?.memberships ?? []) if (m.role === "dancer") rows.push({ team: teamName(m.team_id), via: t("admin.viaChild", { name: c!.first_name }) }); }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dancer, dancerTeams, staff, staffTeams, parent, kids, all, teams]);

  const save = async () => {
    setBusy(true);
    try {
      const ms: { team_id: string; role: Role }[] = [...(dancer ? dancerTeams.map((team_id) => ({ team_id, role: "dancer" as Role })) : []), ...(staff ? staffTeams.filter((m) => !dancer || !dancerTeams.includes(m.team_id)) : [])];
      await api.setMemberships(p.id, ms);
      if (!isChild) await api.setGuardians(p.id, parent ? kids : []);
      toast(t("common.saved")); onChanged(); onClose();
    } finally { setBusy(false); }
  };
  const createKid = async () => {
    if (!newKid || !newKid.first_name.trim()) return;
    setBusy(true);
    try { const cid = await api.createChild({ parent_id: p.id, first_name: newKid.first_name, last_name: p.last_name, birth_date: newKid.birth_date || null, team_ids: newKid.team_ids }); setKids((k) => [...k, cid]); setNewKid(null); onChanged(); toast(t("admin.childCreated", { name: newKid.first_name })); }
    finally { setBusy(false); }
  };

  const login = p.supervised_by ? t("admin.loginChild") : p.user_id ? t("admin.loginOwn", { email: p.email ?? "" }) : t("admin.loginNone");
  const year = p.birth_date ? new Date(p.birth_date).getFullYear() : p.birth_year;

  return (
    <Sheet onClose={onClose} eyebrow={t("admin.member")} title={`${p.first_name} ${p.last_name}`}>
      <div className="tiny">{[year ? t("admin.born", { year }) : null, p.phone, login].filter(Boolean).join(" · ")}</div>
      {p.parents.length > 0 && <div className="tiny" style={{ marginTop: 4 }}>{t("admin.parents")}: {p.parents.map((g) => <button key={g.id} className="linklike" onClick={() => { const m = byId(g.id); if (m) onOpen(m); }}>{g.first_name} {g.last_name}</button>).reduce<ReactNode[]>((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])}</div>}

      {/* 1. Roles */}
      <div className="field"><span>{t("admin.rolesHead")}</span>
        <div className="checklist">
          <Check on={dancer} onChange={() => setDancer((v) => !v)} sub={t("admin.roleDancerSub")} testId="role-dancer">{t("roles.dancer")}</Check>
          {!isChild && <Check on={parent} onChange={() => setParent((v) => !v)} sub={t("admin.roleParentSub")} testId="role-parent">{t("roles.parent")}</Check>}
          {canStaff && <Check on={staff} onChange={() => setStaff((v) => !v)} sub={t("admin.roleStaffSub")} testId="role-staff">{t("admin.roleStaff")}</Check>}
          {canStaff && p.id !== me.person.id && <Check on={p.is_admin} onChange={async () => { await api.setAdmin(p.id, !p.is_admin); toast(!p.is_admin ? t("admin.adminGiven", { name: p.first_name }) : t("admin.adminRemoved", { name: p.first_name })); onChanged(); }} sub={t("admin.isAdminHint")} testId="admin-toggle">{t("admin.isAdmin")}</Check>}
        </div>
      </div>

      {/* 2. Dancer on teams */}
      {dancer && <div className="field"><span>{t("admin.dancerOn")}</span>
        <div className="checklist cols" data-testid="dancer-teams">{teams.map((tm) => <Check key={tm.id} on={dancerTeams.includes(tm.id)} onChange={() => setDancerTeams((l) => toggleIn(l, tm.id))}>{tm.name}<span className="tiny"> · {tm.level}</span></Check>)}</div>
      </div>}

      {/* 3. Trainer / assistant on teams */}
      {staff && canStaff && <div className="field"><span>{t("admin.staffOn")}</span>
        <div className="teamgrid" data-testid="staff-teams">{teams.map((tm) => { const r = staffTeams.find((m) => m.team_id === tm.id)?.role ?? null; return (
          <div key={tm.id} className={"teamrow" + (r ? " on" : "")}><span className="grow">{r ? "✓ " : ""}{tm.name}</span><div className="chips tight">{(["trainer", "assistant"] as Role[]).map((role) => <button key={role} type="button" className={"chip small" + (r === role ? " on" : "")} onClick={() => setStaffRole(tm.id, r === role ? null : role)}>{t(`roles.${role}`)}</button>)}</div></div>); })}</div>
      </div>}

      {/* 4. Children */}
      {parent && !isChild && <div className="field"><span>{t("admin.childrenHead")}</span>
        <div className="checklist" data-testid="kids">
          {kids.map((id) => { const c = byId(id); if (!c) return null; const tms = c.memberships.filter((m) => m.role === "dancer").map((m) => teamName(m.team_id)); return (
            <div key={id} className="checkrow on static"><span className="box" aria-hidden>✓</span><span className="grow"><span className="lbl">{c.first_name} {c.last_name}</span><span className="tiny">{[c.birth_year ? String(c.birth_year) : null, tms.length ? tms.join(" · ") : t("admin.noTeams")].filter(Boolean).join(" · ")}</span></span>
              <button type="button" className="chip small" onClick={() => onOpen(c)}>{t("admin.editChild")}</button><button type="button" className="chip small danger" aria-label={t("admin.unlink")} onClick={() => setKids((k) => k.filter((x) => x !== id))}>×</button></div>); })}
          {!kids.length && <p className="tiny muted" style={{ margin: "4px 0" }}>{t("admin.noChildrenYet")}</p>}
        </div>
        {!newKid && <div className="row" style={{ marginTop: 8 }}>
          <input placeholder={t("admin.findChild")} value={kidQ} onChange={(e) => setKidQ(e.target.value)} data-testid="kid-search" />
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

      {/* 5. Access summary */}
      <div className="field"><span>{t("admin.accessHead")}</span>
        <div className="card access" data-testid="access">
          {access.length ? access.map((r, i) => <div key={i} className="accessrow"><span className="box on" aria-hidden>✓</span><span className="grow">{r.team}</span><span className="tiny">{r.via}</span></div>) : <p className="tiny muted" style={{ margin: 0 }}>{t("admin.accessNone")}</p>}
          <div className="tiny" style={{ marginTop: 8 }}>{login}{p.is_admin ? ` · ${t("admin.accessAdmin")}` : ""}</div>
        </div>
      </div>

      <div className="row"><button className="cta grow" disabled={busy} onClick={() => void save()} data-testid="member-save">{t("common.save")}</button>
        <button className="ghost danger" onClick={async () => { if (!confirmOff) { setConfirmOff(true); setTimeout(() => setConfirmOff(false), 4000); return; } await api.setPersonStatus(p.id, "inactive"); toast(t("admin.deactivated")); onChanged(); onClose(); }}>{confirmOff ? t("admin.deactivateConfirm") : t("admin.deactivate")}</button></div>
    </Sheet>
  );
}
