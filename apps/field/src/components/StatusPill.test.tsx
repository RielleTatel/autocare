import { render, screen } from "@testing-library/react-native";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("renders its lifecycle label", () => {
    render(<StatusPill tone="warn">RETRYING</StatusPill>);
    expect(screen.getByText("RETRYING")).toBeTruthy();
  });
});
