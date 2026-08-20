import { subject } from "@casl/ability";
import { AbilityFactory } from "./ability.factory";

const f = new AbilityFactory();
const member = { id: "u1", role: "MEMBER" as const, orgId: null };
const fleet = { id: "u2", role: "FLEET_MANAGER" as const, orgId: "org1" };
const mechanic = { id: "u3", role: "MECHANIC" as const, orgId: null };
const admin = { id: "u4", role: "ADMIN" as const, orgId: null };

const ownVehicle = subject("Vehicle", { ownerUserId: "u1", orgOwnerId: null });
const strangersVehicle = subject("Vehicle", { ownerUserId: "u9", orgOwnerId: null });
const orgVehicle = subject("Vehicle", { ownerUserId: null, orgOwnerId: "org1" });
const otherOrgVehicle = subject("Vehicle", { ownerUserId: null, orgOwnerId: "org2" });

describe("ability matrix (FR-007)", () => {
  it("MEMBER manages own vehicle, not a stranger's", () => {
    const a = f.for(member);
    expect(a.can("update", ownVehicle)).toBe(true);
    expect(a.can("delete", ownVehicle)).toBe(true);
    expect(a.can("update", strangersVehicle)).toBe(false);
    expect(a.can("read", strangersVehicle)).toBe(false);
  });
  it("MEMBER updates own profile only, and never other Users", () => {
    const a = f.for(member);
    expect(a.can("update", subject("Profile", { id: "u1" }))).toBe(true);
    expect(a.can("update", subject("Profile", { id: "u9" }))).toBe(false);
    expect(a.can("update", "User")).toBe(false);
  });
  it("FLEET_MANAGER manages own-org vehicles only", () => {
    const a = f.for(fleet);
    expect(a.can("update", orgVehicle)).toBe(true);
    expect(a.can("update", otherOrgVehicle)).toBe(false);
    expect(a.can("update", strangersVehicle)).toBe(false);
  });
  it("MECHANIC reads any vehicle but writes none, and cannot touch member PII", () => {
    const a = f.for(mechanic);
    expect(a.can("read", strangersVehicle)).toBe(true);
    expect(a.can("update", strangersVehicle)).toBe(false);
    expect(a.can("update", subject("Profile", { id: "u9" }))).toBe(false);
    expect(a.can("read", subject("Profile", { id: "u3" }))).toBe(true);
  });
  it("ADMIN manages everything", () => {
    const a = f.for(admin);
    expect(a.can("manage", "all")).toBe(true);
    expect(a.can("update", "User")).toBe(true);
  });
});
