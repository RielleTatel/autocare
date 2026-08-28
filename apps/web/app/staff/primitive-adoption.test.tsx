import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (...p: string[]) => readFileSync(join(__dirname, ...p), "utf8");

describe("the component library is actually used", () => {
  it("the board renders plates through the Plate primitive", () => {
    expect(read("schedule", "Board.tsx")).toMatch(/from "\.\.\/\.\.\/\.\.\/components\/Plate"/);
  });

  it("the staff index uses Button rather than hand-rolled anchors", () => {
    expect(read("page.tsx")).toMatch(/from "\.\.\/\.\.\/components\/Button"/);
  });

  it("capacity settings uses the shared form primitives", () => {
    const src = read("config", "page.tsx");
    expect(src).toMatch(/components\/(Button|FormField)/);
  });
});
