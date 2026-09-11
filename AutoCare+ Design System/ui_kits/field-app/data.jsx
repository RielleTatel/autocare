const { Card, Button, Plate, StatusPill, Icon, FormField, ScoreGauge, StarRating, CategoryBar, BandChip, SyncBanner, StatusChoice, StatusChip, EmptyState } = window.AutoCareDesignSystem_2155ba;

const POINTS = [
  { code: "BRK-01", label: "Front pad thickness", labelFil: "Kapal ng harap na brake pad", unit: "mm", measured: true, good: 5.0, value: "3.0", status: "ATTENTION", photoRequired: true },
  { code: "BRK-02", label: "Rear pad thickness", labelFil: "Kapal ng likod na brake pad", unit: "mm", measured: true, good: 5.0, value: "5.5", status: "GOOD" },
  { code: "BRK-03", label: "Disc runout", labelFil: "Pagkiling ng disc", measured: false, status: "GOOD" },
  { code: "BRK-04", label: "Brake fluid condition", labelFil: "Kalagayan ng brake fluid", measured: false, status: null },
];

const CATS = [
  { code: "BRK", label: "Brakes", labelFil: "Preno", done: 3, total: 4 },
  { code: "TYR", label: "Tyres & wheels", labelFil: "Gulong", done: 6, total: 6 },
  { code: "ENG", label: "Engine & fluids", labelFil: "Makina", done: 12, total: 12 },
  { code: "ELE", label: "Electrical & battery", labelFil: "Kuryente", done: 0, total: 7 },
  { code: "SUS", label: "Suspension & steering", labelFil: "Suspensyon", done: 0, total: 8 },
  { code: "BDY", label: "Body & lights", labelFil: "Katawan at ilaw", done: 0, total: 10 },
];

const FieldNav = ({ title, onBack, right }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "var(--ac-space-sm)", minHeight: 52, flex: "none", background: "var(--ac-surface)", borderBottom: "1px solid var(--ac-line)", padding: "0 var(--ac-space-sm)" }}>
    {onBack && (
      <button type="button" onClick={onBack} style={{ display: "flex", alignItems: "center", minHeight: 44, border: "none", background: "transparent", color: "var(--ac-primary)", font: "var(--type-h2)", cursor: "pointer", padding: "0 4px" }}>
        <Icon name="chevron-left" size={22} /> Back
      </button>
    )}
    <span style={{ font: "var(--type-h2)", color: "var(--ac-ink)", flex: 1 }}>{title}</span>
    {right}
  </div>
);

Object.assign(window, { POINTS, CATS, FieldNav, Card, Button, Plate, StatusPill, Icon, FormField, ScoreGauge, StarRating, CategoryBar, BandChip, SyncBanner, StatusChoice, StatusChip, EmptyState });
