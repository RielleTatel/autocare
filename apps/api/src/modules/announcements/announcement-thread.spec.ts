import { nextThreadState, renderAnnouncementCopy, ThreadState } from "./announcement-thread";

const active = (kind: ThreadState["kind"]): ThreadState => ({ kind, status: "ACTIVE" });

describe("nextThreadState", () => {
  it("opens a SERVICE_DUE thread when none exists", () => {
    expect(nextThreadState(null, { type: "SERVICE_DUE_DETECTED" })).toEqual(active("SERVICE_DUE"));
  });

  it("leaves an already-open SERVICE_DUE thread untouched (idempotent daily job)", () => {
    expect(nextThreadState(active("SERVICE_DUE"), { type: "SERVICE_DUE_DETECTED" })).toBeNull();
  });

  it("moves a due thread to booked", () => {
    expect(nextThreadState(active("SERVICE_DUE"), { type: "APPOINTMENT_BOOKED" })).toEqual(active("APPOINTMENT_BOOKED"));
  });

  it("moves a booked thread to reminder", () => {
    expect(nextThreadState(active("APPOINTMENT_BOOKED"), { type: "APPOINTMENT_REMINDER_DUE" })).toEqual(active("APPOINTMENT_REMINDER"));
  });

  it("does not re-send a reminder for a thread already reminded", () => {
    expect(nextThreadState(active("APPOINTMENT_REMINDER"), { type: "APPOINTMENT_REMINDER_DUE" })).toBeNull();
  });

  it("returns a cancelled appointment to due — the service is still needed", () => {
    expect(nextThreadState(active("APPOINTMENT_BOOKED"), { type: "APPOINTMENT_CANCELLED" })).toEqual(active("SERVICE_DUE"));
  });

  it("reschedules from either booked or reminded", () => {
    expect(nextThreadState(active("APPOINTMENT_BOOKED"), { type: "APPOINTMENT_RESCHEDULED" })).toEqual(active("APPOINTMENT_RESCHEDULED"));
    expect(nextThreadState(active("APPOINTMENT_REMINDER"), { type: "APPOINTMENT_RESCHEDULED" })).toEqual(active("APPOINTMENT_RESCHEDULED"));
  });

  it("closes the thread when the service completes", () => {
    expect(nextThreadState(active("APPOINTMENT_BOOKED"), { type: "SERVICE_COMPLETED" }))
      .toEqual({ kind: "SERVICE_COMPLETED", status: "SUPERSEDED" });
  });

  it("dismisses an open thread", () => {
    expect(nextThreadState(active("SERVICE_DUE"), { type: "DISMISSED" }))
      .toEqual({ kind: "SERVICE_DUE", status: "DISMISSED" });
  });

  it("ignores every event on a closed thread", () => {
    const closed: ThreadState = { kind: "SERVICE_COMPLETED", status: "SUPERSEDED" };
    expect(nextThreadState(closed, { type: "APPOINTMENT_BOOKED" })).toBeNull();
    expect(nextThreadState(closed, { type: "DISMISSED" })).toBeNull();
  });

  it("ignores a booking event when no thread exists", () => {
    expect(nextThreadState(null, { type: "APPOINTMENT_BOOKED" })).toBeNull();
  });

  it("does not remind a thread that is only due — there is no appointment yet", () => {
    expect(nextThreadState(active("SERVICE_DUE"), { type: "APPOINTMENT_REMINDER_DUE" })).toBeNull();
  });

  it("reminds again after a reschedule — the date the member was told has changed", () => {
    expect(nextThreadState(active("APPOINTMENT_RESCHEDULED"), { type: "APPOINTMENT_REMINDER_DUE" }))
      .toEqual(active("APPOINTMENT_REMINDER"));
  });
});

describe("renderAnnouncementCopy", () => {
  const when = new Date("2026-09-12T02:00:00Z");

  it("names the service and the trigger for a due thread", () => {
    expect(renderAnnouncementCopy({ kind: "SERVICE_DUE", serviceTypeName: "Oil Change", reason: "ODOMETER" }))
      .toEqual({ title: "Oil Change due", body: "Your mileage since the last Oil Change has reached the recommended interval." });
  });

  it("uses elapsed-time wording for a time-triggered thread", () => {
    expect(renderAnnouncementCopy({ kind: "SERVICE_DUE", serviceTypeName: "Oil Change", reason: "TIME" }).body)
      .toBe("It has been long enough since the last Oil Change to book the next one.");
  });

  it("states the date once booked", () => {
    const copy = renderAnnouncementCopy({ kind: "APPOINTMENT_BOOKED", serviceTypeName: "Oil Change", scheduledStart: when });
    expect(copy.title).toBe("Oil Change scheduled");
    // Tolerant of the ICU month abbreviation ("Sep" vs "Sept" varies by Node/ICU version) —
    // the day and year are the part that must be right.
    expect(copy.body).toMatch(/12 Sept? 2026/);
  });

  it("confirms completion", () => {
    expect(renderAnnouncementCopy({ kind: "SERVICE_COMPLETED", serviceTypeName: "Oil Change" }))
      .toEqual({ title: "Oil Change completed", body: "This service is recorded in your vehicle's history." });
  });

  it("renders dates in Manila time, not UTC", () => {
    // 2026-09-11T17:00Z is already 2026-09-12 01:00 in Manila (UTC+8).
    const copy = renderAnnouncementCopy({
      kind: "APPOINTMENT_REMINDER", serviceTypeName: "Oil Change",
      scheduledStart: new Date("2026-09-11T17:00:00Z"),
    });
    expect(copy.body).toMatch(/12 Sept? 2026/);
    expect(copy.body).not.toMatch(/11 Sept? 2026/);
  });
});
