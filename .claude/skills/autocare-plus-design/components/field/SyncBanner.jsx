import React from "react";

/** Persistent on every field screen whenever the outbox is non-empty. Staff must
 *  never wonder whether their work saved. Tapping opens the queue (F-03). */
export function SyncBanner({ pendingCount = 0, onClick, style }) {
  if (!pendingCount) return null;
  return (
    <div role="alert" onClick={onClick}
      style={{
        background: "var(--ac-primary-deep)", color: "#FFFFFF", textAlign: "center",
        fontFamily: "var(--ac-font-body)", fontSize: 16, fontWeight: 600,
        padding: "var(--ac-space-sm)", cursor: onClick ? "pointer" : undefined, ...style,
      }}>
      {pendingCount} item{pendingCount === 1 ? "" : "s"} waiting to sync
    </div>
  );
}
