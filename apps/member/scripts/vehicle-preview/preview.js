import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { fitVehicleCameraDistance, VEHICLE_CAMERA_FOV } from '/vehicleCameraFit.mjs';

const byId = id => document.getElementById(id);
const labels = { GOOD: 'Good', MONITOR: 'Monitor', ATTENTION: 'Needs attention', CRITICAL: 'Critical', NOT_APPLICABLE: 'Not applicable', UNKNOWN: 'Status unavailable' };
const severity = { GOOD: 0, MONITOR: 1, ATTENTION: 2, CRITICAL: 3 };
const initialRotation = [0.18, -0.65, 0];
const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
let fixture;
let findings = [];
let selected = 'WHEEL_FL';
let model;
let renderer;
let scene;
let camera;
let car;
let framePending = false;
let loaded = false;
const regionButtons = new Map();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function dot(color) {
  const node = element('span', 'dot');
  node.style.backgroundColor = color;
  node.setAttribute('aria-hidden', 'true');
  return node;
}
function color(status) { return fixture.palette[status] ?? fixture.palette.UNKNOWN; }
function regionFor(node) {
  for (let current = node; current; current = current.parent) {
    if (regionButtons.has(current.userData.regionId)) return current.userData.regionId;
    if (regionButtons.has(current.name)) return current.name;
  }
}
function regionFindings(id) {
  return findings.filter(finding => finding.diagramZone && fixture.zoneShapes[finding.diagramZone]?.includes(id));
}
function regionStatus(id) {
  const rows = regionFindings(id);
  let worst;
  for (const row of rows) if (severity[row.status] !== undefined && (!worst || severity[row.status] > severity[worst])) worst = row.status;
  return worst ?? (rows.length && rows.every(row => row.status === 'NOT_APPLICABLE') ? 'NOT_APPLICABLE' : 'UNKNOWN');
}
function render() {
  if (!renderer || framePending || document.hidden) return;
  framePending = true;
  requestAnimationFrame(() => {
    framePending = false;
    try { renderer.render(scene, camera); }
    catch { failModel(); }
  });
}
function tintModel() {
  model?.traverse(node => {
    if (!node.isMesh) return;
    const region = regionFor(node);
    if (!region) return;
    const status = regionStatus(region);
    const scored = severity[status] !== undefined;
    const tint = new THREE.Color(color(status));
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      material.color.copy(material.userData.previewBaseColor).lerp(tint, scored ? 0.65 : 0.3);
      material.emissive.copy(tint).multiplyScalar(scored ? 0.06 : 0);
    }
  });
  render();
}
function selectRegion(id) {
  selected = id;
  const other = id === 'UNLOCATED';
  const shape = fixture.shapes.find(shape => shape.id === id);
  const rows = other ? findings.filter(finding => !finding.diagramZone) : regionFindings(id);
  const status = other ? 'UNKNOWN' : regionStatus(id);
  byId('region-title').textContent = other ? 'Other findings' : shape.label;
  byId('region-status').textContent = other ? 'Unlocated' : labels[status];
  byId('region-status').style.color = color(status);
  byId('region-status').style.backgroundColor = `${color(status)}14`;
  byId('region-context').textContent = other ? 'These sample findings have no known position on the model.' : `${rows.length} sample finding${rows.length === 1 ? '' : 's'} associated with this region.`;
  const container = byId('findings');
  container.replaceChildren();
  if (!rows.length) container.append(element('p', 'region-context', 'No findings were recorded for this sample region.'));
  for (const row of [...rows].sort((a, b) => (severity[b.status] ?? -1) - (severity[a.status] ?? -1))) {
    const article = element('article', 'finding');
    const heading = element('div', 'finding-header');
    heading.append(dot(color(row.status)), document.createTextNode(labels[row.status] ?? labels.UNKNOWN));
    article.append(heading, element('h3', '', row.label));
    if (row.measuredValue !== undefined) article.append(element('p', 'reading', `${row.measuredValue} ${row.unit ?? ''}`));
    article.append(element('p', '', row.note));
    container.append(article);
  }
  for (const [region, button] of regionButtons) button.setAttribute('aria-pressed', String(id === region));
}
function updateResults() {
  const scenario = byId('scenario').value;
  findings = fixture.findings.map(finding => ({
    ...finding,
    status: scenario === 'good' && finding.status !== 'NOT_APPLICABLE' ? 'GOOD' : scenario === 'unknown' ? null : finding.status,
    measuredValue: scenario === 'mixed' ? finding.measuredValue : undefined,
    note: scenario === 'mixed' ? finding.note : scenario === 'good'
      ? finding.status === 'NOT_APPLICABLE' ? 'This sample component is not applicable and is excluded from severity.' : 'Representative recorded good result for this demo inspection.'
      : 'This sample supplies no usable status. No healthy result is inferred.',
  }));
  for (const shape of fixture.shapes) {
    const status = regionStatus(shape.id);
    const button = regionButtons.get(shape.id);
    button.replaceChildren();
    const copy = element('span');
    copy.append(element('strong', '', shape.label), element('small', '', labels[status]));
    button.append(dot(color(status)), copy);
  }
  selectRegion(selected);
  tintModel();
}
function resize() {
  if (!renderer) return;
  const { width, height } = byId('scene').getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  const distance = fitVehicleCameraDistance(width, height);
  const directionLength = Math.hypot(2.1, 6.8);
  camera.position.set(0, distance * 2.1 / directionLength, distance * 6.8 / directionLength);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  render();
}
function setZoom(value) {
  if (!camera) return;
  camera.zoom = clamp(value, 0.8, 1.8);
  camera.updateProjectionMatrix();
  byId('zoom-in').disabled = camera.zoom >= 1.799;
  byId('zoom-out').disabled = camera.zoom <= 0.801;
  render();
}
function failModel() {
  loaded = false;
  byId('model-status').textContent = '3D unavailable';
  byId('load-error').hidden = false;
}
async function loadModel() {
  byId('load-error').hidden = true;
  byId('model-status').textContent = 'Loading model…';
  try {
    const gltf = await new GLTFLoader().loadAsync('/vehicle.glb');
    if (model) car.remove(model);
    model = gltf.scene;
    model.position.y = -0.72;
    const regions = new Set();
    model.traverse(node => {
      if (!node.isMesh) return;
      const region = regionFor(node);
      if (!region) throw new Error('Missing model region');
      regions.add(region);
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => { material.userData.previewBaseColor = material.color.clone(); });
    });
    if (regions.size !== fixture.shapes.length) throw new Error('Incomplete model');
    car.add(model);
    tintModel();
    loaded = true;
    byId('model-status').textContent = `Model ready · ${regions.size} inspection regions`;
  } catch { failModel(); }
}
function startScene() {
  const canvas = byId('vehicle');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(VEHICLE_CAMERA_FOV, 1, 0.1, 100);
  car = new THREE.Group();
  car.rotation.set(...initialRotation);
  scene.add(car, new THREE.AmbientLight(0xffffff, 1.8));
  const key = new THREE.DirectionalLight(0xffffff, 2);
  key.position.set(3, 6, 5);
  const fill = new THREE.DirectionalLight(0xffffff, 1);
  fill.position.set(-3, -3, -4);
  scene.add(key, fill);
  new ResizeObserver(resize).observe(byId('scene'));
  resize();
  let gesture;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, pitch: car.rotation.x, yaw: car.rotation.y, distance: 0 };
  });
  canvas.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture.distance = Math.max(gesture.distance, Math.hypot(dx, dy));
    car.rotation.set(clamp(gesture.pitch + dy * 0.008, -1.45, 1.45), gesture.yaw + dx * 0.008, 0);
    render();
  });
  canvas.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (gesture.distance < 7 && loaded) {
      const rect = canvas.getBoundingClientRect();
      const raycaster = new THREE.Raycaster();
      car.updateWorldMatrix(true, true);
      camera.updateMatrixWorld();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hit = raycaster.intersectObject(car, true)[0];
      const region = hit && regionFor(hit.object);
      if (region) selectRegion(region);
    }
    gesture = undefined;
  });
  canvas.addEventListener('pointercancel', () => { gesture = undefined; });
  canvas.addEventListener('wheel', event => { event.preventDefault(); setZoom(camera.zoom + (event.deltaY < 0 ? 0.1 : -0.1)); }, { passive: false });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); failModel(); });
  document.addEventListener('visibilitychange', render);
  byId('zoom-in').onclick = () => setZoom(camera.zoom + 0.2);
  byId('zoom-out').onclick = () => setZoom(camera.zoom - 0.2);
  byId('reset').onclick = () => { car.rotation.set(...initialRotation); setZoom(1); };
  const presets = { front: [0.18, 0, 0], rear: [0.18, Math.PI, 0], top: [1.45, 0, 0], underbody: [-1.45, 0, 0] };
  document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => { car.rotation.set(...presets[button.dataset.view]); render(); }; });
  void loadModel();
}

try {
  fixture = await fetch('/fixture.json').then(response => { if (!response.ok) throw new Error('Fixture unavailable'); return response.json(); });
  for (const shape of fixture.shapes) {
    const button = element('button', 'region-button');
    button.onclick = () => selectRegion(shape.id);
    regionButtons.set(shape.id, button);
    byId('regions').append(button);
  }
  for (const status of ['GOOD', 'MONITOR', 'ATTENTION', 'CRITICAL', 'UNKNOWN']) {
    const item = element('span');
    item.append(dot(color(status)), document.createTextNode(labels[status]));
    byId('legend').append(item);
  }
  byId('scenario').onchange = updateResults;
  byId('unlocated').onclick = () => selectRegion('UNLOCATED');
  byId('retry').onclick = () => {
    if (renderer) { void loadModel(); return; }
    try { startScene(); } catch { failModel(); }
  };
  updateResults();
  try { startScene(); } catch { failModel(); }
} catch {
  byId('model-status').textContent = 'Preview unavailable';
  byId('load-error').hidden = false;
}
