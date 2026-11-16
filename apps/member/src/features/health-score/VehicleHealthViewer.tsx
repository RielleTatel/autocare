import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Platform, Pressable, Text, View } from "react-native";
import { DIAGRAM_ZONES } from "@autocare/contracts";
import { theme } from "../../theme";
import { VehicleDiagram } from "./VehicleDiagram";
import { SHAPES, shapeStatuses, zonesForShape, type ShapeId } from "./diagramGeometry";
import { effectiveStatus, statusLabel, zoneStatuses } from "./zoneStatus";
import { statusColor } from "./statusColor";
import type { InspectionResultDetail } from "./healthScoreApi";

// Import only when requested, so missing native modules can recover inside the boundary.
const NativeDiagram = lazy(() => Promise.resolve().then(() => {
  const renderer = require("./VehicleDiagram3D") as typeof import("./VehicleDiagram3D");
  return { default: renderer.VehicleDiagram3D };
}));

class DiagramBoundary extends Component<{ children: ReactNode; onError: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function VehicleHealthViewer({ results, onShapePress, initialMode, onModeChange }: {
  results: InspectionResultDetail[];
  onShapePress: (shape: ShapeId) => void;
  initialMode?: "2d" | "3d";
  onModeChange?: (mode: "2d" | "3d") => void;
}) {
  const [mode, setMode] = useState<"2d" | "3d">(Platform.OS === "web" ? "2d" : initialMode ?? "3d");
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const byShape = shapeStatuses(zoneStatuses(results));
  const fail = useCallback(() => { setFailed(true); setMode("2d"); onModeChange?.("2d"); }, [onModeChange]);
  const markReady = useCallback(() => setReady(true), []);
  const markLoading = useCallback(() => setReady(false), []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (mode !== "3d" || ready || !active) return;
    const timeout = setTimeout(fail, 15000);
    return () => clearTimeout(timeout);
  }, [mode, ready, active, fail]);
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={{ ...theme.text("label"), color: theme.colors.inkMuted }}>Generic vehicle · Inspection regions</Text>
      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
        {(["3d", "2d"] as const).map(value => (
          <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value.toUpperCase()} vehicle view`}
            accessibilityState={{ selected: mode === value, disabled: value === "3d" && Platform.OS === "web" }}
            disabled={value === "3d" && Platform.OS === "web"}
            onPress={() => {
              if (value === mode) return;
              if (value === "3d") { setFailed(false); setAttempt(current => current + 1); setReady(false); }
              setMode(value);
              onModeChange?.(value);
            }}
            style={{ minHeight: 48, padding: 12, backgroundColor: mode === value ? theme.colors.primary : theme.colors.surface, borderRadius: theme.radii.sm }}>
            <Text style={{ color: mode === value ? "#FFFFFF" : theme.colors.ink }}>{value.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      {failed && <Text accessibilityRole="alert" style={{ color: theme.colors.inkMuted }}>3D is unavailable. You can explore the same findings in 2D or select a region below.</Text>}
      {mode === "2d" ? <VehicleDiagram results={results} onShapePress={onShapePress} /> : (
        <DiagramBoundary key={attempt} onError={fail}>
          {!ready && <View accessibilityLabel="Loading vehicle model"><ActivityIndicator /><Text style={{ color: theme.colors.inkMuted }}>Loading vehicle model…</Text></View>}
          <Suspense fallback={null}><NativeDiagram results={results} onShapePress={onShapePress} onError={fail} onReady={markReady} onLoading={markLoading} /></Suspense>
        </DiagramBoundary>
      )}
      <Text style={{ ...theme.text("label"), color: theme.colors.ink }}>Select an inspection region</Text>
      <Text style={{ ...theme.text("body"), color: theme.colors.inkMuted }}>Each region shows its most concerning recorded finding. Group findings can affect several regions.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        {(["GOOD", "MONITOR", "ATTENTION", "CRITICAL", undefined] as const).map(status => (
          <View key={status ?? "unknown"} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor(status) }} />
            <Text style={{ ...theme.text("label"), color: theme.colors.inkMuted }}>{statusLabel(status)}</Text>
          </View>
        ))}
      </View>
      {SHAPES.map(shape => {
        const zones = new Set(zonesForShape(shape.id));
        const matching = results.filter(r => r.diagramZone && zones.has(r.diagramZone));
        const label = byShape[shape.id] ? statusLabel(byShape[shape.id]) : matching.length === 0 ? "No findings recorded" : matching.every(r => effectiveStatus(r) === "NOT_APPLICABLE") ? "Not applicable" : "Status unavailable";
        return <Pressable key={shape.id} testID={`region-${shape.id}`} accessibilityRole="button"
          accessibilityLabel={`${shape.label}: ${label}`} onPress={() => onShapePress(shape.id)}
          style={{ minHeight: 48, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: theme.colors.line }}>
          <Text style={{ ...theme.text("body"), color: theme.colors.ink }}>{shape.label} · {label}</Text>
        </Pressable>;
      })}
      {results.some(r => !r.diagramZone || !(DIAGRAM_ZONES as readonly string[]).includes(r.diagramZone)) && <Text style={{ color: theme.colors.inkMuted }}>Some findings have no known location. Open category breakdown to see all inspection findings.</Text>}
    </View>
  );
}
