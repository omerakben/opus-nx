import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

test.describe("Environment Setup Mode", () => {
  test("health endpoint returns ok", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/health`);
    expect(response.ok()).toBeTruthy();
  });

  test("public landing renders regardless of env config", async ({ page }) => {
    await page.goto(BASE_URL);
    // Landing page should always render (it uses public env schema)
    await expect(page.getByText("OPUS NX", { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});
