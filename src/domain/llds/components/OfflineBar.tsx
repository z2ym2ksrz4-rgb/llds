import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/** A quiet line at the top when the device is offline – what is on screen is the last thing fetched. */
export function OfflineBar() {
  const { t } = useTranslation();
  const [off, setOff] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => { const on = () => setOff(false); const no = () => setOff(true); addEventListener("online", on); addEventListener("offline", no); return () => { removeEventListener("online", on); removeEventListener("offline", no); }; }, []);
  return off ? <div className="offlinebar" role="status" data-testid="offline-bar">{t("common.offline")}</div> : null;
}
