const { Card, Button, Plate, StatusPill, Icon, FormField, AttentionCard, AttentionItemRow, ScoreGauge, StarRating, CategoryBar, BandChip, TabBar, BottomSheet, MeasuredRow, PlanCard, EmptyState } = window.AutoCareDesignSystem_2155ba;

const ATTENTION = [
  { id: "1", severity: "CRITICAL", plate: "ABC 1234", title: "Front brake pads at 3.0 mm", body: "Replace within 1,000 km. Book a service and we'll collect the vehicle." },
  { id: "2", severity: "ATTENTION", plate: "ABC 1234", title: "Rear tyres at 4.0 mm tread", body: "Still legal, but plan replacement before the rainy season." },
  { id: "3", severity: "MONITOR", plate: "XYZ 8842", title: "Battery capacity 78%", body: "Within range. We'll re-check at the next inspection." },
  { id: "4", severity: "INFO", plate: "ABC 1234", title: "Inspection due in 12 days", body: "Your plan covers two inspections this cycle; one is unused." },
];

const CATEGORIES = [
  { code: "BRK", label: "Brakes", score: 55.0, weight: 22, points: 9 },
  { code: "TYR", label: "Tyres & wheels", score: 64.0, weight: 18, points: 6 },
  { code: "ENG", label: "Engine & fluids", score: 91.0, weight: 20, points: 12 },
  { code: "ELE", label: "Electrical & battery", score: 80.0, weight: 14, points: 7 },
  { code: "SUS", label: "Suspension & steering", score: 88.0, weight: 14, points: 8 },
  { code: "BDY", label: "Body & lights", score: 95.0, weight: 12, points: 10 },
];

const EXPLAIN = {
  BRK: { title: "Brakes", stars: "NEEDS_ATTENTION", body: "Front pad thickness is below the replacement threshold. Because brakes are safety-critical, this finding caps the whole vehicle score until it is resolved.", measured: "Measured 3.0 mm · good ≥ 5.0 mm" },
  TYR: { title: "Tyres & wheels", stars: "FAIR", body: "Rear tread depth is above the legal minimum but wearing unevenly. Rotation is recommended at the next visit.", measured: "Measured 4.0 mm · good ≥ 5.0 mm" },
  ENG: { title: "Engine & fluids", stars: "EXCELLENT", body: "Oil condition, coolant level and belt tension are all within the acceptable operational range.", measured: null },
  ELE: { title: "Electrical & battery", stars: "GOOD", body: "Battery capacity remains within the acceptable operational range but should be monitored during the next inspection.", measured: "Measured 12.3 V · good ≥ 12.4 V" },
  SUS: { title: "Suspension & steering", stars: "GOOD", body: "No play detected in the steering rack. Front shocks show light seepage; not yet actionable.", measured: null },
  BDY: { title: "Body & lights", stars: "EXCELLENT", body: "All lamps functional, no structural corrosion found on the underbody.", measured: null },
};

const Section = ({ title, sub, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "var(--ac-space-sm)" }}>
    <div>
      <div style={{ font: "var(--type-h1)", color: "var(--ac-ink)" }}>{title}</div>
      {sub && <div style={{ font: "var(--type-label)", color: "var(--ac-ink-muted)" }}>{sub}</div>}
    </div>
    {children}
  </div>
);

const NavBar = ({ title, onBack }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)", height: 44, flex: "none", background: "var(--ac-surface)", borderBottom: "1px solid var(--ac-line)", padding: "0 var(--ac-space-sm)" }}>
    <button type="button" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 2, border: "none", background: "transparent", color: "var(--ac-primary)", font: "var(--type-body)", fontWeight: 600, cursor: "pointer", padding: "8px 4px" }}>
      <Icon name="chevron-left" size={18} /> Back
    </button>
    <span style={{ font: "var(--type-h2)", color: "var(--ac-ink)" }}>{title}</span>
  </div>
);

Object.assign(window, { ATTENTION, CATEGORIES, EXPLAIN, Section, NavBar, Card, Button, Plate, StatusPill, Icon, FormField, AttentionCard, AttentionItemRow, ScoreGauge, StarRating, CategoryBar, BandChip, TabBar, BottomSheet, MeasuredRow, PlanCard, EmptyState });
