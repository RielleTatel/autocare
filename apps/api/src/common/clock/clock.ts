/**
 * Injected "now" for time-driven job logic (Task 8, §7.8). Billing job logic must NEVER call
 * `new Date()` directly — it reads "today" from this instead, so acceptance tests can simulate a
 * multi-day timeline deterministically by overriding the CLOCK provider with a fake that returns
 * whatever day the test is currently simulating.
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol("CLOCK");

/** Default provider — real wall-clock time. Used everywhere except tests. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
