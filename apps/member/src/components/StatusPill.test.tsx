import { render, screen } from "@testing-library/react-native";
import { StatusPill } from "./StatusPill";

describe("member StatusPill", () => {
  it("renders its label", () => {
    render(<StatusPill tone="success">SETTLED</StatusPill>);
    expect(screen.getByText("SETTLED")).toBeTruthy();
  });
});
