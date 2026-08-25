function HomeScreen({ onSeeAll, onBook, onOpenVehicle, onRoadside }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-lg)", padding: "var(--ac-space-lg) var(--ac-space-md)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)" }}>
        <img src={(window.__resources && window.__resources.logoMark) || "../../assets/logo-mark.png"} alt="" width="44" height="44" style={{ display: "block", flex: "none", borderRadius: 10 }} />
        <div>
          <div style={{ font: "var(--type-h1)", color: "var(--ac-primary-deep)" }}>Magandang araw, Rielle</div>
          <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>Care Plus · next billing 15 Sep 2026</div>
        </div>
      </div>
      <AttentionCard items={ATTENTION} onSeeAll={onSeeAll} onPressItem={onSeeAll} />
      <Card interactive onClick={onOpenVehicle} style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Plate variant="chip">ABC 1234</Plate>
          <BandChip band="FAIR" />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ font: "var(--type-body)", color: "var(--ac-ink)" }}>2019 Toyota Vios 1.3 XE</span>
          <span style={{ font: "var(--type-code)", color: "var(--ac-ink-muted)", fontFamily: "var(--ac-font-mono)" }}>48,210 km</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <StarRating band="FAIR" size={18} />
          <span style={{ font: "var(--type-label)", color: "var(--ac-primary)", fontWeight: 600 }}>Health score 69 ›</span>
        </div>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
        <Button variant="deep" block icon={<Icon name="calendar-plus" size={18} />} onClick={onBook}>Book a service</Button>
        <div style={{ display: "flex", gap: "var(--ac-space-sm)" }}>
          <Button variant="secondary" style={{ flex: 1 }}>Update odometer</Button>
          <Button variant="secondary" style={{ flex: 1 }}>Add vehicle</Button>
        </div>
      </div>
      <Card accent="var(--ac-danger)" style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-md)" }}>
        <Icon name="phone" size={24} color="var(--ac-danger)" />
        <div style={{ flex: 1 }}>
          <div style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>Roadside assistance</div>
          <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>2 call-outs left this cycle</div>
        </div>
        <Button variant="danger" onClick={onRoadside}>Request</Button>
      </Card>
    </div>
  );
}

function AttentionListScreen({ onBack }) {
  return (
    <>
      <NavBar title="Needs attention" onBack={onBack} />
      <div style={{ padding: "var(--ac-space-md)", display: "flex", flexDirection: "column", gap: "var(--ac-space-md)" }}>
        {[["ABC 1234", ATTENTION.filter((i) => i.plate === "ABC 1234")], ["XYZ 8842", ATTENTION.filter((i) => i.plate === "XYZ 8842")]].map(([plate, items]) => (
          <div key={plate} style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
            <Plate variant="plain" style={{ color: "var(--ac-ink-muted)" }}>{plate}</Plate>
            {items.map((i) => <AttentionItemRow key={i.id} {...i} />)}
          </div>
        ))}
      </div>
    </>
  );
}

Object.assign(window, { HomeScreen, AttentionListScreen });
