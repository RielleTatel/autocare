import { render } from "@testing-library/react-native";
import { Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("stands in for as many lines as the caller expects", () => {
    const { getAllByTestId } = render(<Skeleton.Card lines={4} />);
    expect(getAllByTestId("skeleton-line")).toHaveLength(4);
  });

  it("defaults to a three-line card", () => {
    const { getAllByTestId } = render(<Skeleton.Card />);
    expect(getAllByTestId("skeleton-line")).toHaveLength(3);
  });

  it("renders a single line on its own", () => {
    const { getByTestId } = render(<Skeleton.Line width="50%" />);
    expect(getByTestId("skeleton-line").props.style.width).toBe("50%");
  });

  it("previews a whole screen as a heading plus cards", () => {
    const { getAllByTestId, getByTestId } = render(<Skeleton.Screen cards={3} />);
    getByTestId("skeleton-screen");
    expect(getAllByTestId("skeleton-card")).toHaveLength(3);
  });

  it("announces itself as loading rather than as silent empty content", () => {
    const { getByTestId } = render(<Skeleton.Screen />);
    const screen = getByTestId("skeleton-screen");
    expect(screen.props.accessibilityRole).toBe("progressbar");
    expect(screen.props.accessibilityLabel).toBe("Loading");
  });
});
