import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { Card } from "./Card";

describe("member Card", () => {
  it("renders children", () => {
    render(<Card><Text>Inside</Text></Card>);
    expect(screen.getByText("Inside")).toBeTruthy();
  });
});
