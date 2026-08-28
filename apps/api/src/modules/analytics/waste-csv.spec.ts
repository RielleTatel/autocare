import { toCsv, type WasteExportRow } from "./waste-csv";

const row: WasteExportRow = {
  disposedAt: "2026-08-20",
  workOrderNumber: "WO-202608-0001",
  plateNo: "ABC 1234",
  wasteType: "USED_OIL",
  quantity: 4.2,
  unit: "L",
  haulerName: "Zamboanga Enviro",
  manifestNo: "MF-99",
};

describe("toCsv", () => {
  it("emits the DENR header row first", () => {
    expect(toCsv([]).split("\n")[0]).toBe(
      "disposed_at,work_order,plate,waste_type,quantity,unit,hauler,manifest_no",
    );
  });

  it("writes a record in column order", () => {
    expect(toCsv([row]).split("\n")[1]).toBe(
      "2026-08-20,WO-202608-0001,ABC 1234,USED_OIL,4.2,L,Zamboanga Enviro,MF-99",
    );
  });

  it("leaves optional hauler and manifest empty rather than printing null", () => {
    const bare = { ...row, haulerName: null, manifestNo: null };
    expect(toCsv([bare]).split("\n")[1]).toBe(
      "2026-08-20,WO-202608-0001,ABC 1234,USED_OIL,4.2,L,,",
    );
  });

  it("quotes and escapes a value containing a comma or quote", () => {
    const messy = { ...row, haulerName: 'Cruz, Sons & Co "Enviro"' };
    expect(toCsv([messy]).split("\n")[1]).toContain('"Cruz, Sons & Co ""Enviro"""');
  });
});
