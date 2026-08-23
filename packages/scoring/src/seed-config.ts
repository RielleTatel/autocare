import type { ChecklistConfig, ConfigPoint, StatusTemplates, Thresholds } from "./types";

/** Launch checklist v1.0 — the single authoring point for both the golden
 *  test suite and the DB seed (Task 3). Weights per VHS §11.3 Step 4
 *  (rebalanced 2026-08-17: Emissions + Sensors added, total still 100).
 *  Thresholds verbatim from §11.3 Step 2. */

const TREAD: Thresholds = { direction: "HIGHER_BETTER", good: 5.0, monitor: 3.0, attention: 1.6 };
const PAD: Thresholds = { direction: "HIGHER_BETTER", good: 7.0, monitor: 4.0, attention: 2.0 };
const VOLTAGE: Thresholds = { direction: "HIGHER_BETTER", good: 12.6, monitor: 12.4, attention: 12.0 };
const LEVEL_PCT: Thresholds = { direction: "HIGHER_BETTER", good: 80, monitor: 60, attention: 40 };
const MOISTURE: Thresholds = { direction: "LOWER_BETTER", good: 2.0, monitor: 3.0, attention: 4.0 };
const PRESSURE_DEV: Thresholds = { direction: "LOWER_BETTER", good: 6, monitor: 13, attention: 26 };

/** §11.6a-style status sentences for a component. Measured points get
 *  {measured}/{threshold}/{unit} placeholders filled by renderExplanation. */
function tpl(component: string, measured = false): StatusTemplates {
  const m = measured ? " ({measured} {unit}, recommended limit {threshold} {unit})" : "";
  return {
    GOOD: `${component} is in good condition${m}. No action needed.`,
    MONITOR: `${component} is serviceable, but${measured ? " {measured} {unit} is" : " it is"} approaching the recommended limit. Have it checked at your next visit.`,
    ATTENTION: `${component} needs attention soon${m}. Book a service to address it.`,
    CRITICAL: `${component} is in unsafe condition${m}. Have it repaired before driving further.`,
  };
}

type PointDef = {
  code: string; label: string; labelFil: string; w: number;
  sc?: boolean; thresholds?: Thresholds; unit?: string;
  rec: string; naWhen?: string; photoOnAdverse?: boolean;
};
function pt(d: PointDef): ConfigPoint {
  return {
    code: d.code, label: d.label, labelFil: d.labelFil, weightInCategory: d.w,
    isSafetyCritical: d.sc ?? false,
    inputType: d.thresholds ? "MEASURED" : "STATUS",
    unit: d.unit, thresholds: d.thresholds,
    recommendation: d.rec,
    templates: tpl(d.label, Boolean(d.thresholds)),
    requiresPhotoOnAdverse: d.photoOnAdverse ?? Boolean(d.sc),
    notApplicableWhen: d.naWhen,
  };
}

