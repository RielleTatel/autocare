import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, PanResponder, Pressable, Text, View } from "react-native";
import { Canvas, useFrame, useLoader, useThree, type RootState } from "@react-three/fiber/native";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Color, Group, Mesh, MeshStandardMaterial, Raycaster, Vector2 } from "three";
import { theme } from "../../theme";
import { BottomSheet } from "../../components/BottomSheet";
import { Icon } from "../../components/Icon";
import { SHAPES, shapeStatuses, type ShapeId } from "./diagramGeometry";
import { zoneStatuses } from "./zoneStatus";
import { statusColor } from "./statusColor";
import type { InspectionResultDetail } from "./healthScoreApi";
import { modelRegion } from "./modelRegion";
import { fitVehicleCameraDistance, VEHICLE_CAMERA_FOV } from "./vehicleCameraFit.mjs";

type Props = {
  viewportHeight?: number;
  results: InspectionResultDetail[];
  onShapePress?: (id: ShapeId) => void;
  onError: (error: Error) => void;
  onLoading?: () => void;
  onReady?: () => void;
};

// Metro resolves a bundled asset to its numeric asset-registry identifier.
const MODEL: number = require("../../../assets/vehicle/generic-vehicle.glb");
const REGION_IDS = new Set<string>(SHAPES.map((shape) => shape.id));
const INITIAL_ROTATION: [number, number, number] = [0.18, -0.65, 0];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

class SceneBoundary extends Component<{ onError: (error: Error) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

function FitVehicleCamera() {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    const distance = fitVehicleCameraDistance(width, height);
    const directionLength = Math.hypot(2.1, 6.8);
    camera.position.set(0, distance * 2.1 / directionLength, distance * 6.8 / directionLength);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    // Keep the user's explicit zoom factor when the viewport resizes.
    invalidate();
  }, [camera, width, height, invalidate]);
  return null;
}

function VehicleModel({ results, onReady, modelRef }: Pick<Props, "results" | "onReady"> & { modelRef: React.RefObject<Group | null> }) {
  // The native FileLoader accepts Expo's numeric registry IDs; Fiber's shared
  // web/native useLoader declaration currently describes URL strings only.
  const gltf = useLoader(GLTFLoader, MODEL as unknown as string);
  const invalidate = useThree((state) => state.invalidate);
  const readyFrame = useRef<number | null>(null);
  const readyCallback = useRef(onReady);
  readyCallback.current = onReady;
  // Clone materials, because useLoader caches the source scene across viewer mounts.
  const model = useMemo(() => {
    const clone = gltf.scene.clone(true);
    const found = new Set<string>();
    clone.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const region = modelRegion(object);
      if (region) found.add(region);
      const originals = Array.isArray(object.material) ? object.material : [object.material];
      const materials = originals.map((original) => {
        const material = original.clone() as MeshStandardMaterial;
        material.userData.regionBaseColor = material.color.clone();
        return material;
      });
      object.material = Array.isArray(object.material) ? materials : materials[0];
    });
    const missing = [...REGION_IDS].filter((id) => !found.has(id));
    if (missing.length) throw new Error(`Vehicle model is missing regions: ${missing.join(", ")}`);
    return clone;
  }, [gltf]);

  useEffect(() => {
    const statuses = shapeStatuses(zoneStatuses(results));
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const region = modelRegion(object);
      if (!region) return;
      const status = statuses[region];
      const tint = new Color(statusColor(status));
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials as MeshStandardMaterial[]) {
        material.color.copy(material.userData.regionBaseColor as Color).lerp(tint, status ? 0.65 : 0.3);
        material.emissive.copy(tint).multiplyScalar(status ? 0.06 : 0);
      }
    });
    invalidate();
  }, [model, results, invalidate]);

  // Wait until the next animation turn after the first render-loop visit.
  useFrame(() => {
    if (readyFrame.current === null) {
      readyFrame.current = requestAnimationFrame(() => readyCallback.current?.());
    }
  });

  useEffect(() => {
    return () => {
      if (readyFrame.current !== null) cancelAnimationFrame(readyFrame.current);
      readyFrame.current = null;
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
    };
  }, [model]);

  return (
    <group ref={modelRef} rotation={INITIAL_ROTATION}>
      <primitive object={model} position={[0, -0.72, 0]} dispose={null} />
    </group>
  );
}

