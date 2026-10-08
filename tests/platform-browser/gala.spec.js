import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("store-language", "en");
    } catch {}
  });
});
for (const width of [390, 1440])
  test(`GALA ${width}: catalogue, variants, saved items, search and cart`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/demo/gala");
    await expect(page.locator(".pcard")).toHaveCount(8);
    await expect(page.locator(".gala-store h1")).toHaveText("MAISON VERE");
    expect(
      await page
        .locator(".gala-store")
        .evaluate((e) =>
          getComputedStyle(e).getPropertyValue("--th-accent").trim(),
        ),
    ).toBe("#c23b6b");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("textbox", { name: "Search products" }).fill("Wool");
    await expect(page.locator(".sr-item")).toHaveCount(1);
    await page.locator(".sr-item").click();
    await expect(page.locator(".pd-info h1")).toHaveText("Wool Overcoat");
    await page
      .getByRole("combobox", { name: "Size", exact: true })
      .selectOption("M");
    await page
      .getByRole("combobox", { name: "Colour", exact: true })
      .selectOption("Charcoal");
    await page.locator(".btn-atc").click();
    await expect(
      page.getByRole("dialog", { name: "Shopping cart" }),
    ).toBeVisible();
    await expect(page.locator(".gala-cart-line")).toContainText("M / Charcoal");
    await page
      .getByRole("button", { name: "Increase quantity", exact: true })
      .last()
      .click();
    await expect(page.getByRole("dialog").getByRole("spinbutton")).toHaveValue(
      "2",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto("/demo/gala/shop?collection=tops");
    await expect(page.locator(".pcard")).toHaveCount(2);
    await page.locator(".pcard-wish").first().click();
    await page.goto("/demo/gala/saved");
    await expect(page.locator(".pcard")).toHaveCount(1);
    await page.reload();
    await expect(page.locator(".pcard")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
test("GALA mobile: menu, filters, FAQ and Arabic stay within viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/gala");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Navigation menu" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close menu" }).click();
  await page.locator(".faq-q").first().click();
  await expect(page.locator(".faq-a").first()).toContainText(
    "carefully curated",
  );
  await page.goto("/demo/gala/shop");
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Filters" });
  await modal.getByLabel("Out of Stock", { exact: true }).click();
  await expect(modal.getByLabel("Out of Stock", { exact: true })).toBeChecked();
  await modal.getByRole("button", { name: "Show products" }).click();
  await expect(
    page.getByRole("heading", { name: "No products found" }),
  ).toBeVisible();
  await page.locator(".gala-language").click();
  await expect(page.locator(".gala-store")).toHaveAttribute("dir", "rtl");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("GALA merchant: contact and newsletter arrive in dedicated dashboard; design saves and preview renders", async ({
  page,
}) => {
  await page.goto("/s/gala-browser/contact");
  await page.getByLabel("Name", { exact: true }).fill("GALA customer");
  await page
    .getByLabel("Email", { exact: true })
    .fill("gala-browser@example.test");
  await page.getByLabel("Message", { exact: true }).fill("Do you have size M?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status").first()).toContainText(
    "Message received",
  );
  await page
    .getByRole("textbox", { name: "Email address for newsletter" })
    .fill("gala-browser@example.test");
  await page.getByRole("button", { name: "Subscribe", exact: true }).click();
  await expect(page.locator(".nl-form [role=status]")).toContainText(
    "subscribed",
  );
  await page.goto("/s/gala-browser/admin");
  await page.getByLabel("Store password").fill("test-private-password-123");
  await page.getByRole("button", { name: "Enter studio" }).click();
  await page
    .locator(".gs-sidebar")
    .getByRole("button", { name: "Customer messages", exact: true })
    .click();
  await expect(page.locator(".gs-inbox")).toContainText("Do you have size M?");
  await page.getByRole("button", { name: "Mark resolved" }).click();
  await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();
  await page
    .locator(".gs-sidebar")
    .getByRole("button", { name: "Newsletter", exact: true })
    .click();
  await expect(page.locator(".gs-inbox")).toContainText(
    "gala-browser@example.test",
  );
  await page
    .getByRole("button", { name: "GALA design studio", exact: true })
    .click();
  await expect(
    page.frameLocator("iframe").locator(".gala-store"),
  ).toBeVisible();
  await page
    .locator(".gs-design-nav")
    .getByRole("button", { name: "Section headings", exact: true })
    .click();
  const field = page
    .locator(".gs-inspector")
    .getByLabel("English", { exact: true })
    .nth(1);
  await field.fill("The latest edit");
  await page.getByRole("button", { name: "Publish changes" }).click();
  await expect(page.locator(".gs-notice")).toContainText("Changes published");
  await expect(
    page
      .frameLocator("iframe")
      .getByRole("heading", { name: "The latest edit" }),
  ).toBeVisible();
  await page.reload();
  await page
    .locator(".gs-design-nav")
    .getByRole("button", { name: "Section headings", exact: true })
    .click();
  await expect(
    page.locator(".gs-inspector").getByLabel("English", { exact: true }).nth(1),
  ).toHaveValue("The latest edit");
});
test("GALA checkout creates a real cash-on-delivery order with a selected variant", async ({
  page,
}) => {
  await page.goto("/s/gala-browser/product/heavyweight-tee");
  await page.locator(".btn-buynow").click();
  await expect(page).toHaveURL(/checkout/);
  await page.getByLabel("Full name").fill("GALA Buyer");
  await page.getByLabel("Phone number").fill("01234567890");
  await page.getByLabel("Email (optional)").fill("gala-buyer@example.test");
  await page
    .getByLabel("Street address / building / apartment")
    .fill("10 Store Street");
  await page.getByLabel("City").fill("Cairo");
  await page.getByLabel("Country").fill("Egypt");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page).toHaveURL(/success/);
  await expect(page.getByText(/confirmed|received/i).first()).toBeVisible();
});
