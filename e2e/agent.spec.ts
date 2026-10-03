import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('[data-page="/"]')).toBeVisible();
});

async function ask(page: import("@playwright/test").Page, text: string) {
  await page.keyboard.press("/");
  await page.fill("#agent-input", text);
  await page.keyboard.press("Enter");
  // The send button comes back when the run finishes.
  await expect(page.locator(`[data-agent-dock] button[aria-label="Send"]`)).toBeVisible({ timeout: 60_000 });
}

test("Show me: agent navigates, fills the purchase order form and submits it", async ({ page }) => {
  await page.keyboard.press("/");
  await page.fill("#agent-input", "Restock what's low");
  await page.keyboard.press("Enter");
  // The real form opens and the visible cursor appears while it is filled.
  await expect(page.locator('[data-agent-form="purchase-order"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Agent", { exact: true }).first()).toBeVisible();
  await expect(page.locator(`[data-agent-dock] button[aria-label="Send"]`)).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.locator("tr", { hasText: "Draft" }).first()).toBeVisible();
  await expect(page.locator("[data-agent-dock]")).toContainText("Drafted");
});

test("Background: agent creates a coupon without leaving the page", async ({ page }) => {
  await page.keyboard.press("/");
  await page.getByRole("radio", { name: "Background" }).click();
  await page.fill("#agent-input", "Create a 20% coupon WEEKEND20");
  await page.keyboard.press("Enter");
  await expect(page.locator(`[data-agent-dock] button[aria-label="Send"]`)).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/marketing");
  await expect(page.getByText("WEEKEND20").first()).toBeVisible();
});

test("Navigation request opens the page", async ({ page }) => {
  await ask(page, "Open finance");
  await expect(page).toHaveURL(/\/finance$/);
});

test("Typing indicator shows while the model is replying", async ({ page }) => {
  // Slow the model call down so the waiting state is observable.
  await page.route("**/api/chat", async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await page.keyboard.press("/");
  await page.fill("#agent-input", "How are sales this week?");
  await page.keyboard.press("Enter");
  const status = page.locator('[data-agent-dock] [role="status"]');
  await expect(status).toBeVisible();
  await expect(page.locator("[data-agent-dock]")).toContainText("Last 7 days", { timeout: 20_000 });
  await expect(status).toHaveCount(0);
});

test("Jev fast path handles a simple toggle without the big model", async ({ page }) => {
  let chatCalls = 0;
  await page.route("**/api/chat", async (route) => {
    chatCalls++;
    await route.continue();
  });
  await page.keyboard.press("/");
  await page.getByRole("radio", { name: "Background" }).click();
  await page.fill("#agent-input", "Mark garlic bread sold out");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-agent-dock]")).toContainText("Jev fast path", { timeout: 20_000 });
  await expect(page.locator("[data-agent-dock]")).toContainText("Garlic bread is now marked sold out");
  expect(chatCalls).toBe(0);
  await page.goto("/menu");
  await expect(page.locator('tr[data-row-id="m-garlicbread"]')).toContainText("Sold out");
});

test("Jev tags reviews and flags the ones that need a reply today", async ({ page }) => {
  await page.goto("/marketing");
  await expect(page.getByText("Topics and urgency tagged by Jev")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("radio", { name: "Reply today" }).click();
  await expect(page.locator('li[data-row-id="rv-2"]')).toContainText("Reply today");
  await expect(page.locator('li[data-row-id="rv-1"]')).toHaveCount(0);
});

test("Jev suggests an expense category from the vendor", async ({ page }) => {
  await page.goto("/finance");
  await page.locator('[data-agent-open="expense"]').click();
  await page.fill("#vendor", "CoolTech HVAC chiller repair");
  await page.getByRole("button", { name: /Jev suggests Maintenance/ }).click();
  await expect(page.locator("#category")).toHaveValue("Maintenance");
});
