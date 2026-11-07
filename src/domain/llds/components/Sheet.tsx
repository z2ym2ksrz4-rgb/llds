import type { ReactNode } from "react";

/** Bottom sheet on phone, centered dialog on desktop. Click the backdrop to close. */
export function Sheet({ onClose, children, title, eyebrow, photo }: { onClose: () => void; children: ReactNode; title?: string; eyebrow?: string; photo?: string | null }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className={"sheet" + (photo ? " withphoto" : "")} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {photo ? (
          <div className="hero photo kb sheet-hero" data-testid="sheet-hero"><span className="bg warm" style={{ backgroundImage: `url(${photo})` }} />
            <button className="sheet-close" aria-label="Luk" onClick={onClose}>×</button>
            <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}{title && <h2 className="display">{title}</h2>}</div>
          </div>
        ) : (<>
          <div className="handle" />
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          {title && <h2 className="display" style={{ margin: 0 }}>{title}</h2>}
        </>)}
        {children}
      </div>
    </div>
  );
}

export function Toast({ msg }: { msg: string | null }) { return msg ? <div className="toast" role="status">{msg}</div> : null; }
