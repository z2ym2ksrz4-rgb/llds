import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

/** Shows "new version – update" when public/version.json (no-store) differs from the build this bundle was made with. Checked on load, every 5 min and when the app comes back to the foreground. */
export function UpdateBanner() {
  const { t } = useTranslation();
  const [newer, setNewer] = useState(false);
  useEffect(() => {
    if (__BUILD__ === "dev") return;
    const check = async () => { try { const r = await fetch(`${import.meta.env.BASE_URL}version.json?x=${Date.now()}`, { cache: "no-store" }); const j = await r.json(); if (j.build && j.build !== __BUILD__) setNewer(true); } catch { /* offline */ } };
    void check(); const id = setInterval(check, 5 * 60_000); const vis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", vis); return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, []);
  if (!newer) return null;
  return <button className="updatebar" onClick={async () => { try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } catch { /* ignore */ } location.reload(); }}>{t("common.newVersion")}</button>;
}
