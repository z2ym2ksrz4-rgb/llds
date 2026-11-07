import { useEffect, useRef, useState, type ReactNode } from "react";

/** A list box that shows the first `rows` items (default 3) and scrolls for the rest. A soft fade + chevron at the bottom says "there is more"; it disappears at the end.
 * Wrap the items (`.item` children) – the box measures the first rows itself, so rows may have different heights. */
export function ScrollList({ children, rows = 3, className = "", testId }: { children: ReactNode; rows?: number; className?: string; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState<number | undefined>(undefined);
  const [more, setMore] = useState(false);
  const measure = () => {
    const el = ref.current; if (!el) return;
    const items = Array.from(el.children).filter((c) => !c.classList.contains("scroll-more")) as HTMLElement[];
    if (items.length <= rows) { setMax(undefined); setMore(false); return; }
    const first = items[0]; const last = items[rows - 1];
    const h = last.offsetTop + last.offsetHeight - first.offsetTop + 2;
    setMax(h); setMore(el.scrollTop + h < el.scrollHeight - 4);
  };
  useEffect(() => { measure(); const ro = new ResizeObserver(measure); if (ref.current) ro.observe(ref.current); return () => ro.disconnect(); }); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className={"card list scrolllist " + className} data-testid={testId} data-more={more || undefined} style={max ? { maxHeight: max } : undefined}
      onScroll={(e) => { const el = e.currentTarget; setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 4); }}>
      {children}
      {more && <div className="scroll-more" aria-hidden="true"><span>⌄</span></div>}
    </div>
  );
}
