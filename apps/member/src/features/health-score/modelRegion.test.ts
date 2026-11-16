import { modelRegion } from "./modelRegion";

describe("model region selection", () => {
  it("resolves a material primitive through its named region parent", () => {
    const region = { name: "WHEEL_FL", parent: null };
    expect(modelRegion({ name: "wheel_primitive_0", parent: region })).toBe("WHEEL_FL");
  });
  it("uses an explicit known region identifier when the loader renames nodes", () => {
    expect(modelRegion({ name: "Mesh_002", userData: { regionId: "ENGINE_BAY" }, parent: null })).toBe("ENGINE_BAY");
  });
  it("does not assign decorative or unknown regions an invented position", () => {
    expect(modelRegion({ name: "ornament", userData: { regionId: "UNKNOWN" }, parent: null })).toBeUndefined();
    expect(modelRegion(null)).toBeUndefined();
  });
});
