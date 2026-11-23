import type { ReactNode } from "react";

/** Empty state: a small picture (or a gold symbol) + one sentence + at most one action. Sections that are empty for
 *  everyone should rather be hidden entirely – this is for places where "nothing yet" is itself information. */
export function Empty({ text, art, symbol = "✦", action, testId }: { text: ReactNode; art?: string | null; symbol?: string; action?: ReactNode; testId?: string }) {
  return (
    <div className="empty" data-testid={testId}>
      {art ? <span className="art" style={{ backgroundImage: `url(${art})` }} aria-hidden /> : <span className="art sym" aria-hidden>{symbol}</span>}
      <div><p>{text}</p>{action}</div>
    </div>
  );
}
