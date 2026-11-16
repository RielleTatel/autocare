# Generic inspection vehicle

`generic-vehicle.glb` is an original, stylized AutoCare vehicle with ten selectable
regions. It is produced by `scripts/generate_vehicle_model.py` using Python's
standard library. The generator is the editable model source; it defines every
vertex, material, and region assignment. No external artwork, textures, licensed
vehicle design, or Blender installation is required.

From the repository root:

```sh
python3 scripts/generate_vehicle_model.py
python3 scripts/generate_vehicle_model.py --check
node apps/member/scripts/validate-vehicle-model.mjs
```

Generation is deterministic. The check validates the GLB header and chunks,
buffer/accessor bounds, indices, region names, triangle winding, and normals.
The Node validator loads the actual GLB with Three.js and checks nearest-surface selection across camera views and phone widths. Device rendering and interaction require separate native acceptance evidence.

## Coordinate and selection contract

Units are metres. Y is up, +Z points to the front of the car, and +X is the
vehicle's left side when seated facing forward. The model rests near Y=0, with
wheel centers at Y=0.38, X=±0.91 and Z=±1.30. Approximate dimensions are
2.13 m wide including wheel hubs, 4.29 m long including bumpers, and 1.46 m tall.

Every region is a named glTF node and mesh with `extras.regionId` matching its
name. A region can contain several material primitives; picking must walk up
to the region node when a loader creates child meshes for those primitives.

| Node/region | Representation |
| --- | --- |
| BODY_SHELL | Lower body, trunk, bumpers, sills and mirrors |
| ENGINE_BAY | Hood surface marking the engine-bay inspection region |
| CABIN | Glazed cabin and roof |
| UNDERBODY | Underside plate and axle bars, visible from below |
| LIGHTS_FRONT | Both front lights |
| LIGHTS_REAR | Both rear lights |
| WHEEL_FL / WHEEL_FR | Front-left / front-right wheel |
| WHEEL_RL / WHEEL_RR | Rear-left / rear-right wheel |

The member app maps all fourteen semantic inspection zones to these ten
regions. Axle, corner, and light groups retain the existing inspection scope.
The hood is a region marker, not a mechanically accurate engine model. Cabin
and underbody likewise represent inspection regions. Decorative details do not
imply that a specific part was inspected or diagnosed.

## Asset origin and maintenance

Created specifically for AutoCare from original procedural geometry. The asset
and generator contain no third-party content and may be maintained and bundled
as project-owned source. No external attribution or redistribution restriction
was introduced by asset sourcing.

Retain the generator alongside the generated GLB. Changing region names requires
a coordinated change to the viewer's mapping and asset validation. Avoid merging
all nodes into one mesh during optimization: individual region selection and
status styling depend on these identifiers. The model uses core glTF 2.0 metallic
roughness materials without texture downloads, compression decoders, animation,
or optional glTF extensions.
