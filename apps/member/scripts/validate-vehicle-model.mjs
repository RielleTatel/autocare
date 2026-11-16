/** Real Three.js loader/raycast check; does not create a native GL context. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Group, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { fitVehicleCameraDistance, VEHICLE_BOUNDING_RADIUS, VEHICLE_CAMERA_FOV } from '../src/features/health-score/vehicleCameraFit.mjs';

const expectedRegions = new Set([
  'BODY_SHELL', 'ENGINE_BAY', 'CABIN', 'UNDERBODY', 'LIGHTS_FRONT', 'LIGHTS_REAR',
  'WHEEL_FL', 'WHEEL_FR', 'WHEEL_RL', 'WHEEL_RR',
]);
const bytes = await readFile(new URL('../assets/vehicle/generic-vehicle.glb', import.meta.url));
const { scene } = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '',
);
const car = new Group();
scene.position.set(0, -0.72, 0);
car.add(scene);
const regionFor = node => {
  for (let current = node; current; current = current.parent) {
    if (expectedRegions.has(current.userData.regionId)) return current.userData.regionId;
    if (expectedRegions.has(current.name)) return current.name;
  }
};
let meshCount = 0;
const regions = new Set();
scene.traverse(node => {
  if (!node.isMesh) return;
  meshCount++;
  const region = regionFor(node);
  assert.ok(region, `Loaded mesh ${node.name} has no selectable region`);
  regions.add(region);
});
assert.deepEqual(regions, expectedRegions, 'The loaded asset must retain every inspection region');
car.updateWorldMatrix(true, true);
const vertex = new Vector3();
scene.traverse(node => {
  if (!node.isMesh) return;
  const positions = node.geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index++) {
    vertex.fromBufferAttribute(positions, index).applyMatrix4(node.matrixWorld);
    assert.ok(vertex.length() <= VEHICLE_BOUNDING_RADIUS, 'Asset exceeds the camera-fit bounding sphere');
  }
});

const views = [
  ['initial', 0.18, -0.65, ['BODY_SHELL', 'ENGINE_BAY']],
  ['front', 0.18, 0, ['ENGINE_BAY', 'LIGHTS_FRONT']],
  ['rear', 0.18, Math.PI, ['LIGHTS_REAR']],
  ['top', 1.45, 0, ['CABIN']],
  ['underbody', -1.45, 0, ['UNDERBODY']],
  ['left', 0.18, -Math.PI / 2, ['WHEEL_FL', 'WHEEL_RL']],
  ['right', 0.18, Math.PI / 2, ['WHEEL_FR', 'WHEEL_RR']],
];
const raycaster = new Raycaster();
const pointer = new Vector2();
const results = [];
for (const width of [240, 280, 430]) {
  const camera = new PerspectiveCamera(VEHICLE_CAMERA_FOV, width / 340, 0.1, 100);
  const distance = fitVehicleCameraDistance(width, 340);
  const directionLength = Math.hypot(2.1, 6.8);
  camera.position.set(0, distance * 2.1 / directionLength, distance * 6.8 / directionLength);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const reachable = new Set();
  for (const [name, x, y, required] of views) {
    car.rotation.set(x, y, 0);
    car.updateWorldMatrix(true, true);
    let largestProjectedExtent = 0;
    scene.traverse(node => {
      if (!node.isMesh) return;
      const positions = node.geometry.getAttribute('position');
      for (let index = 0; index < positions.count; index++) {
        vertex.fromBufferAttribute(positions, index).applyMatrix4(node.matrixWorld).project(camera);
        const extent = Math.max(Math.abs(vertex.x), Math.abs(vertex.y));
        largestProjectedExtent = Math.max(largestProjectedExtent, extent);
        assert.ok(extent < 0.98 && vertex.z > -1 && vertex.z < 1,
          `Default framing clips model geometry in ${name} at width ${width}`);
      }
    });
    const picked = new Set();
    // Sample viewport-local taps; pick the nearest visible surface, not a hidden mesh.
    for (let column = 0; column <= 100; column++) {
      for (let row = 0; row <= 100; row++) {
        pointer.set(column / 50 - 1, -(row / 50 - 1));
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObject(car, true)[0];
        if (!hit) continue;
        const region = regionFor(hit.object);
        assert.ok(region, `Unmapped visible hit in ${name}`);
        picked.add(region);
        reachable.add(region);
      }
    }
    for (const region of required) assert.ok(picked.has(region), `${region} is not selectable in ${name} at width ${width}`);
    results.push({ width, view: name, largestProjectedExtent, selectableRegions: [...picked].sort() });
  }
  assert.deepEqual(reachable, expectedRegions, `Some inspection regions are unreachable at width ${width}`);
}
console.log(JSON.stringify({
  result: 'passed', loader: 'Three.js GLTFLoader', meshes: meshCount, regions: [...regions],
  raycastViews: results, nativeRenderingVerified: false,
}, null, 2));
