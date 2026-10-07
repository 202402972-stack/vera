import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }, info) => {
  await page.setExtraHTTPHeaders({
    "X-Forwarded-For": `198.51.100.${30 + info.title.length}`,
  });
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
for (const language of ["en", "ar"]) {
  test(`login password controls stay inside the field in ${language}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (lang) => localStorage.setItem("store-language", lang),
      language,
    );
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin");
      const input = page.locator("#dashboard-password");
      const toggle = page.locator(".login-password-toggle");
      await input.fill("A test password");
      await expect(input).toHaveAttribute("type", "password");
      await toggle.click();
      await expect(input).toHaveAttribute("type", "text");
      await expect(input).toHaveValue("A test password");
      const field = await page.locator(".login-password-field").boundingBox();
      const eye = await toggle.boundingBox();
      const text = await input.boundingBox();
      expect(eye.x).toBeGreaterThanOrEqual(field.x);
      expect(eye.x + eye.width).toBeLessThanOrEqual(field.x + field.width);
      expect(
        Math.min(text.x + text.width, eye.x + eye.width) -
          Math.max(text.x, eye.x),
      ).toBeLessThanOrEqual(1);
      await toggle.click();
      await expect(input).toHaveAttribute("type", "password");
      await expect(page.locator(".login-monogram")).toHaveText("B");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    // A real language switch preserves the entered password and the control.
    await page.locator(".dashboard-language").click();
    await expect(page.locator("#dashboard-password")).toHaveValue(
      "A test password",
    );
    await expect(page.locator(".login-password-toggle")).toBeVisible();
  });
}
test("mobile dashboard header hides downwards and returns upwards, desktop stays visible", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("store-language", "en"));
  await page.setViewportSize({ width: 390, height: 700 });
  await login(page);
  const header = page.locator(".dashboard-header");
  await page.locator(".dashboard-language").click();
  await page.evaluate(() => window.scrollTo(0, 650));
  await expect(header).toHaveClass(/is-scroll-hidden/);
  await expect
    .poll(() => header.evaluate((el) => el.getBoundingClientRect().bottom))
    .toBeLessThanOrEqual(0);
  await page.evaluate(() => window.scrollBy(0, -120));
  await expect(header).not.toHaveClass(/is-scroll-hidden/);
  await expect
    .poll(() =>
      header.evaluate((el) => Math.round(el.getBoundingClientRect().top)),
    )
    .toBe(0);
  await expect(page.locator(".welcome-emblem > span")).toHaveText("B");
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.evaluate(() => window.scrollTo(0, 800));
  await expect(header).not.toHaveClass(/is-scroll-hidden/);
  await expect(page.locator(".signature-mark")).toHaveText("B");
});
test("available style and quantity controls respect inventory and the existing bag", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("store-language", "en"));
  await login(page);
  const original = await (
    await page.request.get("/api/admin/products/alpaca-beanie")
  ).json();
  const id = "quantity-regression";
  const response = await page.request.post("/api/admin/products", {
    data: {
      ...original,
      id,
      title: "Quantity regression",
      variants: [
        {
          ...original.variants[0],
          id: `${id}-empty`,
          title: "Empty style",
          manage_inventory: true,
          inventory_quantity: 0,
        },
        {
          ...original.variants[0],
          id: `${id}-available`,
          title: "Available style",
          manage_inventory: true,
          inventory_quantity: 2,
        },
      ],
    },
  });
  expect(response.ok()).toBeTruthy();
  try {
    await page.goto(`/product/${id}`);
    await expect(
      page.getByRole("button", { name: "Available style", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const plus = page.getByRole("button", {
      name: "Increase quantity",
      exact: true,
    });
    await plus.click();
    await expect(plus).toBeDisabled();
    await page
      .getByRole("button", { name: "Add to Cart", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Add to Cart", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("This style is already fully in your bag."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Empty style · Sold out", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Sold out", exact: true }),
    ).toBeDisabled();
    await expect(plus).toBeDisabled();
  } finally {
    await page.request.delete(`/api/admin/products/${id}`);
  }
});
test("an overview order opens its own private detail and survives reload", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("store-language", "en"));
  await login(page);
  const orderResponse = await page.request.post("/api/orders", {
    data: {
      idempotency_key: crypto.randomUUID(),
      customer: {
        name: "Direct order customer",
        phone: "+201234567890",
        address: "12 Test Lane",
        city: "Cairo",
        country: "Egypt",
      },
      payment_method: "cod",
      items: [{ variant_id: "alpaca-beanie-oat", quantity: 1 }],
    },
  });
  expect(orderResponse.ok()).toBeTruthy();
  const { order } = await orderResponse.json();
  await page.reload();
  await page
    .locator(`.recent-orders a[href="/admin?tab=orders&order=${order.id}"]`)
    .click();
  await expect(page.getByRole("dialog")).toContainText(order.number);
  await page.reload();
  await expect(page.getByRole("dialog")).toContainText(order.number);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(new URL(page.url()).searchParams.has("order")).toBe(false);
});
test("Home menu link returns from a secondary store page", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("store-language", "en"));
  await page.goto("/about");
  await page.locator(".store-menu-trigger").click();
  await page
    .locator("#store-menu-panel")
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { name: "Handcrafted Alpaca Wool Luxury" }),
  ).toBeVisible();
});
