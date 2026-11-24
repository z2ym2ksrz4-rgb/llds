import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Member, type Role, type Team } from "@/core/api";

/** Admin → Importér medlemmer: paste or upload a list (Excel copy, CSV/TSV) of dancers, parents and trainers →
 *  preview with validation → one invitation per household (invite_person) or per existing person (invite_existing).
 *  Everyone gets the normal invitation mail and logs in with e-mail + one-time code – no passwords. */

type Row = { n: number; first: string; last: string; birth: string; email: string; phone: string; teams: string[]; role: Role; pFirst: string; pLast: string; pEmail: string; pPhone: string };
type Plan =
  | { kind: "new_own"; row: Row; teamIds: string[] }
  | { kind: "existing"; row: Row; person: Member; teamIds: string[] }
  | { kind: "skip"; row: Row; why: string }
  | { kind: "error"; row: Row; why: string };
type Household = { key: string; parent: { first: string; last: string; email: string; phone: string } | null; rows: { row: Row; teamIds: string[] }[] };

const H = {
  first: ["fornavn", "first name", "firstname", "first"], last: ["efternavn", "last name", "lastname", "last", "surname"], name: ["navn", "name", "danser", "dancer"],
  birth: ["fødselsdato", "foedselsdato", "fødselsdag", "birth", "birthdate", "birth date", "født"], email: ["e-mail", "email", "mail"], phone: ["telefon", "tlf", "mobil", "phone"],
  teams: ["hold", "team", "teams", "holdnavn"], role: ["rolle", "role"],
  pName: ["forælder", "foraelder", "forældre", "parent", "kontakt", "kontaktperson"], pEmail: ["forælder e-mail", "forælder email", "forældre e-mail", "parent email", "kontakt e-mail", "kontakt email", "forælder mail"], pPhone: ["forælder telefon", "forældre telefon", "parent phone", "kontakt telefon", "forælder tlf"],
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-zæøå0-9 ]/g, "").replace(/\s+/g, " ").trim();
const col = (headers: string[], keys: string[]) => { const hs = headers.map(norm); for (const k of keys) { const i = hs.indexOf(norm(k)); if (i >= 0) return i; } for (const k of keys) { const i = hs.findIndex((h) => h.includes(norm(k))); if (i >= 0) return i; } return -1; };
const splitName = (s: string) => { const p = s.trim().split(/\s+/); return p.length > 1 ? { first: p.slice(0, -1).join(" "), last: p[p.length - 1] } : { first: p[0] ?? "", last: "" }; };
const toIso = (s: string) => { const t = s.trim(); if (!t) return ""; let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`; m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/); if (m) { const y = m[3].length === 2 ? (Number(m[3]) > 30 ? "19" : "20") + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; } return t; };
const roleOf = (s: string): Role => { const v = norm(s); if (/tr(æ|ae)ner|trainer|coach/.test(v) && !/hj(æ|ae)lp|assist/.test(v)) return "trainer"; if (/hj(æ|ae)lp|assist/.test(v)) return "assistant"; return "dancer"; };

export function parseList(text: string): { rows: Row[]; headers: string[] } {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return { rows: [], headers: [] };
  const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const cells = (l: string) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
  const headers = cells(lines[0]);
  const ix = { first: col(headers, H.first), last: col(headers, H.last), name: col(headers, H.name), birth: col(headers, H.birth), email: col(headers, H.email), phone: col(headers, H.phone), teams: col(headers, H.teams), role: col(headers, H.role), pName: col(headers, H.pName), pEmail: col(headers, H.pEmail), pPhone: col(headers, H.pPhone) };
  // "e-mail" would also match "forælder e-mail": keep the plain one for the dancer
  if (ix.email === ix.pEmail && ix.email >= 0) ix.email = headers.findIndex((h, i) => i !== ix.pEmail && /mail/.test(norm(h)));
  if (ix.phone === ix.pPhone && ix.phone >= 0) ix.phone = headers.findIndex((h, i) => i !== ix.pPhone && /telefon|tlf|mobil|phone/.test(norm(h)));
  const g = (c: string[], i: number) => (i >= 0 ? c[i] ?? "" : "");
  const rows: Row[] = lines.slice(1).map((l, i) => { const c = cells(l); let first = g(c, ix.first), last = g(c, ix.last); if (!first && ix.name >= 0) ({ first, last } = splitName(g(c, ix.name))); const pn = splitName(g(c, ix.pName));
    return { n: i + 2, first, last, birth: toIso(g(c, ix.birth)), email: g(c, ix.email).toLowerCase(), phone: g(c, ix.phone), teams: g(c, ix.teams).split(/[;|/]| og /).map((x) => x.trim()).filter(Boolean), role: roleOf(g(c, ix.role)), pFirst: pn.first, pLast: pn.last, pEmail: g(c, ix.pEmail).toLowerCase(), pPhone: g(c, ix.pPhone) }; }).filter((r) => r.first);
  return { rows, headers };
}

export function ImportMembers() {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [teams, setTeams] = useState<Team[]>([]); const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false); const [done, setDone] = useState<{ ok: number; fail: { who: string; why: string }[] } | null>(null); const [progress, setProgress] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { void Promise.all([api.listTeams(), api.listMembers()]).then(([tm, m]) => { setTeams(tm); setMembers(m); }); }, []);
  const { rows } = useMemo(() => parseList(text), [text]);
  const findTeam = (name: string) => { const v = norm(name); return teams.find((x) => norm(x.name) === v) ?? teams.find((x) => norm(x.name).startsWith(v) || v.startsWith(norm(x.name))) ?? teams.find((x) => norm(x.name).includes(v)); };
  const findPerson = (first: string, last: string, email: string) => members.find((m) => (email && m.email?.toLowerCase() === email) || (norm(m.first_name) === norm(first) && norm(m.last_name) === norm(last) && last));
  const plans: Plan[] = useMemo(() => rows.map((row) => {
    const unknown = row.teams.filter((n) => !findTeam(n)); if (unknown.length) return { kind: "error", row, why: t("import.unknownTeam", { name: unknown.join(", ") }) };
    const teamIds = row.teams.map((n) => findTeam(n)!.id);
    const ex = findPerson(row.first, row.last, row.email);
    if (ex) { if (ex.user_id) return { kind: "skip", row, why: t("import.hasLogin") }; if (!row.email && !row.pEmail) return { kind: "skip", row, why: t("import.existsNoMail") }; return { kind: "existing", row, person: ex, teamIds }; }
    if (!row.email && !row.pEmail) return { kind: "error", row, why: t("import.noMail") };
    if (!row.email && !row.birth) return { kind: "error", row, why: t("import.noBirth") };
    return { kind: "new_own", row, teamIds };
  }), [rows, teams, members]); // eslint-disable-line react-hooks/exhaustive-deps
  // households: rows sharing a parent e-mail become one invitation with several children
  const households: Household[] = useMemo(() => { const map = new Map<string, Household>(); for (const p of plans) { if (p.kind !== "new_own") continue; const key = p.row.pEmail ? "p:" + p.row.pEmail : "o:" + p.row.n; const h = map.get(key) ?? { key, parent: p.row.pEmail ? { first: p.row.pFirst || t("import.parentFallback"), last: p.row.pLast || p.row.last, email: p.row.pEmail, phone: p.row.pPhone } : null, rows: [] }; h.rows.push({ row: p.row, teamIds: p.teamIds }); map.set(key, h); } return [...map.values()]; }, [plans]); // eslint-disable-line react-hooks/exhaustive-deps
  const existing = plans.filter((p): p is Extract<Plan, { kind: "existing" }> => p.kind === "existing");
  const errors = plans.filter((p) => p.kind === "error").length; const skips = plans.filter((p) => p.kind === "skip").length;
  const total = households.length + existing.length;

  const run = async () => {
    setBusy(true); setProgress(0); const fail: { who: string; why: string }[] = []; let ok = 0; let i = 0;
    for (const h of households) {
      i++; setProgress(i);
      try {
        if (h.parent) await api.invitePerson({ first_name: h.parent.first, last_name: h.parent.last, email: h.parent.email, phone: h.parent.phone, is_parent: true, memberships: [], children: h.rows.map(({ row, teamIds }) => ({ first_name: row.first, last_name: row.last, birth_date: row.birth, memberships: teamIds.map((team_id) => ({ team_id, role: "dancer" as Role })) })) });
        else { const { row, teamIds } = h.rows[0]; await api.invitePerson({ first_name: row.first, last_name: row.last, email: row.email, phone: row.phone, is_parent: false, memberships: teamIds.map((team_id) => ({ team_id, role: row.role })), children: [] }); }
        ok++;
      } catch (e) { fail.push({ who: h.parent ? h.parent.email : h.rows[0].row.first + " " + h.rows[0].row.last, why: (e as Error).message }); }
    }
    for (const p of existing) {
      i++; setProgress(i);
      try {
        const have = p.person.memberships.map((m) => ({ team_id: m.team_id, role: m.role as Role })); const add = p.teamIds.filter((team_id) => !have.some((m) => m.team_id === team_id && m.role === p.row.role)).map((team_id) => ({ team_id, role: p.row.role }));
        if (add.length) await api.setMemberships(p.person.id, [...have, ...add]);
        await api.inviteExisting(p.person.id, p.row.email || p.row.pEmail); ok++;
      }
      catch (e) { fail.push({ who: `${p.row.first} ${p.row.last}`, why: (e as Error).message }); }
    }
    setDone({ ok, fail }); setBusy(false); setMembers(await api.listMembers().catch(() => members));
  };
  const template = "data:text/csv;charset=utf-8," + encodeURIComponent("Fornavn;Efternavn;Fødselsdato;E-mail;Telefon;Hold;Rolle;Forælder;Forælder e-mail;Forælder telefon\nEmma;Jensen;12-03-2014;;;Mini Angels;Danser;Mette Jensen;mette@eksempel.dk;12345678\nLukas;Nielsen;05-09-2009;lukas@eksempel.dk;87654321;The AXIS; Teknik The AXIS;Danser;;;\nSofie;Dahl;;sofie@eksempel.dk;;Disco;Træner;;;\n");
  return (
    <section className="screen">
      <header className="topbar"><h1 className="display">{t("import.title")}</h1></header>
      <p className="small muted" style={{ marginTop: 0 }}>{t("import.intro")}</p>
      <div className="card"><div className="eyebrow">{t("import.step1")}</div>
        <p className="tiny muted" style={{ margin: "0 0 8px" }}>{t("import.columns")}</p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}><a className="linklike small" href={template} download="llds-medlemmer-skabelon.csv">{t("import.template")} ↓</a><button type="button" className="ghost small" onClick={() => file.current?.click()}>{t("import.pickFile")}</button></div>
        <input ref={file} type="file" accept=".csv,.tsv,.txt" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); e.target.value = ""; }} />
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("import.paste")} data-testid="import-text" style={{ marginTop: 8, fontFamily: "ui-monospace, monospace", fontSize: 12 }} />
      </div>
      {rows.length > 0 && (
        <div className="card" data-testid="import-preview"><div className="eyebrow">{t("import.step2", { n: rows.length })}</div>
          <p className="tiny muted" style={{ margin: "0 0 8px" }}>{t("import.summary", { households: households.filter((h) => h.parent).length, own: households.filter((h) => !h.parent).length, existing: existing.length, skips, errors })}</p>
          <div className="list importlist">
            {plans.map((p) => <div key={p.row.n} className="item" style={{ alignItems: "flex-start" }}>
              <span className="grow"><b>{p.row.first} {p.row.last}</b>{p.row.birth && <span className="tiny"> · {p.row.birth}</span>}{p.row.role !== "dancer" && <span className="chip small" style={{ marginLeft: 6 }}>{t(`roles.${p.row.role}`)}</span>}
                <div className="tiny">{p.row.teams.join(", ") || "—"}{p.row.pEmail ? ` · ${t("import.via", { name: p.row.pFirst || p.row.pEmail })}` : p.row.email ? ` · ${p.row.email}` : ""}</div>
                {(p.kind === "error" || p.kind === "skip") && <div className={"tiny " + (p.kind === "error" ? "warn" : "muted")}>{p.why}</div>}</span>
              <span className={"chip small " + (p.kind === "new_own" ? "sage" : p.kind === "existing" ? "gold" : p.kind === "skip" ? "" : "rose")}>{t(`import.kind.${p.kind}`)}</span>
            </div>)}
          </div>
          {progress > 0 && busy && <p className="small">{t("import.progress", { i: progress, n: total })}</p>}
          {done ? <div className="card" style={{ margin: "8px 0 0" }}><b>{t("import.done", { ok: done.ok })}</b>{done.fail.length > 0 && <ul className="small" style={{ margin: "6px 0 0", paddingLeft: 18 }}>{done.fail.map((f, i) => <li key={i}>{f.who}: {f.why}</li>)}</ul>}<p className="tiny muted" style={{ margin: "6px 0 0" }}>{t("import.afterwards")}</p></div>
            : <button type="button" className="cta" disabled={busy || total === 0} data-testid="import-run" onClick={() => void run()} style={{ marginTop: 10 }}>{t("import.run", { n: total })}</button>}
        </div>
      )}
    </section>
  );
}
