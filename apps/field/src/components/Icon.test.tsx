import { render } from "@testing-library/react-native";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders a glyph for a design-system kebab name", () => {
    const { toJSON } = render(<Icon name="wrench" size={20} />);
    expect(toJSON()).toBeTruthy();
  });

  it("stays out of the accessibility tree — it always sits beside its own label", () => {
    const { toJSON } = render(<Icon name="camera" />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain("importantForAccessibility");
  });
});
