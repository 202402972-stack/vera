import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }, info) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `192.0.2.${110 + (info.testId.length % 80)}`,
  });
  await page.addInitScript(() => localStorage.setItem("store-language", "en"));
});
async function login(page) {
  await page.goto("/admin");
  await page
    .getByLabel("Dashboard password", { exact: true })
    .fill("admin@admin");
  await page
    .getByRole("button", { name: "Enter dashboard", exact: true })
    .click();
  await expect(page.locator(".admin-tabs")).toBeVisible();
}
async function restore(page, original) {
  const current = await (await page.request.get("/api/admin/store")).json();
  const response = await page.request.put("/api/admin/store", {
    data: { ...original, _version: current._version },
  });
  expect(response.ok()).toBeTruthy();
}

test("brand customization publishes actual storefront tokens and protects unsaved changes", async ({
  page,
}) => {
  await login(page);
  const original = await (await page.request.get("/api/admin/store")).json();
  try {
    await page
      .getByRole("button", { name: "Brand studio", exact: true })
      .click();
    await page.getByLabel("Store name", { exact: true }).fill("Maison Aurelia");
    await page
      .getByRole("button", { name: "Forest house", exact: true })
      .click();
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: "Orders", exact: true }).click();
    await expect(page.locator(".brand-preview")).toBeVisible();
    await page.getByLabel("Announcement bar", { exact: false }).check();
    await page
      .getByLabel("Announcement", { exact: true })
      .fill("A collection made to last.");
    await page
      .getByRole("button", { name: "Publish brand", exact: true })
      .click();
    await expect(
      page.getByText("Changes published to your store."),
    ).toBeVisible();
    const storefront = await page.context().newPage();
    await storefront.goto("/");
    await expect(storefront.locator(".store-text-wordmark")).toHaveText(
      "Maison Aurelia",
    );
    await expect(storefront.locator(".store-announcement")).toHaveText(
      "A collection made to last.",
    );
    const color = await storefront.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim(),
    );
    expect(color).toBe("164 41% 24%");
    await storefront.reload();
    await expect(storefront.locator(".store-text-wordmark")).toHaveText(
      "Maison Aurelia",
    );
    await storefront.close();
  } finally {
    await restore(page, original);
  }
});

test("commerce settings, coupon, checkout, admin shipment and private receipt work together", async ({
  page,
}) => {
  test.setTimeout(90000);
  await login(page);
  const original = await (await page.request.get("/api/admin/store")).json();
  try {
    await page.getByRole("button", { name: "Commerce", exact: true }).click();
    await page.getByLabel("Delivery fee", { exact: true }).fill("5");
    await page.getByLabel("Free delivery from", { exact: true }).fill("100");
    await page.getByLabel("Tax rate (%)", { exact: true }).fill("10");
    await page.getByLabel("Delivery countries", { exact: true }).fill("Egypt");
    await page
      .getByRole("button", { name: "Publish settings", exact: true })
      .click();
    await expect(
      page.getByText("Changes published to your store."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add discount", exact: true })
      .click();
    const code = `STUDIO-${Date.now()}`;
    await page.getByLabel("Discount code", { exact: true }).fill(code);
    await page.getByLabel("Discount percentage", { exact: true }).fill("10");
    await page
      .getByRole("button", { name: "Save discount", exact: true })
      .click();
    await expect(page.locator(".discount-list")).toContainText(code);
    await page.goto("/");
    await page
      .getByRole("button", { name: "Add to Cart", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Open shopping cart", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Shopping Cart", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Open shopping cart", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Proceed to Checkout", exact: true })
      .click();
    await page.getByLabel("Full name", { exact: true }).fill("Studio Journey");
    await page
      .getByLabel("Phone number", { exact: true })
      .fill("+201234567890");
    await page.getByLabel("Country", { exact: true }).selectOption("Egypt");
    await page
      .getByLabel("Street address / building / apartment", { exact: true })
      .fill("12 Atelier Lane");
    await page.getByLabel("City", { exact: true }).fill("Cairo");
    await page.getByLabel("Discount code", { exact: true }).fill(code);
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.locator("aside")).toContainText("$69.35");
    await page
      .getByRole("button", {
        name: "Place order · Cash on delivery",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/success#/);
    const receiptUrl = page.url();
    await expect(
      page.getByText("Total due on delivery: $69.35", { exact: true }),
    ).toBeVisible();
    await page.goto("/admin?tab=orders");
    await page
      .getByPlaceholder("Search by order number, customer or phone…")
      .fill("Studio Journey");
    await page
      .getByRole("button", { name: "View", exact: true })
      .first()
      .click();
    await page.getByLabel("Carrier", { exact: true }).fill("Atelier Express");
    await page.getByLabel("Tracking number", { exact: true }).fill("AT-100");
    await page
      .getByLabel("Tracking URL", { exact: true })
      .fill("https://shipping.example/AT-100");
    await page
      .getByLabel("Update order status", { exact: true })
      .selectOption("shipped");
    await page.getByRole("button", { name: "Update", exact: true }).click();
    await expect(
      page.getByText("Order status updated.", { exact: true }),
    ).toBeVisible();
    await page.goto(receiptUrl);
    await expect(
      page.getByRole("link", { name: "Track shipment", exact: true }),
    ).toHaveAttribute("href", "https://shipping.example/AT-100");
    await expect(page.locator('[aria-current="step"]')).toHaveText("shipped");
  } finally {
    await restore(page, original);
  }
});

test("search, recovery, contacts and unknown pages remain usable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("e-commerce-cart", '{"broken":true}'),
  );
  await page.goto("/");
  await page
    .getByRole("searchbox", { name: "Search collection" })
    .fill("no-such-piece");
  await expect(
    page.getByRole("heading", { name: "No pieces found." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(
    page.getByRole("heading", { name: "Alpaca Wool Scarf", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "Search collection" })
    .fill("beanie");
  await expect(page.locator(".catalogue-count")).toHaveText(
    "1 pieces in the collection",
  );
  await page.goto("/contact");
  await expect(page.locator('main a[href^="mailto:"]')).toHaveAttribute(
    "href",
    "mailto:hello@yourexample.com",
  );
  const missing = await page.goto("/does-not-exist");
  expect(missing.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This page has moved on." }),
  ).toBeVisible();
  let fail = true;
  await page.route("**/api/store", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Unavailable" }),
        })
      : route.continue(),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "We could not load the store",
  );
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Handcrafted Alpaca Wool Luxury" }),
  ).toBeVisible();
});
