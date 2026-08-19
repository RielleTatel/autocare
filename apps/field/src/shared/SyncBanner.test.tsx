import { render } from "@testing-library/react-native";
import { SyncBanner } from "./SyncBanner";
describe("SyncBanner", () => {
  it("hides when queue is empty", () => {
    expect(render(<SyncBanner pendingCount={0} />).toJSON()).toBeNull();
  });
  it("shows pending count", () => {
    const { getByText } = render(<SyncBanner pendingCount={3} />);
    getByText("3 items waiting to sync");
  });
});
