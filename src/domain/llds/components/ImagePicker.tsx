import { useTranslation } from "react-i18next";
import { CATALOG, catalogFor, catalogUrl } from "../lib/catalog";

/** Grid of catalogue images; value = catalogue key (or null = automatic). */
export function ImagePicker({ value, onChange, tag, allowNone = true }: { value: string | null; onChange: (key: string | null) => void; tag: "event" | "team" | "post"; allowNone?: boolean }) {
  const { t } = useTranslation();
  const list = catalogFor(tag).length ? catalogFor(tag) : CATALOG;
  return (
    <div className="field"><span>{t("catalog.pick")}</span>
      <div className="imgpick" data-testid="image-picker">
        {allowNone && <button className={"ip" + (value == null ? " on" : "")} onClick={() => onChange(null)}><span className="auto">✦</span><small>{t("catalog.auto")}</small></button>}
        {list.map((c) => <button key={c.key} className={"ip" + (value === c.key ? " on" : "")} style={{ backgroundImage: `url(${catalogUrl(c.key)})` }} onClick={() => onChange(c.key)} title={c.title} aria-label={c.title} data-testid="image-option"><small>{c.title}</small></button>)}
      </div>
      <div className="tiny">{t("catalog.hint", { n: list.length })}</div>
    </div>
  );
}
