import { roadsideUpdateCopy } from "./announcement-thread";
import { AnnouncementsService } from "./announcements.service";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * The member closes the status screen and goes back to changing the tyre. The
 * feed is where they find out what happened while they were not looking.
 */
describe("roadsideUpdateCopy", () => {
  it("names the responder once one is assigned", () => {
    const copy = roadsideUpdateCopy("DISPATCHED", { responderName: "J. Cruz", etaMinutes: 25 })!;
    expect(copy.title).toBe("Help is on the way");
    expect(copy.body).toContain("J. Cruz");
    expect(copy.body).toContain("25");
  });

  it("still says something useful when no ETA is known", () => {
    const copy = roadsideUpdateCopy("DISPATCHED", { responderName: "J. Cruz", etaMinutes: null })!;
    expect(copy.body).toContain("J. Cruz");
    expect(copy.body).not.toContain("null");
  });

  it("speaks plainly at each step a member would notice", () => {
    expect(roadsideUpdateCopy("EN_ROUTE", { responderName: "J. Cruz", etaMinutes: null })!.title).toMatch(/on the way|driving/i);
    expect(roadsideUpdateCopy("ON_SITE", { responderName: "J. Cruz", etaMinutes: null })!.title).toMatch(/arrived|here/i);
    expect(roadsideUpdateCopy("RESOLVED", { responderName: "J. Cruz", etaMinutes: null })!.title).toMatch(/sorted|done|resolved/i);
  });

  // REQUESTED and ACKNOWLEDGED happen while the member is still looking at the
  // screen they just submitted from; an entry for those is noise.
  it("says nothing for the steps the member is already watching", () => {
    expect(roadsideUpdateCopy("REQUESTED", { responderName: null, etaMinutes: null })).toBeNull();
    expect(roadsideUpdateCopy("ACKNOWLEDGED", { responderName: null, etaMinutes: null })).toBeNull();
  });
});

describe("AnnouncementsService.announceRoadside", () => {
  const build = (over: Record<string, unknown> = {}) => {
    const prisma = {
      announcement: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: "ann-1" }),
      },
      ...over,
    } as unknown as PrismaService;
    return { svc: new AnnouncementsService(prisma), prisma };
  };

  it("supersedes the previous update so the feed holds one live entry per incident", async () => {
    const { svc, prisma } = build();
    await svc.announceRoadside({
      userId: "user-1", vehicleId: "veh-1", roadsideRequestId: "rr-1",
      status: "EN_ROUTE", responderName: "J. Cruz", etaMinutes: 15,
    });
    expect((prisma as any).announcement.updateMany).toHaveBeenCalledWith({
      where: { roadsideRequestId: "rr-1", status: "ACTIVE" },
      data: { status: "SUPERSEDED" },
    });
    const created = (prisma as any).announcement.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ kind: "ROADSIDE_UPDATE", roadsideRequestId: "rr-1", userId: "user-1" });
  });

  it("writes nothing for a step the member is already watching", async () => {
    const { svc, prisma } = build();
    await svc.announceRoadside({
      userId: "user-1", vehicleId: "veh-1", roadsideRequestId: "rr-1",
      status: "ACKNOWLEDGED", responderName: null, etaMinutes: null,
    });
    expect((prisma as any).announcement.create).not.toHaveBeenCalled();
    expect((prisma as any).announcement.updateMany).not.toHaveBeenCalled();
  });
});
