/** Local-only 3D review harness; serves no account data or application API. */
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const member = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(member, '../..');
const preview = path.join(member, 'scripts/vehicle-preview');
const threeRoot = await realpath(path.resolve(path.dirname(require.resolve('three')), '..'));
const port = Number(process.env.VEHICLE_PREVIEW_PORT || 8093);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port');

// Extract only static declarations, rather than executing application modules.
function literal(node) {
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)) return literal(node.expression);
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return ts.isNumericLiteral(node) ? Number(node.text) : node.text;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
    if (!ts.isPropertyAssignment(property)) throw new Error('Expected a static property');
    return [property.name.text, literal(property.initializer)];
  }));
  throw new Error(`Unsupported static declaration: ${ts.SyntaxKind[node.kind]}`);
}
async function constants(file, names) {
  const source = ts.createSourceFile(file, await readFile(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const values = {};
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && names.includes(declaration.name.text)) values[declaration.name.text] = literal(declaration.initializer);
    }
  }
  for (const name of names) if (!(name in values)) throw new Error(`Missing ${name}`);
  return values;
}
const geometry = await constants(path.join(member, 'src/features/health-score/diagramGeometry.ts'), ['SHAPES', 'ZONE_SHAPES']);
const { DIAGRAM_ZONES } = await constants(path.join(repo, 'packages/contracts/src/diagram.ts'), ['DIAGRAM_ZONES']);
const tokens = await constants(path.join(repo, 'packages/design-tokens/src/tokens.ts'), ['colors', 'vhsBands']);
const palette = { GOOD: tokens.vhsBands.GOOD.fill, MONITOR: tokens.vhsBands.FAIR.fill, ATTENTION: tokens.vhsBands.NEEDS_ATTENTION.fill, CRITICAL: tokens.vhsBands.CRITICAL.fill, UNKNOWN: tokens.colors.inkMuted };
const fixture = {
  shapes: geometry.SHAPES.map(({ id, label }) => ({ id, label })), zoneShapes: geometry.ZONE_SHAPES, zones: DIAGRAM_ZONES, palette,
  findings: [
    { pointCode: 'TREAD_FL', label: 'Front-left tyre tread', diagramZone: 'WHEEL_FL', status: 'CRITICAL', measuredValue: 1.2, unit: 'mm', note: 'Sample low tread reading. This finding belongs specifically to the front-left wheel.' },
    { pointCode: 'BRAKE_PAD_FRONT', label: 'Front brake pads', diagramZone: 'AXLE_FRONT', status: 'ATTENTION', note: 'Sample axle-level finding. It appears in both front-wheel regions; this inspection does not identify a single side.' },
    { pointCode: 'SHOCKS', label: 'Shock absorbers', diagramZone: 'CORNERS_ALL', status: 'GOOD', note: 'Sample result applies to all four corners.' },
    { pointCode: 'ENGINE_IDLE', label: 'Engine idle quality', diagramZone: 'ENGINE_BAY', status: 'MONITOR', note: 'Sample monitor finding for the engine-bay region.' },
    { pointCode: 'CABIN_FILTER', label: 'Cabin filter', diagramZone: 'CABIN', status: 'NOT_APPLICABLE', note: 'Sample not-applicable result. It is excluded from the region severity.' },
    { pointCode: 'UNDERBODY', label: 'Underbody condition', diagramZone: 'UNDERBODY', status: null, note: 'No usable status was supplied in this sample. It must not be shown as healthy or not applicable.' },
    { pointCode: 'BODY_CONDITION', label: 'Exterior condition', diagramZone: 'BODY_SHELL', status: 'GOOD', note: 'Sample recorded good result for the body shell.' },
    { pointCode: 'FRONT_LIGHTS', label: 'Headlamp function', diagramZone: 'LIGHTS_FRONT', status: 'GOOD', note: 'Sample result for both front lights.' },
    { pointCode: 'REAR_LIGHTS', label: 'Rear light function', diagramZone: 'LIGHTS_REAR', status: 'GOOD', note: 'Sample result for both rear lights.' },
    { pointCode: 'HORN', label: 'Horn function', diagramZone: null, status: 'GOOD', note: 'This sample finding has no mapped position and remains in the findings list.' },
  ],
};

const fixed = new Map([
  ['/', [path.join(preview, 'index.html'), 'text/html; charset=utf-8']],
  ['/preview.js', [path.join(preview, 'preview.js'), 'text/javascript; charset=utf-8']],
  ['/preview.css', [path.join(preview, 'preview.css'), 'text/css; charset=utf-8']],
  ['/vehicle.glb', [path.join(member, 'assets/vehicle/generic-vehicle.glb'), 'model/gltf-binary']],
  ['/vehicleCameraFit.mjs', [path.join(member, 'src/features/health-score/vehicleCameraFit.mjs'), 'text/javascript; charset=utf-8']],
]);

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  try {
    const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
    let route = fixed.get(pathname);
    if (pathname === '/fixture.json') {
      response.setHeader('Content-Type', 'application/json');
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify(fixture)); return;
    }
    if (pathname.startsWith('/three/')) {
      const relative = decodeURIComponent(pathname.slice(7));
      if (!/^(build|examples\/jsm)\/.+\.js$/.test(relative)) throw new Error('Unsupported module');
      const file = await realpath(path.resolve(threeRoot, relative));
      if (!file.startsWith(threeRoot + path.sep) || !(await stat(file)).isFile()) throw new Error('Invalid module path');
      route = [file, 'text/javascript; charset=utf-8'];
    }
    if (!route) { response.writeHead(404); response.end('Not found'); return; }
    const bytes = await readFile(route[0]);
    response.setHeader('Content-Type', route[1]);
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Preview port ${port} is already in use. Set VEHICLE_PREVIEW_PORT to another local port.`
    : `Preview could not start: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`AutoCare 3D preview: http://127.0.0.1:${port}`));
