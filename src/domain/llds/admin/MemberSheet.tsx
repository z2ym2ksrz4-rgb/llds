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
  const [kidTeams] = useState<Record<string, string[]>>(() => Object.fromEntries(p.children.map((c) => [c.id, (all.find((x) => x.id === c.id)?.memberships ?? []).filter((m) => m.role === "dancer").map((m) => m.team_id)])));
  const [kidQ, setKidQ] = useState("");
  const kidChips = (ids: string[], onToggle: (id: string) => void) => <div className="chips tight wrap">{[...teams].sort((a, b) => a.name.localeCompare(b.name, "da")).map((tm) => <button key={tm.id} type="button" className={"chip small" + (ids.includes(tm.id) ? " on" : "")} onClick={() => onToggle(tm.id)}>{tm.name}</button>)}</div>;
  const [pickOpen, setPickOpen] = useState(false);
  const [newKid, setNewKid] = useState<{ first_name: string; birth_date: string; team_ids: string[] } | null>(null);
  // children drafted in this sheet – created only when Gem is pressed, so a wrong "Tilføj" can simply be removed again
  const [drafts, setDrafts] = useState<{ tmp: string; first_name: string; birth_date: string; team_ids: string[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  // personal details – editable by admin, saved with Gem
  const [det, setDet] = useState({ first_name: p.first_name, last_name: p.last_name, birth_date: p.birth_date ?? "", phone: p.phone ?? "", email: p.email ?? "" });
  const [detOpen, setDetOpen] = useState(false);
  const [openStyles, setOpenStyles] = useState<Record<string, boolean>>({});   // team list: styles fold out on demand; styles with ticks start open
  const detChanged = det.first_name !== p.first_name || det.last_name !== p.last_name || det.birth_date !== (p.birth_date ?? "") || det.phone !== (p.phone ?? "") || det.email.trim().toLowerCase() !== (p.email ?? "").toLowerCase();

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
    if (!pickOpen) return [];
    const q = kidQ.trim().toLowerCase();
    const ageOf = (x: Member) => (x.birth_date ? Math.floor((Date.now() - new Date(x.birth_date).getTime()) / 31557600000) : x.birth_year ? new Date().getFullYear() - x.birth_year : null);
    const list = all.filter((x) => x.id !== p.id && !kids.includes(x.id) && !x.is_admin && (!q || `${x.first_name} ${x.last_name}`.toLowerCase().includes(q)));
    // existing dancers first (youngest first), then everyone else alphabetically
    const rank = (x: Member) => (x.memberships.some((m) => m.role === "dancer") ? 0 : 1) * 1000 + (ageOf(x) ?? 500);
    return list.sort((a, b) => rank(a) - rank(b) || a.first_name.localeCompare(b.first_name, "da")).slice(0, q ? 12 : 8);
  }, [pickOpen, kidQ, all, kids, p.id]);

  const access = useMemo(() => {
    const rows: { team: string; via: string }[] = [];
    for (const m of ms) if ((m.role === "dancer" && dancer) || (m.role !== "dancer" && staff)) rows.push({ team: teamName(m.team_id), via: t(`roles.${m.role}`) });
    if (parent) for (const kid of kids) { const c = byId(kid); for (const tid of kidTeams[kid] ?? c?.memberships.filter((m) => m.role === "dancer").map((m) => m.team_id) ?? []) rows.push({ team: teamName(tid), via: t("admin.viaChild", { name: c?.first_name ?? "" }) }); }
    if (parent) for (const d of drafts) for (const tid of d.team_ids) rows.push({ team: teamName(tid), via: t("admin.viaChild", { name: d.first_name }) });
    return rows.sort((a, b) => a.team.localeCompare(b.team, "da"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, dancer, staff, parent, kids, kidTeams, drafts, all, teams]);

  const save = async () => {
    if (parent && canParent && kids.length === 0 && drafts.length === 0) { toast(t("admin.parentNeedsChild")); return; }
    setBusy(true);
    try {
      if (detChanged) await api.updatePerson(p.id, { first_name: det.first_name.trim(), last_name: det.last_name.trim(), birth_date: det.birth_date || null, phone: det.phone.trim() || null, ...(p.user_id ? {} : { email: det.email.trim().toLowerCase() || null }) });
      await api.setMemberships(p.id, ms.filter((m) => (m.role === "dancer" ? dancer : staff)));
      if (canParent) {
        const created: string[] = [];
        if (parent) for (const d of drafts) created.push(await api.createChild({ parent_id: p.id, first_name: d.first_name, last_name: p.last_name, birth_date: d.birth_date || null, team_ids: d.team_ids }));
        await api.setGuardians(p.id, parent ? [...kids, ...created] : []);
        if (parent) for (const kid of kids) { const c = byId(kid); if (!c || !kidTeams[kid]) continue; const keep = c.memberships.filter((m) => m.role !== "dancer").map((m) => ({ team_id: m.team_id, role: m.role })); await api.setMemberships(kid, [...keep, ...kidTeams[kid].map((team_id) => ({ team_id, role: "dancer" as Role }))]); }
      }
      if (canAdmin && admin !== p.is_admin) await api.setAdmin(p.id, admin);
      toast(t("common.saved")); onChanged(); onClose();
    } catch (x) { toast(t("common.error") + ": " + String((x as Error).message ?? x)); }
    finally { setBusy(false); }
  };
  const addDraft = () => {
    if (!newKid || !newKid.first_name.trim()) return;
    setDrafts((d) => [...d, { tmp: "tmp-" + Date.now(), first_name: newKid.first_name.trim(), birth_date: newKid.birth_date, team_ids: newKid.team_ids }]);
    setNewKid(null);
  };

  const login = p.supervised_by ? t("admin.loginChild") : p.user_id ? t("admin.loginOwn", { email: p.email ?? "" }) : p.email ? t("admin.loginPending", { email: p.email }) : p.parents.length ? t("admin.loginNone") : t("admin.loginNoEmail");

  const anyRole = dancer || staff || (parent && (kids.length > 0 || drafts.length > 0));

  return (
    <Sheet onClose={onClose} eyebrow={t("admin.member")} title={`${p.first_name} ${p.last_name}`}>
      {/* 0. Personal details – everything admin may know, editable */}
      <div className="card details" data-testid="member-details">
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div className="grow small">
            <div><span className="muted">{t("admin.detBirth")}:</span> {p.birth_date ? new Date(p.birth_date).toLocaleDateString("da-DK") + (age != null ? ` · ${age} ${t("settings.years")}` : "") : p.birth_year ? String(p.birth_year) : <span className="warn">{t("admin.detMissing")}</span>}</div>
            <div><span className="muted">{t("admin.detEmail")}:</span> {p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : <span className="warn">{t("admin.detMissing")}</span>}</div>
            <div><span className="muted">{t("admin.detPhone")}:</span> {p.phone ? <a href={`tel:${p.phone.replace(/\s/g, "")}`}>{p.phone}</a> : <span className="muted">–</span>}</div>
            <div><span className="muted">{t("admin.detLogin")}:</span> {login}</div>
            {p.parents.length > 0 && <div><span className="muted">{t("admin.parents")}:</span> {p.parents.map((g) => <button key={g.id} className="linklike" onClick={() => { const m = byId(g.id); if (m) onOpen(m); }}>{g.first_name} {g.last_name}</button>).reduce<ReactNode[]>((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])}</div>}
            {p.children.length > 0 && <div><span className="muted">{t("admin.childrenHead")}:</span> {p.children.map((c) => <button key={c.id} className="linklike" onClick={() => { const m = byId(c.id); if (m) onOpen(m); }}>{c.first_name}</button>).reduce<ReactNode[]>((acc, el, i) => (i ? [...acc, ", ", el] : [el]), [])}</div>}
            <div className="tiny muted" style={{ marginTop: 4 }}>{[p.source ? t(`admin.source.${p.source}`) : null, p.created_at ? t("admin.detCreated", { date: new Date(p.created_at).toLocaleDateString("da-DK") }) : null, p.photo_consent === false ? t("team.noPhotoConsent") : null].filter(Boolean).join(" · ")}</div>
          </div>
          <button type="button" className="chip small" onClick={() => setDetOpen((o) => !o)} data-testid="details-edit">{detOpen ? t("common.cancel") : t("common.edit")}</button>
        </div>
        {detOpen && <div className="stack" style={{ marginTop: 10 }} data-testid="details-form">
          <div className="grid2"><label>{t("register.firstName")}<input value={det.first_name} onChange={(e) => setDet({ ...det, first_name: e.target.value })} /></label><label>{t("register.lastName")}<input value={det.last_name} onChange={(e) => setDet({ ...det, last_name: e.target.value })} /></label></div>
          <div className="grid2"><label>{t("admin.detBirth")}<input type="date" value={det.birth_date} onChange={(e) => setDet({ ...det, birth_date: e.target.value })} data-testid="det-birth" /></label><label>{t("admin.detPhone")}<input type="tel" value={det.phone} onChange={(e) => setDet({ ...det, phone: e.target.value })} /></label></div>
          <label>{t("admin.detEmail")}<input type="email" value={det.email} disabled={!!p.user_id} onChange={(e) => setDet({ ...det, email: e.target.value })} /></label>
          {p.user_id && <p className="tiny muted" style={{ margin: 0 }}>{t("admin.detEmailLocked")}</p>}
          <p className="tiny muted" style={{ margin: 0 }}>{t("admin.detSaveHint")}</p>
        </div>}
      </div>
      {!p.user_id && <InviteBlock person={p} busy={busy} setBusy={setBusy} toast={toast} onChanged={onChanged} />}

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
            <div key={id} className="checkrow kidrow on static"><span className="box" aria-hidden>✓</span><span className="grow"><span className="lbl">{c.first_name} {c.last_name}</span><span className="tiny">{[c.birth_year ? String(c.birth_year) : null, tms.length ? tms.join(" · ") : t("admin.noTeams")].filter(Boolean).join(" · ")}</span></span>
              <span className="acts"><button type="button" className="chip small" onClick={() => onOpen(c)}>{t("admin.editChild")}</button><button type="button" className="chip small danger" aria-label={t("admin.unlink")} title={t("admin.unlink")} onClick={() => setKids((k) => k.filter((x) => x !== id))}>×</button></span></div>); })}
          {drafts.map((d) => <div key={d.tmp} className="checkrow kidrow on static" data-testid="kid-draft"><span className="box" aria-hidden>✓</span><span className="grow"><span className="lbl">{d.first_name} {p.last_name} <span className="tiny" style={{ display: "inline" }}>· {t("admin.draftNew")}</span></span><span className="tiny">{[d.birth_date ? d.birth_date.slice(0, 4) : null, d.team_ids.length ? d.team_ids.map(teamName).join(" · ") : t("admin.noTeams")].filter(Boolean).join(" · ")}</span></span>
            <span className="acts"><button type="button" className="chip small danger" aria-label={t("admin.removeDraft")} title={t("admin.removeDraft")} onClick={() => setDrafts((x) => x.filter((y) => y.tmp !== d.tmp))}>×</button></span></div>)}
          {!kids.length && !drafts.length && <p className="tiny muted" style={{ margin: "4px 0" }}>{t("admin.noChildrenYet")}</p>}
        </div>
        {!newKid && !pickOpen && <div className="kidactions">
          <button type="button" className="chip" data-testid="kid-pick-open" onClick={() => { setPickOpen(true); setTimeout(() => document.getElementById("kid-search")?.focus(), 50); }}>{t("admin.pickExisting")}</button>
          <button type="button" className="chip" data-testid="kid-new-open" onClick={() => setNewKid({ first_name: "", birth_date: "", team_ids: [] })}>+ {t("admin.newChild")}</button>
        </div>}
        {pickOpen && !newKid && <div className="card stack kidpick" style={{ marginTop: 8 }} data-testid="kid-pick">
          <div className="head row between"><span className="eyebrow">{t("admin.pickExisting")}</span><button type="button" className="ghost small" onClick={() => { setPickOpen(false); setKidQ(""); }}>{t("common.cancel")}</button></div>
          <input id="kid-search" placeholder={t("admin.findChild")} value={kidQ} onChange={(e) => setKidQ(e.target.value)} data-testid="kid-search" />
          <div className="list">{candidates.map((c) => <button key={c.id} type="button" className="item" onClick={() => { setKids((k) => [...k, c.id]); setKidQ(""); setPickOpen(false); }}><span className="grow">{c.first_name} {c.last_name}<div className="tiny">{[c.birth_year ? String(c.birth_year) : null, c.memberships.filter((m) => m.role === "dancer").map((m) => teamName(m.team_id)).join(" · ") || t("admin.noTeams"), c.parents.length ? `${t("admin.parents")}: ${c.parents.map((g) => g.first_name).join(", ")}` : null].filter(Boolean).join(" · ")}</div></span><span className="gold">+</span></button>)}
            {!candidates.length && <p className="tiny muted" style={{ margin: "6px 0" }}>{t("admin.noMatch")}</p>}</div>
        </div>}
        {newKid && <div className="card stack newkid" style={{ marginTop: 8 }} data-testid="new-kid">
          <div className="head"><span className="eyebrow">{t("admin.newChild")}</span><button type="button" className="ghost small" onClick={() => setNewKid(null)}>{t("common.cancel")}</button></div>
          <div className="grid2"><label>{t("admin.inviteChildName")}<input value={newKid.first_name} onChange={(e) => setNewKid({ ...newKid, first_name: e.target.value })} autoFocus /></label><label>{t("admin.inviteBirth")}<input type="date" value={newKid.birth_date} onChange={(e) => setNewKid({ ...newKid, birth_date: e.target.value })} /></label></div>
          <div className="tiny muted">{t("admin.dancerOn")} <span className="muted">· {t("admin.optional")}</span></div>
          {kidChips(newKid.team_ids, (id) => setNewKid({ ...newKid, team_ids: toggleIn(newKid.team_ids, id) }))}
          <button type="button" className="cta" disabled={!newKid.first_name.trim()} onClick={addDraft} data-testid="kid-add">{t("admin.addChild")}</button>
          <p className="tiny muted" style={{ margin: 0 }}>{t("admin.draftHint")}</p>
        </div>}
      </div>}

      {/* 4. One team list – chips per checked role */}
      {anyRole && <div className="field"><span>{t("admin.teamsHead")}</span>
        <p className="tiny muted" style={{ margin: "0 0 6px" }}>{(dancer || staff) ? t("admin.teamsHint") : t("admin.teamsParentOnly")}</p>
        <div className="teamlist" data-testid="teamlist">
          {groups.map(([style, list]) => { const onCount = list.filter((tm) => (dancer && has(tm.id, "dancer")) || (staff && (has(tm.id, "trainer") || has(tm.id, "assistant"))) || (parent && kidsOn(tm.id).length > 0)).length; const isOpen = openStyles[style] ?? false; /* all styles start folded – the summary says how many are ticked */ return <div key={style} className={"tgroup" + (isOpen ? " open" : "")}>
            <button type="button" className="tgroup-head" onClick={() => setOpenStyles((o) => ({ ...o, [style]: !isOpen }))} aria-expanded={isOpen} data-testid="tgroup-head"><span className="eyebrow">{style}</span><span className="tiny">{onCount ? t("admin.styleOn", { n: onCount, total: list.length }) : t("admin.styleTeams", { n: list.length })}</span><span className="caret">{isOpen ? "⌃" : "⌄"}</span></button>
            {isOpen && list.map((tm) => { const kOn = parent ? kidsOn(tm.id) : []; const on = (dancer && has(tm.id, "dancer")) || (staff && (has(tm.id, "trainer") || has(tm.id, "assistant"))) || kOn.length > 0; return (
              <div key={tm.id} className={"trow" + (on ? " on" : "")} data-team={tm.name}>
                <div className="trow-main"><span className="grow"><span className="tname">{on ? "✓ " : ""}{tm.name}</span><span className="tiny"> · {tm.level}</span></span>
                  <div className="chips tight">
                    {dancer && <button type="button" className={"chip small" + (has(tm.id, "dancer") ? " on" : "")} onClick={() => toggleRole(tm.id, "dancer")}>{t("roles.dancer")}</button>}
                    {parent && kOn.length > 0 && <span className="chip small on static" data-testid="chip-parent">{t("admin.viaChild", { name: kOn.map((k) => byId(k)?.first_name).join(", ") })}</span>}
                    {staff && canStaff && <button type="button" className={"chip small" + (has(tm.id, "trainer") ? " on" : "")} onClick={() => toggleRole(tm.id, "trainer")}>{t("roles.trainer")}</button>}
                    {staff && canStaff && <button type="button" className={"chip small" + (has(tm.id, "assistant") ? " on" : "")} onClick={() => toggleRole(tm.id, "assistant")}>{t("roles.assistant")}</button>}
                  </div></div>
              </div>); })}
          </div>; })}
        </div>
      </div>}

      <div className="row"><button className="cta grow" disabled={busy} onClick={() => void save()} data-testid="member-save">{t("common.save")}</button>
        <button className="ghost danger" onClick={async () => { if (!confirmOff) { setConfirmOff(true); setTimeout(() => setConfirmOff(false), 4000); return; } await api.setPersonStatus(p.id, "inactive"); toast(t("admin.deactivated")); onChanged(); onClose(); }}>{confirmOff ? t("admin.deactivateConfirm") : t("admin.deactivate")}</button></div>
    </Sheet>
  );
}

