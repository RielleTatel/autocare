import "./bigint-serializer";

describe("bigint-serializer", () => {
  it("serializes BigInt as a plain JSON number", () => {
    expect(JSON.stringify({ n: 49900n })).toBe('{"n":49900}');
  });
});
