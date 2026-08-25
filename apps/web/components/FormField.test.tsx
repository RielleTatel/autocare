import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormField } from "./FormField";

describe("FormField", () => {
  it("emits changes and shows sentence-form errors", () => {
    const onChange = vi.fn();
    render(<FormField label="Plate" value="" onChange={onChange} error="Enter a plate number to continue." />);
    fireEvent.change(screen.getByLabelText("Plate"), { target: { value: "X" } });
    expect(onChange).toHaveBeenCalledWith("X");
    expect(screen.getByText("Enter a plate number to continue.")).toBeInTheDocument();
  });
  it("uses mono + wide tracking for machine identity", () => {
    render(<FormField label="VIN" mono value="" onChange={() => {}} />);
    expect(screen.getByLabelText("VIN").className).toContain("font-mono");
  });
});
