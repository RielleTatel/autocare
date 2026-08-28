import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("login page", () => {
  it("offers staff sign-in", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /autocare\+/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeDefined();
  });

  it("meets the 48px web touch target on its inputs", () => {
    const { container } = render(<LoginPage />);
    const email = container.querySelector("input[type=email]");
    expect(email?.className).toContain("h-12");
  });

  it("keeps the staff-only notice", () => {
    render(<LoginPage />);
    expect(screen.getByText(/Staff access only/)).toBeTruthy();
  });

  it("disables sign-in until both fields are filled", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /sign in/i }).hasAttribute("disabled")).toBe(true);
  });
});
