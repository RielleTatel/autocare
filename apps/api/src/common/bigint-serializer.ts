/**
 * Prisma models represent money as BigInt centavos (Postgres `bigint`), but
 * `JSON.stringify` throws a TypeError on BigInt values by default.
 *
 * PH peso amounts are far below Number.MAX_SAFE_INTEGER (2^53 - 1), so it is
 * safe to serialize BigInt as a plain JS number for API responses.
 *
 * Imported once in main.ts for its side effect.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
(BigInt.prototype as unknown as { toJSON(): number }).toJSON = function (
  this: bigint,
): number {
  return Number(this);
};

export {};
