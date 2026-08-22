import { SetMetadata } from "@nestjs/common";

/** Marks a route as requiring an `Idempotency-Key` header — read by IdempotencyInterceptor. */
export const IDEMPOTENT_KEY = "idempotent";
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
