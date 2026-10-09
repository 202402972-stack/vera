import { test, expect } from "@playwright/test";
import path from "node:path";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("store-language", "en"));
});
const login = async (page) => {
  await page.goto("/admin");
  await page.getByLabel("Dashboard password").fill("admin@admin");
  await page.getByRole("button", { name: "Enter dashboard" }).click();
  await expect(
    page.getByRole("navigation", { name: "Dashboard sections" }),
  ).toBeVisible();
};
test("store layout, bottom admin link, original catalogue and mobile layout", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Handcrafted Alpaca Wool Luxury" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Alpaca Wool Scarf", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Admin", exact: true })
    .scrollIntoViewIfNeeded();
  const last = await page
    .locator("footer")
    .evaluate((el) => el.lastElementChild.textContent.trim());
  expect(last).toBe("Admin");
  await page.screenshot({
    path: "screenshots/store-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Handcrafted Alpaca Wool Luxury" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "screenshots/store-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("dashboard login, all sections, content save and upload/product management", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  await page.screenshot({
    path: "screenshots/dashboard-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Store content", exact: true })
    .click();
  await page
    .getByLabel("Store name", { exact: true })
    .fill("Alpaca Wool Boutique");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Store content saved" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Products", exact: true }).click();
  await page.getByRole("button", { name: "Add product", exact: true }).click();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Browser Test Scarf");
  await page.getByLabel("Short subtitle").fill("Warm and soft");
  await page.getByLabel("Product ID / URL").fill("browser-test-scarf");
  await page
    .getByLabel("Product description", { exact: true })
    .fill("A lovely scarf for this browser test.");
  await page
    .getByLabel("Visibility", { exact: true })
    .selectOption("published");
  await page.getByRole("button", { name: "Images", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles(path.resolve("public/assets/hero.jpg"));
  await expect(page.getByAltText("Cover photograph")).toBeVisible();
  await page
    .getByRole("button", { name: "Options & inventory", exact: true })
    .click();
  await page.getByLabel("Price", { exact: true }).fill("25.00");
  await page.getByLabel("Stock", { exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Create product", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Product added" }),
  ).toBeVisible();
  await expect(
    page.getByText("Browser Test Scarf", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Browser Test Scarf", exact: true })
    .click();
  await page.getByLabel("Short subtitle").fill("Edited after creation");
  await page.getByRole("button", { name: "Save product", exact: true }).click();
  await expect(
    page.getByText("1 styles · Edited after creation"),
  ).toBeVisible();
  for (const name of [
    "Footer & settings",
    "Analytics",
    "Connections",
    "Orders",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("navigation", { name: "Dashboard sections" }),
    ).toBeVisible();
    await page.waitForTimeout(200);
  }
  await page
    .getByRole("button", { name: "Footer & settings", exact: true })
    .click();
  const fee = page.getByLabel("Delivery fee", { exact: true });
  await fee.fill("");
  await fee.pressSequentially("3.45");
  await expect(fee).toHaveValue("3.45");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Store content saved" }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/store")).json()).checkout
      .shippingInCents,
  ).toBe(345);
  await fee.fill("0");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(fee).toHaveValue("0.00");
  await page.getByRole("button", { name: "Products", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete Browser Test Scarf", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete product", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Product deleted" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".dashboard-header .admin-mobile-menu").click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.screenshot({
    path: "screenshots/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("cash-on-delivery checkout, durable confirmation, order details and analytics", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Add to Cart", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Open shopping cart", exact: true })
    .click();
  await page.getByRole("button", { name: "Proceed to Checkout" }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await expect(
    page.getByText("Cash on delivery", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("input[type=radio][disabled]")).toHaveCount(0);
  await page.getByLabel("Full name").fill("Browser Customer");
  await page
    .getByLabel("Phone number", { exact: true })
    .fill("+1 555 123 4567");
  await page.getByLabel("Email (optional)").fill("browser@example.com");
  await page.getByLabel("Country", { exact: true }).fill("United States");
  await page
    .getByLabel("Street address / building / apartment")
    .fill("123 Browser Street");
  await page.getByLabel("City", { exact: true }).fill("Portland");
  await page
    .getByLabel("Delivery notes (optional)")
    .fill("Leave at the front door.");
  await page.screenshot({ path: "screenshots/checkout.png", fullPage: true });
  await page
    .getByRole("button", { name: "Place order · Cash on delivery" })
    .click();
  await expect(page).toHaveURL(/\/success#/);
  await expect(page.getByText("Delivery to Browser Customer")).toBeVisible();
  await expect(page.getByText("Total due on delivery: $65.00")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Delivery to Browser Customer")).toBeVisible();
  await page.screenshot({
    path: "screenshots/confirmation.png",
    fullPage: true,
  });
  await login(page);
  await page.getByRole("button", { name: "Orders", exact: true }).click();
  await expect(
    page.getByText("Browser Customer", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toContainText("123 Browser Street");
  await expect(page.getByRole("dialog")).toContainText(
    "Leave at the front door.",
  );
  await page.getByRole("button", { name: "Close order" }).click();
  await page.getByRole("button", { name: "Analytics", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Visitor journeys", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "screenshots/analytics.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("product detail cart and every original footer route work", async ({
  page,
}) => {
  await page.goto("/product/alpaca-scarf");
  await expect(page.getByText("$65.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Grey", exact: true }).click();
  await expect(page.getByText("$52.00", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await page.getByRole("button", { name: "View Cart", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "Shopping Cart", exact: true }),
  ).toBeVisible();
  for (const route of ["/shop", "/about", "/contact", "/privacy", "/terms"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
  }
});
