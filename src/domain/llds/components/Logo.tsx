/** LL Dance Studio logo – the original artwork from lldancestudio.dk (public/brand). "light" = white version for dark surfaces.
 * draw=true adds a slow gold light sweep masked to the logo shape (loading screen, login). */
const base = import.meta.env.BASE_URL;
export function Logo({ size = 180, wordmark = true, variant = "light", draw = false }: { size?: number; wordmark?: boolean; variant?: "light" | "dark"; draw?: boolean }) {
  const file = wordmark ? (variant === "light" ? "logo-white.png" : "logo.png") : (variant === "light" ? "mark-white.png" : "mark.png");
  const src = `${base}brand/${file}`;
  const img = <img className="brand" src={src} width={size} alt="LL Dance Studio" style={{ height: "auto" }} />;
  return draw ? <span className="logo-draw" style={{ ["--mask" as string]: `url(${src})` }}>{img}</span> : img;
}
