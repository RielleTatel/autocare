const { Card, Button, Plate, StatusPill, Icon, FormField, CategoryBar, BandChip, StarRating, EmptyState } = window.AutoCareDesignSystem_2155ba;

const APPTS = [
  { id: "a1", hour: "09:00", plate: "ABC 1234", service: "Preventive maintenance", start: "09:00", end: "11:00", member: "R. Tatel", status: "IN_PROGRESS", pickup: true },
  { id: "a2", hour: "09:00", plate: "QRS 4410", service: "Oil change", start: "09:30", end: "10:15", member: "M. Santos", status: "CONFIRMED" },
  { id: "a3", hour: "11:00", plate: "XYZ 8842", service: "Full inspection", start: "11:00", end: "13:00", member: "Delgado Fleet", status: "BOOKED" },
  { id: "a4", hour: "14:00", plate: "JKL 2290", service: "Brake service", start: "14:00", end: "16:00", member: "A. Reyes", status: "BOOKED", pickup: true },
  { id: "a5", hour: "14:00", plate: "TUV 7781", service: "Aircon service", start: "14:30", end: "15:30", member: "L. Uy", status: "CANCELLED" },
];

const STATUS_TONE = { BOOKED: "info", CONFIRMED: "info", IN_PROGRESS: "info", COMPLETED: "success", CANCELLED: "neutral", NO_SHOW: "danger" };

const UTIL = [0.42, 0.55, 0.61, 0.7, 0.78, 0.83, 0.88, 0.92, 0.74, 0.66, 0.58, 0.71, 0.86, 0.94];

const TopBar = ({ console: label, nav, active, onNav, onSignOut }) => (
  <header style={{ background: "var(--ac-primary-deep)", color: "#fff", display: "flex", alignItems: "center", gap: "var(--ac-space-lg)", padding: "0 var(--ac-space-lg)", height: 56, flex: "none" }}>
    <span style={{ fontFamily: "var(--ac-font-display)", fontWeight: 600, fontSize: 22, letterSpacing: "0.01em" }}>AutoCare+</span>
    <span style={{ fontFamily: "var(--ac-font-mono)", fontSize: 12, color: "var(--ac-on-deep-meta)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
    <nav style={{ display: "flex", gap: 4, marginLeft: "var(--ac-space-md)" }}>
      {nav.map((n) => (
        <button key={n} type="button" onClick={() => onNav(n)}
          style={{ border: "none", background: active === n ? "rgba(255,255,255,0.12)" : "transparent", color: active === n ? "#fff" : "var(--ac-on-deep-body)", font: "var(--type-body)", fontSize: 14, fontWeight: 500, padding: "8px 12px", borderRadius: "var(--ac-radius-sm)", cursor: "pointer", minHeight: 36 }}>{n}</button>
      ))}
    </nav>
    <span style={{ flex: 1 }} />
    <button type="button" onClick={onSignOut} style={{ border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", font: "var(--type-body)", fontSize: 14, padding: "8px 12px", borderRadius: "var(--ac-radius-sm)", cursor: "pointer" }}>Sign out</button>
  </header>
);

Object.assign(window, { APPTS, STATUS_TONE, UTIL, TopBar, Card, Button, Plate, StatusPill, Icon, FormField, CategoryBar, BandChip, StarRating, EmptyState });
