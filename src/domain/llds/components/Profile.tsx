import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Person } from "@/core/api";
import { useAuth } from "@/core/auth";

/** Round avatar: the person's own photo when they have one, otherwise initials. */
export function Avatar({ person, size = "", className = "" }: { person: Pick<Person, "first_name" | "last_name" | "photo_url">; size?: "" | "small" | "big"; className?: string }) {
  const initials = `${person.first_name?.[0] ?? ""}${size === "small" ? "" : person.last_name?.[0] ?? ""}`;
  return person.photo_url
    ? <span className={`avatar ${size} photo ${className}`.trim()} style={{ backgroundImage: `url(${person.photo_url})` }} aria-label={`${person.first_name} ${person.last_name}`} />
    : <span className={`avatar ${size} ${className}`.trim()}>{initials}</span>;
}

/** Settings → "Min profil": picture + "about me" for me and for children without their own login. Both optional. */
export function ProfileSection() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me);
  if (!me) return null;
  const people = [me.person, ...me.children.filter((c) => !c.user_id)];
  return (
    <div className="sec" data-testid="profile-section"><h2>{t("profile.title")}</h2>
      <p className="tiny muted" style={{ marginTop: 0 }}>{t("profile.sub")}</p>
      {people.map((p) => <ProfileCard key={p.id} person={p} mine={p.id === me.person.id} />)}
    </div>
  );
}

function ProfileCard({ person: p, mine }: { person: Person; mine: boolean }) {
  const { t } = useTranslation();
  const refresh = useAuth((s) => s.refresh);
  const file = useRef<HTMLInputElement>(null);
  const [bio, setBio] = useState(p.bio ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2400); };
  const pick = async (f: File | undefined) => { if (!f) return; setBusy(true); try { await api.uploadAvatar(p.id, f); await refresh(); say(t("profile.photoSaved")); } catch (x) { say(t("common.error") + ": " + String((x as Error).message ?? x)); } finally { setBusy(false); } };
  const remove = async () => { setBusy(true); try { await api.updatePerson(p.id, { photo_path: null }); await refresh(); say(t("profile.photoRemoved")); } finally { setBusy(false); } };
  const saveBio = async () => { setBusy(true); try { await api.updatePerson(p.id, { bio: bio.trim() || null }); await refresh(); say(t("profile.bioSaved")); } finally { setBusy(false); } };
  return (
    <div className="card profilecard" data-testid={`profile-${mine ? "me" : p.id}`}>
      <div className="row" style={{ alignItems: "center", gap: 14 }}>
        <Avatar person={p} size="big" />
        <div className="grow"><strong>{p.first_name} {p.last_name}</strong>{!mine && <div className="tiny">{t("profile.childNote")}</div>}
          <div className="row" style={{ marginTop: 6, gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="chip small" disabled={busy} onClick={() => file.current?.click()} data-testid="avatar-pick">{p.photo_url ? t("profile.changePhoto") : t("profile.addPhoto")}</button>
            {p.photo_url && <button type="button" className="chip small danger" disabled={busy} onClick={() => void remove()}>{t("profile.removePhoto")}</button>}
          </div>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} data-testid="avatar-file" />
        </div>
      </div>
      <label className="field" style={{ marginTop: 10 }}><span>{t("profile.bio")}</span>
        <textarea rows={2} maxLength={280} value={bio} placeholder={t("profile.bioPh")} onChange={(e) => setBio(e.target.value)} data-testid="bio-input" />
      </label>
      <div className="row between"><span className="tiny muted">{bio.length}/280 · {t("profile.bioWho")}</span>{bio.trim() !== (p.bio ?? "").trim() && <button type="button" className="small" disabled={busy} onClick={() => void saveBio()} data-testid="bio-save">{t("common.save")}</button>}</div>
      {msg && <p className="ok tiny" role="status" style={{ margin: "6px 0 0" }}>{msg}</p>}
    </div>
  );
}
