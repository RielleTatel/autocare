import { fireEvent, render } from "@testing-library/react-native";
import { SlotPickerScreen } from "./SlotPickerScreen";
import type { Slot } from "./bookingApi";

const slots: Slot[] = [
  { start: "2027-09-01T09:00:00+08:00", end: "2027-09-01T10:00:00+08:00", bayId: "bay1", serviceTypeId: "st1" },
  { start: "2027-09-01T10:00:00+08:00", end: "2027-09-01T11:00:00+08:00", bayId: "bay1", serviceTypeId: "st1" },
];

/** Two days, with the same clock times on each — the shape that used to render
 *  as one undated list of apparent duplicates. */
const twoDays: Slot[] = [
  ...slots,
  { start: "2027-09-01T14:00:00+08:00", end: "2027-09-01T15:00:00+08:00", bayId: "bay1", serviceTypeId: "st1" },
  { start: "2027-09-02T09:00:00+08:00", end: "2027-09-02T10:00:00+08:00", bayId: "bay1", serviceTypeId: "st1" },
  { start: "2027-09-02T18:00:00+08:00", end: "2027-09-02T19:00:00+08:00", bayId: "bay1", serviceTypeId: "st1" },
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

  it("offers one date per day rather than one long undated list", () => {
    const { getByTestId } = render(<SlotPickerScreen slots={twoDays} holdSecondsLeft={null} onPick={jest.fn()} onRepick={jest.fn()} />);
    expect(getByTestId("day-2027-09-01")).toBeTruthy();
    expect(getByTestId("day-2027-09-02")).toBeTruthy();
  });

  it("shows only the selected day's times, so a repeated clock time is never ambiguous", () => {
    const { getByTestId, queryByTestId } = render(
      <SlotPickerScreen slots={twoDays} holdSecondsLeft={null} onPick={jest.fn()} onRepick={jest.fn()} />,
    );
    // Defaults to the first day.
    expect(getByTestId("slot-2027-09-01T09:00:00+08:00")).toBeTruthy();
    expect(queryByTestId("slot-2027-09-02T09:00:00+08:00")).toBeNull();

    fireEvent.press(getByTestId("day-2027-09-02"));
    expect(getByTestId("slot-2027-09-02T09:00:00+08:00")).toBeTruthy();
    expect(queryByTestId("slot-2027-09-01T09:00:00+08:00")).toBeNull();
  });

  it("sorts a day's times into morning, afternoon and evening", () => {
    const { getByText, getByTestId } = render(
      <SlotPickerScreen slots={twoDays} holdSecondsLeft={null} onPick={jest.fn()} onRepick={jest.fn()} />,
    );
    getByText("MORNING");
    getByText("AFTERNOON");
    fireEvent.press(getByTestId("day-2027-09-02"));
    getByText("EVENING");
  });

  it("keeps what is being booked in view", () => {
    const { getByTestId } = render(
      <SlotPickerScreen
        slots={twoDays}
        holdSecondsLeft={null}
        vehicle={{ plateNo: "ABA1234", year: 2020, make: "Toyota", model: "Vios" }}
        serviceName="Oil Change"
        onPick={jest.fn()}
        onRepick={jest.fn()}
      />,
    );
    expect(getByTestId("booking-subject")).toBeTruthy();
    getByTestId("slot-picker-screen");
  });

  it("says the window is empty rather than showing a bare screen", () => {
    const { getByText } = render(<SlotPickerScreen slots={[]} holdSecondsLeft={null} onPick={jest.fn()} onRepick={jest.fn()} />);
    getByText(/No open times in the next two weeks/);
  });

  it("returns to the held slot's day after a hold expires", () => {
    const { getByTestId } = render(
      <SlotPickerScreen
        slots={twoDays}
        holdSecondsLeft={0}
        heldSlotKey={"bay1|2027-09-02T18:00:00+08:00"}
        onPick={jest.fn()}
        onRepick={jest.fn()}
      />,
    );
    // Not day one, even though that is the default.
    expect(getByTestId("slot-2027-09-02T18:00:00+08:00")).toBeTruthy();
  });
});
