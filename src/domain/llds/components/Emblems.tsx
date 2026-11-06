import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Badge, type PersonBadge } from "@/core/api";
import { Sheet } from "./Sheet";
import { ago } from "../lib/time";

/** One emblem: emoji in a gold ring. size "sm" for inline strips, "lg" for the Home row. */
export function Emblem({ b, size = "lg", onClick }: { b: PersonBadge; size?: "sm" | "lg"; onClick?: () => void }) {
  return (
    <button className={"emblem " + size} title={b.name} aria-label={b.name} onClick={onClick} data-testid="emblem">
      <span className="e">{b.emoji}</span>{size === "lg" && <span className="n">{b.name}</span>}
    </button>
  );
}

/** Emblem strip for a person (dancer list, Home). */
export function EmblemRow({ badges, size = "lg" }: { badges: PersonBadge[]; size?: "sm" | "lg" }) {
  const [open, setOpen] = useState<PersonBadge | null>(null);
  if (!badges.length) return null;
  return (
    <>
      <div className={"emblems " + size}>{badges.map((b) => <Emblem key={b.id} b={b} size={size} onClick={() => setOpen(b)} />)}</div>
      {open && <EmblemSheet b={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export function EmblemSheet({ b, onClose, onRemove }: { b: PersonBadge; onClose: () => void; onRemove?: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet onClose={onClose} eyebrow={b.kind === "auto" ? t("badges.auto") : t("badges.manual")} title={`${b.emoji} ${b.name}`}>
      <p className="muted">{b.description}</p>
      <p className="small">{b.person_name}{b.team_name ? ` · ${b.team_name}` : ""}{b.period ? ` · ${b.period}` : ""}</p>
      {b.note && <p className="small" style={{ fontStyle: "italic" }}>“{b.note}”</p>}
      <p className="tiny">{b.given_by_name ? t("badges.givenBy", { name: b.given_by_name }) : t("badges.earned")} · {ago(b.created_at)}</p>
      {onRemove && <button className="ghost small" onClick={onRemove}>{t("badges.remove")}</button>}
    </Sheet>
  );
}

/** Staff: give an emblem to a dancer. */
export function GiveEmblemSheet({ personId, personName, teamId, onClose, onGiven }: { personId: string; personName: string; teamId: string; onClose: () => void; onGiven: (b: Badge) => void }) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<Badge[]>([]);
  const [pick, setPick] = useState<Badge | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void api.listBadges().then(setCatalog); }, []);
  const manual = catalog.filter((b) => b.kind === "manual");
  return (
    <Sheet onClose={onClose} eyebrow={t("badges.give")} title={personName}>
      <div className="chips" data-testid="badge-picker">{manual.map((b) => <button key={b.id} className={"chip" + (pick?.id === b.id ? " on" : "")} onClick={() => setPick(b)}>{b.emoji} {b.name}</button>)}</div>
      {pick && <p className="tiny">{pick.description}{pick.monthly ? ` · ${t("badges.monthlyHint")}` : ""}</p>}
      <input placeholder={t("badges.notePh")} value={note} onChange={(e) => setNote(e.target.value)} />
      {err && <p className="error small">{err}</p>}
      <button className="cta" data-testid="badge-save" disabled={!pick} onClick={async () => { if (!pick) return; try { await api.giveBadge(personId, pick.id, teamId, note.trim()); onGiven(pick); } catch (e) { setErr((e as Error).message); } }}>{t("badges.giveBtn")}</button>
    </Sheet>
  );
}
