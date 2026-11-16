# Local 3D vehicle preview

From the repository root, with workspace dependencies installed:

```sh
node apps/member/scripts/serve-vehicle-preview.mjs
```

Open <http://127.0.0.1:8093>. Set `VEHICLE_PREVIEW_PORT` to use another port.

The preview loads the actual bundled GLB and shared camera-fit helper. Its region
mapping, labels and status palette are extracted from the application source.
Rotate by dragging, scroll or use the buttons to zoom, select a camera preset,
and click a model region or the accessible region list to inspect its findings.
The selector offers mixed, good and unavailable-status demo scenarios.

All findings are synthetic demo data. The server binds only to loopback, uses no
application API or login, and serves an explicit set of preview/module/asset
paths. Browser preview results do not establish native Android or iOS rendering.
