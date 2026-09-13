import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { VehiclePhotosScreen } from "./VehiclePhotosScreen";

function props(overrides: Partial<React.ComponentProps<typeof VehiclePhotosScreen>> = {}) {
  return {
    vehicleId: "vehicle-1",
    onDone: jest.fn(),
    pickImage: jest.fn().mockResolvedValue(null),
    uploadPhoto: jest.fn(),
    patchVehicle: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("VehiclePhotosScreen", () => {
  it("handles a native picker rejection instead of leaving an unhandled promise", async () => {
    const pickImage = jest.fn().mockRejectedValue(
      new Error("Attempting to launch an unregistered ActivityResultLauncher")
    );
    const screen = render(<VehiclePhotosScreen {...props({ pickImage })} />);

    fireEvent.press(screen.getByTestId("add-photo"));

    await waitFor(() => {
      expect(screen.getByTestId("error").props.children).toContain("Restart AutoCare+");
      expect(screen.queryByTestId("activity-indicator")).toBeNull();
    });
  });

  it("allows only one picker launch at a time", async () => {
    let resolvePick!: (uri: string | null) => void;
    const pickImage = jest.fn(() => new Promise<string | null>((resolve) => {
      resolvePick = resolve;
    }));
    const screen = render(<VehiclePhotosScreen {...props({ pickImage })} />);

    fireEvent.press(screen.getByTestId("add-photo"));
    fireEvent.press(screen.getByTestId("add-photo"));

    expect(pickImage).toHaveBeenCalledTimes(1);
    resolvePick(null);
    await waitFor(() => expect(screen.getByTestId("add-photo").props.accessibilityState?.disabled).not.toBe(true));
  });

  it("unlocks the screen when image selection is cancelled", async () => {
    const screen = render(<VehiclePhotosScreen {...props()} />);

    fireEvent.press(screen.getByTestId("add-photo"));

    await waitFor(() => expect(screen.getByTestId("add-photo").props.accessibilityState?.disabled).not.toBe(true));
  });
});
