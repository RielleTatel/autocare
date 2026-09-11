function LoginScreen({ onSignIn }) {
  const [email, setEmail] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [err, setErr] = React.useState(null);
  return (
    <div style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ac-chassis)", padding: "var(--ac-space-md)" }}>
      <div style={{ width: 380, background: "var(--ac-surface)", borderRadius: "var(--ac-radius-md)", border: "1px solid var(--ac-line)", padding: 32, boxShadow: "var(--ac-elevation-raised)" }}>
        <div style={{ fontFamily: "var(--ac-font-display)", fontWeight: 600, fontSize: 32, color: "var(--ac-primary-deep)", letterSpacing: "0.01em" }}>AutoCare+</div>
        <div style={{ font: "var(--type-body)", fontSize: 14, color: "var(--ac-ink-muted)", marginBottom: "var(--ac-space-lg)" }}>Staff console</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
          <FormField id="e" label="Email" value={email} onChange={setEmail} placeholder="you@autocare.ph" />
          <FormField id="p" label="Password" type="password" value={pw} onChange={setPw} error={err} />
          <Button block disabled={!email || !pw} onClick={() => (email.includes("@") ? onSignIn() : setErr("Wrong email or password"))}>Sign in</Button>
        </div>
        <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)", marginTop: "var(--ac-space-lg)" }}>
          Staff access only. Members use the mobile app.
        </div>
      </div>
    </div>
  );
}

function ScheduleBoard() {
  const [cancelled, setCancelled] = React.useState([]);
  const hours = [...new Set(APPTS.map((a) => a.hour))];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "var(--ac-space-lg)", alignItems: "start" }}>
      <section style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)" }}>
          <h1 style={{ font: "var(--type-h1)", color: "var(--ac-ink)", margin: 0, flex: 1 }}>Schedule · Mon 24 Aug</h1>
          <Button variant="secondary" icon={<Icon name="chevron-left" size={16} />}>Prev</Button>
          <Button variant="secondary">Next</Button>
          <Button icon={<Icon name="plus" size={16} />}>New appointment</Button>
        </div>
        {hours.map((h) => (
          <div key={h} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: "var(--ac-space-sm)" }}>
            <div style={{ fontFamily: "var(--ac-font-mono)", fontSize: 14, color: "var(--ac-ink-muted)", paddingTop: 10 }}>{h}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
              {APPTS.filter((a) => a.hour === h).map((a) => {
                const off = cancelled.includes(a.id) || a.status === "CANCELLED";
                return (
                  <article key={a.id} style={{ background: "var(--ac-surface)", border: "1px solid var(--ac-line)", borderRadius: "var(--ac-radius-md)", padding: 12, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, opacity: off ? 0.6 : 1 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)" }}>
                        <Plate variant="plain" style={{ fontWeight: 600, fontSize: 14, textDecoration: off ? "line-through" : "none" }}>{a.plate}</Plate>
                        <StatusPill tone={off ? "neutral" : STATUS_TONE[a.status]}>{off ? "CANCELLED" : a.status.replace("_", " ")}</StatusPill>
                        {a.pickup && !off && <span style={{ font: "var(--type-label)", fontSize: 11, color: "var(--ac-primary)" }}>pickup</span>}
                      </div>
                      <div style={{ font: "var(--type-body)", fontSize: 14, color: "var(--ac-ink)", marginTop: 2 }}>{a.service}</div>
                      <div style={{ font: "var(--type-label)", fontSize: 12, color: "var(--ac-ink-muted)", marginTop: 2 }}>{a.start}–{a.end} · {a.member}</div>
                    </div>
                    {!off && (
                      <button type="button" onClick={() => setCancelled([...cancelled, a.id])}
                        style={{ flex: "none", height: 32, padding: "0 8px", borderRadius: "var(--ac-radius-sm)", border: "1px solid var(--ac-line)", background: "transparent", color: "var(--ac-danger)", font: "var(--type-label)", cursor: "pointer" }}>Cancel</button>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      <aside style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
        <Card pad="lg">
          <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)", marginBottom: "var(--ac-space-sm)" }}>Today</div>
          {[["Booked", "5"], ["Bays in use", "2 of 3"], ["Walk-in buffer", "1 slot"], ["Pick-ups", "2"]].map(([l, v]) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: "1px solid var(--ac-line)", font: "var(--type-body)", fontSize: 14 }}>
              <span style={{ color: "var(--ac-ink-muted)" }}>{l}</span>
              <span style={{ fontFamily: "var(--ac-font-mono)", color: "var(--ac-ink)" }}>{v}</span>
            </div>
          ))}
        </Card>
        <Card pad="lg">
          <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)", marginBottom: "var(--ac-space-sm)" }}>Roadside queue</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
            <div style={{ borderLeft: "4px solid var(--ac-sev-critical)", paddingLeft: 8 }}>
              <div style={{ font: "var(--type-body)", fontSize: 14, color: "var(--ac-ink)" }}>Flat battery · Guiwan</div>
              <div style={{ font: "var(--type-label)", fontSize: 12, color: "var(--ac-ink-muted)" }}>Unassigned · 4 min ago</div>
            </div>
            <Button variant="secondary" block>Open dispatch</Button>
          </div>
        </Card>
      </aside>
    </div>
  );
}

Object.assign(window, { LoginScreen, ScheduleBoard });
