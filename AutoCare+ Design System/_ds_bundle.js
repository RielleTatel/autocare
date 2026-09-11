/* @ds-bundle: {"format":4,"namespace":"AutoCareDesignSystem_2155ba","components":[{"name":"AttentionCard","sourcePath":"components/attention/AttentionCard.jsx"},{"name":"SEVERITY","sourcePath":"components/attention/AttentionItemRow.jsx"},{"name":"AttentionItemRow","sourcePath":"components/attention/AttentionItemRow.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"EmptyState","sourcePath":"components/core/EmptyState.jsx"},{"name":"FormField","sourcePath":"components/core/FormField.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"Plate","sourcePath":"components/core/Plate.jsx"},{"name":"StatusPill","sourcePath":"components/core/StatusPill.jsx"},{"name":"StatusChoice","sourcePath":"components/field/StatusChoice.jsx"},{"name":"StatusChip","sourcePath":"components/field/StatusChoice.jsx"},{"name":"SyncBanner","sourcePath":"components/field/SyncBanner.jsx"},{"name":"BottomSheet","sourcePath":"components/shell/BottomSheet.jsx"},{"name":"MeasuredRow","sourcePath":"components/shell/BottomSheet.jsx"},{"name":"TabBar","sourcePath":"components/shell/TabBar.jsx"},{"name":"PlanCard","sourcePath":"components/subscription/PlanCard.jsx"},{"name":"BANDS","sourcePath":"components/vhs/BandChip.jsx"},{"name":"BandChip","sourcePath":"components/vhs/BandChip.jsx"},{"name":"CategoryBar","sourcePath":"components/vhs/CategoryBar.jsx"},{"name":"ScoreGauge","sourcePath":"components/vhs/ScoreGauge.jsx"},{"name":"StarRating","sourcePath":"components/vhs/StarRating.jsx"}],"sourceHashes":{"components/attention/AttentionCard.jsx":"e81aaa732c1c","components/attention/AttentionItemRow.jsx":"f7e8d4414204","components/core/Button.jsx":"c20308b0abbe","components/core/Card.jsx":"91e5332d3bc1","components/core/EmptyState.jsx":"f11339e9884d","components/core/FormField.jsx":"f5acfa81d724","components/core/Icon.jsx":"351b757e5215","components/core/Plate.jsx":"5016914d0b78","components/core/StatusPill.jsx":"6d9617c9a7d4","components/field/StatusChoice.jsx":"07a078fe10ff","components/field/SyncBanner.jsx":"de8501f09dab","components/shell/BottomSheet.jsx":"d98206ae8e35","components/shell/TabBar.jsx":"0f97df0f8cf0","components/subscription/PlanCard.jsx":"3fb58365bf33","components/vhs/BandChip.jsx":"936d15aa5eb0","components/vhs/CategoryBar.jsx":"10d1ff63728e","components/vhs/ScoreGauge.jsx":"62e0af9b54b8","components/vhs/StarRating.jsx":"2f484510e1a5","ui_kits/certificate/CertificateScreens.jsx":"3660d56d468c","ui_kits/field-app/InspectionScreens.jsx":"dd0022a488fd","ui_kits/field-app/TaskScreens.jsx":"153fecaf3cf5","ui_kits/field-app/data.jsx":"e81a2fb236ec","ui_kits/member-app/BookingFlow.jsx":"d7fa9669e339","ui_kits/member-app/HealthScoreScreen.jsx":"7072da4f9d09","ui_kits/member-app/HomeScreen.jsx":"851ceac65d73","ui_kits/member-app/OtherScreens.jsx":"14e34cef2d48","ui_kits/member-app/RoadsideScreens.jsx":"c41b8d02781b","ui_kits/member-app/data.jsx":"f6cededddd35","ui_kits/staff-web/AdminScreens.jsx":"1b5b3779005d","ui_kits/staff-web/StaffScreens.jsx":"cb0a39f5984f","ui_kits/staff-web/data.jsx":"4723edad18b9"},"inlinedExternals":[],"unexposedExports":[{"name":"bandForScore","sourcePath":"components/vhs/BandChip.jsx"}]} */

(() => {

const __ds_ns = (window.AutoCareDesignSystem_2155ba = window.AutoCareDesignSystem_2155ba || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/attention/AttentionItemRow.jsx
try { (() => {
const SEVERITY = {
  CRITICAL: {
    color: "var(--ac-sev-critical)",
    label: "Critical"
  },
  ATTENTION: {
    color: "var(--ac-sev-attention)",
    label: "Needs attention"
  },
  MONITOR: {
    color: "var(--ac-sev-monitor)",
    label: "Monitor"
  },
  INFO: {
    color: "var(--ac-sev-info)",
    label: "Info"
  }
};

/** One open item. Severity is a 5px left edge plus the word — the row never
 *  relies on colour alone. Tapping deep-links to the source screen. */
function AttentionItemRow({
  title,
  body,
  plate,
  severity = "INFO",
  showPlate,
  onClick,
  style
}) {
  const s = SEVERITY[severity] || SEVERITY.INFO;
  return /*#__PURE__*/React.createElement("div", {
    role: "button",
    tabIndex: 0,
    onClick: onClick,
    style: {
      background: "var(--ac-surface)",
      border: "1px solid var(--ac-line)",
      borderLeft: `var(--ac-border-accent-row) solid ${s.color}`,
      borderRadius: "var(--ac-radius-md)",
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-xs)",
      cursor: onClick ? "pointer" : undefined,
      boxSizing: "border-box",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      flex: 1
    }
  }, title), showPlate && plate && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ac-font-mono)",
      fontSize: "var(--ac-size-label)",
      color: "var(--ac-ink-muted)"
    }
  }, plate)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, body), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: s.color
    }
  }, s.label, " \u203A"));
}
Object.assign(__ds_scope, { SEVERITY, AttentionItemRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/attention/AttentionItemRow.jsx", error: String((e && e.message) || e) }); }

// components/attention/AttentionCard.jsx
try { (() => {
const ORDER = ["CRITICAL", "ATTENTION", "MONITOR", "INFO"];

/** The member home's answer to "what do I do next?" — severity counts, the most
 *  severe item verbatim, and a way to see the rest. Renders an explicit empty
 *  state; it is never hidden. */
function AttentionCard({
  items = [],
  onSeeAll,
  onPressItem,
  style
}) {
  const shell = {
    background: "var(--ac-surface)",
    border: "1px solid var(--ac-line)",
    borderRadius: "var(--ac-radius-md)",
    padding: "var(--ac-space-md)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--ac-space-sm)",
    boxSizing: "border-box",
    ...style
  };
  if (items.length === 0) {
    return /*#__PURE__*/React.createElement("div", {
      style: shell
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: "var(--type-h2)",
        color: "var(--ac-ink)"
      }
    }, "Nothing needs attention right now"), /*#__PURE__*/React.createElement("div", {
      style: {
        font: "var(--type-body)",
        color: "var(--ac-ink-muted)",
        marginTop: -6
      }
    }, "Your vehicles are up to date."));
  }
  const counts = ORDER.map(sev => ({
    sev,
    n: items.filter(i => i.severity === sev).length
  })).filter(c => c.n > 0);
  const top = items[0];
  return /*#__PURE__*/React.createElement("div", {
    style: shell
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h1)",
      color: "var(--ac-ink)"
    }
  }, "Needs attention"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      gap: "var(--ac-space-xs)"
    }
  }, counts.map(c => /*#__PURE__*/React.createElement("span", {
    key: c.sev,
    "aria-label": `${c.n} ${c.sev.toLowerCase()}`,
    style: {
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      background: __ds_scope.SEVERITY[c.sev].color,
      color: "#FFFFFF",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 6px",
      font: "var(--type-label)",
      fontVariantNumeric: "tabular-nums"
    }
  }, c.n)))), /*#__PURE__*/React.createElement("div", {
    role: "button",
    tabIndex: 0,
    onClick: () => onPressItem && onPressItem(top),
    style: {
      borderLeft: `var(--ac-border-accent) solid ${__ds_scope.SEVERITY[top.severity].color}`,
      paddingLeft: "var(--ac-space-sm)",
      cursor: onPressItem ? "pointer" : undefined
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, top.title, top.plate ? ` · ${top.plate}` : ""), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, top.body)), onSeeAll && /*#__PURE__*/React.createElement("div", {
    role: "button",
    tabIndex: 0,
    onClick: onSeeAll,
    style: {
      minHeight: 40,
      display: "flex",
      alignItems: "center",
      font: "var(--type-body)",
      fontWeight: 600,
      color: "var(--ac-primary)",
      cursor: "pointer"
    }
  }, "See all ", items.length, " \u203A"));
}
Object.assign(__ds_scope, { AttentionCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/attention/AttentionCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const VARIANT = {
  primary: {
    background: "var(--ac-primary)",
    color: "var(--ac-on-primary)",
    border: "none"
  },
  secondary: {
    background: "transparent",
    color: "var(--ac-primary)",
    border: "var(--ac-border-control) solid var(--ac-primary)"
  },
  deep: {
    background: "var(--ac-primary-deep)",
    color: "var(--ac-on-primary)",
    border: "none"
  },
  danger: {
    background: "var(--ac-danger)",
    color: "#FFFFFF",
    border: "none"
  },
  ghost: {
    background: "transparent",
    color: "var(--ac-primary)",
    border: "none"
  }
};

/** The product's one action control. Labels say exactly what happens ("Book a
 *  service", never "Submit"); destructive actions are red and always confirm. */
function Button({
  children,
  variant = "primary",
  size = "member",
  block,
  disabled,
  icon,
  onClick,
  type = "button",
  style,
  ...rest
}) {
  const v = VARIANT[variant] || VARIANT.primary;
  const field = size === "field";
  const height = field ? "var(--ac-target-field)" : "var(--ac-target-member)";
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--ac-space-sm)",
    fontFamily: "var(--ac-font-body)",
    fontWeight: "var(--ac-weight-strong)",
    fontSize: field ? "18px" : "16px",
    lineHeight: 1,
    height,
    minHeight: height,
    padding: `0 ${field ? "var(--ac-space-lg)" : "var(--ac-space-lg)"}`,
    borderRadius: "var(--ac-radius-sm)",
    cursor: disabled ? "not-allowed" : "pointer",
    width: block ? "100%" : undefined,
    textAlign: "center",
    transition: "background var(--ac-duration-fast) var(--ac-ease-standard), opacity var(--ac-duration-instant) linear",
    ...v
  };
  if (disabled) Object.assign(base, {
    background: "var(--ac-line)",
    color: "var(--ac-ink-muted)",
    border: "none"
  });
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    style: {
      ...base,
      ...style
    }
  }, rest), icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** The universal container: white surface, 1px steel hairline, radius 12.
 *  Elevation in AutoCare+ is the hairline, not a shadow. */
