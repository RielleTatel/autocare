/**
 * DENR hazardous-waste export. This is a regulator-facing document, so the
 * column set and order are fixed — add columns at the end, never reorder.
 */

export type WasteExportRow = {
  disposedAt: string;
  workOrderNumber: string;
  plateNo: string;
  wasteType: string;
  quantity: number;
  unit: string;
  haulerName: string | null;
  manifestNo: string | null;
};

const HEADER = "disposed_at,work_order,plate,waste_type,quantity,unit,hauler,manifest_no";

/** RFC 4180: wrap in quotes and double any embedded quote, when needed. */
function cell(value: string | number | null): string {
  if (value === null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: WasteExportRow[]): string {
  const lines = rows.map((r) =>
    [r.disposedAt, r.workOrderNumber, r.plateNo, r.wasteType, r.quantity, r.unit, r.haulerName, r.manifestNo]
      .map(cell)
      .join(","),
  );
  return [HEADER, ...lines].join("\n");
}
