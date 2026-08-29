import { render, screen } from "@testing-library/react-native";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("exposes progress to assistive tech as a real progressbar", () => {
    render(<ProgressBar answered={9} total={10} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 10, now: 9 });
  });

  it("fills proportionally", () => {
    render(<ProgressBar answered={5} total={10} />);
    expect(screen.getByTestId("progress-fill").props.style.width).toBe("50%");
  });

  it("renders empty rather than dividing by zero when nothing is scorable", () => {
    render(<ProgressBar answered={0} total={0} />);
    expect(screen.getByTestId("progress-fill").props.style.width).toBe("0%");
  });

  it("renders full at completion", () => {
    render(<ProgressBar answered={10} total={10} />);
    expect(screen.getByTestId("progress-fill").props.style.width).toBe("100%");
  });
});