function Card({
  children,
  pad = "md",
  accent,
  interactive,
  onClick,
  style,
  ...rest
}) {
  const padding = pad === "none" ? 0 : pad === "lg" ? "var(--ac-space-lg)" : "var(--ac-space-md)";
  return /*#__PURE__*/React.createElement("div", _extends({
    onClick: onClick,
    role: interactive ? "button" : undefined,
    tabIndex: interactive ? 0 : undefined,
    style: {
      background: "var(--ac-surface)",
      border: "1px solid var(--ac-line)",
      borderRadius: "var(--ac-radius-md)",
      padding,
      borderLeft: accent ? `var(--ac-border-accent-row) solid ${accent}` : undefined,
      cursor: interactive ? "pointer" : undefined,
      boxSizing: "border-box",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/EmptyState.jsx
try { (() => {
/** Empty, loading and error states share one shape so an absence never reads as
 *  a bug. Empty states are stated positively ("Nothing needs attention right
 *  now"), never hidden (FR-113). */
function EmptyState({
  title,
  body,
  tone = "empty",
  action,
  style
}) {
  const accent = tone === "error" ? "var(--ac-danger)" : tone === "loading" ? "var(--ac-ink-muted)" : "var(--ac-ink)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--ac-surface)",
      border: "1px solid var(--ac-line)",
      borderRadius: "var(--ac-radius-md)",
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-xs)",
      alignItems: "flex-start",
      ...style
    }
  }, tone === "loading" && /*#__PURE__*/React.createElement("div", {
    "aria-hidden": true,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      width: "100%",
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 10,
      width: "42%",
      borderRadius: 999,
      background: "var(--ac-line)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 10,
      width: "68%",
      borderRadius: 999,
      background: "var(--ac-code-bg)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: accent
    }
  }, title), body && /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, body), action);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/core/FormField.jsx
try { (() => {
/** Labelled input. Errors say what went wrong and what to do next — never a
 *  raw code (NFR-032). Uppercase label, sunken field, 48dp height. */
function FormField({
  label,
  value,
  placeholder,
  error,
  hint,
  mono,
  size = "member",
  type = "text",
  onChange,
  id,
  style
}) {
  const height = size === "field" ? "var(--ac-target-field)" : "var(--ac-target-member)";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-xs)",
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)",
      letterSpacing: "var(--ac-tracking-label)",
      textTransform: "uppercase"
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    id: id,
    type: type,
    value: value,
    placeholder: placeholder,
    onChange: e => onChange && onChange(e.target.value),
    style: {
      fontFamily: mono ? "var(--ac-font-mono)" : "var(--ac-font-body)",
      letterSpacing: mono ? "var(--ac-tracking-code)" : undefined,
      fontSize: "16px",
      color: "var(--ac-ink)",
      background: "var(--ac-chassis)",
      border: `var(--ac-border-control) solid ${error ? "var(--ac-danger)" : "var(--ac-line)"}`,
      borderRadius: "var(--ac-radius-sm)",
      height,
      padding: "0 14px",
      boxSizing: "border-box",
      width: "100%"
    }
  }), error && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--ac-danger)",
      font: "var(--type-body)",
      fontSize: "14px"
    }
  }, error), !error && hint && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "var(--ac-ink-muted)",
      font: "var(--type-label)"
    }
  }, hint));
}
Object.assign(__ds_scope, { FormField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/FormField.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CDN = "https://unpkg.com/lucide-static@0.544.0/icons/";

/** SUBSTITUTED ICON SET. The AutoCare+ codebase ships no icon assets — the
 *  React Native apps use emoji glyphs inline (🏠 🚗 👤 🔧 📷 ⇅) and the web
 *  console uses text arrows. Lucide (2px stroke, square cap) is the closest
 *  match to the industrial register the design language calls for. Swap the CDN
 *  constant if the team adopts a different set.
 *  Recoloured via CSS mask so the glyph always takes currentColor. */
function Icon({
  name,
  size = 20,
  color = "currentColor",
  strokeWidth,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    "aria-hidden": true,
    role: "presentation",
    style: {
      display: "inline-block",
      width: size,
      height: size,
      flex: "none",
      backgroundColor: color,
      WebkitMaskImage: `url(${CDN}${name}.svg)`,
      maskImage: `url(${CDN}${name}.svg)`,
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskSize: "contain",
      maskSize: "contain",
      WebkitMaskPosition: "center",
      maskPosition: "center",
      ...style
    },
    "data-icon": name,
    "data-stroke": strokeWidth
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Plate.jsx
try { (() => {
/** Machine identity: plate numbers, VINs, verification codes. Always mono,
 *  always letter-spaced. `variant="chip"` is the navy chip used on cards. */
function Plate({
  children,
  variant = "outline",
  style
}) {
  if (variant === "chip") {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-block",
        fontFamily: "var(--ac-font-mono)",
        fontWeight: 500,
        fontSize: "var(--ac-size-code)",
        letterSpacing: "var(--ac-tracking-code)",
        background: "var(--ac-primary-deep)",
        color: "var(--ac-on-primary)",
        borderRadius: "var(--ac-radius-sm)",
        padding: "4px var(--ac-space-sm)",
        ...style
      }
    }, children);
  }
  if (variant === "plain") {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--ac-font-mono)",
        fontWeight: 500,
        fontSize: "var(--ac-size-code)",
        letterSpacing: "var(--ac-tracking-code)",
        color: "var(--ac-ink)",
        ...style
      }
    }, children);
  }
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      fontFamily: "var(--ac-font-mono)",
      fontWeight: 500,
      fontSize: "18px",
      letterSpacing: "var(--ac-tracking-plate)",
      background: "var(--ac-surface)",
      color: "var(--ac-ink)",
      border: "2px solid var(--ac-ink)",
      borderRadius: "var(--ac-radius-sm)",
      padding: "4px 14px",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Plate });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Plate.jsx", error: String((e && e.message) || e) }); }

