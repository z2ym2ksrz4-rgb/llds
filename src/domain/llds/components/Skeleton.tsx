/** Grey placeholder rows while a list is loading – so "loading" never looks like "empty". */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="skel" aria-busy="true" aria-live="polite" data-testid="skeleton">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skel-row" style={{ width: `${92 - (i % 3) * 14}%` }} />)}</div>;
}
