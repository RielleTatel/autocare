import { render, screen, fireEvent } from "@testing-library/react-native";
import { AnnouncementsScreen } from "./AnnouncementsScreen";
import type { AnnouncementItem } from "./announcementsApi";

const item = (over: Partial<AnnouncementItem> = {}): AnnouncementItem => ({
  id: "a1",
  kind: "SERVICE_DUE",
  status: "ACTIVE",
  title: "Oil Change due",
  body: "It has been long enough since the last Oil Change to book the next one.",
  vehicleId: "v1",
  serviceTypeId: "s1",
  appointmentId: null,
  publishedAt: "2026-09-01T00:00:00.000Z",
  read: false,
  ...over,
});

const noop = () => undefined;
const base = { refreshing: false, onRefresh: noop, onPressItem: noop, onMarkAllRead: noop };

describe("AnnouncementsScreen", () => {
  it("shows an empty state when there is nothing", () => {
    render(<AnnouncementsScreen items={[]} unreadCount={0} {...base} />);
    expect(screen.getByText("No announcements yet")).toBeTruthy();
  });

  it("renders a thread with its title and body", () => {
    render(<AnnouncementsScreen items={[item()]} unreadCount={1} {...base} />);
    expect(screen.getByText("Oil Change due")).toBeTruthy();
    expect(screen.getByTestId("unread-dot-a1")).toBeTruthy();
  });

  it("hides the unread dot once read", () => {
    render(<AnnouncementsScreen items={[item({ read: true })]} unreadCount={0} {...base} />);
    expect(screen.queryByTestId("unread-dot-a1")).toBeNull();
  });

  it("calls onPressItem when a row is tapped", () => {
    const onPressItem = jest.fn();
    render(<AnnouncementsScreen items={[item()]} unreadCount={1} {...base} onPressItem={onPressItem} />);
    fireEvent.press(screen.getByTestId("announcement-a1"));
    expect(onPressItem).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }));
  });

  it("offers mark-all-read only when something is unread", () => {
    const { rerender } = render(<AnnouncementsScreen items={[item()]} unreadCount={1} {...base} />);
    expect(screen.getByTestId("mark-all-read")).toBeTruthy();

    rerender(<AnnouncementsScreen items={[item({ read: true })]} unreadCount={0} {...base} />);
    expect(screen.queryByTestId("mark-all-read")).toBeNull();
  });

  it("shows the plate only when the API supplied one", () => {
    const { rerender } = render(<AnnouncementsScreen items={[item()]} unreadCount={1} {...base} />);
    expect(screen.queryByText("ABA1234")).toBeNull();

    rerender(<AnnouncementsScreen items={[item({ plate: "ABA1234" })]} unreadCount={1} {...base} />);
    expect(screen.getByText("ABA1234")).toBeTruthy();
  });

  it("renders a broadcast, which has no vehicle", () => {
    render(
      <AnnouncementsScreen
        items={[item({ id: "b1", kind: "ADMIN_BROADCAST", title: "Holiday hours", body: "Closed Dec 25.", vehicleId: null, serviceTypeId: null })]}
        unreadCount={1}
        {...base}
      />,
    );
    expect(screen.getByText("Holiday hours")).toBeTruthy();
    expect(screen.getByTestId("announcement-b1")).toBeTruthy();
  });
});
