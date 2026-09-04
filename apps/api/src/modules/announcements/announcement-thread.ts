import type { AnnouncementKind, AnnouncementStatus } from "@autocare/contracts";

export type ThreadState = { kind: AnnouncementKind; status: AnnouncementStatus };

export type ThreadEvent =
  | { type: "SERVICE_DUE_DETECTED" }
  | { type: "APPOINTMENT_BOOKED" }
  | { type: "APPOINTMENT_REMINDER_DUE" }
  | { type: "APPOINTMENT_RESCHEDULED" }
  | { type: "APPOINTMENT_CANCELLED" }
  | { type: "SERVICE_COMPLETED" }
  | { type: "DISMISSED" };

/** Kinds that mean "an appointment currently exists for this thread". */
const BOOKED_KINDS: AnnouncementKind[] = ["APPOINTMENT_BOOKED", "APPOINTMENT_REMINDER", "APPOINTMENT_RESCHEDULED"];

/**
 * The thread transition table (design spec §5). Returns the next state, or `null` when the
 * event is a no-op — which is what makes the repeating daily and hourly jobs safe to re-run:
 * the caller only writes to the database when this returns something.
 *
 * Pure: no clock, no database. A `null` current state means "no open thread".
 */
export function nextThreadState(current: ThreadState | null, event: ThreadEvent): ThreadState | null {
  // A closed thread is history — nothing reopens it. The next service cycle opens a fresh one,
  // which the partial unique index permits precisely because this one is no longer ACTIVE.
  if (current && current.status !== "ACTIVE") return null;

  if (!current) {
    // Only a due-detection opens a thread; lifecycle events without one are ignored.
    return event.type === "SERVICE_DUE_DETECTED" ? { kind: "SERVICE_DUE", status: "ACTIVE" } : null;
  }

  switch (event.type) {
    case "SERVICE_DUE_DETECTED":
      return null; // already open — the daily job is idempotent
    case "APPOINTMENT_BOOKED":
      return current.kind === "SERVICE_DUE" ? { kind: "APPOINTMENT_BOOKED", status: "ACTIVE" } : null;
    case "APPOINTMENT_REMINDER_DUE":
      // Only remind when an appointment exists and the member has not already been reminded
      // about this date. A reschedule re-arms it, because the date they were told has changed.
      return current.kind === "APPOINTMENT_BOOKED" || current.kind === "APPOINTMENT_RESCHEDULED"
        ? { kind: "APPOINTMENT_REMINDER", status: "ACTIVE" }
        : null;
    case "APPOINTMENT_RESCHEDULED":
      return BOOKED_KINDS.includes(current.kind) ? { kind: "APPOINTMENT_RESCHEDULED", status: "ACTIVE" } : null;
    case "APPOINTMENT_CANCELLED":
      // Fall back rather than close: the service itself is still due.
      return BOOKED_KINDS.includes(current.kind) ? { kind: "SERVICE_DUE", status: "ACTIVE" } : null;
    case "SERVICE_COMPLETED":
      return { kind: "SERVICE_COMPLETED", status: "SUPERSEDED" };
    case "DISMISSED":
      return { kind: current.kind, status: "DISMISSED" };
    default:
      return null;
  }
}

export type CopyInput = {
  kind: AnnouncementKind;
  serviceTypeName: string;
  scheduledStart?: Date;
  reason?: string | null;
};

/** Manila, because that is where the shop and every member is (Zamboanga City). */
const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Manila",
});

/** Member-facing copy for a thread state — plain language, no workshop jargon. */
export function renderAnnouncementCopy(input: CopyInput): { title: string; body: string } {
  const svc = input.serviceTypeName;
  const on = input.scheduledStart ? DATE_FMT.format(input.scheduledStart) : "";

  switch (input.kind) {
    case "SERVICE_DUE":
      return {
        title: `${svc} due`,
        body:
          input.reason === "ODOMETER"
            ? `Your mileage since the last ${svc} has reached the recommended interval.`
            : `It has been long enough since the last ${svc} to book the next one.`,
      };
    case "APPOINTMENT_BOOKED":
      return { title: `${svc} scheduled`, body: `Booked for ${on}. We'll remind you the day before.` };
    case "APPOINTMENT_REMINDER":
      return { title: `${svc} tomorrow`, body: `Your appointment is on ${on}. Reschedule from Bookings if you need to.` };
    case "APPOINTMENT_RESCHEDULED":
      return { title: `${svc} moved`, body: `Your appointment is now on ${on}.` };
    case "APPOINTMENT_CANCELLED":
      return { title: `${svc} cancelled`, body: `The appointment was cancelled. This service is still due.` };
    case "SERVICE_COMPLETED":
      return { title: `${svc} completed`, body: `This service is recorded in your vehicle's history.` };
    default:
      return { title: svc, body: "" };
  }
}
