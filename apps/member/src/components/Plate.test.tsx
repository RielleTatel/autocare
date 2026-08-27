import { render, screen } from "@testing-library/react-native";
import { Plate } from "./Plate";
import { familyForRole } from "../theme";

describe("Plate", () => {
  it("renders plate text in the mono face in every variant", () => {
    for (const variant of ["chip", "plain", "outline"] as const) {
      const { unmount } = render(<Plate variant={variant} testID="plate">ABC 1234</Plate>);
      expect(screen.getByTestId("plate")).toHaveStyle({ fontFamily: familyForRole("code") });
      unmount();
    }
  });

  it("letter-spaces machine identity", () => {
    render(<Plate variant="plain" testID="plate">ABC 1234</Plate>);
    const { letterSpacing } = screen.getByTestId("plate").props.style;
    expect(letterSpacing).toBeGreaterThan(0);
  });
});