// components/core/StatusPill.jsx
try { (() => {
const TONE = {
  neutral: {
    bg: "var(--ac-code-bg)",
    fg: "var(--ac-ink)",
    bd: "transparent"
  },
  info: {
    bg: "color-mix(in srgb, var(--ac-primary) 12%, transparent)",
    fg: "var(--ac-primary)",
    bd: "color-mix(in srgb, var(--ac-primary) 35%, transparent)"
  },
  success: {
    bg: "color-mix(in srgb, var(--ac-success) 12%, transparent)",
    fg: "var(--ac-success)",
    bd: "color-mix(in srgb, var(--ac-success) 35%, transparent)"
  },
  warn: {
    bg: "color-mix(in srgb, var(--ac-band-fair) 14%, transparent)",
    fg: "var(--ac-band-fair)",
    bd: "color-mix(in srgb, var(--ac-band-fair) 40%, transparent)"
  },
  danger: {
    bg: "color-mix(in srgb, var(--ac-danger) 12%, transparent)",
    fg: "var(--ac-danger)",
    bd: "color-mix(in srgb, var(--ac-danger) 35%, transparent)"
  },
  solid: {
    bg: "var(--ac-primary)",
    fg: "#FFFFFF",
    bd: "transparent"
  },
  solidDeep: {
    bg: "var(--ac-primary-deep)",
    fg: "#FFFFFF",
    bd: "transparent"
  }
};

/** Lifecycle state, in mono caps. Blue = moving, green = settled,
 *  amber = needs someone, red = stopped, grey = not started. */
function StatusPill({
  children,
  tone = "neutral",
  style
}) {
  const t = TONE[tone] || TONE.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      fontFamily: "var(--ac-font-mono)",
      fontSize: "12px",
      fontWeight: 500,
      letterSpacing: "0.02em",
      padding: "3px 10px",
      borderRadius: "var(--ac-radius-pill)",
      background: t.bg,
      color: t.fg,
      border: `1px solid ${t.bd}`,
      whiteSpace: "nowrap",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/field/StatusChoice.jsx
try { (() => {
const STATUS = {
  GOOD: {
    label: "Good",
    color: "var(--ac-band-excellent)"
  },
  MONITOR: {
    label: "Monitor",
    color: "var(--ac-band-fair)"
  },
  ATTENTION: {
    label: "Attention",
    color: "var(--ac-band-attention)"
  },
  CRITICAL: {
    label: "Critical",
    color: "var(--ac-band-critical)"
  },
  NOT_APPLICABLE: {
    label: "N/A",
    color: "var(--ac-ink-muted)"
  }
};

/** The mechanic's inspection verdict control: one full-width 56dp target per
 *  status, filled in the band colour when selected. Disabled when a measured
 *  value has already derived the status. */
function StatusChoice({
  status,
  selected,
  disabled,
  onClick,
  style
}) {
  const s = STATUS[status] || STATUS.NOT_APPLICABLE;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: disabled,
    onClick: onClick,
    "aria-pressed": !!selected,
    style: {
      minHeight: "var(--ac-target-field)",
      width: "100%",
      borderRadius: "var(--ac-radius-md)",
      border: selected ? "none" : "1px solid var(--ac-line)",
      background: selected ? s.color : "var(--ac-surface)",
      color: selected ? "#FFFFFF" : "var(--ac-ink)",
      font: "var(--type-h2)",
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "background var(--ac-duration-fast) var(--ac-ease-standard)",
      ...style
    }
  }, s.label);
}

/** The small derived-status chip shown live beneath a measured value. */
function StatusChip({
  status,
  style
}) {
  const s = STATUS[status] || STATUS.NOT_APPLICABLE;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      background: s.color,
      color: "#FFFFFF",
      borderRadius: "var(--ac-radius-pill)",
      padding: "var(--ac-space-xs) var(--ac-space-md)",
      font: "var(--type-label)",
      ...style
    }
  }, s.label);
}
Object.assign(__ds_scope, { StatusChoice, StatusChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/field/StatusChoice.jsx", error: String((e && e.message) || e) }); }

// components/field/SyncBanner.jsx
try { (() => {
/** Persistent on every field screen whenever the outbox is non-empty. Staff must
 *  never wonder whether their work saved. Tapping opens the queue (F-03). */
function SyncBanner({
  pendingCount = 0,
  onClick,
  style
}) {
  if (!pendingCount) return null;
  return /*#__PURE__*/React.createElement("div", {
    role: "alert",
    onClick: onClick,
    style: {
      background: "var(--ac-primary-deep)",
      color: "#FFFFFF",
      textAlign: "center",
      fontFamily: "var(--ac-font-body)",
      fontSize: 16,
      fontWeight: 600,
      padding: "var(--ac-space-sm)",
      cursor: onClick ? "pointer" : undefined,
      ...style
    }
  }, pendingCount, " item", pendingCount === 1 ? "" : "s", " waiting to sync");
}
Object.assign(__ds_scope, { SyncBanner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/field/SyncBanner.jsx", error: String((e && e.message) || e) }); }

// components/shell/BottomSheet.jsx
try { (() => {
/** Progressive disclosure, bottom-anchored. Opens for ANY component — healthy
 *  ones included — so the score is always explainable. Grabber, title, then
 *  the plain-language sentence; a single dismissing action closes it. */
function BottomSheet({
  open = true,
  title,
  children,
  onClose,
  closeLabel = "Got it",
  style
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "absolute",
      inset: 0,
      background: "var(--ac-scrim)",
      display: "flex",
      alignItems: "flex-end",
      zIndex: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      background: "var(--ac-surface)",
      borderTopLeftRadius: "var(--ac-radius-md)",
      borderTopRightRadius: "var(--ac-radius-md)",
      padding: "var(--ac-space-lg)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)",
      boxShadow: "var(--ac-elevation-sheet)",
      boxSizing: "border-box",
      animation: "ac-sheet-in var(--ac-duration-sheet) var(--ac-ease-out)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("style", null, "@keyframes ac-sheet-in{from{transform:translateY(16px);opacity:.6}to{transform:none;opacity:1}}"), /*#__PURE__*/React.createElement("div", {
    "aria-hidden": true,
    style: {
      width: 40,
      height: 4,
      borderRadius: 2,
      background: "var(--ac-line)",
      alignSelf: "center"
    }
  }), title && /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h1)",
      color: "var(--ac-ink)"
    }
  }, title), children, onClose && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClose,
    style: {
      minHeight: "var(--ac-target-member)",
      border: "none",
      borderRadius: "var(--ac-radius-md)",
      background: "var(--ac-primary)",
      color: "var(--ac-on-primary)",
      font: "var(--type-h2)",
      marginTop: "var(--ac-space-xs)",
      cursor: "pointer"
    }
  }, closeLabel)));
}

/** The measured-value readout used inside explain sheets. */
function MeasuredRow({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--ac-chassis)",
      borderRadius: "var(--ac-radius-sm)",
      padding: "var(--ac-space-sm)",
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { BottomSheet, MeasuredRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/BottomSheet.jsx", error: String((e && e.message) || e) }); }

// components/shell/TabBar.jsx
try { (() => {
/** Member app bottom tabs. Active tint is Gauge Blue, inactive is muted ink;
 *  49dp bar over a hairline. Labels are nouns, never verbs. */
function TabBar({
  tabs = [],
  active,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: "flex",
      height: 56,
      borderTop: "1px solid var(--ac-line)",
      background: "var(--ac-surface)",
      ...style
    }
  }, tabs.map(t => {
    const on = t.key === active;
    return /*#__PURE__*/React.createElement("button", {
      key: t.key,
      type: "button",
      onClick: () => onChange && onChange(t.key),
      "aria-current": on ? "page" : undefined,
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        color: on ? "var(--ac-primary)" : "var(--ac-ink-muted)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": true,
      style: {
        display: "flex",
        width: 22,
        height: 22
      }
    }, t.icon), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--ac-font-body)",
        fontSize: 11,
        fontWeight: on ? 600 : 500
      }
    }, t.label));
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shell/TabBar.jsx", error: String((e && e.message) || e) }); }

// components/subscription/PlanCard.jsx
try { (() => {
const INTERVAL_LABEL = {
  MONTHLY: "/month",
  QUARTERLY: "/quarter",
  ANNUAL: "/year"
};

/** Membership plan: name, price in the display face, lock-in, inclusions,
 *  and one primary action. Inclusions are listed in full — never "and more". */
function PlanCard({
  name,
  price,
  interval = "MONTHLY",
  lockInMonths = 0,
  inclusions = [],
  selected,
  actionLabel = "Choose this plan",
  onSelect,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onSelect,
    role: "button",
    tabIndex: 0,
    style: {
      background: "var(--ac-surface)",
      borderRadius: "var(--ac-radius-md)",
      padding: "var(--ac-space-md)",
      border: selected ? "var(--ac-border-control) solid var(--ac-primary)" : "1px solid var(--ac-line)",
      display: "flex",
      flexDirection: "column",
      cursor: "pointer",
      boxSizing: "border-box",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h1)",
      color: "var(--ac-primary-deep)",
      marginTop: "var(--ac-space-xs)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontVariantNumeric: "tabular-nums"
    }
  }, price), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, INTERVAL_LABEL[interval] || "")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)",
      marginTop: "var(--ac-space-xs)"
    }
  }, lockInMonths > 0 ? `${lockInMonths}-month lock-in` : "No lock-in"), /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: "var(--ac-space-sm) 0 0",
      padding: 0,
      listStyle: "none",
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, inclusions.map((i, n) => /*#__PURE__*/React.createElement("li", {
    key: n,
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink)"
    }
  }, "\u2022 ", i))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--ac-target-member)",
      marginTop: "var(--ac-space-sm)",
      borderRadius: "var(--ac-radius-sm)",
      background: "var(--ac-primary)",
      color: "var(--ac-on-primary)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      font: "var(--type-body)",
      fontWeight: 600
    }
  }, actionLabel));
}
Object.assign(__ds_scope, { PlanCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/subscription/PlanCard.jsx", error: String((e && e.message) || e) }); }

// components/vhs/BandChip.jsx
try { (() => {
const BANDS = {
  EXCELLENT: {
    min: 90,
    fill: "#177245",
    text: "#0F5C37",
    labelEn: "Excellent",
    labelFil: "Napakaayos"
  },
  GOOD: {
    min: 75,
    fill: "#5C9E31",
    text: "#3F7420",
    labelEn: "Good",
    labelFil: "Maayos"
  },
  FAIR: {
    min: 60,
    fill: "#B87E00",
    text: "#8A5F00",
    labelEn: "Fair",
    labelFil: "Katamtaman"
  },
  NEEDS_ATTENTION: {
    min: 40,
    fill: "#C75E1B",
    text: "#9C4204",
    labelEn: "Needs Attention",
    labelFil: "Kailangan ng Aksyon"
  },
  CRITICAL: {
    min: 0,
    fill: "#B3261E",
    text: "#8F1D17",
    labelEn: "Critical",
    labelFil: "Delikado"
  }
};
function bandForScore(score) {
  for (const [key, b] of Object.entries(BANDS)) if (score >= b.min) return key;
  return "CRITICAL";
}

/** Band chip / inline band label. Colour always ships with the word and,
 *  where there is room, the number — colour is never the only signal. */
function BandChip({
  score,
  band,
  showRange,
  showFil,
  style
}) {
  const key = band || bandForScore(score ?? 0);
  const b = BANDS[key];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "baseline",
      gap: "var(--ac-space-sm)",
      background: b.fill,
      color: "#FFFFFF",
      borderRadius: "var(--ac-radius-pill)",
      padding: "4px 12px",
      ...style
    }
  }, showRange && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ac-font-mono)",
      fontSize: 12,
      opacity: 0.85,
      fontVariantNumeric: "tabular-nums"
    }
  }, b.min, "\u2013", key === "EXCELLENT" ? 100 : (BANDS[Object.keys(BANDS)[Object.keys(BANDS).indexOf(key) - 1]]?.min ?? 100) - 1), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ac-font-display)",
      fontWeight: 600,
      fontSize: 15,
      lineHeight: 1.2
    }
  }, b.labelEn), showFil && /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ac-font-body)",
      fontSize: 12,
      opacity: 0.85
    }
  }, b.labelFil));
}
Object.assign(__ds_scope, { BANDS, bandForScore, BandChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/vhs/BandChip.jsx", error: String((e && e.message) || e) }); }

// components/vhs/ScoreGauge.jsx
try { (() => {
const CONFIDENCE_LABEL = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence"
};
function polar(cx, cy, r, deg) {
  const a = deg * Math.PI / 180;
  return {
    x: cx + r * Math.cos(a),
    y: cy - r * Math.sin(a)
  };
}
function arcPath(cx, cy, r, fromDeg, toDeg) {
  const s = polar(cx, cy, r, fromDeg),
    e = polar(cx, cy, r, toDeg);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${Math.abs(toDeg - fromDeg) > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
}

/** The signature component: a 180° band-coloured arc, the score numeral in the
 *  display face, and the EN/FIL band label. Stale inspections render grey —
 *  an old score is never shown as if it were current. */
function ScoreGauge({
  score,
  band,
  confidence,
  isStale,
  daysSinceInspection,
  size = 220,
  variant = "member",
  style
}) {
  const key = band || __ds_scope.bandForScore(score);
  const b = __ds_scope.BANDS[key];
  const stroke = 18,
    r = (size - stroke) / 2,
    cx = size / 2,
    cy = size / 2;
  const clamped = Math.max(0, Math.min(100, score));
  const progressDeg = 180 - clamped / 100 * 180;
  const arcColor = isStale ? "var(--ac-ink-muted)" : b.fill;
  const end = polar(cx, cy, r, progressDeg);
  return /*#__PURE__*/React.createElement("div", {
    role: "img",
    "aria-label": `Vehicle health score ${clamped} out of 100, ${b.labelEn}`,
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: size,
      height: size / 2 + stroke
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size / 2 + stroke
  }, /*#__PURE__*/React.createElement("path", {
    d: arcPath(cx, cy, r, 180, 0),
    stroke: "var(--ac-line)",
    strokeWidth: stroke,
    fill: "none",
    strokeLinecap: "round"
  }), clamped > 0 && /*#__PURE__*/React.createElement("path", {
    d: arcPath(cx, cy, r, 180, progressDeg),
    stroke: arcColor,
    strokeWidth: stroke,
    fill: "none",
    strokeLinecap: "round"
  }), clamped > 0 && /*#__PURE__*/React.createElement("circle", {
    cx: end.x,
    cy: end.y,
    r: stroke / 2.5,
    fill: arcColor
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: size / 4,
      left: 0,
      right: 0,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ac-font-display)",
      fontWeight: 600,
      lineHeight: 1,
      fontSize: variant === "field" ? 72 : 56,
      fontVariantNumeric: "tabular-nums",
      color: isStale ? "var(--ac-ink-muted)" : b.text
    }
  }, clamped))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: isStale ? "var(--ac-ink-muted)" : b.text
    }
  }, b.labelEn), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, b.labelFil), isStale ? /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)",
      marginTop: "var(--ac-space-xs)"
    }
  }, "Inspected ", daysSinceInspection ?? "90+", " days ago") : confidence ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--ac-space-xs)",
      borderRadius: "var(--ac-radius-pill)",
      border: "1px solid var(--ac-line)",
      padding: "2px var(--ac-space-sm)",
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, CONFIDENCE_LABEL[confidence]) : null);
}
Object.assign(__ds_scope, { ScoreGauge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/vhs/ScoreGauge.jsx", error: String((e && e.message) || e) }); }

// components/vhs/StarRating.jsx
try { (() => {
const STAR = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
const STARS_FOR = {
  EXCELLENT: 5,
  GOOD: 4,
  FAIR: 3,
  NEEDS_ATTENTION: 2,
  CRITICAL: 1
};

/** A display transform over the band — never a second scoring system.
 *  5 = Excellent, 4 = Good, 3 = Fair, 2 = Needs attention, 1 = Critical. */
function StarRating({
  score,
  band,
  size = 20,
  style
}) {
  const key = band || __ds_scope.bandForScore(score);
  const filled = STARS_FOR[key];
  const color = __ds_scope.BANDS[key].fill;
  return /*#__PURE__*/React.createElement("span", {
    role: "img",
    "aria-label": `${filled} out of 5 stars — ${__ds_scope.BANDS[key].labelEn}`,
    style: {
      display: "inline-flex",
      gap: 2,
      ...style
    }
  }, [1, 2, 3, 4, 5].map(i => /*#__PURE__*/React.createElement("svg", {
    key: i,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    "aria-hidden": true
  }, /*#__PURE__*/React.createElement("path", {
    d: STAR,
    fill: i <= filled ? color : "none",
    stroke: color,
    strokeWidth: i <= filled ? 0 : 1.5
  }))));
}
Object.assign(__ds_scope, { StarRating });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/vhs/StarRating.jsx", error: String((e && e.message) || e) }); }

// components/vhs/CategoryBar.jsx
try { (() => {
/** One inspection category: label, score, band-coloured bar, and the weight +
 *  point-count footnote that shows how the number was reached. */
function CategoryBar({
  label,
  score,
  weight,
  points,
  showStars = true,
  compact,
  onClick,
  style
}) {
  const key = __ds_scope.bandForScore(score);
  const b = __ds_scope.BANDS[key];
  const barH = compact ? 8 : 12;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    role: onClick ? "button" : undefined,
    tabIndex: onClick ? 0 : undefined,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-xs)",
      cursor: onClick ? "pointer" : undefined,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: compact ? "var(--type-body)" : "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, showStars && !compact && /*#__PURE__*/React.createElement(__ds_scope.StarRating, {
    score: score,
    size: 16
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: compact ? "var(--type-body)" : "var(--type-h2)",
      color: b.text,
      fontVariantNumeric: "tabular-nums"
    }
  }, Math.round(score)))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: barH,
      borderRadius: "var(--ac-radius-pill)",
      background: "var(--ac-chassis)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${Math.max(0, Math.min(100, score))}%`,
      height: "100%",
      background: b.fill,
      borderRadius: "var(--ac-radius-pill)"
    }
  })), (weight != null || points != null) && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, weight != null ? `Weight ${weight}%` : "", weight != null && points != null ? " · " : "", points != null ? `${points} points checked` : ""));
}
Object.assign(__ds_scope, { CategoryBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/vhs/CategoryBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/certificate/CertificateScreens.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Certificate() {
  const cats = [{
    label: "Brakes",
    score: 55
  }, {
    label: "Tyres & wheels",
    score: 64
  }, {
    label: "Engine & fluids",
    score: 91
  }, {
    label: "Electrical & battery",
    score: 80
  }, {
    label: "Suspension & steering",
    score: 88
  }, {
    label: "Body & lights",
    score: 95
  }];
  const fields = [["Plate", "ABC 1234", true], ["Odometer", "48,210 km", false], ["Inspected", "12 Aug 2026", false], ["Valid until", "10 Nov 2026", false], ["Confidence", "Medium", false], ["Verification code", "7QK4-92MB", true]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 512,
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-lg)",
      padding: "var(--ac-space-xl) var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--ac-surface)",
      borderRadius: "var(--ac-radius-md)",
      border: "1px solid var(--ac-line)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--ac-primary-deep)",
      padding: "var(--ac-space-md) var(--ac-space-lg)",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--ac-font-display)",
      fontWeight: 600,
      fontSize: 22,
      color: "#fff",
      margin: 0,
      letterSpacing: "0.01em"
    }
  }, "AutoCare+ Vehicle Health Certificate")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "var(--ac-space-lg) var(--ac-space-lg) var(--ac-space-md)",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement(ScoreGauge, {
    score: 69,
    size: 260
  }), /*#__PURE__*/React.createElement(StarRating, {
    band: "FAIR",
    size: 22
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md) var(--ac-space-lg)",
      borderTop: "1px solid var(--ac-line)",
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "var(--ac-space-md)"
    }
  }, fields.map(([l, v, mono]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      fontSize: 12,
      color: "var(--ac-ink-muted)"
    }
  }, l), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body)",
      fontSize: 14,
      color: "var(--ac-ink)",
      fontFamily: mono ? "var(--ac-font-mono)" : undefined,
      letterSpacing: mono ? "var(--ac-tracking-code)" : undefined
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md) var(--ac-space-lg)",
      borderTop: "1px solid var(--ac-line)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      margin: 0
    }
  }, "Category scores"), cats.map(c => /*#__PURE__*/React.createElement(CategoryBar, _extends({
    key: c.label
  }, c, {
    compact: true
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md) var(--ac-space-lg)",
      borderTop: "1px solid var(--ac-line)"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      margin: 0
    }
  }, "Service history"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--type-body)",
      fontSize: 14,
      color: "var(--ac-ink-muted)",
      margin: "2px 0 var(--ac-space-sm)"
    }
  }, "4 completed services on record"), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: "none",
      margin: 0,
      padding: 0,
      display: "flex",
      flexDirection: "column",
      gap: 4,
      fontSize: 14
    }
  }, [["Preventive maintenance", "12 Aug 2026"], ["Brake service", "3 May 2026"], ["Oil change", "18 Feb 2026"], ["Full inspection", "9 Nov 2025"]].map(([t, d]) => /*#__PURE__*/React.createElement("li", {
    key: d,
    style: {
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--ac-ink)"
    }
  }, t), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--ac-ink-muted)",
      fontFamily: "var(--ac-font-mono)",
      fontSize: 13
    }
  }, d)))))), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)",
      textAlign: "center",
      margin: 0,
      padding: "0 var(--ac-space-md)"
    }
  }, "This certificate reflects a point-in-time inspection and is valid for 90 days. Verify its authenticity at ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ac-font-mono)"
    }
  }, "/verify"), " using the code above."), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--ac-primary-deep)",
      borderRadius: "var(--ac-radius-md)",
      padding: "var(--ac-space-sm)",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      color: "#fff",
      font: "var(--type-body)",
      fontSize: 14
    }
  }, "Powered by AutoCare+ \xB7 autocare.example/verify")));
}
function VerifyForm() {
  const [code, setCode] = React.useState("");
  const [result, setResult] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 420,
      margin: "0 auto",
      padding: "var(--ac-space-xl) var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: "var(--type-h1)",
      color: "var(--ac-primary-deep)",
      margin: 0
    }
  }, "Verify a certificate"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)",
      margin: 0
    }
  }, "Enter the verification code printed on the certificate to confirm it is genuine and still valid."), /*#__PURE__*/React.createElement(FormField, {
    id: "code",
    label: "Verification code",
    mono: true,
    value: code,
    onChange: setCode,
    placeholder: "7QK4-92MB"
  }), /*#__PURE__*/React.createElement(Button, {
    block: true,
    disabled: !code,
    onClick: () => setResult(code.trim().toUpperCase() === "7QK4-92MB" ? "ok" : "bad")
  }, "Verify"), result === "ok" && /*#__PURE__*/React.createElement(Card, {
    accent: "var(--ac-success)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "Valid certificate"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, "ABC 1234 \xB7 score 69 (Fair) \xB7 inspected 12 Aug 2026 \xB7 valid until 10 Nov 2026.")), result === "bad" && /*#__PURE__*/React.createElement(Card, {
    accent: "var(--ac-danger)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "No certificate with that code"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, "Check the code on the certificate. If it was revoked by the owner, it will no longer verify.")));
}
function RevokedNotice() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 420,
      margin: "0 auto",
      padding: "var(--ac-space-xl) var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: "lg",
    accent: "var(--ac-ink-muted)",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "shield-off",
    size: 28,
    color: "var(--ac-ink-muted)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h1)",
      color: "var(--ac-ink)"
    }
  }, "This certificate has been revoked"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, "The vehicle owner withdrew this link, so it no longer shows a score. Ask them for a current certificate.")));
}
Object.assign(window, {
  Certificate,
  VerifyForm,
  RevokedNotice
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/certificate/CertificateScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/field-app/InspectionScreens.jsx
try { (() => {
function PointEntryScreen({
  onBack,
  onNext
}) {
  const p = POINTS[0];
  const [value, setValue] = React.useState(p.value);
  const [photo, setPhoto] = React.useState(false);
  const num = parseFloat(value);
  const derived = isNaN(num) ? null : num >= 5 ? "GOOD" : num >= 4 ? "MONITOR" : num >= 2.5 ? "ATTENTION" : "CRITICAL";
  const adverse = derived === "ATTENTION" || derived === "CRITICAL";
  const needsPhoto = adverse && !photo;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FieldNav, {
    title: "Brakes \xB7 1 of 4",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h1)",
      fontSize: 32,
      color: "var(--ac-ink)"
    }
  }, p.label), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      fontSize: 18,
      color: "var(--ac-ink-muted)"
    }
  }, p.labelFil)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: e => setValue(e.target.value),
    inputMode: "decimal",
    style: {
      flex: 1,
      minHeight: 56,
      border: "1px solid var(--ac-line)",
      borderRadius: "var(--ac-radius-md)",
      background: "var(--ac-surface)",
      padding: "0 var(--ac-space-md)",
      fontSize: 28,
      fontFamily: "var(--ac-font-body)",
      color: "var(--ac-ink)",
      boxSizing: "border-box"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h2)",
      fontSize: 25,
      color: "var(--ac-ink-muted)"
    }
  }, p.unit)), derived && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(StatusChip, {
    status: derived
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, ["GOOD", "MONITOR", "ATTENTION", "CRITICAL", "NOT_APPLICABLE"].map(s => /*#__PURE__*/React.createElement(StatusChoice, {
    key: s,
    status: s,
    selected: derived === s,
    disabled: derived != null && derived !== s
  }))), needsPhoto && /*#__PURE__*/React.createElement(Button, {
    size: "field",
    block: true,
    variant: "danger",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "camera",
      size: 20
    }),
    onClick: () => setPhoto(true)
  }, "Add photo \u2014 required for this finding"), photo && /*#__PURE__*/React.createElement(Card, {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "image",
    size: 22,
    color: "var(--ac-band-excellent)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body)",
      fontSize: 18,
      color: "var(--ac-ink)"
    }
  }, "1 photo attached")), /*#__PURE__*/React.createElement("textarea", {
    placeholder: "Notes (optional)",
    rows: 2,
    style: {
      minHeight: 56,
      border: "1px solid var(--ac-line)",
      borderRadius: "var(--ac-radius-md)",
      background: "var(--ac-surface)",
      padding: "var(--ac-space-md)",
      font: "var(--type-body)",
      fontSize: 18,
      color: "var(--ac-ink)",
      boxSizing: "border-box",
      resize: "none"
    }
  }), /*#__PURE__*/React.createElement(Button, {
    size: "field",
    block: true,
    disabled: !derived || needsPhoto,
    onClick: onNext
  }, "Save & next")));
}
function ReviewScreen({
  onBack,
  onSubmit
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FieldNav, {
    title: "Review & submit",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Plate, null, "ABC 1234"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body)",
      fontSize: 18,
      color: "var(--ac-ink-muted)"
    }
  }, "2019 Toyota Vios 1.3 XE \xB7 48,210 km")), POINTS.map(p => /*#__PURE__*/React.createElement(Card, {
    key: p.code,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-sm)",
      minHeight: 56
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      fontSize: 18,
      color: "var(--ac-ink)"
    }
  }, p.label), p.measured && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--ac-font-mono)",
      fontSize: 15,
      color: "var(--ac-ink-muted)"
    }
  }, p.value, " ", p.unit, " \xB7 good \u2265 ", p.good, " ", p.unit)), p.status ? /*#__PURE__*/React.createElement(StatusChip, {
    status: p.status
  }) : /*#__PURE__*/React.createElement(StatusPill, {
    tone: "warn"
  }, "NOT RECORDED"))), /*#__PURE__*/React.createElement(Card, {
    accent: "var(--ac-sev-attention)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "1 point still to record"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      fontSize: 18,
      color: "var(--ac-ink-muted)"
    }
  }, "Brake fluid condition has no status. Record it before submitting, or mark it N/A.")), /*#__PURE__*/React.createElement(Button, {
    size: "field",
    block: true,
    onClick: onSubmit
  }, "Submit inspection"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      fontSize: 15,
      color: "var(--ac-ink-muted)",
      textAlign: "center"
    }
  }, "Submits to the outbox \u2014 it will sync when you have signal.")));
}
function ScoreResultScreen({
  onBack
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FieldNav, {
    title: "Score result",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: "lg",
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(ScoreGauge, {
    score: 69,
    variant: "field",
    size: 240,
    confidence: "MEDIUM"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      fontSize: 15,
      color: "var(--ac-ink-muted)",
      textAlign: "center"
    }
  }, "Averaged 84.5 \xB7 capped at 69 by a safety-critical brake finding")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "Recommendations generated"), [["Front brake pad replacement", "₱3,200", "CRITICAL"], ["Tyre rotation", "₱450", "ATTENTION"]].map(([l, c, s]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    accent: s === "CRITICAL" ? "var(--ac-sev-critical)" : "var(--ac-sev-attention)",
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      fontSize: 18,
      color: "var(--ac-ink)"
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--ac-font-mono)",
      fontSize: 15,
      color: "var(--ac-ink-muted)"
    }
  }, "est. ", c)), /*#__PURE__*/React.createElement(StatusChip, {
    status: s
  }))), /*#__PURE__*/React.createElement(Button, {
    size: "field",
    block: true,
    variant: "secondary",
    onClick: onBack
  }, "Back to today's tasks")));
}
function SyncQueueScreen({
  onBack
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FieldNav, {
    title: "Sync queue",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, [["Inspection · ABC 1234", "24 Aug 09:42", "QUEUED"], ["Photo · BRK-01", "24 Aug 09:41", "QUEUED"], ["Waste record · used oil 4.2 L", "24 Aug 08:15", "RETRYING"]].map(([l, t, s]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-sm)",
      minHeight: 56
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      fontSize: 18,
      color: "var(--ac-ink)"
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--ac-font-mono)",
      fontSize: 15,
      color: "var(--ac-ink-muted)"
    }
  }, t)), /*#__PURE__*/React.createElement(StatusPill, {
    tone: s === "RETRYING" ? "warn" : "neutral"
  }, s))), /*#__PURE__*/React.createElement(Button, {
    size: "field",
    block: true,
    variant: "secondary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 20
    })
  }, "Retry now")));
}
Object.assign(window, {
  PointEntryScreen,
  ReviewScreen,
  ScoreResultScreen,
  SyncQueueScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/field-app/InspectionScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/field-app/TaskScreens.jsx
try { (() => {
function TaskListScreen({
  onStart,
  onQueue
}) {
  const tasks = [{
    id: "WO-1042",
    plate: "ABC 1234",
    vehicle: "2019 Toyota Vios",
    service: "Preventive maintenance",
    time: "09:00",
    status: "IN PROGRESS",
    tone: "info"
  }, {
    id: "WO-1043",
    plate: "XYZ 8842",
    vehicle: "2021 Mitsubishi L300",
    service: "Full inspection",
    time: "11:00",
    status: "BOOKED",
    tone: "neutral"
  }, {
    id: "WO-1044",
    plate: "JKL 2290",
    vehicle: "2017 Honda City",
    service: "Brake service",
    time: "14:00",
    status: "AWAITING APPROVAL",
    tone: "warn"
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FieldNav, {
    title: "Today \xB7 24 Aug",
    right: /*#__PURE__*/React.createElement("span", {
      style: {
        font: "var(--type-label)",
        color: "var(--ac-ink-muted)",
        paddingRight: 8
      }
    }, "Mechanic \xB7 J. Cruz")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, tasks.map(t => /*#__PURE__*/React.createElement(Card, {
    key: t.id,
    interactive: true,
    onClick: onStart,
    pad: "md",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ac-font-mono)",
      fontSize: 18,
      fontWeight: 600,
      color: "var(--ac-ink)"
    }
  }, t.time), /*#__PURE__*/React.createElement(Plate, {
    variant: "plain",
    style: {
      fontSize: 17
    }
  }, t.plate), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(StatusPill, {
    tone: t.tone
  }, t.status)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, t.service), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      fontSize: 18,
      color: "var(--ac-ink-muted)"
    }
  }, t.vehicle, " \xB7 ", t.id))), /*#__PURE__*/React.createElement(Button, {
    size: "field",
    block: true,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "wrench",
      size: 20
    }),
    onClick: onStart,
    style: {
      marginTop: "var(--ac-space-sm)"
    }
  }, "Start inspection"), /*#__PURE__*/React.createElement(Button, {
    size: "field",
    block: true,
    variant: "secondary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 20
    }),
    onClick: onQueue
  }, "Sync queue (3)")));
}
function CategoryNavScreen({
  onBack,
  onPoint,
  onReview
}) {
  const done = CATS.reduce((n, c) => n + c.done, 0);
  const total = CATS.reduce((n, c) => n + c.total, 0);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(FieldNav, {
    title: "Inspection \xB7 ABC 1234",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      fontSize: 18,
      color: "var(--ac-ink-muted)"
    }
  }, done, " of ", total, " points recorded"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8,
      borderRadius: 999,
      background: "var(--ac-line)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${done / total * 100}%`,
      height: "100%",
      background: "var(--ac-primary)"
    }
  })), CATS.map(c => /*#__PURE__*/React.createElement(Card, {
    key: c.code,
    interactive: true,
    onClick: onPoint,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-md)",
      minHeight: 56
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, c.label), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      fontSize: 15,
      color: "var(--ac-ink-muted)"
    }
  }, c.labelFil)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ac-font-mono)",
      fontSize: 17,
      color: c.done === c.total ? "var(--ac-band-excellent)" : "var(--ac-ink-muted)"
    }
  }, c.done, "/", c.total), /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 22,
    color: "var(--ac-ink-muted)"
  }))), /*#__PURE__*/React.createElement(Button, {
    size: "field",
    block: true,
    onClick: onReview,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "clipboard-check",
      size: 20
    })
  }, "Review & submit")));
}
Object.assign(window, {
  TaskListScreen,
  CategoryNavScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/field-app/TaskScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/field-app/data.jsx
try { (() => {
const {
  Card,
  Button,
  Plate,
  StatusPill,
  Icon,
  FormField,
  ScoreGauge,
  StarRating,
  CategoryBar,
  BandChip,
  SyncBanner,
  StatusChoice,
  StatusChip,
  EmptyState
} = window.AutoCareDesignSystem_2155ba;
const POINTS = [{
  code: "BRK-01",
  label: "Front pad thickness",
  labelFil: "Kapal ng harap na brake pad",
  unit: "mm",
  measured: true,
  good: 5.0,
  value: "3.0",
  status: "ATTENTION",
  photoRequired: true
}, {
  code: "BRK-02",
  label: "Rear pad thickness",
  labelFil: "Kapal ng likod na brake pad",
  unit: "mm",
  measured: true,
  good: 5.0,
  value: "5.5",
  status: "GOOD"
}, {
  code: "BRK-03",
  label: "Disc runout",
  labelFil: "Pagkiling ng disc",
  measured: false,
  status: "GOOD"
}, {
  code: "BRK-04",
  label: "Brake fluid condition",
  labelFil: "Kalagayan ng brake fluid",
  measured: false,
  status: null
}];
const CATS = [{
  code: "BRK",
  label: "Brakes",
  labelFil: "Preno",
  done: 3,
  total: 4
}, {
  code: "TYR",
  label: "Tyres & wheels",
  labelFil: "Gulong",
  done: 6,
  total: 6
}, {
  code: "ENG",
  label: "Engine & fluids",
  labelFil: "Makina",
  done: 12,
  total: 12
}, {
  code: "ELE",
  label: "Electrical & battery",
  labelFil: "Kuryente",
  done: 0,
  total: 7
}, {
  code: "SUS",
  label: "Suspension & steering",
  labelFil: "Suspensyon",
  done: 0,
  total: 8
}, {
  code: "BDY",
  label: "Body & lights",
  labelFil: "Katawan at ilaw",
  done: 0,
  total: 10
}];
const FieldNav = ({
  title,
  onBack,
  right
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    alignItems: "center",
    gap: "var(--ac-space-sm)",
    minHeight: 52,
    flex: "none",
    background: "var(--ac-surface)",
    borderBottom: "1px solid var(--ac-line)",
    padding: "0 var(--ac-space-sm)"
  }
}, onBack && /*#__PURE__*/React.createElement("button", {
  type: "button",
  onClick: onBack,
  style: {
    display: "flex",
    alignItems: "center",
    minHeight: 44,
    border: "none",
    background: "transparent",
    color: "var(--ac-primary)",
    font: "var(--type-h2)",
    cursor: "pointer",
    padding: "0 4px"
  }
}, /*#__PURE__*/React.createElement(Icon, {
  name: "chevron-left",
  size: 22
}), " Back"), /*#__PURE__*/React.createElement("span", {
  style: {
    font: "var(--type-h2)",
    color: "var(--ac-ink)",
    flex: 1
  }
}, title), right);
Object.assign(window, {
  POINTS,
  CATS,
  FieldNav,
  Card,
  Button,
  Plate,
  StatusPill,
  Icon,
  FormField,
  ScoreGauge,
  StarRating,
  CategoryBar,
  BandChip,
  SyncBanner,
  StatusChoice,
  StatusChip,
  EmptyState
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/field-app/data.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/BookingFlow.jsx
try { (() => {
/* Faithful to apps/member/src/features/booking/{ServiceTypeScreen,SlotPickerScreen,ConfirmScreen}.tsx.
   Three steps only — the source flow has no pick-up step (M-21 is not built in the repo). */

const SERVICE_TYPES = [{
  code: "PM",
  name: "Preventive maintenance",
  durationMin: 120,
  price: "₱2,800.00",
  entitled: true
}, {
  code: "INS",
  name: "Full inspection",
  durationMin: 120,
  price: "₱1,500.00",
  entitled: true
}, {
  code: "BRK",
  name: "Brake service",
  durationMin: 120,
  price: "₱3,200.00",
  entitled: false
}, {
  code: "AC",
  name: "Aircon service",
  durationMin: 90,
  price: "₱1,800.00",
  entitled: false
}];
const OPEN_SLOTS = ["08:00", "09:00", "10:30", "13:00", "14:00", "15:30"];
const ENTITLEMENT_LINE = {
  PM: "Uses 1 of 2 monthly inspections",
  INS: "Uses 1 of 2 monthly inspections",
  BRK: null,
  AC: null
};
function BookingFlow({
  onBack,
  onDone
}) {
  const [step, setStep] = React.useState(0);
  const [service, setService] = React.useState(null);
  const [slot, setSlot] = React.useState(null);
  const [hold, setHold] = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);

  // FR-043 — picking a slot acquires a 10-minute hold; it counts down and can lapse.
  React.useEffect(() => {
    if (hold == null || hold <= 0) return;
    const t = setTimeout(() => setHold(hold - 1), 1000);
    return () => clearTimeout(t);
  }, [hold]);
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const expired = hold === 0;
  const back = () => step === 0 ? onBack() : setStep(step - 1);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(NavBar, {
    onBack: back
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-lg)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, step === 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "Book a service"), SERVICE_TYPES.map(s => /*#__PURE__*/React.createElement(Card, {
    key: s.code,
    interactive: true,
    onClick: () => {
      setService(s);
      setStep(1);
    },
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
      minHeight: "var(--ac-target-member)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink)"
    }
  }, s.name), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, s.durationMin, " min"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: s.entitled ? "var(--ac-primary)" : "var(--ac-ink)"
    }
  }, s.entitled ? "Included in your plan" : s.price)))), step === 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "Pick a time"), hold != null && !expired && /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-primary)"
    }
  }, "Slot held \u2014 ", mmss(hold), " left to confirm"), expired && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-danger)"
    }
  }, "Your hold expired. Please pick a time again."), /*#__PURE__*/React.createElement("div", {
    role: "button",
    tabIndex: 0,
    onClick: () => {
      setHold(null);
      setSlot(null);
    },
    style: {
      minHeight: "var(--ac-target-member)",
      display: "flex",
      alignItems: "center",
      font: "var(--type-label)",
      color: "var(--ac-primary)",
      cursor: "pointer"
    }
  }, "Refresh times")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "var(--ac-space-sm)"
    }
  }, OPEN_SLOTS.map(t => {
    const locked = hold != null && !expired;
    return /*#__PURE__*/React.createElement("button", {
      key: t,
      type: "button",
      disabled: locked && slot !== t,
      onClick: () => {
        setSlot(t);
        setHold(600);
      },
      style: {
        minHeight: "var(--ac-target-member)",
        padding: "0 var(--ac-space-md)",
        border: `1px solid ${slot === t ? "var(--ac-primary)" : "var(--ac-line)"}`,
        borderRadius: "var(--ac-radius-sm)",
        background: "var(--ac-surface)",
        font: "var(--type-code)",
        fontFamily: "var(--ac-font-mono)",
        color: "var(--ac-ink)",
        opacity: locked && slot !== t ? 0.4 : 1,
        cursor: locked && slot !== t ? "not-allowed" : "pointer"
      }
    }, t);
  })), slot && !expired && /*#__PURE__*/React.createElement(Button, {
    block: true,
    onClick: () => setStep(2)
  }, "Continue")), step === 2 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "Confirm booking"), /*#__PURE__*/React.createElement(Card, {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink)"
    }
  }, service?.name), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, "Tue, Sep 2, ", slot), ENTITLEMENT_LINE[service?.code] && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-primary)"
    }
  }, ENTITLEMENT_LINE[service.code])), /*#__PURE__*/React.createElement(Button, {
    block: true,
    disabled: submitting,
    onClick: () => {
      setSubmitting(true);
      setTimeout(onDone, 500);
    }
  }, submitting ? "Booking…" : "Confirm"))));
}
Object.assign(window, {
  BookingFlow
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/BookingFlow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/HealthScoreScreen.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function HealthScoreScreen({
  onBack,
  onBreakdown,
  onShare
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(NavBar, {
    title: "Health Score",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: "lg",
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(ScoreGauge, {
    score: 69,
    confidence: "MEDIUM",
    size: 220
  }), /*#__PURE__*/React.createElement(StarRating, {
    band: "FAIR",
    size: 22
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)",
      textAlign: "center"
    }
  }, "Inspected 12 Aug 2026 \xB7 48,210 km")), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      marginBottom: 4
    }
  }, "Why 69?"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, "Your categories averaged 84.5, but a safety-critical brake finding caps the score at 69 until it is resolved."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--ac-space-sm)",
      display: "flex",
      flexDirection: "column"
    }
  }, [["var(--ac-sev-attention)", "Front brake pads — 3.0 mm.", "Replace within 1,000 km."], ["var(--ac-sev-monitor)", "Rear tyres — 4.0 mm tread.", "Monitor; plan replacement."]].map(([c, b, t]) => /*#__PURE__*/React.createElement("div", {
    key: b,
    style: {
      display: "flex",
      gap: 10,
      alignItems: "baseline",
      padding: "var(--ac-space-sm) 0",
      borderTop: "1px solid var(--ac-line)",
      font: "var(--type-body)",
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 999,
      flex: "none",
      background: c,
      position: "relative",
      top: 1
    }
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", {
    style: {
      color: "var(--ac-ink)"
    }
  }, b), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--ac-ink-muted)"
    }
  }, t)))))), /*#__PURE__*/React.createElement(Button, {
    block: true,
    onClick: onBreakdown,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "list-tree",
      size: 18
    })
  }, "See category breakdown"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    style: {
      flex: 1
    },
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "trending-up",
      size: 16
    })
  }, "History"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    style: {
      flex: 1
    },
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "share-2",
      size: 16
    }),
    onClick: onShare
  }, "Share"))));
}
function BreakdownScreen({
  onBack
}) {
  const [target, setTarget] = React.useState(null);
  const [open, setOpen] = React.useState(null);
  const e = target ? EXPLAIN[target] : null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(NavBar, {
    title: "Category breakdown",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, "Tap any category to see what it means."), CATEGORIES.map(c => /*#__PURE__*/React.createElement(Card, {
    key: c.code,
    pad: "none"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement(CategoryBar, _extends({}, c, {
    onClick: () => setTarget(c.code)
  }))), /*#__PURE__*/React.createElement("div", {
    role: "button",
    onClick: () => setOpen(open === c.code ? null : c.code),
    style: {
      padding: "0 var(--ac-space-md) var(--ac-space-sm)",
      font: "var(--type-label)",
      color: "var(--ac-primary)",
      cursor: "pointer"
    }
  }, open === c.code ? "Hide components ▲" : "Show components ▼"), open === c.code && /*#__PURE__*/React.createElement("div", null, [["Front pad thickness", "ATTENTION"], ["Rear pad thickness", "MONITOR"], ["Disc runout", "GOOD"], ["Fluid level", "GOOD"]].map(([l, s]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    onClick: () => setTarget(c.code),
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "var(--ac-space-sm) var(--ac-space-md)",
      borderTop: "1px solid var(--ac-line)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink)"
    }
  }, l), /*#__PURE__*/React.createElement(StatusPill, {
    tone: s === "ATTENTION" ? "danger" : s === "MONITOR" ? "warn" : "success"
  }, s))))))), e && /*#__PURE__*/React.createElement(BottomSheet, {
    title: e.title,
    onClose: () => setTarget(null)
  }, /*#__PURE__*/React.createElement(StarRating, {
    band: e.stars,
    size: 22
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, e.body), e.measured && /*#__PURE__*/React.createElement(MeasuredRow, null, e.measured)));
}
Object.assign(window, {
  HealthScoreScreen,
  BreakdownScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/HealthScoreScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/HomeScreen.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function HomeScreen({
  onSeeAll,
  onBook,
  onOpenVehicle,
  onRoadside
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-lg)",
      padding: "var(--ac-space-lg) var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: window.__resources && window.__resources.logoMark || "../../assets/logo-mark.png",
    alt: "",
    width: "44",
    height: "44",
    style: {
      display: "block",
      flex: "none",
      borderRadius: 10
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h1)",
      color: "var(--ac-primary-deep)"
    }
  }, "Magandang araw, Rielle"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, "Care Plus \xB7 next billing 15 Sep 2026"))), /*#__PURE__*/React.createElement(AttentionCard, {
    items: ATTENTION,
    onSeeAll: onSeeAll,
    onPressItem: onSeeAll
  }), /*#__PURE__*/React.createElement(Card, {
    interactive: true,
    onClick: onOpenVehicle,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(Plate, {
    variant: "chip"
  }, "ABC 1234"), /*#__PURE__*/React.createElement(BandChip, {
    band: "FAIR"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink)"
    }
  }, "2019 Toyota Vios 1.3 XE"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-code)",
      color: "var(--ac-ink-muted)",
      fontFamily: "var(--ac-font-mono)"
    }
  }, "48,210 km")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(StarRating, {
    band: "FAIR",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-primary)",
      fontWeight: 600
    }
  }, "Health score 69 \u203A"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "deep",
    block: true,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "calendar-plus",
      size: 18
    }),
    onClick: onBook
  }, "Book a service"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    style: {
      flex: 1
    }
  }, "Update odometer"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    style: {
      flex: 1
    }
  }, "Add vehicle"))), /*#__PURE__*/React.createElement(Card, {
    accent: "var(--ac-danger)",
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "phone",
    size: 24,
    color: "var(--ac-danger)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "Roadside assistance"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, "2 call-outs left this cycle")), /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    onClick: onRoadside
  }, "Request")));
}
function AttentionListScreen({
  onBack
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(NavBar, {
    title: "Needs attention",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, [["ABC 1234", ATTENTION.filter(i => i.plate === "ABC 1234")], ["XYZ 8842", ATTENTION.filter(i => i.plate === "XYZ 8842")]].map(([plate, items]) => /*#__PURE__*/React.createElement("div", {
    key: plate,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(Plate, {
    variant: "plain",
    style: {
      color: "var(--ac-ink-muted)"
    }
  }, plate), items.map(i => /*#__PURE__*/React.createElement(AttentionItemRow, _extends({
    key: i.id
  }, i)))))));
}
Object.assign(window, {
  HomeScreen,
  AttentionListScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/OtherScreens.jsx
try { (() => {
function VehiclesScreen({
  onOpenVehicle
}) {
  const rows = [{
    plate: "ABC 1234",
    name: "2019 Toyota Vios 1.3 XE",
    km: "48,210 km",
    score: 69,
    band: "FAIR"
  }, {
    plate: "XYZ 8842",
    name: "2021 Mitsubishi L300",
    km: "112,940 km",
    score: 81,
    band: "GOOD"
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-lg) var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(Section, {
    title: "My vehicles",
    sub: "2 vehicles on Care Plus"
  }), rows.map(r => /*#__PURE__*/React.createElement(Card, {
    key: r.plate,
    interactive: true,
    onClick: onOpenVehicle,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: "var(--ac-radius-sm)",
      background: "var(--ac-chassis)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "none"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "car-front",
    size: 24,
    color: "var(--ac-ink-muted)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Plate, {
    variant: "plain"
  }, r.plate), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink)"
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, r.km)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(BandChip, {
    band: r.band
  }), /*#__PURE__*/React.createElement(StarRating, {
    band: r.band,
    size: 14
  })))), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    block: true,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 18
    }),
    style: {
      marginTop: "var(--ac-space-sm)"
    }
  }, "Add vehicle"));
}