/** Native-only scene. Screen-level lazy loading catches unavailable native modules. */
export function VehicleDiagram3D({ results, onShapePress, onError, onLoading, onReady, viewportHeight = 340 }: Props) {
  const modelRef = useRef<Group>(null);
  const rootRef = useRef<RootState | null>(null);
  const size = useRef({ width: 1, height: 340 });
  const start = useRef({ x: INITIAL_ROTATION[0], y: INITIAL_ROTATION[1] });
  const [active, setActive] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const [viewsOpen, setViewsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const pressRef = useRef(onShapePress);
  pressRef.current = onShapePress;
  const raycaster = useMemo(() => new Raycaster(), []);
  const handleSceneError = useCallback((error: Error) => {
    // Failed loads are cached by suspend-react. Clear only this model so an
    // explicit retry can recover from a transient asset/Metro read failure.
    useLoader.clear(GLTFLoader, MODEL as unknown as string);
    onError(error);
  }, [onError]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") rootRef.current = null;
      setActive(state === "active");
    });
    return () => { subscription.remove(); rootRef.current = null; };
  }, []);

  // The GL surface is recreated after backgrounding; re-arm the outer load timer.
  useEffect(() => {
    if (active) onLoading?.();
  }, [active, onLoading]);

  const applyZoom = useCallback((next: number) => {
    const bounded = clamp(next, 0.8, 1.8);
    setZoom(bounded);
    if (rootRef.current) {
      rootRef.current.camera.zoom = bounded;
      rootRef.current.camera.updateProjectionMatrix();
      rootRef.current.invalidate();
    }
  }, []);

  const preset = (x: number, y: number) => {
    modelRef.current?.rotation.set(x, y, 0);
    rootRef.current?.invalidate();
  };

  const gestures = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      if (modelRef.current) start.current = { x: modelRef.current.rotation.x, y: modelRef.current.rotation.y };
    },
    onPanResponderMove: (_, gesture) => {
      if (!modelRef.current) return;
      modelRef.current.rotation.set(
        clamp(start.current.x + gesture.dy * 0.008, -1.45, 1.45),
        start.current.y + gesture.dx * 0.008,
        0,
      );
      rootRef.current?.invalidate();
    },
    onPanResponderRelease: (event, gesture) => {
      const root = rootRef.current;
      const model = modelRef.current;
      if (!root || !model || Math.hypot(gesture.dx, gesture.dy) > 7) return;
      const { locationX, locationY } = event.nativeEvent;
      model.updateWorldMatrix(true, true);
      root.camera.updateMatrixWorld();
      raycaster.setFromCamera(new Vector2(locationX / size.current.width * 2 - 1, -(locationY / size.current.height) * 2 + 1), root.camera);
      const hit = raycaster.intersectObject(model, true).find((entry) => modelRegion(entry.object));
      const region = hit && modelRegion(hit.object);
      if (region) pressRef.current?.(region);
    },
    onPanResponderTerminationRequest: () => false,
  }), [raycaster]);

  const views = [
    { label: "Front", x: 0.18, y: 0 },
    { label: "Rear", x: 0.18, y: Math.PI },
    { label: "Top", x: 1.45, y: 0 },
    { label: "Underbody", x: -1.45, y: 0 },
  ];

  return (
    <View>
      <View style={{ height: viewportHeight, width: "100%", backgroundColor: theme.colors.surfaceSoft, borderRadius: theme.radii.md, overflow: "hidden" }} onLayout={({ nativeEvent }) => { size.current = nativeEvent.layout; }}>
        {active && (
          <View style={{ flex: 1 }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Canvas
              frameloop="demand"
              camera={{ fov: VEHICLE_CAMERA_FOV, zoom }}
              onCreated={(state) => { rootRef.current = state; state.camera.lookAt(0, 0, 0); }}
            >
              <ambientLight intensity={1.8} />
              <directionalLight position={[3, 6, 5]} intensity={2} />
              <directionalLight position={[-3, -3, -4]} intensity={1} />
              <SceneBoundary onError={handleSceneError}>
                <Suspense fallback={null}>
                  <FitVehicleCamera />
                  <VehicleModel results={results} modelRef={modelRef} onReady={onReady} />
                </Suspense>
              </SceneBoundary>
            </Canvas>
          </View>
        )}
        <View style={{ position: "absolute", inset: 0 }} {...gestures.panHandlers} accessible={false} />
      </View>
      <Text style={{ ...theme.text("label"), color: theme.colors.inkMuted, textAlign: "center" }}>
        Drag to rotate. Tap a region to see findings.
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Camera views" onPress={() => setViewsOpen(true)}
          style={{ flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radii.sm }}>
          <Icon name="camera" size={16} /><Text style={{ ...theme.text("label"), color: theme.colors.ink, flexShrink: 1 }}>Views</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Reset view" onPress={() => { preset(INITIAL_ROTATION[0], INITIAL_ROTATION[1]); applyZoom(1); }}
          style={{ flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Icon name="rotate-cw" size={16} /><Text style={{ ...theme.text("label"), color: theme.colors.ink, flexShrink: 1 }}>Reset</Text>
        </Pressable>
        <View style={{ flexDirection: "row", borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radii.sm }}>
          {([{ label: "Zoom out", glyph: "−", delta: -0.2, disabled: zoom <= 0.8 }, { label: "Zoom in", glyph: "+", delta: 0.2, disabled: zoom >= 1.8 }]).map(control => (
            <Pressable key={control.label} accessibilityRole="button" accessibilityLabel={control.label} accessibilityState={{ disabled: control.disabled }} disabled={control.disabled}
              onPress={() => applyZoom(zoom + control.delta)} style={{ minHeight: 48, width: 48, alignItems: "center", justifyContent: "center", opacity: control.disabled ? 0.4 : 1 }}>
              <Text style={{ ...theme.text("h2"), color: theme.colors.ink }}>{control.glyph}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <BottomSheet open={viewsOpen} title="Camera views" onClose={() => setViewsOpen(false)} closeLabel="Close">
        {views.map(view => <Pressable key={view.label} accessibilityRole="button" accessibilityLabel={`${view.label} view`}
          onPress={() => { preset(view.x, view.y); setViewsOpen(false); }}
          style={{ minHeight: 48, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft }}>
          <Text style={{ ...theme.text("body"), color: theme.colors.ink }}>{view.label}</Text>
        </Pressable>)}
      </BottomSheet>
    </View>
  );
}