/** Member card, person without login: set/confirm the e-mail and send the invitation (or send it again). Under-18s become a supervised login under their parent. */
function InviteBlock({ person: p, busy, setBusy, toast, onChanged }: { person: Member; busy: boolean; setBusy: (b: boolean) => void; toast: (m: string) => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(p.email ?? "");
  const [open, setOpen] = useState(!p.email);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const age = p.birth_date ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / 31557600000) : p.birth_year ? new Date().getFullYear() - p.birth_year : null;
  const minor = age != null && age < 18;
  const needsParent = minor && p.parents.length === 0;
  const send = async () => {
    setBusy(true);
    try {
      if (p.email && email.trim().toLowerCase() === p.email.toLowerCase()) await api.resendInvite(p.id); else await api.inviteExisting(p.id, email.trim());
      const st = await api.lastMailStatus(p.id).catch(() => null);
      const ok = st === "sent" || st === "queued"; setNote({ ok, text: ok ? t("admin.inviteSentTo", { email: email.trim() }) : t("admin.inviteResentNoMail") }); toast(ok ? t("admin.inviteResent") : t("admin.inviteResentNoMail")); onChanged();
    } catch (x) { const m = String((x as Error).message ?? x); const text = m.includes("needs parent") ? t("admin.inviteNeedsParent") : m.includes("exists") ? t("admin.inviteExists") : m.includes("too young") ? t("admin.inviteTooYoung") : /function|schema cache|404/i.test(m) ? t("admin.inviteNotReady") : t("common.error") + ": " + m; setNote({ ok: false, text }); toast(text); }
    finally { setBusy(false); }
  };
  if (!open) return <button type="button" className="chip small" style={{ marginTop: 6 }} disabled={busy} data-testid="resend-invite" onClick={() => setOpen(true)}>{p.email ? t("admin.resendInvite") : t("admin.inviteNow")}</button>;
  return (
    <div className="card stack" style={{ marginTop: 8 }} data-testid="invite-existing">
      <div className="eyebrow">{p.email ? t("admin.resendInvite") : t("admin.inviteNow")}</div>
      <p className="tiny muted" style={{ margin: 0 }}>{minor ? t("admin.inviteMinorHint", { name: p.first_name, parent: p.parents[0]?.first_name ?? "–" }) : t("admin.inviteExistingHint")}</p>
      {needsParent && <p className="tiny warn" style={{ margin: 0 }}>{t("admin.inviteNeedsParent")}</p>}
      <div className="row"><input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="invite-email" />
        <button type="button" className="small" disabled={busy || needsParent || !email.includes("@")} onClick={() => void send()} data-testid="invite-send">{t("admin.inviteSend")}</button>
        {p.email && <button type="button" className="ghost small" onClick={() => setOpen(false)}>{t("common.cancel")}</button>}</div>
      {note && <p className={"small " + (note.ok ? "ok" : "warn")} role="status" style={{ margin: 0 }} data-testid="invite-note">{note.text}</p>}
      {!p.birth_date && !p.birth_year && <p className="tiny muted" style={{ margin: 0 }}>{t("admin.inviteNoBirth")}</p>}
    </div>
  );
}
