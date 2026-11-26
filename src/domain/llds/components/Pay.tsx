import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import { Sheet } from "./Sheet";
import appConfig from "../../../../app.config.json";

/** MobilePay payment: deep link on the phone, QR on a bigger screen, then "I have paid" → Line confirms in Admin. */
export function PaySheet({ amount, reference, onPaid, onClose, title }: { amount: number; reference: string; onPaid: () => Promise<void>; onClose: () => void; title: string }) {
  const { t } = useTranslation();
  const mp = appConfig.mobilepay;
  const link = `mobilepay://send?phone=${mp.number}&amount=${amount}&comment=${encodeURIComponent(reference)}`;
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [went, setWent] = useState(false);   // tapped "Åbn MobilePay" – when they come back, "Jeg har betalt" is the obvious next step
  const [back, setBack] = useState(false);
  useEffect(() => { if (!went) return; const f = () => { if (document.visibilityState === "visible") setBack(true); }; document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f); }, [went]);
  useEffect(() => { void QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: "#0a0a0b", light: "#f2efe8" } }).then(setQr); }, [link]);
  return (
    <Sheet onClose={onClose} eyebrow={t("pay.eyebrow")} title={title}>
      <div className="pay">
        <div className="pay-amount"><span className="display">{amount} kr.</span><span className="tiny">{t("pay.to")} {mp.name} · {mp.number}</span></div>
        {qr && <img className="qr" src={qr} alt="MobilePay QR" />}
        <a className={back ? "ghost mp" : "cta mp"} href={link} data-testid="mp-link" onClick={() => setWent(true)}>{t("pay.open")}</a>
        <p className="tiny">{t("pay.reference")}: <code>{reference}</code></p>
        <p className="tiny">{t("pay.hint")}</p>
        {back && <p className="small ok" role="status" data-testid="pay-back" style={{ margin: "4px 0 0" }}>{t("pay.backHint")}</p>}
        <button className={back ? "cta" : "ghost"} id="pay-claim" disabled={busy} onClick={async () => { setBusy(true); try { await onPaid(); } finally { setBusy(false); } }}>{t("pay.claim")}</button>
      </div>
    </Sheet>
  );
}
