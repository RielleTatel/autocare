import { render, screen } from "@testing-library/react-native";
import { Plate } from "./Plate";

describe("Plate", () => {
  it("renders the plate in the mono face", () => {
    render(<Plate testID="p">ABC 1234</Plate>);
    expect(screen.getByTestId("p").props.style.fontFamily).toBe("IBMPlexMono_500Medium");
  });
});
