import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoginPage from "./page";

describe("login page", () => {
  it("offers staff sign-in", () => {
    render(<LoginPage />);
    expect(screen.getByRole("heading", { name: /autocare\+/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeDefined();
  });
});
