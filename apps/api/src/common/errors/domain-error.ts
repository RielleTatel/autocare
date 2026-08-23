import type { ErrorCode } from "@autocare/contracts";

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly httpStatus: number,
    /** Optional machine-readable context surfaced in the error envelope (e.g. overage price). */
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
