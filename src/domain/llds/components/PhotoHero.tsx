import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { focusStyle } from "../lib/art";
import type { Focus } from "@/core/api";

/** A real photo (Line's) vs. catalog art/own uploads: WordPress URLs from the old site. */
export const isSitePhoto = (url: string | null | undefined) => !!url && /^https?:\/\/[^/]*lldancestudio\.dk\//.test(url);
/** WordPress thumbnails ("…-477x1024.jpg") → the original; the <img> falls back to the thumbnail if the original is missing. */
export const hiRes = (url: string) => url.replace(/-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp)(?:$|\?))/i, "");

/**
 * Hero media that never crops a photo away: the sharp image is shown whole (object-fit: contain, anchored at the top),
 * a blurred, enlarged copy fills the rest of the frame and the page gradient fades it out at the bottom.
 * Catalog art and photos with an admin-set focus point still use the classic cover crop (that is what the focus is for).
 */
export function HeroMedia({ src, focus, className = "", style, blurClass = "" }: { src: string; focus?: Focus | null; className?: string; style?: CSSProperties; blurClass?: string }) {
  const photo = isSitePhoto(src) && !focus;
  const [img, setImg] = useState(() => (photo ? hiRes(src) : src));
  useEffect(() => { setImg(photo ? hiRes(src) : src); }, [src, photo]);   // follows the team picker (new src → new image, hi-res attempt again)
  if (!photo) return <span className={"bg " + className} style={focusStyle(focus, { backgroundImage: `url(${src})`, ...style })} />;
  return (
    <>
      <span className={"bg blurbg " + blurClass} style={{ backgroundImage: `url(${src})`, ...style }} aria-hidden />
      <img className={"pic " + className} src={img} alt="" onError={() => { if (img !== src) setImg(src); }} onLoad={(e) => { const el = e.currentTarget; const host = el.closest<HTMLElement>(".homehero, .hero.photo"); if (host && el.naturalWidth && el.naturalHeight) host.style.setProperty("--hero-ar", String(el.naturalWidth / el.naturalHeight)); }} draggable={false} />
    </>
  );
}
