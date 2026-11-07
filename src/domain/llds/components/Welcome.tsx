import { useEffect, useState } from "react";
import { useAuth } from "@/core/auth";
import { Logo } from "./Logo";

/** First open of the day: the logo is drawn in gold over black for ~2 s, then fades into Home. Never blocks taps. */
const KEY = "llds_welcome";
export function Welcome() {
  const phase = useAuth((s) => s.phase);
  const [show, setShow] = useState(false); const [out, setOut] = useState(false);
  useEffect(() => {
    if (phase !== "ready") return;
    const today = new Date().toDateString(); let seen = ""; try { seen = localStorage.getItem(KEY) ?? ""; } catch { /* ignore */ }
    if (seen === today) return;
    try { localStorage.setItem(KEY, today); } catch { /* ignore */ }
    setShow(true); const a = setTimeout(() => setOut(true), 2100); const b = setTimeout(() => setShow(false), 2900);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [phase]);
  if (!show) return null;
  return <div className={"welcome" + (out ? " out" : "")} aria-hidden="true" data-testid="welcome"><Logo size={190} draw /></div>;
}
