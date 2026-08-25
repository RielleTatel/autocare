import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("renders its label and fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Book a service</Button>);
    const btn = screen.getByRole("button", { name: "Book a service" });
    btn.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
  it("applies the field size height", () => {
    render(<Button size="field">Start inspection</Button>);
    expect(screen.getByRole("button").className).toContain("h-14");
  });
  it("is disabled and non-interactive when disabled", () => {
    render(<Button disabled>Nope</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