/* Faithful to features/booking/BookingsListScreen.tsx (M-23). */
function BookingsScreen({
  onBookNew,
  onApprove
}) {
  const upcoming = [{
    id: "1",
    name: "Preventive maintenance",
    when: "Tue, Sep 2, 09:00",
    status: "CONFIRMED",
    cancellable: true
  }, {
    id: "2",
    name: "Full inspection",
    when: "Mon, Sep 22, 11:00",
    status: "BOOKED",
    cancellable: true
  }];
  const past = [{
    id: "3",
    name: "Brake service",
    when: "Sun, May 3, 14:00",
    status: "COMPLETED"
  }, {
    id: "4",
    name: "Aircon service",
    when: "Thu, Apr 10, 10:00",
    status: "CANCELLED"
  }];
  const [cancelled, setCancelled] = React.useState([]);
  const Row = ({
    a,
    cancellable
  }) => /*#__PURE__*/React.createElement(Card, {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink)"
    }
  }, a.name), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, a.when, " \xB7 ", cancelled.includes(a.id) ? "CANCELLED" : a.status.replace("_", " ")), cancellable && !cancelled.includes(a.id) && /*#__PURE__*/React.createElement("div", {
    role: "button",
    tabIndex: 0,
    onClick: () => setCancelled([...cancelled, a.id]),
    style: {
      minHeight: "var(--ac-target-member)",
      display: "flex",
      alignItems: "center",
      font: "var(--type-label)",
      color: "var(--ac-danger)",
      cursor: "pointer"
    }
  }, "Cancel"));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-lg)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "My bookings"), /*#__PURE__*/React.createElement("div", {
    role: "button",
    tabIndex: 0,
    onClick: onBookNew,
    style: {
      minHeight: "var(--ac-target-member)",
      display: "flex",
      alignItems: "center",
      font: "var(--type-label)",
      color: "var(--ac-primary)",
      cursor: "pointer"
    }
  }, "Book new")), /*#__PURE__*/React.createElement(Card, {
    accent: "var(--ac-sev-attention)",
    interactive: true,
    onClick: onApprove,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink)"
    }
  }, "Work order WO-1042 needs your decision"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-primary)"
    }
  }, "Approve your service \u203A")), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, "Upcoming"), upcoming.map(a => /*#__PURE__*/React.createElement(Row, {
    key: a.id,
    a: a,
    cancellable: a.cancellable
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, "Past"), past.map(a => /*#__PURE__*/React.createElement(Row, {
    key: a.id,
    a: a,
    cancellable: false
  })));
}

