function TaskListScreen({ onStart, onQueue }) {
  const tasks = [
    { id: "WO-1042", plate: "ABC 1234", vehicle: "2019 Toyota Vios", service: "Preventive maintenance", time: "09:00", status: "IN PROGRESS", tone: "info" },
    { id: "WO-1043", plate: "XYZ 8842", vehicle: "2021 Mitsubishi L300", service: "Full inspection", time: "11:00", status: "BOOKED", tone: "neutral" },
    { id: "WO-1044", plate: "JKL 2290", vehicle: "2017 Honda City", service: "Brake service", time: "14:00", status: "AWAITING APPROVAL", tone: "warn" },
  ];
  return (
    <>
      <FieldNav title="Today · 24 Aug" right={<span style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)", paddingRight: 8 }}>Mechanic · J. Cruz</span>} />
      <div style={{ padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
        {tasks.map((t) => (
          <Card key={t.id} interactive onClick={onStart} pad="md" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)" }}>
              <span style={{ fontFamily: "var(--ac-font-mono)", fontSize: 18, fontWeight: 600, color: "var(--ac-ink)" }}>{t.time}</span>
              <Plate variant="plain" style={{ fontSize: 17 }}>{t.plate}</Plate>
              <span style={{ flex: 1 }} />
              <StatusPill tone={t.tone}>{t.status}</StatusPill>
            </div>
            <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>{t.service}</div>
            <div style={{ font: "var(--type-body)", fontSize: 18, color: "var(--ac-ink-muted)" }}>{t.vehicle} · {t.id}</div>
          </Card>
        ))}
        <Button size="field" block icon={<Icon name="wrench" size={20} />} onClick={onStart} style={{ marginTop: "var(--ac-space-sm)" }}>Start inspection</Button>
        <Button size="field" block variant="secondary" icon={<Icon name="refresh-cw" size={20} />} onClick={onQueue}>Sync queue (3)</Button>
      </div>
    </>
  );
}

function CategoryNavScreen({ onBack, onPoint, onReview }) {
  const done = CATS.reduce((n, c) => n + c.done, 0);
  const total = CATS.reduce((n, c) => n + c.total, 0);
  return (
    <>
      <FieldNav title="Inspection · ABC 1234" onBack={onBack} />
      <div style={{ padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
        <div style={{ font: "var(--type-body)", fontSize: 18, color: "var(--ac-ink-muted)" }}>{done} of {total} points recorded</div>
        <div style={{ height: 8, borderRadius: 999, background: "var(--ac-line)", overflow: "hidden" }}>
          <div style={{ width: `${(done / total) * 100}%`, height: "100%", background: "var(--ac-primary)" }} />
        </div>
        {CATS.map((c) => (
          <Card key={c.code} interactive onClick={onPoint} style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-md)", minHeight: 56 }}>
            <div style={{ flex: 1 }}>
              <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>{c.label}</div>
              <div style={{ font: "var(--type-label)", fontSize: 15, color: "var(--ac-ink-muted)" }}>{c.labelFil}</div>
            </div>
            <span style={{ fontFamily: "var(--ac-font-mono)", fontSize: 17, color: c.done === c.total ? "var(--ac-band-excellent)" : "var(--ac-ink-muted)" }}>{c.done}/{c.total}</span>
            <Icon name="chevron-right" size={22} color="var(--ac-ink-muted)" />
          </Card>
        ))}
        <Button size="field" block onClick={onReview} icon={<Icon name="clipboard-check" size={20} />}>Review &amp; submit</Button>
      </div>
    </>
  );
}

Object.assign(window, { TaskListScreen, CategoryNavScreen });
