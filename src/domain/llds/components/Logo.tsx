/** LL Dance Studio logo – the original artwork from lldancestudio.dk (public/brand). "light" = white version for dark surfaces. */
const base = import.meta.env.BASE_URL;
export function Logo({ size = 180, wordmark = true, variant = "light" }: { size?: number; wordmark?: boolean; variant?: "light" | "dark" }) {
  const file = wordmark ? (variant === "light" ? "logo-white.png" : "logo.png") : (variant === "light" ? "mark-white.png" : "mark.png");
  return <img className="brand" src={`${base}brand/${file}`} width={size} alt="LL Dance Studio" style={{ height: "auto" }} />;
}
