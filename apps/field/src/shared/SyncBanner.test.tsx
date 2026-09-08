import { render, fireEvent } from "@testing-library/react-native";
import { SyncBanner } from "./SyncBanner";
describe("SyncBanner", () => {
  it("hides when queue is empty", () => {
    expect(render(<SyncBanner pendingCount={0} />).toJSON()).toBeNull();
  });
  it("shows pending count", () => {
    const { getByText } = render(<SyncBanner pendingCount={3} />);
    getByText("3 items waiting to sync");
  });
  it("opens the sync queue when tapped", () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<SyncBanner pendingCount={3} onPress={onPress} />);
    fireEvent.press(getByLabelText("3 items waiting to sync"));
    expect(onPress).toHaveBeenCalled();
  });

  it("warns that sync is failing rather than showing a neutral waiting label", () => {
    const { getByText, queryByText } = render(<SyncBanner pendingCount={2} lastError="Missing bearer token" />);
    getByText("Sync failing — 2 items not uploaded. Tap to review.");
    expect(queryByText("2 items waiting to sync")).toBeNull();
  });

  it("stays visible for rejected items even when nothing is pending", () => {
    const { getByText } = render(<SyncBanner pendingCount={0} rejectedCount={1} />);
    getByText("1 item was rejected. Tap to review.");
  });
});
