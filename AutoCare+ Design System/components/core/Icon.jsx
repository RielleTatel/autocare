import React from "react";

const CDN = "https://unpkg.com/lucide-static@0.544.0/icons/";

/** SUBSTITUTED ICON SET. The AutoCare+ codebase ships no icon assets — the
 *  React Native apps use emoji glyphs inline (🏠 🚗 👤 🔧 📷 ⇅) and the web
 *  console uses text arrows. Lucide (2px stroke, square cap) is the closest
 *  match to the industrial register the design language calls for. Swap the CDN
 *  constant if the team adopts a different set.
 *  Recoloured via CSS mask so the glyph always takes currentColor. */
export function Icon({ name, size = 20, color = "currentColor", strokeWidth, style, ...rest }) {
  return (
    <span aria-hidden role="presentation"
      style={{
        display: "inline-block", width: size, height: size, flex: "none",
        backgroundColor: color,
        WebkitMaskImage: `url(${CDN}${name}.svg)`, maskImage: `url(${CDN}${name}.svg)`,
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskSize: "contain", maskSize: "contain",
        WebkitMaskPosition: "center", maskPosition: "center",
        ...style,
      }}
      data-icon={name} data-stroke={strokeWidth} {...rest} />
  );
}
