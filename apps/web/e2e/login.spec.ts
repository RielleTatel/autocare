import { expect, test } from "@playwright/test";

const email = process.env.E2E_STAFF_EMAIL,
  password = process.env.E2E_STAFF_PASSWORD;
test.skip(!email || !password, "needs E2E_STAFF_EMAIL/PASSWORD and a running API");

test("staff signs in and lands on /staff", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/staff/);
});

test("anonymous /admin bounces to /login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});
