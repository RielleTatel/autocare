import { fireEvent, render } from "@testing-library/react-native";
import { SlotPickerScreen } from "./SlotPickerScreen";
import type { Slot } from "./bookingApi";

const slots: Slot[] = [
  { start: "2027-09-01T09:00:00+08:00", end: "2027-09-01T10:00:00+08:00", bayId: "bay1", serviceTypeId: "st1" },
  { start: "2027-09-01T10:00:00+08:00", end: "2027-09-01T11:00:00+08:00", bayId: "bay1", serviceTypeId: "st1" },
];

describe("SlotPickerScreen", () => {
  it("renders slot chips and picks one", () => {
    const onPick = jest.fn();
    const { getByTestId } = render(<SlotPickerScreen slots={slots} holdSecondsLeft={null} onPick={onPick} onRepick={jest.fn()} />);
    fireEvent.press(getByTestId("slot-2027-09-01T09:00:00+08:00"));
    expect(onPick).toHaveBeenCalledWith(slots[0]);
  });

  it("shows a live countdown while a hold is held", () => {
    const { getByTestId } = render(<SlotPickerScreen slots={slots} holdSecondsLeft={125} onPick={jest.fn()} onRepick={jest.fn()} />);
    expect(getByTestId("hold-countdown").props.children).toEqual(expect.arrayContaining(["2:05"]));
  });

  it("prompts a re-pick when the hold expires and can refresh", () => {
    const onRepick = jest.fn();
    const { getByTestId } = render(<SlotPickerScreen slots={slots} holdSecondsLeft={0} onPick={jest.fn()} onRepick={onRepick} />);
    expect(getByTestId("hold-expired")).toBeTruthy();
    fireEvent.press(getByTestId("repick"));
    expect(onRepick).toHaveBeenCalled();
  });
});
