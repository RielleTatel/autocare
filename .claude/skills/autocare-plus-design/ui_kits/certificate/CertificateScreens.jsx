function Certificate() {
  const cats = [
    { label: "Brakes", score: 55 }, { label: "Tyres & wheels", score: 64 }, { label: "Engine & fluids", score: 91 },
    { label: "Electrical & battery", score: 80 }, { label: "Suspension & steering", score: 88 }, { label: "Body & lights", score: 95 },
  ];
  const fields = [["Plate", "ABC 1234", true], ["Odometer", "48,210 km", false], ["Inspected", "12 Aug 2026", false],
    ["Valid until", "10 Nov 2026", false], ["Confidence", "Medium", false], ["Verification code", "7QK4-92MB", true]];
  return (
    <div style={{ maxWidth: 512, margin: "0 auto", display: "flex", flexDirection: "column", gap: "var(--ac-space-lg)", padding: "var(--ac-space-xl) var(--ac-space-md)" }}>
      <div style={{ background: "var(--ac-surface)", borderRadius: "var(--ac-radius-md)", border: "1px solid var(--ac-line)", overflow: "hidden" }}>
        <div style={{ background: "var(--ac-primary-deep)", padding: "var(--ac-space-md) var(--ac-space-lg)", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--ac-font-display)", fontWeight: 600, fontSize: 22, color: "#fff", margin: 0, letterSpacing: "0.01em" }}>
            AutoCare+ Vehicle Health Certificate
          </h1>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "var(--ac-space-lg) var(--ac-space-lg) var(--ac-space-md)", gap: 2 }}>
          <ScoreGauge score={69} size={260} />
          <StarRating band="FAIR" size={22} />
        </div>
        <div style={{ padding: "var(--ac-space-md) var(--ac-space-lg)", borderTop: "1px solid var(--ac-line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--ac-space-md)" }}>
          {fields.map(([l, v, mono]) => (
            <div key={l} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ font: "var(--type-label)", fontSize: 12, color: "var(--ac-ink-muted)" }}>{l}</span>
              <span style={{ font: "var(--type-body)", fontSize: 14, color: "var(--ac-ink)", fontFamily: mono ? "var(--ac-font-mono)" : undefined, letterSpacing: mono ? "var(--ac-tracking-code)" : undefined }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "var(--ac-space-md) var(--ac-space-lg)", borderTop: "1px solid var(--ac-line)", display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
          <h2 style={{ font: "var(--type-h2)", color: "var(--ac-ink)", margin: 0 }}>Category scores</h2>
          {cats.map((c) => <CategoryBar key={c.label} {...c} compact />)}
        </div>
        <div style={{ padding: "var(--ac-space-md) var(--ac-space-lg)", borderTop: "1px solid var(--ac-line)" }}>
          <h2 style={{ font: "var(--type-h2)", color: "var(--ac-ink)", margin: 0 }}>Service history</h2>
          <p style={{ font: "var(--type-body)", fontSize: 14, color: "var(--ac-ink-muted)", margin: "2px 0 var(--ac-space-sm)" }}>4 completed services on record</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
            {[["Preventive maintenance", "12 Aug 2026"], ["Brake service", "3 May 2026"], ["Oil change", "18 Feb 2026"], ["Full inspection", "9 Nov 2025"]].map(([t, d]) => (
              <li key={d} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--ac-ink)" }}>{t}</span>
                <span style={{ color: "var(--ac-ink-muted)", fontFamily: "var(--ac-font-mono)", fontSize: 13 }}>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)", textAlign: "center", margin: 0, padding: "0 var(--ac-space-md)" }}>
        This certificate reflects a point-in-time inspection and is valid for 90 days.
        Verify its authenticity at <span style={{ fontFamily: "var(--ac-font-mono)" }}>/verify</span> using the code above.
      </p>
      <div style={{ background: "var(--ac-primary-deep)", borderRadius: "var(--ac-radius-md)", padding: "var(--ac-space-sm)", textAlign: "center" }}>
        <p style={{ margin: 0, color: "#fff", font: "var(--type-body)", fontSize: 14 }}>Powered by AutoCare+ · autocare.example/verify</p>
      </div>
    </div>
  );
}

function VerifyForm() {
  const [code, setCode] = React.useState("");
  const [result, setResult] = React.useState(null);
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "var(--ac-space-xl) var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
      <h1 style={{ font: "var(--type-h1)", color: "var(--ac-primary-deep)", margin: 0 }}>Verify a certificate</h1>
      <p style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)", margin: 0 }}>
        Enter the verification code printed on the certificate to confirm it is genuine and still valid.
      </p>
      <FormField id="code" label="Verification code" mono value={code} onChange={setCode} placeholder="7QK4-92MB" />
      <Button block disabled={!code} onClick={() => setResult(code.trim().toUpperCase() === "7QK4-92MB" ? "ok" : "bad")}>Verify</Button>
      {result === "ok" && (
        <Card accent="var(--ac-success)">
          <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>Valid certificate</div>
          <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>ABC 1234 · score 69 (Fair) · inspected 12 Aug 2026 · valid until 10 Nov 2026.</div>
        </Card>
      )}
      {result === "bad" && (
        <Card accent="var(--ac-danger)">
          <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>No certificate with that code</div>
          <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>Check the code on the certificate. If it was revoked by the owner, it will no longer verify.</div>
        </Card>
      )}
    </div>
  );
}

function RevokedNotice() {
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "var(--ac-space-xl) var(--ac-space-md)" }}>
      <Card pad="lg" accent="var(--ac-ink-muted)" style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
        <Icon name="shield-off" size={28} color="var(--ac-ink-muted)" />
        <div style={{ font: "var(--type-h1)", color: "var(--ac-ink)" }}>This certificate has been revoked</div>
        <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>
          The vehicle owner withdrew this link, so it no longer shows a score. Ask them for a current certificate.
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { Certificate, VerifyForm, RevokedNotice });
