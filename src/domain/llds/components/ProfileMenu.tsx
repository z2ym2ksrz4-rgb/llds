import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/core/auth";
import { useNav } from "@/core/nav";
import { Sheet } from "./Sheet";
import { Bell } from "./Notifications";

/** Top-right of every main screen: bell + avatar. Avatar opens the profile menu (shop, punch cards, milestones, settings, sign out). */
export function TopRight() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.me)!;
  const signOut = useAuth((s) => s.signOut);
  const setTab = useNav((s) => s.setTab);
  const [open, setOpen] = useState(false);
  return (
    <div className="row">
      <Bell />
      <button className="avatar" aria-label={t("nav.profile")} data-testid="avatar" onClick={() => setOpen(true)}>{me.person.first_name[0]}{me.person.last_name[0] ?? ""}</button>
      {open && (
        <Sheet onClose={() => setOpen(false)} eyebrow={me.person.email ?? ""} title={`${me.person.first_name} ${me.person.last_name}`}>
          <div className="list">
            {me.person.is_admin && <button className="item" onClick={() => { setOpen(false); setTab("admin"); }}><span className="grow">{t("nav.admin")}<div className="tiny">{t("more.adminSub")}</div></span><span className="gold">›</span></button>}
            <button className="item" data-testid="menu-more" onClick={() => { setOpen(false); setTab("more"); }}><span className="grow">{t("nav.more")}<div className="tiny">{t("more.menuSub")}</div></span><span className="gold">›</span></button>
          </div>
          <button className="ghost" onClick={() => void signOut()}>{t("common.signOut")}</button>
        </Sheet>
      )}
    </div>
  );
}
