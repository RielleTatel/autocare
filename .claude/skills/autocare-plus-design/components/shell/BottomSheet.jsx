import React from "react";

/** Progressive disclosure, bottom-anchored. Opens for ANY component — healthy
 *  ones included — so the score is always explainable. Grabber, title, then
 *  the plain-language sentence; a single dismissing action closes it. */
export function BottomSheet({ open = true, title, children, onClose, closeLabel = "Got it", style }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: "absolute", inset: 0, background: "var(--ac-scrim)",
      display: "flex", alignItems: "flex-end", zIndex: 40,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", background: "var(--ac-surface)",
        borderTopLeftRadius: "var(--ac-radius-lg)", borderTopRightRadius: "var(--ac-radius-lg)",
        padding: "var(--ac-space-lg) var(--ac-space-lg) var(--ac-space-xl)", display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)",
        boxShadow: "var(--ac-elevation-sheet)", boxSizing: "border-box",
        animation: "ac-sheet-in var(--ac-duration-sheet) var(--ac-ease-out)", ...style,
      }}>
        <style>{"@keyframes ac-sheet-in{from{transform:translateY(16px);opacity:.6}to{transform:none;opacity:1}}"}</style>
        <div aria-hidden style={{ width: 40, height: 4, borderRadius: 2, background: "var(--ac-line)", alignSelf: "center" }} />
        {title && <div style={{ font: "var(--type-h1)", color: "var(--ac-ink)" }}>{title}</div>}
        {children}
        {onClose && (
          <button type="button" onClick={onClose} style={{
            minHeight: "var(--ac-target-member)", border: "none", borderRadius: "var(--ac-radius-pill)",
            background: "var(--ac-primary)", color: "var(--ac-on-primary)", font: "var(--type-h2)",
            marginTop: "var(--ac-space-xs)", cursor: "pointer",
          }}>{closeLabel}</button>
        )}
      </div>
    </div>
  );
}

/** The measured-value readout used inside explain sheets. */
export function MeasuredRow({ children, style }) {
  return (
    <div style={{
      background: "var(--ac-chassis)", borderRadius: "var(--ac-radius-sm)",
      padding: "var(--ac-space-sm)", font: "var(--type-label)", color: "var(--ac-ink-muted)", ...style,
    }}>{children}</div>
  );
}
