-- Enforces "one ACTIVE subscription per vehicle" (FR-017/BR-08) at the database level,
-- as a race-safe backstop to the application-level check-then-act guard in
-- SubscriptionsService.create. Prisma's schema DSL has no syntax for partial/filtered
-- unique indexes, so this index is not (and cannot be) declared in schema.prisma —
-- this migration file is the sole source of truth for it. See the note above the
-- Subscription model in schema.prisma.
CREATE UNIQUE INDEX "subscriptions_one_active_per_vehicle"
  ON "subscriptions" ("vehicle_id")
  WHERE "status" = 'ACTIVE';
