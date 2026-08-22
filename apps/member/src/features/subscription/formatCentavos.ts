/** Format integer centavos (as returned by the API) as a Philippine peso amount, e.g. 150000 -> "₱1500.00". */
export function formatCentavos(n: number): string {
  return "₱" + (n / 100).toFixed(2);
}
