function WorkOrderScreen() {
  const [lines, setLines] = React.useState([
    { id: 1, label: "Front brake pad set", kind: "Part", qty: 1, price: "₱2,400", state: "AWAITING APPROVAL", tone: "warn" },
    { id: 2, label: "Brake pad replacement labour", kind: "Labour", qty: 1.5, price: "₱800", state: "AWAITING APPROVAL", tone: "warn" },
    { id: 3, label: "Engine oil 5W-30 (4 L)", kind: "Part", qty: 1, price: "₱1,150", state: "APPROVED", tone: "success" },
    { id: 4, label: "Tyre rotation", kind: "Labour", qty: 0.5, price: "₱450", state: "DECLINED", tone: "neutral" },
  ]);
  const set = (id, state, tone) => setLines(lines.map((l) => (l.id === id ? { ...l, state, tone } : l)));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "var(--ac-space-lg)", alignItems: "start" }}>
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)" }}>
            <h1 style={{ font: "var(--type-h1)", color: "var(--ac-ink)", margin: 0 }}>Work order WO-1042</h1>
            <StatusPill tone="info">IN PROGRESS</StatusPill>
          </div>
          <div style={{ font: "var(--type-body)", fontSize: 14, color: "var(--ac-ink-muted)" }}>
            ABC 1234 · 2019 Toyota Vios 1.3 XE · R. Tatel · Care Plus
          </div>
        </div>
        <Card pad="none">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead><tr style={{ textAlign: "left" }}>
              {["Line", "Type", "Qty", "Amount", "State", ""].map((h) => (
                <th key={h} style={{ padding: "10px 14px", fontFamily: "var(--ac-font-display)", fontWeight: 600, letterSpacing: "0.02em", borderBottom: "1px solid var(--ac-line)", color: "var(--ac-ink)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--ac-line)" }}>
                  <td style={{ padding: "10px 14px", color: "var(--ac-ink)" }}>{l.label}</td>
                  <td style={{ padding: "10px 14px", color: "var(--ac-ink-muted)" }}>{l.kind}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--ac-font-mono)", fontVariantNumeric: "tabular-nums" }}>{l.qty}</td>
                  <td style={{ padding: "10px 14px", fontFamily: "var(--ac-font-mono)", fontVariantNumeric: "tabular-nums" }}>{l.price}</td>
                  <td style={{ padding: "10px 14px" }}><StatusPill tone={l.tone}>{l.state}</StatusPill></td>
                  <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {l.state === "AWAITING APPROVAL" && (
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <button type="button" onClick={() => set(l.id, "APPROVED", "success")} style={{ height: 32, padding: "0 10px", borderRadius: "var(--ac-radius-sm)", border: "none", background: "var(--ac-primary)", color: "#fff", font: "var(--type-label)", cursor: "pointer" }}>Approve</button>
                        <button type="button" onClick={() => set(l.id, "DECLINED", "neutral")} style={{ height: 32, padding: "0 10px", borderRadius: "var(--ac-radius-sm)", border: "1px solid var(--ac-line)", background: "transparent", color: "var(--ac-ink)", font: "var(--type-label)", cursor: "pointer" }}>Decline</button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div style={{ display: "flex", gap: "var(--ac-space-sm)" }}>
          <Button icon={<Icon name="send" size={16} />}>Request member approval</Button>
          <Button variant="secondary">Add part or labour line</Button>
        </div>
      </section>
      <aside style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
        <Card pad="lg">
          <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)", marginBottom: "var(--ac-space-sm)" }}>Health score</div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)", marginBottom: "var(--ac-space-sm)" }}>
            <span style={{ fontFamily: "var(--ac-font-display)", fontWeight: 600, fontSize: 40, color: "var(--ac-band-fair-text)", lineHeight: 1 }}>69</span>
            <div><BandChip band="FAIR" /><div style={{ marginTop: 4 }}><StarRating band="FAIR" size={14} /></div></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <CategoryBar label="Brakes" score={55} compact />
            <CategoryBar label="Tyres" score={64} compact />
            <CategoryBar label="Engine" score={91} compact />
          </div>
        </Card>
        <Card pad="lg">
          <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)", marginBottom: 4 }}>Entitlements</div>
          <div style={{ font: "var(--type-body)", fontSize: 14, color: "var(--ac-ink-muted)" }}>1 of 2 inspections used · 1 pick-up remaining this cycle.</div>
        </Card>
      </aside>
    </div>
  );
}

