function PointEntryScreen({ onBack, onNext }) {
  const p = POINTS[0];
  const [value, setValue] = React.useState(p.value);
  const [photo, setPhoto] = React.useState(false);
  const num = parseFloat(value);
  const derived = isNaN(num) ? null : num >= 5 ? "GOOD" : num >= 4 ? "MONITOR" : num >= 2.5 ? "ATTENTION" : "CRITICAL";
  const adverse = derived === "ATTENTION" || derived === "CRITICAL";
  const needsPhoto = adverse && !photo;
  return (
    <>
      <FieldNav title="Brakes · 1 of 4" onBack={onBack} />
      <div style={{ padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
        <div>
          <div style={{ font: "var(--type-h1)", fontSize: 32, color: "var(--ac-ink)" }}>{p.label}</div>
          <div style={{ font: "var(--type-body)", fontSize: 18, color: "var(--ac-ink-muted)" }}>{p.labelFil}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)" }}>
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal"
            style={{ flex: 1, minHeight: 56, border: "1px solid var(--ac-line)", borderRadius: "var(--ac-radius-md)", background: "var(--ac-surface)", padding: "0 var(--ac-space-md)", fontSize: 28, fontFamily: "var(--ac-font-body)", color: "var(--ac-ink)", boxSizing: "border-box" }} />
          <span style={{ font: "var(--type-h2)", fontSize: 25, color: "var(--ac-ink-muted)" }}>{p.unit}</span>
        </div>
        {derived && <div><StatusChip status={derived} /></div>}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
          {["GOOD", "MONITOR", "ATTENTION", "CRITICAL", "NOT_APPLICABLE"].map((s) => (
            <StatusChoice key={s} status={s} selected={derived === s} disabled={derived != null && derived !== s} />
          ))}
        </div>
        {needsPhoto && (
          <Button size="field" block variant="danger" icon={<Icon name="camera" size={20} />} onClick={() => setPhoto(true)}>
            Add photo — required for this finding
          </Button>
        )}
        {photo && (
          <Card style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)" }}>
            <Icon name="image" size={22} color="var(--ac-band-excellent)" />
            <span style={{ font: "var(--type-body)", fontSize: 18, color: "var(--ac-ink)" }}>1 photo attached</span>
          </Card>
        )}
        <textarea placeholder="Notes (optional)" rows={2}
          style={{ minHeight: 56, border: "1px solid var(--ac-line)", borderRadius: "var(--ac-radius-md)", background: "var(--ac-surface)", padding: "var(--ac-space-md)", font: "var(--type-body)", fontSize: 18, color: "var(--ac-ink)", boxSizing: "border-box", resize: "none" }} />
        <Button size="field" block disabled={!derived || needsPhoto} onClick={onNext}>Save &amp; next</Button>
      </div>
    </>
  );
}

function ReviewScreen({ onBack, onSubmit }) {
  return (
    <>
      <FieldNav title="Review &amp; submit" onBack={onBack} />
      <div style={{ padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Plate>ABC 1234</Plate>
          <span style={{ font: "var(--type-body)", fontSize: 18, color: "var(--ac-ink-muted)" }}>2019 Toyota Vios 1.3 XE · 48,210 km</span>
        </Card>
        {POINTS.map((p) => (
          <Card key={p.code} style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)", minHeight: 56 }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: "var(--type-body)", fontSize: 18, color: "var(--ac-ink)" }}>{p.label}</div>
              {p.measured && <div style={{ fontFamily: "var(--ac-font-mono)", fontSize: 15, color: "var(--ac-ink-muted)" }}>{p.value} {p.unit} · good ≥ {p.good} {p.unit}</div>}
            </div>
            {p.status ? <StatusChip status={p.status} /> : <StatusPill tone="warn">NOT RECORDED</StatusPill>}
          </Card>
        ))}
        <Card accent="var(--ac-sev-attention)">
          <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>1 point still to record</div>
          <div style={{ font: "var(--type-body)", fontSize: 18, color: "var(--ac-ink-muted)" }}>Brake fluid condition has no status. Record it before submitting, or mark it N/A.</div>
        </Card>
        <Button size="field" block onClick={onSubmit}>Submit inspection</Button>
        <div style={{ font: "var(--type-label)", fontSize: 15, color: "var(--ac-ink-muted)", textAlign: "center" }}>
          Submits to the outbox — it will sync when you have signal.
        </div>
      </div>
    </>
  );
}

function ScoreResultScreen({ onBack }) {
  return (
    <>
      <FieldNav title="Score result" onBack={onBack} />
      <div style={{ padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
        <Card pad="lg" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--ac-space-sm)" }}>
          <ScoreGauge score={69} variant="field" size={240} confidence="MEDIUM" />
          <div style={{ font: "var(--type-label)", fontSize: 15, color: "var(--ac-ink-muted)", textAlign: "center" }}>
            Averaged 84.5 · capped at 69 by a safety-critical brake finding
          </div>
        </Card>
        <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>Recommendations generated</div>
        {[["Front brake pad replacement", "₱3,200", "CRITICAL"], ["Tyre rotation", "₱450", "ATTENTION"]].map(([l, c, s]) => (
          <Card key={l} accent={s === "CRITICAL" ? "var(--ac-sev-critical)" : "var(--ac-sev-attention)"} style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: "var(--type-body)", fontSize: 18, color: "var(--ac-ink)" }}>{l}</div>
              <div style={{ fontFamily: "var(--ac-font-mono)", fontSize: 15, color: "var(--ac-ink-muted)" }}>est. {c}</div>
            </div>
            <StatusChip status={s} />
          </Card>
        ))}
        <Button size="field" block variant="secondary" onClick={onBack}>Back to today's tasks</Button>
      </div>
    </>
  );
}

function SyncQueueScreen({ onBack }) {
  return (
    <>
      <FieldNav title="Sync queue" onBack={onBack} />
      <div style={{ padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
        {[["Inspection · ABC 1234", "24 Aug 09:42", "QUEUED"], ["Photo · BRK-01", "24 Aug 09:41", "QUEUED"], ["Waste record · used oil 4.2 L", "24 Aug 08:15", "RETRYING"]].map(([l, t, s]) => (
          <Card key={l} style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)", minHeight: 56 }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: "var(--type-body)", fontSize: 18, color: "var(--ac-ink)" }}>{l}</div>
              <div style={{ fontFamily: "var(--ac-font-mono)", fontSize: 15, color: "var(--ac-ink-muted)" }}>{t}</div>
            </div>
            <StatusPill tone={s === "RETRYING" ? "warn" : "neutral"}>{s}</StatusPill>
          </Card>
        ))}
        <Button size="field" block variant="secondary" icon={<Icon name="refresh-cw" size={20} />}>Retry now</Button>
      </div>
    </>
  );
}

Object.assign(window, { PointEntryScreen, ReviewScreen, ScoreResultScreen, SyncQueueScreen });
