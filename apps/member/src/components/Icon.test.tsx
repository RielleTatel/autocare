import { render } from "@testing-library/react-native";
import { Icon } from "./Icon";
import { theme } from "../theme";

describe("Icon", () => {
  it("renders a glyph for a design-system name", () => {
    const { toJSON } = render(<Icon name="car-front" size={24} />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders every name in the map", () => {
    // Guards against a Lucide rename silently landing `undefined` in GLYPHS,
    // which fails as an invalid-element-type error only at render time.
    const names = [
      "house", "user", "car-front", "calendar-days", "calendar-plus",
      "chevron-left", "chevron-right", "share-2", "trending-up", "list-tree",
      "plus", "map-pin", "phone", "camera", "triangle-alert",
      "battery-warning", "disc-3", "fuel", "circle-help",
    ] as const;
    for (const name of names) {
      expect(() => render(<Icon name={name} color={theme.colors.ink} />)).not.toThrow();
    }
  });

  it("stays out of the accessibility tree", () => {
    const { toJSON } = render(<Icon name="phone" />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain("importantForAccessibility");
  });
});
