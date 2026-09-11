function HealthScoreScreen({ onBack, onBreakdown, onShare }) {
  return (
    <>
      <NavBar title="Health Score" onBack={onBack} />
      <div style={{ padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
        <Card pad="lg" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--ac-space-sm)" }}>
          <ScoreGauge score={69} confidence="MEDIUM" size={220} />
          <StarRating band="FAIR" size={22} />
          <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)", textAlign: "center" }}>
            Inspected 12 Aug 2026 · 48,210 km
          </div>
        </Card>
        <Card>
          <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)", marginBottom: 4 }}>Why 69?</div>
          <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>
            Your categories averaged 84.5, but a safety-critical brake finding caps the score at 69 until it is resolved.
          </div>
          <div style={{ marginTop: "var(--ac-space-sm)", display: "flex", flexDirection: "column" }}>
            {[["var(--ac-sev-attention)", "Front brake pads — 3.0 mm.", "Replace within 1,000 km."],
              ["var(--ac-sev-monitor)", "Rear tyres — 4.0 mm tread.", "Monitor; plan replacement."]].map(([c, b, t]) => (
              <div key={b} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "var(--ac-space-sm) 0", borderTop: "1px solid var(--ac-line)", font: "var(--type-body)", fontSize: 14 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, flex: "none", background: c, position: "relative", top: 1 }} />
                <span><strong style={{ color: "var(--ac-ink)" }}>{b}</strong> <span style={{ color: "var(--ac-ink-muted)" }}>{t}</span></span>
              </div>
            ))}
          </div>
        </Card>
        <Button block onClick={onBreakdown} icon={<Icon name="list-tree" size={18} />}>See category breakdown</Button>
        <div style={{ display: "flex", gap: "var(--ac-space-sm)" }}>
          <Button variant="secondary" style={{ flex: 1 }} icon={<Icon name="trending-up" size={16} />}>History</Button>
          <Button variant="secondary" style={{ flex: 1 }} icon={<Icon name="share-2" size={16} />} onClick={onShare}>Share</Button>
        </div>
      </div>
    </>
  );
}

function BreakdownScreen({ onBack }) {
  const [target, setTarget] = React.useState(null);
  const [open, setOpen] = React.useState(null);
  const e = target ? EXPLAIN[target] : null;
  return (
    <>
      <NavBar title="Category breakdown" onBack={onBack} />
      <div style={{ padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
        <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>Tap any category to see what it means.</div>
        {CATEGORIES.map((c) => (
          <Card key={c.code} pad="none">
            <div style={{ padding: "var(--ac-space-md)" }}>
              <CategoryBar {...c} onClick={() => setTarget(c.code)} />
            </div>
            <div role="button" onClick={() => setOpen(open === c.code ? null : c.code)}
              style={{ padding: "0 var(--ac-space-md) var(--ac-space-sm)", font: "var(--type-label)", color: "var(--ac-primary)", cursor: "pointer" }}>
              {open === c.code ? "Hide components ▲" : "Show components ▼"}
            </div>
            {open === c.code && (
              <div>
                {[["Front pad thickness", "ATTENTION"], ["Rear pad thickness", "MONITOR"], ["Disc runout", "GOOD"], ["Fluid level", "GOOD"]].map(([l, s]) => (
                  <div key={l} onClick={() => setTarget(c.code)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--ac-space-sm) var(--ac-space-md)", borderTop: "1px solid var(--ac-line)", cursor: "pointer" }}>
                    <span style={{ font: "var(--type-body)", color: "var(--ac-ink)" }}>{l}</span>
                    <StatusPill tone={s === "ATTENTION" ? "danger" : s === "MONITOR" ? "warn" : "success"}>{s}</StatusPill>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
      {e && (
        <BottomSheet title={e.title} onClose={() => setTarget(null)}>
          <StarRating band={e.stars} size={22} />
          <p style={{ margin: 0, font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>{e.body}</p>
          {e.measured && <MeasuredRow>{e.measured}</MeasuredRow>}
        </BottomSheet>
      )}
    </>
  );
}

Object.assign(window, { HealthScoreScreen, BreakdownScreen });