/* Faithful to features/work-orders/ApprovalRequestScreen.tsx (M-25) — per-line
   Approve / Defer / Decline, running approved total, atomic confirm. */
function ApprovalScreen({
  onBack,
  onDone
}) {
  const items = [{
    id: "i1",
    label: "Front brake pad replacement",
    desc: "Front pads at 3.0 mm, below the 5.0 mm threshold.",
    price: 320000,
    severity: "CRITICAL"
  }, {
    id: "i2",
    label: "Tyre rotation",
    desc: "Rear tread wearing unevenly.",
    price: 45000,
    severity: "ATTENTION"
  }, {
    id: "i3",
    label: "Cabin air filter",
    desc: null,
    price: 65000,
    severity: "MONITOR"
  }];
  const SEV = {
    CRITICAL: "var(--ac-sev-critical)",
    ATTENTION: "var(--ac-sev-attention)",
    MONITOR: "var(--ac-sev-monitor)"
  };
  const [choices, setChoices] = React.useState({});
  const total = items.filter(i => choices[i.id] === "APPROVED").reduce((s, i) => s + i.price, 0);
  const allDecided = items.every(i => choices[i.id]);
  const peso = c => `₱${(c / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2
  })}`;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(NavBar, {
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h1)",
      color: "var(--ac-ink)"
    }
  }, "Approve your service"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, "Work order WO-1042. Decide each item below \u2014 approve what you want done, decline or defer the rest."), items.map(i => /*#__PURE__*/React.createElement(Card, {
    key: i.id,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-xs)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 5,
      flex: "none",
      background: SEV[i.severity]
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      flex: 1
    }
  }, i.label), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      fontVariantNumeric: "tabular-nums"
    }
  }, peso(i.price))), i.desc && /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, i.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--ac-space-xs)"
    }
  }, [["APPROVED", "Approve", "var(--ac-success)"], ["DEFERRED", "Defer", "var(--ac-ink-muted)"], ["DECLINED", "Decline", "var(--ac-danger)"]].map(([d, label, color]) => {
    const on = choices[i.id] === d;
    return /*#__PURE__*/React.createElement("button", {
      key: d,
      type: "button",
      onClick: () => setChoices(c => ({
        ...c,
        [i.id]: d
      })),
      style: {
        flex: 1,
        minHeight: "var(--ac-target-member)",
        borderRadius: "var(--ac-radius-md)",
        background: on ? color : "var(--ac-surface)",
        color: on ? "#fff" : "var(--ac-ink)",
        border: `1px solid ${on ? color : "var(--ac-line)"}`,
        font: "var(--type-body)",
        cursor: "pointer"
      }
    }, label);
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: "1px solid var(--ac-line)",
      background: "var(--ac-surface)",
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "Approved total"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      fontVariantNumeric: "tabular-nums"
    }
  }, peso(total))), /*#__PURE__*/React.createElement(Button, {
    block: true,
    disabled: !allDecided,
    onClick: onDone
  }, "Confirm decisions")));
}
function AccountScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-lg) var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement(Section, {
    title: "Account",
    sub: "Rielle Tatel \xB7 rielle@example.ph"
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "Care Plus"), /*#__PURE__*/React.createElement(StatusPill, {
    tone: "success"
  }, "ACTIVE")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)",
      textTransform: "uppercase",
      letterSpacing: "var(--ac-tracking-label)"
    }
  }, "Next billing date"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink)"
    }
  }, "15 September 2026 \xB7 \u20B11,499"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, "6-month lock-in \xB7 ends 15 Jan 2027")), /*#__PURE__*/React.createElement(Section, {
    title: "Change plan"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(PlanCard, {
    name: "Care Basic",
    price: "\u20B1899",
    lockInMonths: 0,
    actionLabel: "Downgrade",
    inclusions: ["1 inspection/cycle", "1 roadside call-out/cycle"]
  }), /*#__PURE__*/React.createElement(PlanCard, {
    name: "Care Plus",
    price: "\u20B11,499",
    lockInMonths: 6,
    selected: true,
    actionLabel: "Current plan",
    inclusions: ["2 inspections/cycle", "1 pick-up & delivery/cycle", "2 roadside call-outs/cycle"]
  }))), ["Invoices & receipts", "Notifications", "Privacy & data", "Emergency contact"].map(l => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 48,
      borderBottom: "1px solid var(--ac-line)",
      font: "var(--type-body)",
      color: "var(--ac-ink)"
    }
  }, l, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-right",
    size: 18,
    color: "var(--ac-ink-muted)"
  }))));
}
Object.assign(window, {
  VehiclesScreen,
  BookingsScreen,
  ApprovalScreen,
  AccountScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/OtherScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/RoadsideScreens.jsx
try { (() => {
const INCIDENTS = [{
  code: "BATT",
  label: "Won't start",
  fil: "Ayaw umandar",
  icon: "battery-warning"
}, {
  code: "FLAT",
  label: "Flat tyre",
  fil: "Flat na gulong",
  icon: "disc-3"
}, {
  code: "FUEL",
  label: "Out of fuel",
  fil: "Walang gasolina",
  icon: "fuel"
}, {
  code: "CRSH",
  label: "Collision",
  fil: "Aksidente",
  icon: "car-front"
}, {
  code: "OTHR",
  label: "Something else",
  fil: "Iba pa",
  icon: "circle-help"
}];
function RoadsideRequest({
  onBack,
  onSubmit
}) {
  const [pick, setPick] = React.useState(null);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(NavBar, {
    title: "Roadside assistance",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, "What has happened? We'll send the nearest responder and keep you updated here."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, INCIDENTS.map(i => {
    const on = pick === i.code;
    return /*#__PURE__*/React.createElement(Card, {
      key: i.code,
      interactive: true,
      onClick: () => setPick(i.code),
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--ac-space-md)",
        minHeight: 48,
        border: on ? "var(--ac-border-control) solid var(--ac-primary)" : undefined
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: i.icon,
      size: 22,
      color: on ? "var(--ac-primary)" : "var(--ac-ink-muted)"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: "var(--type-body)",
        fontWeight: 600,
        color: "var(--ac-ink)"
      }
    }, i.label), /*#__PURE__*/React.createElement("div", {
      style: {
        font: "var(--type-label)",
        color: "var(--ac-ink-muted)"
      }
    }, i.fil)));
  })), /*#__PURE__*/React.createElement(Card, {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "map-pin",
    size: 20,
    color: "var(--ac-primary)"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink)"
    }
  }, "Governor Camins Ave, Zamboanga City"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, "Located from your phone \xB7 accurate to 20 m")), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost"
  }, "Change")), /*#__PURE__*/React.createElement(Card, {
    accent: "var(--ac-primary)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "2 call-outs left this cycle"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, "Care Plus covers this request at no charge.")), /*#__PURE__*/React.createElement(Button, {
    block: true,
    variant: "danger",
    disabled: !pick,
    onClick: onSubmit
  }, "Request assistance now"), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, "Prefer to talk? Call the hotline on ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ac-font-mono)"
    }
  }, "0917 555 0142"), ".")));
}
function RoadsideStatus({
  onBack
}) {
  const steps = [{
    label: "Request received",
    time: "10:42",
    state: "done",
    body: "We have your location and the incident type."
  }, {
    label: "Responder assigned",
    time: "10:45",
    state: "done",
    body: "Ariel D. · Service van ZAM-4 · 0917 555 0188"
  }, {
    label: "On the way",
    time: "10:47",
    state: "active",
    body: "Estimated arrival 11:05 — about 18 minutes."
  }, {
    label: "On site",
    time: null,
    state: "todo",
    body: null
  }, {
    label: "Resolved",
    time: null,
    state: "todo",
    body: null
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(NavBar, {
    title: "Roadside status",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    accent: "var(--ac-sev-critical)",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "Won't start \xB7 ABC 1234"), /*#__PURE__*/React.createElement(StatusPill, {
    tone: "info"
  }, "ON THE WAY")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, "Governor Camins Ave \xB7 reported 10:42")), /*#__PURE__*/React.createElement(Card, null, steps.map((s, i) => {
    const color = s.state === "todo" ? "var(--ac-line)" : s.state === "active" ? "var(--ac-primary)" : "var(--ac-success)";
    return /*#__PURE__*/React.createElement("div", {
      key: s.label,
      style: {
        display: "flex",
        gap: "var(--ac-space-md)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: "none",
        width: 14
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 14,
        height: 14,
        borderRadius: 999,
        background: s.state === "todo" ? "var(--ac-surface)" : color,
        border: `2px solid ${color}`,
        marginTop: 4,
        boxSizing: "border-box"
      }
    }), i < steps.length - 1 && /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        width: 2,
        background: s.state === "done" ? "var(--ac-success)" : "var(--ac-line)",
        minHeight: 26
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        paddingBottom: i < steps.length - 1 ? "var(--ac-space-md)" : 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: "var(--type-body)",
        fontWeight: 600,
        color: s.state === "todo" ? "var(--ac-ink-muted)" : "var(--ac-ink)"
      }
    }, s.label), s.time && /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--ac-font-mono)",
        fontSize: 13,
        color: "var(--ac-ink-muted)"
      }
    }, s.time)), s.body && /*#__PURE__*/React.createElement("div", {
      style: {
        font: "var(--type-body)",
        fontSize: 14,
        color: "var(--ac-ink-muted)"
      }
    }, s.body)));
  })), /*#__PURE__*/React.createElement(Button, {
    block: true,
    variant: "secondary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "phone",
      size: 18
    })
  }, "Call Ariel D."), /*#__PURE__*/React.createElement(Button, {
    block: true,
    variant: "ghost",
    style: {
      color: "var(--ac-danger)"
    }
  }, "Cancel request")));
}
function ShareCertificateScreen({
  onBack
}) {
  const [live, setLive] = React.useState(true);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(NavBar, {
    title: "Share certificate",
    onBack: onBack
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--ac-space-md)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, "A certificate is a read-only page a buyer can open without the app. It shows the score, category breakdown and service count \u2014 never your contact details."), /*#__PURE__*/React.createElement(Card, {
    pad: "lg",
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(ScoreGauge, {
    score: 69,
    size: 180,
    isStale: !live,
    daysSinceInspection: 13
  }), /*#__PURE__*/React.createElement(Plate, {
    variant: "plain"
  }, "ABC 1234")), /*#__PURE__*/React.createElement(Card, {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "Link"), /*#__PURE__*/React.createElement(StatusPill, {
    tone: live ? "success" : "neutral"
  }, live ? "ACTIVE" : "REVOKED")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--ac-chassis)",
      borderRadius: "var(--ac-radius-sm)",
      padding: "var(--ac-space-sm)",
      fontFamily: "var(--ac-font-mono)",
      fontSize: 13,
      color: "var(--ac-ink)",
      wordBreak: "break-all"
    }
  }, "autocare.example/c/7QK4-92MB"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, "Valid until 10 Nov 2026 \xB7 verification code 7QK4-92MB")), live ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
    block: true,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "share-2",
      size: 18
    })
  }, "Share link"), /*#__PURE__*/React.createElement(Button, {
    block: true,
    variant: "ghost",
    style: {
      color: "var(--ac-danger)"
    },
    onClick: () => setLive(false)
  }, "Revoke this link")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    accent: "var(--ac-ink-muted)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)"
    }
  }, "Link revoked"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      color: "var(--ac-ink-muted)"
    }
  }, "Anyone opening it now sees a revoked notice instead of your score.")), /*#__PURE__*/React.createElement(Button, {
    block: true,
    onClick: () => setLive(true)
  }, "Generate a new link"))));
}
Object.assign(window, {
  RoadsideRequest,
  RoadsideStatus,
  ShareCertificateScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/RoadsideScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/member-app/data.jsx
try { (() => {
const {
  Card,
  Button,
  Plate,
  StatusPill,
  Icon,
  FormField,
  AttentionCard,
  AttentionItemRow,
  ScoreGauge,
  StarRating,
  CategoryBar,
  BandChip,
  TabBar,
  BottomSheet,
  MeasuredRow,
  PlanCard,
  EmptyState
} = window.AutoCareDesignSystem_2155ba;
const ATTENTION = [{
  id: "1",
  severity: "CRITICAL",
  plate: "ABC 1234",
  title: "Front brake pads at 3.0 mm",
  body: "Replace within 1,000 km. Book a service and we'll collect the vehicle."
}, {
  id: "2",
  severity: "ATTENTION",
  plate: "ABC 1234",
  title: "Rear tyres at 4.0 mm tread",
  body: "Still legal, but plan replacement before the rainy season."
}, {
  id: "3",
  severity: "MONITOR",
  plate: "XYZ 8842",
  title: "Battery capacity 78%",
  body: "Within range. We'll re-check at the next inspection."
}, {
  id: "4",
  severity: "INFO",
  plate: "ABC 1234",
  title: "Inspection due in 12 days",
  body: "Your plan covers two inspections this cycle; one is unused."
}];
const CATEGORIES = [{
  code: "BRK",
  label: "Brakes",
  score: 55.0,
  weight: 22,
  points: 9
}, {
  code: "TYR",
  label: "Tyres & wheels",
  score: 64.0,
  weight: 18,
  points: 6
}, {
  code: "ENG",
  label: "Engine & fluids",
  score: 91.0,
  weight: 20,
  points: 12
}, {
  code: "ELE",
  label: "Electrical & battery",
  score: 80.0,
  weight: 14,
  points: 7
}, {
  code: "SUS",
  label: "Suspension & steering",
  score: 88.0,
  weight: 14,
  points: 8
}, {
  code: "BDY",
  label: "Body & lights",
  score: 95.0,
  weight: 12,
  points: 10
}];
const EXPLAIN = {
  BRK: {
    title: "Brakes",
    stars: "NEEDS_ATTENTION",
    body: "Front pad thickness is below the replacement threshold. Because brakes are safety-critical, this finding caps the whole vehicle score until it is resolved.",
    measured: "Measured 3.0 mm · good ≥ 5.0 mm"
  },
  TYR: {
    title: "Tyres & wheels",
    stars: "FAIR",
    body: "Rear tread depth is above the legal minimum but wearing unevenly. Rotation is recommended at the next visit.",
    measured: "Measured 4.0 mm · good ≥ 5.0 mm"
  },
  ENG: {
    title: "Engine & fluids",
    stars: "EXCELLENT",
    body: "Oil condition, coolant level and belt tension are all within the acceptable operational range.",
    measured: null
  },
  ELE: {
    title: "Electrical & battery",
    stars: "GOOD",
    body: "Battery capacity remains within the acceptable operational range but should be monitored during the next inspection.",
    measured: "Measured 12.3 V · good ≥ 12.4 V"
  },
  SUS: {
    title: "Suspension & steering",
    stars: "GOOD",
    body: "No play detected in the steering rack. Front shocks show light seepage; not yet actionable.",
    measured: null
  },
  BDY: {
    title: "Body & lights",
    stars: "EXCELLENT",
    body: "All lamps functional, no structural corrosion found on the underbody.",
    measured: null
  }
};
const Section = ({
  title,
  sub,
  children
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--ac-space-sm)"
  }
}, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
  style: {
    font: "var(--type-h1)",
    color: "var(--ac-ink)"
  }
}, title), sub && /*#__PURE__*/React.createElement("div", {
  style: {
    font: "var(--type-label)",
    color: "var(--ac-ink-muted)"
  }
}, sub)), children);
const NavBar = ({
  title,
  onBack
}) => /*#__PURE__*/React.createElement("div", {
  style: {
    display: "flex",
    alignItems: "center",
    gap: "var(--ac-space-sm)",
    height: 44,
    flex: "none",
    background: "var(--ac-surface)",
    borderBottom: "1px solid var(--ac-line)",
    padding: "0 var(--ac-space-sm)"
  }
}, /*#__PURE__*/React.createElement("button", {
  type: "button",
  onClick: onBack,
  style: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    border: "none",
    background: "transparent",
    color: "var(--ac-primary)",
    font: "var(--type-body)",
    fontWeight: 600,
    cursor: "pointer",
    padding: "8px 4px"
  }
}, /*#__PURE__*/React.createElement(Icon, {
  name: "chevron-left",
  size: 18
}), " Back"), /*#__PURE__*/React.createElement("span", {
  style: {
    font: "var(--type-h2)",
    color: "var(--ac-ink)"
  }
}, title));
Object.assign(window, {
  ATTENTION,
  CATEGORIES,
  EXPLAIN,
  Section,
  NavBar,
  Card,
  Button,
  Plate,
  StatusPill,
  Icon,
  FormField,
  AttentionCard,
  AttentionItemRow,
  ScoreGauge,
  StarRating,
  CategoryBar,
  BandChip,
  TabBar,
  BottomSheet,
  MeasuredRow,
  PlanCard,
  EmptyState
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/member-app/data.jsx", error: String((e && e.message) || e) }); }

// ui_kits/staff-web/AdminScreens.jsx
try { (() => {
function WorkOrderScreen() {
  const [lines, setLines] = React.useState([{
    id: 1,
    label: "Front brake pad set",
    kind: "Part",
    qty: 1,
    price: "₱2,400",
    state: "AWAITING APPROVAL",
    tone: "warn"
  }, {
    id: 2,
    label: "Brake pad replacement labour",
    kind: "Labour",
    qty: 1.5,
    price: "₱800",
    state: "AWAITING APPROVAL",
    tone: "warn"
  }, {
    id: 3,
    label: "Engine oil 5W-30 (4 L)",
    kind: "Part",
    qty: 1,
    price: "₱1,150",
    state: "APPROVED",
    tone: "success"
  }, {
    id: 4,
    label: "Tyre rotation",
    kind: "Labour",
    qty: 0.5,
    price: "₱450",
    state: "DECLINED",
    tone: "neutral"
  }]);
  const set = (id, state, tone) => setLines(lines.map(l => l.id === id ? {
    ...l,
    state,
    tone
  } : l));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 300px",
      gap: "var(--ac-space-lg)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: "var(--type-h1)",
      color: "var(--ac-ink)",
      margin: 0
    }
  }, "Work order WO-1042"), /*#__PURE__*/React.createElement(StatusPill, {
    tone: "info"
  }, "IN PROGRESS")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      fontSize: 14,
      color: "var(--ac-ink-muted)"
    }
  }, "ABC 1234 \xB7 2019 Toyota Vios 1.3 XE \xB7 R. Tatel \xB7 Care Plus")), /*#__PURE__*/React.createElement(Card, {
    pad: "none"
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    style: {
      textAlign: "left"
    }
  }, ["Line", "Type", "Qty", "Amount", "State", ""].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      padding: "10px 14px",
      fontFamily: "var(--ac-font-display)",
      fontWeight: 600,
      letterSpacing: "0.02em",
      borderBottom: "1px solid var(--ac-line)",
      color: "var(--ac-ink)"
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, lines.map(l => /*#__PURE__*/React.createElement("tr", {
    key: l.id,
    style: {
      borderBottom: "1px solid var(--ac-line)"
    }
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 14px",
      color: "var(--ac-ink)"
    }
  }, l.label), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 14px",
      color: "var(--ac-ink-muted)"
    }
  }, l.kind), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 14px",
      fontFamily: "var(--ac-font-mono)",
      fontVariantNumeric: "tabular-nums"
    }
  }, l.qty), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 14px",
      fontFamily: "var(--ac-font-mono)",
      fontVariantNumeric: "tabular-nums"
    }
  }, l.price), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 14px"
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    tone: l.tone
  }, l.state)), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "10px 14px",
      textAlign: "right",
      whiteSpace: "nowrap"
    }
  }, l.state === "AWAITING APPROVAL" && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => set(l.id, "APPROVED", "success"),
    style: {
      height: 32,
      padding: "0 10px",
      borderRadius: "var(--ac-radius-sm)",
      border: "none",
      background: "var(--ac-primary)",
      color: "#fff",
      font: "var(--type-label)",
      cursor: "pointer"
    }
  }, "Approve"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => set(l.id, "DECLINED", "neutral"),
    style: {
      height: 32,
      padding: "0 10px",
      borderRadius: "var(--ac-radius-sm)",
      border: "1px solid var(--ac-line)",
      background: "transparent",
      color: "var(--ac-ink)",
      font: "var(--type-label)",
      cursor: "pointer"
    }
  }, "Decline")))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement(Button, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "send",
      size: 16
    })
  }, "Request member approval"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary"
  }, "Add part or labour line"))), /*#__PURE__*/React.createElement("aside", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: "lg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      marginBottom: "var(--ac-space-sm)"
    }
  }, "Health score"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-sm)",
      marginBottom: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ac-font-display)",
      fontWeight: 600,
      fontSize: 40,
      color: "var(--ac-band-fair-text)",
      lineHeight: 1
    }
  }, "69"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(BandChip, {
    band: "FAIR"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(StarRating, {
    band: "FAIR",
    size: 14
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(CategoryBar, {
    label: "Brakes",
    score: 55,
    compact: true
  }), /*#__PURE__*/React.createElement(CategoryBar, {
    label: "Tyres",
    score: 64,
    compact: true
  }), /*#__PURE__*/React.createElement(CategoryBar, {
    label: "Engine",
    score: 91,
    compact: true
  }))), /*#__PURE__*/React.createElement(Card, {
    pad: "lg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      marginBottom: 4
    }
  }, "Entitlements"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      fontSize: 14,
      color: "var(--ac-ink-muted)"
    }
  }, "1 of 2 inspections used \xB7 1 pick-up remaining this cycle."))));
}
function AdminDashboard() {
  const kpis = [["MRR", "₱412,300", "+4.2% vs last month"], ["Active members", "274", "+11 this month"], ["Churn (30d)", "2.1%", "-0.4 pts"], ["Bay utilisation", "78%", "target 85%"]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-lg)"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: "var(--type-h1)",
      color: "var(--ac-ink)",
      margin: 0
    }
  }, "Admin dashboard"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: "var(--ac-space-md)"
    }
  }, kpis.map(([l, v, d]) => /*#__PURE__*/React.createElement(Card, {
    key: l,
    pad: "lg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)",
      textTransform: "uppercase",
      letterSpacing: "var(--ac-tracking-label)"
    }
  }, l), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--ac-font-display)",
      fontWeight: 600,
      fontSize: 34,
      color: "var(--ac-ink)",
      lineHeight: 1.2,
      fontVariantNumeric: "tabular-nums"
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)"
    }
  }, d)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.4fr 1fr",
      gap: "var(--ac-space-md)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: "lg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      marginBottom: "var(--ac-space-sm)"
    }
  }, "Forward utilisation \xB7 next 14 days"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: 4,
      height: 140,
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": true,
    style: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: "85%",
      borderTop: "1px dashed var(--ac-danger)"
    }
  }), UTIL.map((r, i) => {
    const breach = r > 0.85,
      warn = !breach && r >= 0.7;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      title: `${Math.round(r * 100)}%`,
      style: {
        flex: 1,
        height: `${r * 100}%`,
        borderRadius: "3px 3px 0 0",
        background: breach ? "var(--ac-danger)" : warn ? "var(--ac-band-fair)" : "var(--ac-primary)"
      }
    });
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)",
      marginTop: "var(--ac-space-sm)"
    }
  }, "Dashed line is the 85% capacity threshold. Bars turn amber approaching it and red once breached.")), /*#__PURE__*/React.createElement(Card, {
    pad: "lg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      marginBottom: "var(--ac-space-sm)"
    }
  }, "Checklist editor"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, [["Brakes", "22%", "9 points"], ["Engine & fluids", "20%", "12 points"], ["Tyres & wheels", "18%", "6 points"], ["Electrical & battery", "14%", "7 points"]].map(([c, w, p]) => /*#__PURE__*/React.createElement("div", {
    key: c,
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 0",
      borderTop: "1px solid var(--ac-line)",
      font: "var(--type-body)",
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--ac-ink)"
    }
  }, c), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      gap: 12,
      fontFamily: "var(--ac-font-mono)",
      fontSize: 13,
      color: "var(--ac-ink-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", null, w), /*#__PURE__*/React.createElement("span", null, p))))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)",
      marginTop: "var(--ac-space-sm)"
    }
  }, "Weights are versioned \u2014 editing creates a new checklist version."), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    block: true,
    style: {
      marginTop: "var(--ac-space-sm)"
    }
  }, "Edit weights"))), /*#__PURE__*/React.createElement(Card, {
    pad: "lg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      marginBottom: 4
    }
  }, "Waste log export (DENR)"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--type-body)",
      fontSize: 14,
      color: "var(--ac-ink-muted)",
      flex: 1
    }
  }, "42 records this quarter \xB7 used oil 168 L, filters 61, coolant 24 L. Last export 30 Jun 2026."), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "download",
      size: 16
    })
  }, "Export CSV"))));
}
Object.assign(window, {
  WorkOrderScreen,
  AdminDashboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/staff-web/AdminScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/staff-web/StaffScreens.jsx
try { (() => {
function LoginScreen({
  onSignIn
}) {
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--ac-chassis)",
      padding: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 380,
      background: "var(--ac-surface)",
      borderRadius: "var(--ac-radius-md)",
      border: "1px solid var(--ac-line)",
      padding: 32,
      boxShadow: "var(--ac-elevation-raised)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--ac-font-display)",
      fontWeight: 600,
      fontSize: 32,
      color: "var(--ac-primary-deep)",
      letterSpacing: "0.01em"
    }
  }, "AutoCare+"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      fontSize: 14,
      color: "var(--ac-ink-muted)",
      marginBottom: "var(--ac-space-lg)"
    }
  }, "Staff console"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement(FormField, {
    id: "e",
    label: "Email",
    value: email,
    onChange: setEmail,
    placeholder: "you@autocare.ph"
  }), /*#__PURE__*/React.createElement(FormField, {
    id: "p",
    label: "Password",
    type: "password",
    value: pw,
    onChange: setPw,
    error: err
  }), /*#__PURE__*/React.createElement(Button, {
    block: true,
    disabled: !email || !pw,
    onClick: () => email.includes("@") ? onSignIn() : setErr("Wrong email or password")
  }, "Sign in")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      color: "var(--ac-ink-muted)",
      marginTop: "var(--ac-space-lg)"
    }
  }, "Staff access only. Members use the mobile app.")));
}
function ScheduleBoard() {
  const [cancelled, setCancelled] = React.useState([]);
  const hours = [...new Set(APPTS.map(a => a.hour))];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 300px",
      gap: "var(--ac-space-lg)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("section", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: "var(--type-h1)",
      color: "var(--ac-ink)",
      margin: 0,
      flex: 1
    }
  }, "Schedule \xB7 Mon 24 Aug"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-left",
      size: 16
    })
  }, "Prev"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary"
  }, "Next"), /*#__PURE__*/React.createElement(Button, {
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 16
    })
  }, "New appointment")), hours.map(h => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      display: "grid",
      gridTemplateColumns: "64px 1fr",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--ac-font-mono)",
      fontSize: 14,
      color: "var(--ac-ink-muted)",
      paddingTop: 10
    }
  }, h), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, APPTS.filter(a => a.hour === h).map(a => {
    const off = cancelled.includes(a.id) || a.status === "CANCELLED";
    return /*#__PURE__*/React.createElement("article", {
      key: a.id,
      style: {
        background: "var(--ac-surface)",
        border: "1px solid var(--ac-line)",
        borderRadius: "var(--ac-radius-md)",
        padding: 12,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        opacity: off ? 0.6 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--ac-space-sm)"
      }
    }, /*#__PURE__*/React.createElement(Plate, {
      variant: "plain",
      style: {
        fontWeight: 600,
        fontSize: 14,
        textDecoration: off ? "line-through" : "none"
      }
    }, a.plate), /*#__PURE__*/React.createElement(StatusPill, {
      tone: off ? "neutral" : STATUS_TONE[a.status]
    }, off ? "CANCELLED" : a.status.replace("_", " ")), a.pickup && !off && /*#__PURE__*/React.createElement("span", {
      style: {
        font: "var(--type-label)",
        fontSize: 11,
        color: "var(--ac-primary)"
      }
    }, "pickup")), /*#__PURE__*/React.createElement("div", {
      style: {
        font: "var(--type-body)",
        fontSize: 14,
        color: "var(--ac-ink)",
        marginTop: 2
      }
    }, a.service), /*#__PURE__*/React.createElement("div", {
      style: {
        font: "var(--type-label)",
        fontSize: 12,
        color: "var(--ac-ink-muted)",
        marginTop: 2
      }
    }, a.start, "\u2013", a.end, " \xB7 ", a.member)), !off && /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => setCancelled([...cancelled, a.id]),
      style: {
        flex: "none",
        height: 32,
        padding: "0 8px",
        borderRadius: "var(--ac-radius-sm)",
        border: "1px solid var(--ac-line)",
        background: "transparent",
        color: "var(--ac-danger)",
        font: "var(--type-label)",
        cursor: "pointer"
      }
    }, "Cancel"));
  }))))), /*#__PURE__*/React.createElement("aside", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-md)"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    pad: "lg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      marginBottom: "var(--ac-space-sm)"
    }
  }, "Today"), [["Booked", "5"], ["Bays in use", "2 of 3"], ["Walk-in buffer", "1 slot"], ["Pick-ups", "2"]].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: "flex",
      justifyContent: "space-between",
      padding: "6px 0",
      borderTop: "1px solid var(--ac-line)",
      font: "var(--type-body)",
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--ac-ink-muted)"
    }
  }, l), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--ac-font-mono)",
      color: "var(--ac-ink)"
    }
  }, v)))), /*#__PURE__*/React.createElement(Card, {
    pad: "lg"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-h2)",
      color: "var(--ac-ink)",
      marginBottom: "var(--ac-space-sm)"
    }
  }, "Roadside queue"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--ac-space-sm)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      borderLeft: "4px solid var(--ac-sev-critical)",
      paddingLeft: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-body)",
      fontSize: 14,
      color: "var(--ac-ink)"
    }
  }, "Flat battery \xB7 Guiwan"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--type-label)",
      fontSize: 12,
      color: "var(--ac-ink-muted)"
    }
  }, "Unassigned \xB7 4 min ago")), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    block: true
  }, "Open dispatch")))));
}
Object.assign(window, {
  LoginScreen,
  ScheduleBoard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/staff-web/StaffScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/staff-web/data.jsx
try { (() => {
const {
  Card,
  Button,
  Plate,
  StatusPill,
  Icon,
  FormField,
  CategoryBar,
  BandChip,
  StarRating,
  EmptyState
} = window.AutoCareDesignSystem_2155ba;
const APPTS = [{
  id: "a1",
  hour: "09:00",
  plate: "ABC 1234",
  service: "Preventive maintenance",
  start: "09:00",
  end: "11:00",
  member: "R. Tatel",
  status: "IN_PROGRESS",
  pickup: true
}, {
  id: "a2",
  hour: "09:00",
  plate: "QRS 4410",
  service: "Oil change",
  start: "09:30",
  end: "10:15",
  member: "M. Santos",
  status: "CONFIRMED"
}, {
  id: "a3",
  hour: "11:00",
  plate: "XYZ 8842",
  service: "Full inspection",
  start: "11:00",
  end: "13:00",
  member: "Delgado Fleet",
  status: "BOOKED"
}, {
  id: "a4",
  hour: "14:00",
  plate: "JKL 2290",
  service: "Brake service",
  start: "14:00",
  end: "16:00",
  member: "A. Reyes",
  status: "BOOKED",
  pickup: true
}, {
  id: "a5",
  hour: "14:00",
  plate: "TUV 7781",
  service: "Aircon service",
  start: "14:30",
  end: "15:30",
  member: "L. Uy",
  status: "CANCELLED"
}];
const STATUS_TONE = {
  BOOKED: "info",
  CONFIRMED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "neutral",
  NO_SHOW: "danger"
};
const UTIL = [0.42, 0.55, 0.61, 0.7, 0.78, 0.83, 0.88, 0.92, 0.74, 0.66, 0.58, 0.71, 0.86, 0.94];
const TopBar = ({
  console: label,
  nav,
  active,
  onNav,
  onSignOut
}) => /*#__PURE__*/React.createElement("header", {
  style: {
    background: "var(--ac-primary-deep)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    gap: "var(--ac-space-lg)",
    padding: "0 var(--ac-space-lg)",
    height: 56,
    flex: "none"
  }
}, /*#__PURE__*/React.createElement("span", {
  style: {
    fontFamily: "var(--ac-font-display)",
    fontWeight: 600,
    fontSize: 22,
    letterSpacing: "0.01em"
  }
}, "AutoCare+"), /*#__PURE__*/React.createElement("span", {
  style: {
    fontFamily: "var(--ac-font-mono)",
    fontSize: 12,
    color: "var(--ac-on-deep-meta)",
    textTransform: "uppercase",
    letterSpacing: "0.08em"
  }
}, label), /*#__PURE__*/React.createElement("nav", {
  style: {
    display: "flex",
    gap: 4,
    marginLeft: "var(--ac-space-md)"
  }
}, nav.map(n => /*#__PURE__*/React.createElement("button", {
  key: n,
  type: "button",
  onClick: () => onNav(n),
  style: {
    border: "none",
    background: active === n ? "rgba(255,255,255,0.12)" : "transparent",
    color: active === n ? "#fff" : "var(--ac-on-deep-body)",
    font: "var(--type-body)",
    fontSize: 14,
    fontWeight: 500,
    padding: "8px 12px",
    borderRadius: "var(--ac-radius-sm)",
    cursor: "pointer",
    minHeight: 36
  }
}, n))), /*#__PURE__*/React.createElement("span", {
  style: {
    flex: 1
  }
}), /*#__PURE__*/React.createElement("button", {
  type: "button",
  onClick: onSignOut,
  style: {
    border: "1px solid rgba(255,255,255,0.3)",
    background: "transparent",
    color: "#fff",
    font: "var(--type-body)",
    fontSize: 14,
    padding: "8px 12px",
    borderRadius: "var(--ac-radius-sm)",
    cursor: "pointer"
  }
}, "Sign out"));
Object.assign(window, {
  APPTS,
  STATUS_TONE,
  UTIL,
  TopBar,
  Card,
  Button,
  Plate,
  StatusPill,
  Icon,
  FormField,
  CategoryBar,
  BandChip,
  StarRating,
  EmptyState
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/staff-web/data.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AttentionCard = __ds_scope.AttentionCard;

__ds_ns.SEVERITY = __ds_scope.SEVERITY;

__ds_ns.AttentionItemRow = __ds_scope.AttentionItemRow;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.FormField = __ds_scope.FormField;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Plate = __ds_scope.Plate;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.StatusChoice = __ds_scope.StatusChoice;

__ds_ns.StatusChip = __ds_scope.StatusChip;

__ds_ns.SyncBanner = __ds_scope.SyncBanner;

__ds_ns.BottomSheet = __ds_scope.BottomSheet;

__ds_ns.MeasuredRow = __ds_scope.MeasuredRow;

__ds_ns.TabBar = __ds_scope.TabBar;

__ds_ns.PlanCard = __ds_scope.PlanCard;

__ds_ns.BANDS = __ds_scope.BANDS;

__ds_ns.BandChip = __ds_scope.BandChip;

__ds_ns.CategoryBar = __ds_scope.CategoryBar;

__ds_ns.ScoreGauge = __ds_scope.ScoreGauge;

__ds_ns.StarRating = __ds_scope.StarRating;

})();
