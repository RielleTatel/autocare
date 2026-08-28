-- Records when a subscription actually reached CANCELLED. Previously only
-- cancel_requested_at existed, which for deferred cancellations is set up to a
-- full billing period before the subscription ends — so churn-over-a-window was
-- not computable.
ALTER TABLE "subscriptions" ADD COLUMN "cancelled_at" TIMESTAMP(3);

-- Backfill. APPROXIMATE FOR HISTORICAL ROWS ONLY: for subscriptions cancelled
-- via the deferred path, cancel_requested_at precedes the true end date by up
-- to one billing period, so these values read early. Rows created after this
-- migration are stamped exactly at the transition. Do not treat pre-migration
-- history as precise.
UPDATE "subscriptions"
   SET "cancelled_at" = "cancel_requested_at"
 WHERE "status" = 'CANCELLED'
   AND "cancelled_at" IS NULL;
