/* Faithful to apps/member/src/features/booking/{ServiceTypeScreen,SlotPickerScreen,ConfirmScreen}.tsx.
   Three steps only — the source flow has no pick-up step (M-21 is not built in the repo). */

const SERVICE_TYPES = [
  { code: "PM", name: "Preventive maintenance", durationMin: 120, price: "₱2,800.00", entitled: true },
  { code: "INS", name: "Full inspection", durationMin: 120, price: "₱1,500.00", entitled: true },
  { code: "BRK", name: "Brake service", durationMin: 120, price: "₱3,200.00", entitled: false },
  { code: "AC", name: "Aircon service", durationMin: 90, price: "₱1,800.00", entitled: false },
];

const OPEN_SLOTS = ["08:00", "09:00", "10:30", "13:00", "14:00", "15:30"];

const ENTITLEMENT_LINE = { PM: "Uses 1 of 2 monthly inspections", INS: "Uses 1 of 2 monthly inspections", BRK: null, AC: null };

function BookingFlow({ onBack, onDone }) {
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

  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const expired = hold === 0;
  const back = () => (step === 0 ? onBack() : setStep(step - 1));

  return (
    <>
      <NavBar onBack={back} />
      <div style={{ padding: "var(--ac-space-lg)", display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>

        {step === 0 && (
          <>
            <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>Book a service</div>
            {SERVICE_TYPES.map((s) => (
              <Card key={s.code} interactive onClick={() => { setService(s); setStep(1); }} style={{ display: "flex", flexDirection: "column", gap: 4, minHeight: "var(--ac-target-member)" }}>
                <span style={{ font: "var(--type-body)", color: "var(--ac-ink)" }}>{s.name}</span>
                <span style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>{s.durationMin} min</span>
                <span style={{ font: "var(--type-label)", color: s.entitled ? "var(--ac-primary)" : "var(--ac-ink)" }}>
                  {s.entitled ? "Included in your plan" : s.price}
                </span>
              </Card>
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>Pick a time</div>
            {hold != null && !expired && (
              <div style={{ font: "var(--type-label)", color: "var(--ac-primary)" }}>Slot held — {mmss(hold)} left to confirm</div>
            )}
            {expired && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ font: "var(--type-label)", color: "var(--ac-danger)" }}>Your hold expired. Please pick a time again.</div>
                <div role="button" tabIndex={0} onClick={() => { setHold(null); setSlot(null); }}
                  style={{ minHeight: "var(--ac-target-member)", display: "flex", alignItems: "center", font: "var(--type-label)", color: "var(--ac-primary)", cursor: "pointer" }}>Refresh times</div>
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--ac-space-sm)" }}>
              {OPEN_SLOTS.map((t) => {
                const locked = hold != null && !expired;
                return (
                  <button key={t} type="button" disabled={locked && slot !== t}
                    onClick={() => { setSlot(t); setHold(600); }}
                    style={{
                      minHeight: "var(--ac-target-member)", padding: "0 var(--ac-space-md)",
                      border: `1px solid ${slot === t ? "var(--ac-primary)" : "var(--ac-line)"}`,
                      borderRadius: "var(--ac-radius-sm)", background: "var(--ac-surface)",
                      font: "var(--type-code)", fontFamily: "var(--ac-font-mono)",
                      color: "var(--ac-ink)", opacity: locked && slot !== t ? 0.4 : 1,
                      cursor: locked && slot !== t ? "not-allowed" : "pointer",
                    }}>{t}</button>
                );
              })}
            </div>
            {slot && !expired && <Button block onClick={() => setStep(2)}>Continue</Button>}
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>Confirm booking</div>
            <Card style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ font: "var(--type-body)", color: "var(--ac-ink)" }}>{service?.name}</span>
              <span style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>Tue, Sep 2, {slot}</span>
              {ENTITLEMENT_LINE[service?.code] && (
                <span style={{ font: "var(--type-label)", color: "var(--ac-primary)" }}>{ENTITLEMENT_LINE[service.code]}</span>
              )}
            </Card>
            <Button block disabled={submitting} onClick={() => { setSubmitting(true); setTimeout(onDone, 500); }}>
              {submitting ? "Booking…" : "Confirm"}
            </Button>
          </>
        )}
      </div>
    </>
  );
}

Object.assign(window, { BookingFlow });
