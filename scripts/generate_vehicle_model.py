#!/usr/bin/env python3
"""Generate AutoCare's original generic vehicle GLB using Python's standard library.

Edit this source to change the model, then run from any working directory:
    python3 scripts/generate_vehicle_model.py
    python3 scripts/generate_vehicle_model.py --check

Coordinates are metres: +Y up, +Z forward, +X vehicle-left. The ten named
nodes are the stable interaction interface; never infer inspection precision
from decorative geometry. This model contains no third-party artwork.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "apps/member/assets/vehicle/generic-vehicle.glb"
REGIONS = (
    "BODY_SHELL", "ENGINE_BAY", "CABIN", "UNDERBODY", "LIGHTS_FRONT",
    "LIGHTS_REAR", "WHEEL_FL", "WHEEL_FR", "WHEEL_RL", "WHEEL_RR",
)


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0])


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


class Geometry:
    def __init__(self):
        self.positions = []
        self.normals = []
        self.indices = []

    def face(self, points, outward=None):
        """Append a convex planar polygon with independent flat-shaded normals."""
        points = list(points)
        normal = cross(sub(points[1], points[0]), sub(points[2], points[0]))
        if outward is not None and dot(normal, outward) < 0:
            points.reverse()
            normal = cross(sub(points[1], points[0]), sub(points[2], points[0]))
        length = math.sqrt(dot(normal, normal))
        if length < 1e-9:
            raise ValueError("Degenerate polygon")
        normal = tuple(n / length for n in normal)
        start = len(self.positions)
        self.positions.extend(points)
        self.normals.extend([normal] * len(points))
        for i in range(1, len(points) - 1):
            self.indices.extend((start, start + i, start + i + 1))

    def solid(self, vertices, faces):
        center = tuple(sum(v[k] for v in vertices) / len(vertices) for k in range(3))
        for indices in faces:
            points = [vertices[i] for i in indices]
            face_center = tuple(sum(p[k] for p in points) / len(points) for k in range(3))
            self.face(points, sub(face_center, center))

    def box(self, center, size):
        x, y, z = center
        a, b, c = (v / 2 for v in size)
        vertices = [(x - a, y - b, z - c), (x + a, y - b, z - c),
                    (x + a, y + b, z - c), (x - a, y + b, z - c),
                    (x - a, y - b, z + c), (x + a, y - b, z + c),
                    (x + a, y + b, z + c), (x - a, y + b, z + c)]
        self.solid(vertices, [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
                              (3, 2, 6, 7), (0, 3, 7, 4), (1, 5, 6, 2)])

    def loft(self, sections):
        """Closed rectangular loft: sections are (z, half-width, bottom, top)."""
        vertices = []
        for z, width, bottom, top in sections:
            vertices.extend([(-width, bottom, z), (width, bottom, z),
                             (width, top, z), (-width, top, z)])
        faces = [(0, 1, 2, 3), tuple(range(len(vertices) - 4, len(vertices)))]
        for i in range(len(sections) - 1):
            for j in range(4):
                faces.append((4 * i + j, 4 * i + (j + 1) % 4,
                              4 * (i + 1) + (j + 1) % 4, 4 * (i + 1) + j))
        self.solid(vertices, faces)

    def cylinder_x(self, center, radius, depth, segments=24):
        x, y, z = center
        rings = [[(x + side * depth / 2,
                   y + radius * math.cos(i * math.tau / segments),
                   z + radius * math.sin(i * math.tau / segments))
                  for i in range(segments)] for side in (-1, 1)]
        self.face(rings[0], (-1, 0, 0))
        self.face(rings[1], (1, 0, 0))
        for i in range(segments):
            j = (i + 1) % segments
            mid = (i + .5) * math.tau / segments
            self.face([rings[0][i], rings[0][j], rings[1][j], rings[1][i]],
                      (0, math.cos(mid), math.sin(mid)))


def vehicle_geometry():
    # A region may have several material primitives, but remains one named node.
    regions = {region: {} for region in REGIONS}

    def part(region, material):
        return regions[region].setdefault(material, Geometry())

    body = part("BODY_SHELL", "paint")
    body.loft([(-2.12, .66, .42, .69), (-1.88, .85, .38, .82),
               (-1.35, .88, .38, .86), (1.35, .88, .38, .84),
               (1.95, .81, .42, .76), (2.12, .66, .46, .67)])
    # Raised trunk deck, side sills and restrained bumpers establish the silhouette.
    body.loft([(-1.95, .78, .75, .81), (-1.30, .83, .80, .93),
               (-1.12, .80, .82, .93)])
    trim = part("BODY_SHELL", "trim")
    trim.box((0, .48, 2.10), (1.25, .12, .09))
    trim.box((0, .45, -2.10), (1.27, .12, .09))
    for side in (-1, 1):
        body.box((side * .88, .46, 0), (.06, .13, 1.85))
        # Mirrors belong to bodywork; their color does not invent a new zone.
        body.box((side * .96, 1.00, .55), (.18, .10, .18))

    hood = part("ENGINE_BAY", "hood")
    hood.loft([(.64, .78, .85, .94), (1.39, .80, .82, .90),
               (1.96, .73, .76, .80)])

    # A simplified glazed cabin. Its selectable surface represents the cabin zone.
    cabin = part("CABIN", "glass")
    cabin.solid([
        (-.79, .86, -1.21), (.79, .86, -1.21),
        (.79, .91, .70), (-.79, .91, .70),
        (-.63, 1.43, -.73), (.63, 1.43, -.73),
        (.63, 1.43, .21), (-.63, 1.43, .21),
    ], [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
        (3, 2, 6, 7), (0, 3, 7, 4), (1, 5, 6, 2)])
    roof = part("CABIN", "roof")
    roof.box((0, 1.445, -.26), (1.26, .035, .94))
    for side in (-1, 1):
        # B pillars and bottom window rails are decorative cabin geometry.
        part("CABIN", "trim").box((side * .723, 1.15, -.31), (.035, .50, .055))

    floor = part("UNDERBODY", "underbody")
    floor.box((0, .335, 0), (1.48, .11, 3.58))
    for z in (-1.30, 1.30):
        floor.box((0, .315, z), (1.78, .10, .13))

    for region, z, material in (("LIGHTS_FRONT", 2.035, "headlight"),
                                 ("LIGHTS_REAR", -2.035, "taillight")):
        for side in (-1, 1):
            part(region, material).box((side * .54, .73, z), (.35, .14, .12))

    for region, x, z in (("WHEEL_FL", .91, 1.30), ("WHEEL_FR", -.91, 1.30),
                          ("WHEEL_RL", .91, -1.30), ("WHEEL_RR", -.91, -1.30)):
        part(region, "rubber").cylinder_x((x, .38, z), .36, .25)
        outside = x + math.copysign(.132, x)
        part(region, "rim").cylinder_x((outside, .38, z), .225, .018)
        part(region, "trim").cylinder_x((outside + math.copysign(.012, x), .38, z), .075, .024)

    return regions


def generate():
    materials = [
        ("paint", (.59, .65, .70, 1), .15, .65),
        ("hood", (.67, .72, .76, 1), .12, .65),
        ("glass", (.12, .23, .29, 1), .20, .35),
        ("roof", (.55, .62, .68, 1), .15, .65),
        ("trim", (.09, .12, .15, 1), .05, .85),
        ("underbody", (.23, .28, .32, 1), .10, .80),
        ("headlight", (.90, .94, .95, 1), .10, .40),
        ("taillight", (.62, .10, .08, 1), .05, .45),
        ("rubber", (.10, .12, .14, 1), 0, 1),
        ("rim", (.58, .63, .67, 1), .55, .40),
    ]
    doc = {
        "asset": {"version": "2.0", "generator": "AutoCare original procedural vehicle v1",
                  "extras": {"units": "metres", "axes": "+Y up, +Z front, +X vehicle-left"}},
        "scene": 0, "scenes": [{"name": "AutoCare generic vehicle", "nodes": list(range(len(REGIONS)))}],
        "nodes": [], "meshes": [], "accessors": [], "bufferViews": [],
        "materials": [{"name": name, "pbrMetallicRoughness": {
            "baseColorFactor": list(color), "metallicFactor": metallic,
            "roughnessFactor": roughness}} for name, color, metallic, roughness in materials],
    }
    material_indices = {m[0]: i for i, m in enumerate(materials)}
    binary = bytearray()

    def accessor(values, components, component_type, kind, target, bounds=False):
        while len(binary) % 4:
            binary.append(0)
        offset = len(binary)
        flattened = [component for row in values for component in row] if components > 1 else values
        code = "f" if component_type == 5126 else "H"
        binary.extend(struct.pack("<" + str(len(flattened)) + code, *flattened))
        view = len(doc["bufferViews"])
        doc["bufferViews"].append({"buffer": 0, "byteOffset": offset,
                                    "byteLength": len(binary) - offset, "target": target})
        result = {"bufferView": view, "componentType": component_type,
                  "count": len(values), "type": kind}
        if bounds:
            result["min"] = [min(row[k] for row in values) for k in range(components)]
            result["max"] = [max(row[k] for row in values) for k in range(components)]
        doc["accessors"].append(result)
        return len(doc["accessors"]) - 1

    for region, parts in vehicle_geometry().items():
        primitives = []
        for material, geometry in parts.items():
            primitives.append({"attributes": {
                "POSITION": accessor(geometry.positions, 3, 5126, "VEC3", 34962, True),
                "NORMAL": accessor(geometry.normals, 3, 5126, "VEC3", 34962)},
                "indices": accessor(geometry.indices, 1, 5123, "SCALAR", 34963),
                "material": material_indices[material], "mode": 4})
        mesh = len(doc["meshes"])
        doc["meshes"].append({"name": region, "primitives": primitives})
        doc["nodes"].append({"name": region, "mesh": mesh, "extras": {"regionId": region}})
    doc["buffers"] = [{"byteLength": len(binary)}]
    encoded = json.dumps(doc, separators=(",", ":"), ensure_ascii=True).encode()
    encoded += b" " * ((-len(encoded)) % 4)
    binary.extend(b"\x00" * ((-len(binary)) % 4))
    data = (struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(encoded) + 8 + len(binary))
            + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
            + struct.pack("<II", len(binary), 0x004E4942) + binary)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(data)


def validate():
    data = OUTPUT.read_bytes()
    assert struct.unpack_from("<III", data) == (0x46546C67, 2, len(data)), "Invalid GLB header"
    json_length, json_type = struct.unpack_from("<II", data, 12)
    assert json_type == 0x4E4F534A and json_length % 4 == 0
    doc = json.loads(data[20:20 + json_length])
    binary_offset = 20 + json_length
    binary_length, binary_type = struct.unpack_from("<II", data, binary_offset)
    assert binary_type == 0x004E4942 and binary_length % 4 == 0
    binary = data[binary_offset + 8:]
    assert len(binary) == binary_length
    assert 0 <= binary_length - doc["buffers"][0]["byteLength"] <= 3
    assert {n["name"] for n in doc["nodes"]} == set(REGIONS)
    assert len(doc["nodes"]) == len(REGIONS)
    assert doc["scenes"][doc["scene"]]["nodes"] == list(range(len(REGIONS)))
    triangles = 0
    bounds = [[math.inf] * 3, [-math.inf] * 3]

    def decode(index):
        acc = doc["accessors"][index]
        view = doc["bufferViews"][acc["bufferView"]]
        components = {"SCALAR": 1, "VEC3": 3}[acc["type"]]
        size, code = {5126: (4, "f"), 5123: (2, "H")}[acc["componentType"]]
        length = acc["count"] * components * size
        start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
        assert view["buffer"] == 0 and view["byteOffset"] % 4 == 0
        assert length == view["byteLength"] and start + length <= doc["buffers"][0]["byteLength"]
        values = struct.unpack_from("<" + str(acc["count"] * components) + code, binary, start)
        assert all(math.isfinite(v) for v in values)
        return acc, [values[i:i + components] for i in range(0, len(values), components)]

    for node in doc["nodes"]:
        assert node["extras"]["regionId"] == node["name"]
        mesh = doc["meshes"][node["mesh"]]
        assert mesh["name"] == node["name"] and mesh["primitives"]
        for primitive in mesh["primitives"]:
            assert 0 <= primitive["material"] < len(doc["materials"])
            pos_acc, positions = decode(primitive["attributes"]["POSITION"])
            _, normals = decode(primitive["attributes"]["NORMAL"])
            _, indices = decode(primitive["indices"])
            assert len(positions) == len(normals)
            assert len(indices) % 3 == 0 and primitive["mode"] == 4
            assert all(0 <= i[0] < len(positions) for i in indices)
            assert all(abs(dot(n, n) - 1) < 1e-5 for n in normals)
            for k in range(3):
                lo, hi = min(p[k] for p in positions), max(p[k] for p in positions)
                assert abs(lo - pos_acc["min"][k]) < 1e-5
                assert abs(hi - pos_acc["max"][k]) < 1e-5
                bounds[0][k] = min(bounds[0][k], lo)
                bounds[1][k] = max(bounds[1][k], hi)
            for i in range(0, len(indices), 3):
                a, b, c = [positions[indices[j][0]] for j in range(i, i + 3)]
                area = cross(sub(b, a), sub(c, a))
                assert dot(area, area) > 1e-12, "Degenerate triangle"
                assert dot(area, normals[indices[i][0]]) > 0, "Incorrect face winding"
            triangles += len(indices) // 3
    print(json.dumps({"path": str(OUTPUT.relative_to(ROOT)), "bytes": len(data),
                      "regions": len(doc["nodes"]), "triangles": triangles,
                      "bounds": [[round(v, 3) for v in b] for b in bounds],
                      "validation": "GLB structure, named regions, accessors, indices, normals, bounds and winding passed"}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate the existing GLB without changing it")
    args = parser.parse_args()
    if not args.check:
        generate()
    validate()
