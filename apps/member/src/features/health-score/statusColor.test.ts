import { statusColor } from "./statusColor";
import { theme } from "../../theme";

describe("statusColor", () => {
  it("maps each adverse status to its band fill", () => {
    expect(statusColor("CRITICAL")).toBe(theme.vhsBands.CRITICAL.fill);
    expect(statusColor("ATTENTION")).toBe(theme.vhsBands.NEEDS_ATTENTION.fill);
    expect(statusColor("MONITOR")).toBe(theme.vhsBands.FAIR.fill);
  });

  it("separates healthy from unrecorded, N/A and unknown values", () => {
    expect(statusColor("GOOD")).toBe(theme.vhsBands.GOOD.fill);
    expect(statusColor(undefined)).toBe(theme.colors.inkMuted);
    expect(statusColor("NOT_APPLICABLE")).toBe(theme.colors.inkMuted);
    expect(statusColor("SOMETHING_NEW")).toBe(theme.colors.inkMuted);
  });
});
