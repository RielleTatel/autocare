/** Same-origin staff API access. Session credentials remain in the BFF. */
export class StaffApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "StaffApiError";
  }
}

export async function staffApi<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/proxy/${path}`, { ...init, headers, cache: "no-store" });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    const problems = body?.error?.details?.problems;
    const message = Array.isArray(problems) && problems.length
      ? problems.join("; ")
      : body?.error?.message ?? `Could not complete this request (${response.status}). Try again.`;
    throw new StaffApiError(message, response.status, body?.error?.code);
  }
  return body.data as T;
}

/** Decimal input is converted without accepting fractions of a centavo. */
export function parsePeso(value: string): number | null {
  const amount = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) return null;
  const [pesos, cents = ""] = amount.split(".");
  const result = Number(pesos) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}

export const pesoInput = (centavos: number) => (centavos / 100).toFixed(2);
export const formatPeso = (centavos: number) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(centavos / 100);
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Could not complete this request. Try again.";
