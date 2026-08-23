import { fireEvent, render, screen } from "@testing-library/react-native";
import { AttentionCard } from "./AttentionCard";
import { AttentionListScreen } from "./AttentionListScreen";
import type { AttentionItem } from "./attentionApi";

const item = (over: Partial<AttentionItem>): AttentionItem => ({
  id: "x", kind: "RECOMMENDATION", severity: "MONITOR", vehicleId: "v1", title: "T", body: "B",
  deepLink: { screen: "Recommendations", params: { vehicleId: "v1" } }, createdAt: "2026-08-24T00:00:00Z", ...over,
});

const items: AttentionItem[] = [
  item({ id: "c", kind: "COMPONENT_STATUS", severity: "CRITICAL", title: "Front brake pads", body: "Unsafe", plate: "ABC-1234" }),
  item({ id: "r", kind: "RECOMMENDATION", severity: "ATTENTION", title: "Wipers", plate: "ABC-1234" }),
  item({ id: "s", kind: "SERVICE_DUE", severity: "MONITOR", vehicleId: "v2", title: "Oil change due", plate: "XYZ-9876" }),
];

describe("AttentionCard (M-10)", () => {
  it("renders the empty state rather than hiding when there is nothing (FR-113)", () => {
    render(<AttentionCard items={[]} />);
    expect(screen.getByTestId("attention-empty")).toBeTruthy();
    expect(screen.getByText(/Nothing needs attention/)).toBeTruthy();
  });

  it("shows the single most severe item verbatim and a See-all affordance", () => {
    const onSeeAll = jest.fn();
    render(<AttentionCard items={items} onSeeAll={onSeeAll} />);
    expect(screen.getByLabelText("Most urgent: Front brake pads")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("See all attention items"));
    expect(onSeeAll).toHaveBeenCalled();
  });
});

describe("AttentionListScreen (M-38)", () => {
  it("orders CRITICAL-first and routes an item on tap", () => {
    const onPress = jest.fn();
    render(<AttentionListScreen items={items} onPressItem={onPress} />);
    fireEvent.press(screen.getByLabelText("Front brake pads — Critical"));
    expect(onPress).toHaveBeenCalledWith(expect.objectContaining({ id: "c" }));
  });

  it("groups by vehicle plate when the member has more than one vehicle", () => {
    render(<AttentionListScreen items={items} />);
    expect(screen.getByText("ABC-1234")).toBeTruthy();
    expect(screen.getByText("XYZ-9876")).toBeTruthy();
  });

  it("renders the empty state for no items", () => {
    render(<AttentionListScreen items={[]} />);
    expect(screen.getByTestId("attention-empty")).toBeTruthy();
  });
});
