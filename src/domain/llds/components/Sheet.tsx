import type { ReactNode } from "react";

/** Bottom sheet on phone, centered dialog on desktop. Click the backdrop to close. */
export function Sheet({ onClose, children, title, eyebrow }: { onClose: () => void; children: ReactNode; title?: string; eyebrow?: string }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="handle" />
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && <h2 className="display" style={{ margin: 0 }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Toast({ msg }: { msg: string | null }) { return msg ? <div className="toast" role="status">{msg}</div> : null; }
