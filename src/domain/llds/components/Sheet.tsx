import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

/** Bottom sheet on phone, centered dialog on desktop.
 *  Phone behaviour (like iOS/Maps): opens at least half the screen; drag the handle/header up to make it as tall as you like,
 *  drag down (from the header, or from the list when it is scrolled to the top) to close; × in the corner, backdrop tap and
 *  the Escape key close it too. The content scrolls inside the sheet. */
export function Sheet({ onClose, children, title, eyebrow, photo }: { onClose: () => void; children: ReactNode; title?: string; eyebrow?: string; photo?: string | null }) {
  const { t } = useTranslation();
  const bodyRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);          // current height in px while/after dragging (null = natural, min 50dvh)
  const [dy, setDy] = useState(0);                           // translateY while dragging down to close
  const [closing, setClosing] = useState(false);
  const drag = useRef<{ y0: number; h0: number; t0: number; mode: "resize" | "close" | null; fromBody: boolean } | null>(null);
  const phone = () => matchMedia("(max-width: 899px)").matches;
  const vh = () => window.innerHeight;
  const MIN = () => Math.round(vh() * 0.5), MAX = () => Math.round(vh() * 0.94);

  const close = () => { if (closing) return; setClosing(true); setTimeout(onClose, 180); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, []);
  // iOS: stop the list from rubber-banding while we are dragging the sheet (React's touch listeners are passive, so do it natively)
  useEffect(() => { const b = bodyRef.current; if (!b) return; const f = (e: TouchEvent) => { if (drag.current?.mode) e.preventDefault(); }; b.addEventListener("touchmove", f, { passive: false }); return () => b.removeEventListener("touchmove", f); }, []);

  const start = (e: React.PointerEvent, fromBody: boolean) => {
    if (!phone() || e.pointerType === "mouse" && fromBody) return;
    const el = sheetRef.current; if (!el) return;
    drag.current = { y0: e.clientY, h0: el.getBoundingClientRect().height, t0: Date.now(), mode: null, fromBody };
    if (!fromBody) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const dragged = useRef(0); // time of the last drag end – the click that follows a drag must not close the sheet
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const delta = e.clientY - d.y0;
    if (!d.mode) {
      if (Math.abs(delta) < 6) return;
      if (d.fromBody) { const b = bodyRef.current; if (!b || b.scrollTop > 0 || delta < 0) { drag.current = null; return; } d.mode = "close"; }
      else d.mode = delta < 0 || d.h0 > MIN() + 10 ? "resize" : "close";
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    if (d.mode === "resize") {
      const next = d.h0 - delta;
      if (next < MIN() - 40) { d.mode = "close"; d.y0 = e.clientY; d.h0 = MIN(); setH(MIN()); return; }
      setH(Math.min(MAX(), Math.max(MIN(), next)));
      if (e.cancelable) e.preventDefault();
    } else { setDy(Math.max(0, delta)); if (e.cancelable) e.preventDefault(); }
  };
  const end = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null; if (!d || !d.mode) return;
    dragged.current = Date.now();
    const dt = Math.max(1, Date.now() - d.t0); const v = (e.clientY - d.y0) / dt; // px/ms
    if (d.mode === "close") { if (dy > 110 || v > 0.6) { close(); return; } setDy(0); }
    else { const el = sheetRef.current; const cur = el?.getBoundingClientRect().height ?? MIN(); if (v < -0.5) setH(MAX()); else if (v > 0.5) setH(MIN()); else setH(cur > (MIN() + MAX()) / 2 ? MAX() : cur <= MIN() + 10 ? null : cur); }
  };

  const style: React.CSSProperties = {};
  if (h !== null) style.height = h;
  if (dy) style.transform = `translateY(${dy}px)`;
  if (drag.current?.mode) style.transition = "none";
  const head = photo ? (
    <div className="hero photo kb sheet-hero" data-testid="sheet-hero"><span className="bg warm" style={{ backgroundImage: `url(${photo})` }} />
      <div className="handle" />
      <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}{title && <h2 className="display">{title}</h2>}</div>
    </div>
  ) : (
    <div className="sheet-head">
      <div className="handle" />
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      {title && <h2 className="display" style={{ margin: 0 }}>{title}</h2>}
    </div>
  );
  return createPortal(
    <div className={"sheet-bg" + (closing ? " closing" : "")} onClick={() => { if (Date.now() - dragged.current > 300) close(); }} data-testid="sheet-bg">
      <div ref={sheetRef} className={"sheet" + (photo ? " withphoto" : "") + (h !== null ? " sized" : "")} style={style} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sheet-close" aria-label={t("common.close")} data-testid="sheet-close" onClick={close}>×</button>
        <div className="sheet-grab" onPointerDown={(e) => start(e, false)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>{head}</div>
        <div ref={bodyRef} className="sheet-body" onPointerDown={(e) => start(e, true)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Toast({ msg }: { msg: string | null }) { return msg ? <div className="toast" role="status">{msg}</div> : null; }
