import React from "react";

const CDN = "https://unpkg.com/lucide-static@0.544.0/icons/";
const cache = new Map();

/** SUBSTITUTED ICON SET. The AutoCare+ codebase ships no icon assets — the
 *  React Native apps use emoji glyphs inline (🏠 🚗 👤 🔧 📷 ⇅) and the web
 *  console uses text arrows. Lucide (2px stroke, square cap) is the closest
 *  match to the industrial register the design language calls for. Swap the CDN
 *  constant if the team adopts a different set.
 *
 *  The SVG source is fetched once per name and inlined, with stroke set to
 *  currentColor, so every glyph inherits the text colour beside it. */
export function Icon({ name, size = 20, color = "currentColor", strokeWidth = 2, style, ...rest }) {
  const [markup, setMarkup] = React.useState(() => cache.get(name) || null);

  React.useEffect(() => {
    let live = true;
    if (cache.has(name)) { setMarkup(cache.get(name)); return; }
    fetch(`${CDN}${name}.svg`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(name))))
      .then((t) => {
        const inner = t.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "");
        cache.set(name, inner);
        if (live) setMarkup(inner);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [name]);

  return (
    <svg
      aria-hidden focusable="false" role="presentation"
      viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      data-icon={name}
      style={{ display: "inline-block", flex: "none", verticalAlign: "middle", ...style }}
      dangerouslySetInnerHTML={{ __html: markup || "" }}
      {...rest}
    />
  );
}
