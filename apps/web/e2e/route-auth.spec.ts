import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// Helper to set auth cookie
async function authenticateContext(context: import("@playwright/test").BrowserContext) {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) return false;

  const signature = createHmac("sha256", authSecret)
    .update("opus-nx-authenticated")
    .digest("hex");

  await context.addCookies([
    {
      name: "opus-nx-auth",
      value: signature,
      url: BASE_URL,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return true;
}

test.describe("Public Routes", () => {
  test("landing page renders without auth", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveURL(BASE_URL + "/");
    // Should see the landing page content
    await expect(page.getByText("Opus Nx")).toBeVisible({ timeout: 10_000 });
  });

  test("login page renders without auth", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByPlaceholder("Access code")).toBeVisible({ timeout: 10_000 });
  });

  test("share page is accessible without auth", async ({ page }) => {
    // Share pages should not redirect to login
    const response = await page.goto(`${BASE_URL}/share/test-token`);
    // Should NOT redirect to /login
    expect(page.url()).not.toContain("/login");
  });
});

test.describe("Protected Routes", () => {
  test("workspace redirects to login when unauthenticated", async ({ page }) => {
    await page.goto(`${BASE_URL}/workspace`);
    // Should redirect to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("workspace loads with valid auth cookie", async ({ page, context }) => {
    const authSecret = process.env.AUTH_SECRET;
    test.skip(!authSecret, "Set AUTH_SECRET for authenticated tests");

    await authenticateContext(context);
    await page.goto(`${BASE_URL}/workspace`);
    // Should NOT redirect to login
    await expect(page).not.toHaveURL(/\/login/);
    // Should see workspace content
    await expect(page.getByText("Opus Nx")).toBeVisible({ timeout: 10_000 });
  });

  test("protected API returns 401 without auth", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/thinking`);
    // Should be 401 or 302 (redirect)
    expect([401, 302, 307]).toContain(response.status());
  });
});