function AdminDashboard() {
  const kpis = [["MRR", "₱412,300", "+4.2% vs last month"], ["Active members", "274", "+11 this month"], ["Churn (30d)", "2.1%", "-0.4 pts"], ["Bay utilisation", "78%", "target 85%"]];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-lg)" }}>
      <h1 style={{ font: "var(--type-h1)", color: "var(--ac-ink)", margin: 0 }}>Admin dashboard</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--ac-space-md)" }}>
        {kpis.map(([l, v, d]) => (
          <Card key={l} pad="lg">
            <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)", textTransform: "uppercase", letterSpacing: "var(--ac-tracking-label)" }}>{l}</div>
            <div style={{ fontFamily: "var(--ac-font-display)", fontWeight: 600, fontSize: 34, color: "var(--ac-ink)", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>{v}</div>
            <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>{d}</div>
          </Card>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--ac-space-md)", alignItems: "start" }}>
        <Card pad="lg">
          <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)", marginBottom: "var(--ac-space-sm)" }}>Forward utilisation · next 14 days</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 140, position: "relative" }}>
            <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: "85%", borderTop: "1px dashed var(--ac-danger)" }} />
            {UTIL.map((r, i) => {
              const breach = r > 0.85, warn = !breach && r >= 0.7;
              return <div key={i} title={`${Math.round(r * 100)}%`} style={{ flex: 1, height: `${r * 100}%`, borderRadius: "3px 3px 0 0", background: breach ? "var(--ac-danger)" : warn ? "var(--ac-band-fair)" : "var(--ac-primary)" }} />;
            })}
          </div>
          <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)", marginTop: "var(--ac-space-sm)" }}>
            Dashed line is the 85% capacity threshold. Bars turn amber approaching it and red once breached.
          </div>
        </Card>
        <Card pad="lg">
          <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)", marginBottom: "var(--ac-space-sm)" }}>Checklist editor</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[["Brakes", "22%", "9 points"], ["Engine & fluids", "20%", "12 points"], ["Tyres & wheels", "18%", "6 points"], ["Electrical & battery", "14%", "7 points"]].map(([c, w, p]) => (
              <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--ac-line)", font: "var(--type-body)", fontSize: 14 }}>
                <span style={{ color: "var(--ac-ink)" }}>{c}</span>
                <span style={{ display: "inline-flex", gap: 12, fontFamily: "var(--ac-font-mono)", fontSize: 13, color: "var(--ac-ink-muted)" }}><span>{w}</span><span>{p}</span></span>
              </div>
            ))}
          </div>
          <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)", marginTop: "var(--ac-space-sm)" }}>Weights are versioned — editing creates a new checklist version.</div>
          <Button variant="secondary" block style={{ marginTop: "var(--ac-space-sm)" }}>Edit weights</Button>
        </Card>
      </div>
      <Card pad="lg">
        <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)", marginBottom: 4 }}>Waste log export (DENR)</div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-md)" }}>
          <span style={{ font: "var(--type-body)", fontSize: 14, color: "var(--ac-ink-muted)", flex: 1 }}>
            42 records this quarter · used oil 168 L, filters 61, coolant 24 L. Last export 30 Jun 2026.
          </span>
          <Button variant="secondary" icon={<Icon name="download" size={16} />}>Export CSV</Button>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { WorkOrderScreen, AdminDashboard });
