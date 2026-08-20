import { AbilityBuilder, createMongoAbility, MongoAbility } from "@casl/ability";
import { Injectable } from "@nestjs/common";
import type { Role } from "@autocare/contracts";

export { subject } from "@casl/ability";

export type Action = "manage" | "create" | "read" | "update" | "delete";
export type Subjects = "Vehicle" | "Profile" | "User" | "Organization" | "all";
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches @casl/ability's own AnyRecord (Record<PropertyKey, any>); `unknown` fails structural assignability for ForcedSubject intersections under strict mode.
export type AppAbility = MongoAbility<[Action, Subjects | Record<string, any>]>;
export interface AbilityUser { id: string; role: Role; orgId?: string | null }

@Injectable()
export class AbilityFactory {
  for(user: AbilityUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    switch (user.role) {
      case "ADMIN":
        can("manage", "all");
        break;
      case "MEMBER":
        can("create", "Vehicle");
        can("manage", "Vehicle", { ownerUserId: user.id });
        can(["read", "update"], "Profile", { id: user.id });
        break;
      case "FLEET_MANAGER":
        if (user.orgId) {
          can("create", "Vehicle");
          can("manage", "Vehicle", { orgOwnerId: user.orgId });
          can("read", "Organization", { id: user.orgId });
        }
        can(["read", "update"], "Profile", { id: user.id });
        break;
      case "MECHANIC":
      case "ADVISOR":
      case "DRIVER":
        can("read", "Vehicle"); // no owner condition — staff see all vehicles, write none
        can(["read", "update"], "Profile", { id: user.id });
        break;
    }
    return build();
  }
}
