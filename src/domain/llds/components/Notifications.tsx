import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, type Notification } from "@/core/api";
import { Sheet } from "./Sheet";
import { Icon } from "./Icons";
import { ago } from "../lib/time";

const ICON: Record<string, string> = { message: "✉️", booking: "🏠", substitute: "🙋", session: "⚠️", event: "📅", milestone: "🏅", order: "🛍", punch: "🎟", post: "💬" };

/** Bell with unread count; the in-app inbox. Native push arrives with the store build – the rows are the same. */
export function Bell() {
  const { t } = useTranslation();
  const [list, setList] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => setList(await api.listNotifications()), []);
  useEffect(() => { void load(); const i = setInterval(() => void load(), 60_000); return () => clearInterval(i); }, [load]);
  const unread = list.filter((n) => !n.read_at).length;
  const openIt = async () => { setOpen(true); if (unread) { await api.markNotificationsRead(); setTimeout(() => void load(), 400); } };
  return (
    <>
      <button className="bell" aria-label={t("notif.title")} data-testid="bell" onClick={() => void openIt()}><Icon name="bell" />{unread > 0 && <span className="badge" data-testid="badge">{unread}</span>}</button>
      {open && (
        <Sheet onClose={() => setOpen(false)} eyebrow={t("notif.eyebrow")} title={t("notif.title")}>
          <div className="list">
            {list.map((n) => <div key={n.id} className={"item" + (n.read_at ? "" : " unread")} data-testid="notif"><span className="avatar small">{ICON[n.kind] ?? "•"}</span><span className="grow"><div>{n.title}</div>{n.body && <div className="tiny">{n.body}</div>}</span><span className="tiny">{ago(n.created_at)}</span></div>)}
            {!list.length && <p className="muted">{t("notif.empty")}</p>}
          </div>
        </Sheet>
      )}
    </>
  );
}
