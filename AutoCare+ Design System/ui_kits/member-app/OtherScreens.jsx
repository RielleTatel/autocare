function VehiclesScreen({ onOpenVehicle }) {
  const rows = [
    { plate: "ABC 1234", name: "2019 Toyota Vios 1.3 XE", km: "48,210 km", score: 69, band: "FAIR" },
    { plate: "XYZ 8842", name: "2021 Mitsubishi L300", km: "112,940 km", score: 81, band: "GOOD" },
  ];
  return (
    <div style={{ padding: "var(--ac-space-lg) var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
      <Section title="My vehicles" sub="2 vehicles on Care Plus" />
      {rows.map((r) => (
        <Card key={r.plate} interactive onClick={onOpenVehicle} style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-md)" }}>
          <div style={{ width: 46, height: 46, borderRadius: "var(--ac-radius-sm)", background: "var(--ac-chassis)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Icon name="car-front" size={24} color="var(--ac-ink-muted)" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Plate variant="plain">{r.plate}</Plate>
            <div style={{ font: "var(--type-body)", color: "var(--ac-ink)" }}>{r.name}</div>
            <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>{r.km}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            <BandChip band={r.band} />
            <StarRating band={r.band} size={14} />
          </div>
        </Card>
      ))}
      <Button variant="secondary" block icon={<Icon name="plus" size={18} />} style={{ marginTop: "var(--ac-space-sm)" }}>Add vehicle</Button>
    </div>
  );
}

/* Faithful to features/booking/BookingsListScreen.tsx (M-23). */
function BookingsScreen({ onBookNew, onApprove }) {
  const upcoming = [
    { id: "1", name: "Preventive maintenance", when: "Tue, Sep 2, 09:00", status: "CONFIRMED", cancellable: true },
    { id: "2", name: "Full inspection", when: "Mon, Sep 22, 11:00", status: "BOOKED", cancellable: true },
  ];
  const past = [
    { id: "3", name: "Brake service", when: "Sun, May 3, 14:00", status: "COMPLETED" },
    { id: "4", name: "Aircon service", when: "Thu, Apr 10, 10:00", status: "CANCELLED" },
  ];
  const [cancelled, setCancelled] = React.useState([]);
  const Row = ({ a, cancellable }) => (
    <Card style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ font: "var(--type-body)", color: "var(--ac-ink)" }}>{a.name}</span>
      <span style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>
        {a.when} · {cancelled.includes(a.id) ? "CANCELLED" : a.status.replace("_", " ")}
      </span>
      {cancellable && !cancelled.includes(a.id) && (
        <div role="button" tabIndex={0} onClick={() => setCancelled([...cancelled, a.id])}
          style={{ minHeight: "var(--ac-target-member)", display: "flex", alignItems: "center", font: "var(--type-label)", color: "var(--ac-danger)", cursor: "pointer" }}>Cancel</div>
      )}
    </Card>
  );
  return (
    <div style={{ padding: "var(--ac-space-lg)", display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>My bookings</span>
        <div role="button" tabIndex={0} onClick={onBookNew}
          style={{ minHeight: "var(--ac-target-member)", display: "flex", alignItems: "center", font: "var(--type-label)", color: "var(--ac-primary)", cursor: "pointer" }}>Book new</div>
      </div>
      <Card accent="var(--ac-sev-attention)" interactive onClick={onApprove} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ font: "var(--type-body)", color: "var(--ac-ink)" }}>Work order WO-1042 needs your decision</span>
        <span style={{ font: "var(--type-label)", color: "var(--ac-primary)" }}>Approve your service ›</span>
      </Card>
      <span style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>Upcoming</span>
      {upcoming.map((a) => <Row key={a.id} a={a} cancellable={a.cancellable} />)}
      <span style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>Past</span>
      {past.map((a) => <Row key={a.id} a={a} cancellable={false} />)}
    </div>
  );
}

/* Faithful to features/work-orders/ApprovalRequestScreen.tsx (M-25) — per-line
   Approve / Defer / Decline, running approved total, atomic confirm. */
function ApprovalScreen({ onBack, onDone }) {
  const items = [
    { id: "i1", label: "Front brake pad replacement", desc: "Front pads at 3.0 mm, below the 5.0 mm threshold.", price: 320000, severity: "CRITICAL" },
    { id: "i2", label: "Tyre rotation", desc: "Rear tread wearing unevenly.", price: 45000, severity: "ATTENTION" },
    { id: "i3", label: "Cabin air filter", desc: null, price: 65000, severity: "MONITOR" },
  ];
  const SEV = { CRITICAL: "var(--ac-sev-critical)", ATTENTION: "var(--ac-sev-attention)", MONITOR: "var(--ac-sev-monitor)" };
  const [choices, setChoices] = React.useState({});
  const total = items.filter((i) => choices[i.id] === "APPROVED").reduce((s, i) => s + i.price, 0);
  const allDecided = items.every((i) => choices[i.id]);
  const peso = (c) => `₱${(c / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
  return (
    <>
      <NavBar onBack={onBack} />
      <div style={{ padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
        <div style={{ font: "var(--type-h1)", color: "var(--ac-ink)" }}>Approve your service</div>
        <div style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>
          Work order WO-1042. Decide each item below — approve what you want done, decline or defer the rest.
        </div>
        {items.map((i) => (
          <Card key={i.id} style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-xs)" }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, flex: "none", background: SEV[i.severity] }} />
              <span style={{ font: "var(--type-h2)", color: "var(--ac-ink)", flex: 1 }}>{i.label}</span>
              <span style={{ font: "var(--type-h2)", color: "var(--ac-ink)", fontVariantNumeric: "tabular-nums" }}>{peso(i.price)}</span>
            </div>
            {i.desc && <span style={{ font: "var(--type-body)", color: "var(--ac-ink-muted)" }}>{i.desc}</span>}
            <div style={{ display: "flex", gap: "var(--ac-space-xs)" }}>
              {[["APPROVED", "Approve", "var(--ac-success)"], ["DEFERRED", "Defer", "var(--ac-ink-muted)"], ["DECLINED", "Decline", "var(--ac-danger)"]].map(([d, label, color]) => {
                const on = choices[i.id] === d;
                return (
                  <button key={d} type="button" onClick={() => setChoices((c) => ({ ...c, [i.id]: d }))}
                    style={{ flex: 1, minHeight: "var(--ac-target-member)", borderRadius: "var(--ac-radius-md)", background: on ? color : "var(--ac-surface)", color: on ? "#fff" : "var(--ac-ink)", border: `1px solid ${on ? color : "var(--ac-line)"}`, font: "var(--type-body)", cursor: "pointer" }}>{label}</button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--ac-line)", background: "var(--ac-surface)", padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>Approved total</span>
          <span style={{ font: "var(--type-h2)", color: "var(--ac-ink)", fontVariantNumeric: "tabular-nums" }}>{peso(total)}</span>
        </div>
        <Button block disabled={!allDecided} onClick={onDone}>Confirm decisions</Button>
      </div>
    </>
  );
}

function AccountScreen() {
  return (
    <div style={{ padding: "var(--ac-space-lg) var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
      <Section title="Account" sub="Rielle Tatel · rielle@example.ph" />
      <Card style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>Care Plus</span>
          <StatusPill tone="success">ACTIVE</StatusPill>
        </div>
        <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)", textTransform: "uppercase", letterSpacing: "var(--ac-tracking-label)" }}>Next billing date</div>
        <div style={{ font: "var(--type-body)", color: "var(--ac-ink)" }}>15 September 2026 · ₱1,499</div>
        <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>6-month lock-in · ends 15 Jan 2027</div>
      </Card>
      <Section title="Change plan">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
          <PlanCard name="Care Basic" price="₱899" lockInMonths={0} actionLabel="Downgrade"
            inclusions={["1 inspection/cycle", "1 roadside call-out/cycle"]} />
          <PlanCard name="Care Plus" price="₱1,499" lockInMonths={6} selected actionLabel="Current plan"
            inclusions={["2 inspections/cycle", "1 pick-up & delivery/cycle", "2 roadside call-outs/cycle"]} />
        </div>
      </Section>
      {["Invoices & receipts", "Notifications", "Privacy & data", "Emergency contact"].map((l) => (
        <div key={l} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 48, borderBottom: "1px solid var(--ac-line)", font: "var(--type-body)", color: "var(--ac-ink)" }}>
          {l}<Icon name="chevron-right" size={18} color="var(--ac-ink-muted)" />
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { VehiclesScreen, BookingsScreen, ApprovalScreen, AccountScreen });
