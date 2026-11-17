import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, AppState, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import { DIAGRAM_ZONES } from "@autocare/contracts";
import { theme } from "../../theme";
import { BottomSheet } from "../../components/BottomSheet";
import { Button } from "../../components/Button";
import { DiagramZoneSheet } from "./DiagramZoneSheet";
import { VehicleDiagram } from "./VehicleDiagram";
import { type ShapeId } from "./diagramGeometry";
import { statusLabel } from "./zoneStatus";
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

export function VehicleHealthViewer({ results, onShapePress, initialMode, onModeChange, enabled = true, onOpenBreakdown }: {
  enabled?: boolean;
  onOpenBreakdown?: () => void;
  results: InspectionResultDetail[];
  onShapePress: (shape: ShapeId) => void;
  initialMode?: "2d" | "3d";
  onModeChange?: (mode: "2d" | "3d") => void;
}) {
  const { height } = useWindowDimensions();
  const viewportHeight = Math.max(220, Math.min(460, height * 0.45));
  const [panel, setPanel] = useState<"regions" | "colors" | null>(null);
  const [mode, setMode] = useState<"2d" | "3d">(Platform.OS === "web" ? "2d" : initialMode ?? "3d");
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const [selectedShape, setSelectedShape] = useState<ShapeId | null>(null);
  const selectShape = (shape: ShapeId) => { setSelectedShape(shape); setPanel("regions"); onShapePress(shape); };
  const fail = useCallback(() => { setFailed(true); setMode("2d"); onModeChange?.("2d"); }, [onModeChange]);
  const markReady = useCallback(() => setReady(true), []);
  const markLoading = useCallback(() => setReady(false), []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setActive(state === "active"));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (mode !== "3d" || ready || !active || !enabled) return;
    const timeout = setTimeout(fail, 15000);
    return () => clearTimeout(timeout);
  }, [mode, ready, active, enabled, fail]);
  useEffect(() => { if (!enabled) setReady(false); }, [enabled]);
  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", gap: theme.spacing.xs, backgroundColor: theme.colors.surfaceSunken, padding: 4, borderRadius: theme.radii.sm }}>
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
            style={{ minHeight: 48, padding: 12, backgroundColor: mode === value ? theme.colors.surface : "transparent", borderRadius: theme.radii.sm }}>
            <Text style={{ ...theme.text("label", 600), color: mode === value ? theme.colors.primary : theme.colors.inkMuted }}>{value.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={() => setPanel("colors")} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 8 }}>
        <Text style={{ ...theme.text("label"), color: theme.colors.inkMuted }}>Color key</Text>
      </Pressable>
      </View>
      {failed && <Text accessibilityRole="alert" style={{ color: theme.colors.inkMuted }}>3D is unavailable. You can explore the same findings in 2D or select a region below.</Text>}
      {mode === "2d" ? <VehicleDiagram results={results} onShapePress={selectShape} /> : (
        <DiagramBoundary key={attempt} onError={fail}>
          {!ready && <View accessibilityLabel="Loading vehicle model"><ActivityIndicator /><Text style={{ color: theme.colors.inkMuted }}>Loading vehicle model…</Text></View>}
          <Suspense fallback={null}>{enabled && <NativeDiagram viewportHeight={viewportHeight} results={results} onShapePress={selectShape} onError={fail} onReady={markReady} onLoading={markLoading} />}</Suspense>
        </DiagramBoundary>
      )}
      <Button block variant="secondary" icon="list-tree" onPress={() => { setSelectedShape(null); setPanel("regions"); }}>Choose a region</Button>
      <Text style={{ ...theme.text("label"), color: theme.colors.inkMuted }}>Generic vehicle. Colors show the most concerning finding in each region.</Text>
      {results.some(r => !r.diagramZone || !(DIAGRAM_ZONES as readonly string[]).includes(r.diagramZone)) && <View style={{ gap: theme.spacing.sm }}>
        <Text style={{ ...theme.text("label"), color: theme.colors.inkMuted }}>Some findings have no known location. Open category breakdown to see all inspection findings.</Text>
        {onOpenBreakdown && <Button variant="ghost" onPress={onOpenBreakdown}>See category breakdown</Button>}
      </View>}
      <BottomSheet open={panel === "colors"} title="Diagram colors" onClose={() => setPanel(null)} closeLabel="Close">
        <Text style={{ ...theme.text("body"), color: theme.colors.inkMuted }}>Group findings can affect several regions. Missing findings are not a healthy result.</Text>
        {(["GOOD", "MONITOR", "ATTENTION", "CRITICAL", undefined] as const).map(status => (
          <View key={status ?? "unknown"} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor(status) }} />
            <Text style={{ ...theme.text("label"), color: theme.colors.inkMuted }}>{statusLabel(status)}</Text>
          </View>
        ))}
      </BottomSheet>
      <DiagramZoneSheet shapeId={panel === "regions" ? selectedShape : null} chooseRegion={panel === "regions"}
        results={results} onSelectRegion={selectShape} onClose={() => { setPanel(null); setSelectedShape(null); }} />
    </View>
  );
}
