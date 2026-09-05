import { describe, expect, it } from "vitest";
import { broadcastCreateSchema } from "./announcements";

describe("announcement contracts", () => {
  it("accepts a title and body", () => {
    const parsed = broadcastCreateSchema.parse({ title: "Holiday hours", body: "Closed Dec 25." });
    expect(parsed.title).toBe("Holiday hours");
    expect(parsed.expiresAt).toBeUndefined();
  });

  it("rejects an empty title", () => {
    expect(() => broadcastCreateSchema.parse({ title: "", body: "x" })).toThrow();
  });

  it("rejects a body over 2000 characters", () => {
    expect(() => broadcastCreateSchema.parse({ title: "t", body: "x".repeat(2001) })).toThrow();
  });

  it("accepts an ISO datetime expiry and rejects a bare date", () => {
    const iso = "2026-12-25T00:00:00.000Z";
    expect(broadcastCreateSchema.parse({ title: "t", body: "b", expiresAt: iso }).expiresAt).toBe(iso);
    expect(() => broadcastCreateSchema.parse({ title: "t", body: "b", expiresAt: "2026-12-25" })).toThrow();
  });
});
