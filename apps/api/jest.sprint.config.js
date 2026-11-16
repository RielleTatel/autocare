/** SPR-001 deterministic checks; no shared database, Redis, provider calls or global fixtures. */
const payments = require("./jest.payments.config.js");
module.exports = {
  ...payments,
  testRegex: "src/(common/idempotency|modules/(payments|invoices|subscriptions))/.*\\.spec\\.ts$|src/modules/(scheduling/(field-bookings|operating-hours-read)|sync/handlers/inspection-booking|inspections/inspections\\.service|billing/billing\\.service)\\.spec\\.ts$",
};