export const seedConfig: ChecklistConfig = {
  checklistVersion: "v1.0",
  weightVersion: "w1.0",
  categories: [
    { code: "ENGINE", label: "Engine & Drivetrain", labelFil: "Makina at Drivetrain", weight: 18, points: [
      pt({ code: "ENGINE_IDLE", label: "Engine idle quality", labelFil: "Kalidad ng idle ng makina", w: 20, rec: "Have the engine idle checked — rough idling can signal ignition or fuel issues." }),
      pt({ code: "ENGINE_NOISE", label: "Engine noise", labelFil: "Ingay ng makina", w: 15, rec: "Have unusual engine noise diagnosed before it worsens." }),
      pt({ code: "DRIVE_BELTS", label: "Drive belts", labelFil: "Mga drive belt", w: 15, rec: "Replace worn drive belts to avoid sudden failure." }),
      pt({ code: "ENGINE_LEAKS", label: "Engine leaks", labelFil: "Tagas sa makina", w: 15, rec: "Have engine leaks traced and sealed." }),
      pt({ code: "TRANSMISSION_SHIFT", label: "Transmission shifting", labelFil: "Pagkambyo ng transmission", w: 15, rec: "Have transmission shifting behaviour inspected." }),
      pt({ code: "ENGINE_MOUNTS", label: "Engine mounts", labelFil: "Mga engine mount", w: 10, rec: "Replace deteriorated engine mounts to stop excess vibration." }),
      pt({ code: "CLUTCH_OPERATION", label: "Clutch operation", labelFil: "Operasyon ng clutch", w: 10, rec: "Have the clutch checked for slipping or dragging.", naWhen: "automatic transmission" }),
    ] },
    { code: "BRAKES", label: "Brakes", labelFil: "Preno", weight: 16, points: [
      pt({ code: "BRAKE_PAD_FRONT", label: "Front brake pads", labelFil: "Brake pad sa harap", w: 30, sc: true, thresholds: PAD, unit: "mm", rec: "Replace front brake pads soon — they are below the safe minimum." }),
      pt({ code: "BRAKE_PAD_REAR", label: "Rear brake pads", labelFil: "Brake pad sa likod", w: 25, sc: true, thresholds: PAD, unit: "mm", rec: "Replace rear brake pads soon — they are below the safe minimum." }),
      pt({ code: "BRAKE_FLUID_MOISTURE", label: "Brake fluid moisture", labelFil: "Moisture ng brake fluid", w: 20, sc: true, thresholds: MOISTURE, unit: "%", rec: "Flush and replace the brake fluid — moisture reduces braking power." }),
      pt({ code: "BRAKE_DISC_CONDITION", label: "Brake disc condition", labelFil: "Kondisyon ng brake disc", w: 15, sc: true, rec: "Have the brake discs machined or replaced." }),
      pt({ code: "PARKING_BRAKE", label: "Parking brake", labelFil: "Parking brake", w: 10, sc: true, rec: "Have the parking brake adjusted so it holds firmly." }),
    ] },
    { code: "TYRES", label: "Tyres & Wheels", labelFil: "Gulong at Wheels", weight: 14, points: [
      pt({ code: "TREAD_FL", label: "Front-left tyre tread", labelFil: "Tread ng gulong sa harap-kaliwa", w: 20, sc: true, thresholds: TREAD, unit: "mm", rec: "Replace the front-left tyre — tread is below the safe minimum." }),
      pt({ code: "TREAD_FR", label: "Front-right tyre tread", labelFil: "Tread ng gulong sa harap-kanan", w: 20, sc: true, thresholds: TREAD, unit: "mm", rec: "Replace the front-right tyre — tread is below the safe minimum." }),
      pt({ code: "TREAD_RL", label: "Rear-left tyre tread", labelFil: "Tread ng gulong sa likod-kaliwa", w: 20, sc: true, thresholds: TREAD, unit: "mm", rec: "Replace the rear-left tyre — tread is below the safe minimum." }),
      pt({ code: "TREAD_RR", label: "Rear-right tyre tread", labelFil: "Tread ng gulong sa likod-kanan", w: 20, sc: true, thresholds: TREAD, unit: "mm", rec: "Replace the rear-right tyre — tread is below the safe minimum." }),
      pt({ code: "TYRE_PRESSURE_DEV", label: "Tyre pressure deviation", labelFil: "Deviation ng presyon ng gulong", w: 10, sc: true, thresholds: PRESSURE_DEV, unit: "%", rec: "Correct tyre pressures to the recommended values." }),
      pt({ code: "WHEEL_CONDITION", label: "Wheel condition", labelFil: "Kondisyon ng wheels", w: 10, rec: "Have damaged wheels inspected for cracks or bends." }),
    ] },
    { code: "BATTERY", label: "Battery & Electrical", labelFil: "Baterya at Elektrikal", weight: 11, points: [
      pt({ code: "BATTERY_VOLTAGE", label: "Battery voltage", labelFil: "Boltahe ng baterya", w: 40, thresholds: VOLTAGE, unit: "V", rec: "Have the battery tested — it may need charging or replacement." }),
      pt({ code: "CHARGING_OUTPUT", label: "Charging system output", labelFil: "Output ng charging system", w: 25, rec: "Have the alternator and charging system tested." }),
      pt({ code: "TERMINALS", label: "Battery terminals", labelFil: "Mga terminal ng baterya", w: 20, rec: "Clean and tighten the battery terminals." }),
      pt({ code: "WIRING_VISIBLE", label: "Visible wiring", labelFil: "Nakikitang mga kable", w: 15, rec: "Have damaged or exposed wiring repaired." }),
    ] },
    { code: "FLUIDS", label: "Fluids", labelFil: "Mga Likido", weight: 11, points: [
      pt({ code: "ENGINE_OIL_LEVEL", label: "Engine oil level", labelFil: "Level ng langis ng makina", w: 30, thresholds: LEVEL_PCT, unit: "%", rec: "Top up or change the engine oil." }),
      pt({ code: "COOLANT_LEVEL", label: "Coolant level", labelFil: "Level ng coolant", w: 25, thresholds: LEVEL_PCT, unit: "%", rec: "Top up the coolant and check for leaks." }),
      pt({ code: "BRAKE_FLUID_LEVEL", label: "Brake fluid level", labelFil: "Level ng brake fluid", w: 15, rec: "Top up the brake fluid and check for leaks." }),
      pt({ code: "ATF_CONDITION", label: "Transmission fluid condition", labelFil: "Kondisyon ng ATF", w: 15, rec: "Have the transmission fluid changed.", naWhen: "manual transmission" }),
      pt({ code: "PS_FLUID", label: "Power steering fluid", labelFil: "Likido ng power steering", w: 10, rec: "Top up the power steering fluid.", naWhen: "electric power steering" }),
      pt({ code: "WASHER_FLUID", label: "Washer fluid", labelFil: "Washer fluid", w: 5, rec: "Top up the windscreen washer fluid." }),
    ] },
    { code: "SUSP", label: "Suspension & Steering", labelFil: "Suspension at Manibela", weight: 9, points: [
      pt({ code: "SHOCKS", label: "Shock absorbers", labelFil: "Mga shock absorber", w: 30, rec: "Replace worn shock absorbers for a safer, more stable ride." }),
      pt({ code: "BUSHINGS", label: "Suspension bushings", labelFil: "Mga bushing ng suspension", w: 20, rec: "Replace cracked suspension bushings." }),
      pt({ code: "BALL_JOINTS", label: "Ball joints", labelFil: "Mga ball joint", w: 20, rec: "Replace worn ball joints before they fail." }),
      pt({ code: "STEERING_LINKAGE", label: "Steering linkage", labelFil: "Steering linkage", w: 20, sc: true, rec: "Have the steering linkage repaired — play in the steering is unsafe." }),
      pt({ code: "ALIGNMENT_PULL", label: "Alignment / pulling", labelFil: "Alignment / paghila", w: 10, rec: "Have the wheel alignment corrected." }),
    ] },
    { code: "LIGHTS", label: "Lights & Visibility", labelFil: "Ilaw at Visibility", weight: 7, points: [
      pt({ code: "HEADLIGHTS", label: "Headlights", labelFil: "Headlights", w: 25, sc: true, rec: "Replace failed headlight bulbs immediately." }),
      pt({ code: "BRAKE_LIGHTS", label: "Brake lights", labelFil: "Ilaw ng preno", w: 25, sc: true, rec: "Replace failed brake light bulbs immediately." }),
      pt({ code: "TURN_SIGNALS", label: "Turn signals", labelFil: "Mga signal light", w: 20, sc: true, rec: "Replace failed turn signal bulbs." }),
      pt({ code: "WIPERS", label: "Wipers", labelFil: "Mga wiper", w: 15, sc: true, rec: "Replace worn wiper blades for clear visibility in rain." }),
      pt({ code: "WINDSCREEN", label: "Windscreen", labelFil: "Windscreen", w: 10, sc: true, rec: "Have windscreen chips repaired before they spread." }),
      pt({ code: "HORN", label: "Horn", labelFil: "Busina", w: 5, rec: "Have the horn repaired." }),
    ] },
    { code: "EMISSIONS", label: "Emissions Systems", labelFil: "Sistema ng Emisyon", weight: 5, points: [
      pt({ code: "O2_SENSOR_SWITCHING", label: "O2 sensor switching", labelFil: "Switching ng O2 sensor", w: 40, rec: "Have the oxygen sensor tested — poor switching wastes fuel." }),
      pt({ code: "CATALYST_READINESS", label: "Catalyst readiness", labelFil: "Readiness ng catalyst", w: 35, rec: "Have the catalytic converter checked." }),
      pt({ code: "EXHAUST_ABNORMALITY", label: "Exhaust abnormality", labelFil: "Abnormalidad sa tambutso", w: 25, rec: "Have unusual exhaust smoke or noise diagnosed." }),
    ] },
    { code: "SENSORS", label: "Sensors & Electronics", labelFil: "Mga Sensor at Electronics", weight: 5, points: [
      pt({ code: "AIRBAG_WARNING_LIGHT", label: "Airbag warning light", labelFil: "Ilaw-babala ng airbag", w: 35, sc: true, rec: "Have the airbag system diagnosed immediately — the airbags may not deploy in a crash." }),
      pt({ code: "DASH_WARNING_LIGHTS", label: "Dashboard warning lights", labelFil: "Mga ilaw-babala sa dashboard", w: 30, rec: "Have active dashboard warning lights diagnosed." }),
      pt({ code: "CRUISE_CONTROL", label: "Cruise control", labelFil: "Cruise control", w: 20, rec: "Have the cruise control system checked.", naWhen: "not fitted" }),
      pt({ code: "SENSOR_WIRING", label: "Sensor wiring", labelFil: "Mga kable ng sensor", w: 15, rec: "Have damaged sensor wiring repaired." }),
    ] },
    { code: "BODY", label: "Body & Undercarriage", labelFil: "Katawan at Undercarriage", weight: 4, points: [
      pt({ code: "RUST_UNDERCARRIAGE", label: "Undercarriage rust", labelFil: "Kalawang sa undercarriage", w: 40, rec: "Have undercarriage rust treated before it spreads to structural parts." }),
      pt({ code: "BODY_PANELS", label: "Body panels", labelFil: "Mga panel ng katawan", w: 30, rec: "Have body panel damage repaired." }),
      pt({ code: "DOORS_LOCKS", label: "Doors & locks", labelFil: "Mga pinto at kandado", w: 15, rec: "Have sticking doors or locks serviced." }),
      pt({ code: "INTERIOR", label: "Interior condition", labelFil: "Kondisyon ng loob", w: 15, rec: "Address interior wear items as needed." }),
    ] },
  ],
};
