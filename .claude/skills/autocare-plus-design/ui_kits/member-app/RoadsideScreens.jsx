const INCIDENTS = [
  { code: "BATT", label: "Won't start", fil: "Ayaw umandar", icon: "battery-warning" },
  { code: "FLAT", label: "Flat tyre", fil: "Flat na gulong", icon: "disc-3" },
  { code: "FUEL", label: "Out of fuel", fil: "Walang gasolina", icon: "fuel" },
  { code: "CRSH", label: "Collision", fil: "Aksidente", icon: "car-front" },
  { code: "OTHR", label: "Something else", fil: "Iba pa", icon: "circle-help" },
];

function RoadsideRequest({ onBack, onSubmit }) {
  const [pick, setPick] = React.useState(null);
  return (
    <>
      <NavBar title="Roadside assistance" onBack={onBack} />
      <div style={{ padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
        <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>
          What has happened? We'll send the nearest responder and keep you updated here.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
          {INCIDENTS.map((i) => {
            const on = pick === i.code;
            return (
              <Card key={i.code} interactive onClick={() => setPick(i.code)}
                style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-md)", minHeight: 48, border: on ? "var(--ac-border-control) solid var(--ac-primary)" : undefined }}>
                <Icon name={i.icon} size={22} color={on ? "var(--ac-primary)" : "var(--ac-ink-muted)"} />
                <div style={{ flex: 1 }}>
                  <div style={{ font: "var(--type-body)", fontWeight: 600, color: "var(--ac-ink)" }}>{i.label}</div>
                  <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>{i.fil}</div>
                </div>
              </Card>
            );
          })}
        </div>
        <Card style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)" }}>
          <Icon name="map-pin" size={20} color="var(--ac-primary)" />
          <div style={{ flex: 1 }}>
            <div style={{ font: "var(--type-body)", color: "var(--ac-ink)" }}>Governor Camins Ave, Zamboanga City</div>
            <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>Located from your phone · accurate to 20 m</div>
          </div>
          <Button variant="ghost">Change</Button>
        </Card>
        <Card accent="var(--ac-primary)">
          <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>2 call-outs left this cycle</div>
          <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>Care Plus covers this request at no charge.</div>
        </Card>
        <Button block variant="danger" disabled={!pick} onClick={onSubmit}>Request assistance now</Button>
        <div style={{ textAlign: "center", font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>
          Prefer to talk? Call the hotline on <span style={{ fontFamily: "var(--ac-font-mono)" }}>0917 555 0142</span>.
        </div>
      </div>
    </>
  );
}

function RoadsideStatus({ onBack }) {
  const steps = [
    { label: "Request received", time: "10:42", state: "done", body: "We have your location and the incident type." },
    { label: "Responder assigned", time: "10:45", state: "done", body: "Ariel D. · Service van ZAM-4 · 0917 555 0188" },
    { label: "On the way", time: "10:47", state: "active", body: "Estimated arrival 11:05 — about 18 minutes." },
    { label: "On site", time: null, state: "todo", body: null },
    { label: "Resolved", time: null, state: "todo", body: null },
  ];
  return (
    <>
      <NavBar title="Roadside status" onBack={onBack} />
      <div style={{ padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
        <Card accent="var(--ac-sev-critical)" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>Won't start · ABC 1234</span>
            <StatusPill tone="info">ON THE WAY</StatusPill>
          </div>
          <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>Governor Camins Ave · reported 10:42</div>
        </Card>
        <Card>
          {steps.map((s, i) => {
            const color = s.state === "todo" ? "var(--ac-line)" : s.state === "active" ? "var(--ac-primary)" : "var(--ac-success)";
            return (
              <div key={s.label} style={{ display: "flex", gap: "var(--ac-space-md)" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", width: 14 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 999, background: s.state === "todo" ? "var(--ac-surface)" : color, border: `2px solid ${color}`, marginTop: 4, boxSizing: "border-box" }} />
                  {i < steps.length - 1 && <span style={{ flex: 1, width: 2, background: s.state === "done" ? "var(--ac-success)" : "var(--ac-line)", minHeight: 26 }} />}
                </div>
                <div style={{ flex: 1, paddingBottom: i < steps.length - 1 ? "var(--ac-space-md)" : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ font: "var(--type-body)", fontWeight: 600, color: s.state === "todo" ? "var(--ac-ink-muted)" : "var(--ac-ink)" }}>{s.label}</span>
                    {s.time && <span style={{ fontFamily: "var(--ac-font-mono)", fontSize: 13, color: "var(--ac-ink-muted)" }}>{s.time}</span>}
                  </div>
                  {s.body && <div style={{ font: "var(--type-body)", fontSize: 14, color: "var(--ac-ink-muted)" }}>{s.body}</div>}
                </div>
              </div>
            );
          })}
        </Card>
        <Button block variant="secondary" icon={<Icon name="phone" size={18} />}>Call Ariel D.</Button>
        <Button block variant="ghost" style={{ color: "var(--ac-danger)" }}>Cancel request</Button>
      </div>
    </>
  );
}

function ShareCertificateScreen({ onBack }) {
  const [live, setLive] = React.useState(true);
  return (
    <>
      <NavBar title="Share certificate" onBack={onBack} />
      <div style={{ padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
        <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>
          A certificate is a read-only page a buyer can open without the app. It shows the score, category breakdown and service count — never your contact details.
        </div>
        <Card pad="lg" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--ac-space-sm)" }}>
          <ScoreGauge score={69} size={180} isStale={!live} daysSinceInspection={13} />
          <Plate variant="plain">ABC 1234</Plate>
        </Card>
        <Card style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>Link</span>
            <StatusPill tone={live ? "success" : "neutral"}>{live ? "ACTIVE" : "REVOKED"}</StatusPill>
          </div>
          <div style={{ background: "var(--ac-chassis)", borderRadius: "var(--ac-radius-sm)", padding: "var(--ac-space-sm)", fontFamily: "var(--ac-font-mono)", fontSize: 13, color: "var(--ac-ink)", wordBreak: "break-all" }}>
            autocare.example/c/7QK4-92MB
          </div>
          <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>Valid until 10 Nov 2026 · verification code 7QK4-92MB</div>
        </Card>
        {live ? (
          <>
            <Button block icon={<Icon name="share-2" size={18} />}>Share link</Button>
            <Button block variant="ghost" style={{ color: "var(--ac-danger)" }} onClick={() => setLive(false)}>Revoke this link</Button>
          </>
        ) : (
          <>
            <Card accent="var(--ac-ink-muted)">
              <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>Link revoked</div>
              <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>Anyone opening it now sees a revoked notice instead of your score.</div>
            </Card>
            <Button block onClick={() => setLive(true)}>Generate a new link</Button>
          </>
        )}
      </div>
    </>
  );
}

Object.assign(window, { RoadsideRequest, RoadsideStatus, ShareCertificateScreen });
