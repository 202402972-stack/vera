import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
const output = "screenshots/ecosystem";
mkdirSync(output, { recursive: true });
const auth = (context) =>
  context.addCookies([
    {
      name: "vera_session",
      value: "fixture-alice",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
for (const language of ["ar", "en"])
  for (const width of [360, 390, 430, 768, 1440]) {
    test(`FORM and Atelier catalogue identity ${language} ${width}`, async ({
      page,
    }) => {
      await page.addInitScript(
        (l) => localStorage.setItem("store-language", l),
        language,
      );
      await page.setViewportSize({ width, height: 1000 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      for (const slug of ["form-browser", "maison-vera"]) {
        await page.goto("/s/" + slug + "/shop");
        await expect(
          page
            .locator(
              slug === "form-browser"
                ? ".form-product"
                : ".atelier-grid article",
            )
            .first(),
        ).toBeVisible();
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
          "href",
          page.url(),
        );
        await expect(page.locator("html")).toHaveAttribute(
          "dir",
          language === "ar" ? "rtl" : "ltr",
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        await page.screenshot({
          path: `${output}/${slug}-${language}-${width}.png`,
          fullPage: true,
        });
      }
      expect(errors).toEqual([]);
    });
  }
for (const language of ["ar", "en"])
  test(`mobile merchant edits saves and reopens a deep product ${language}`, async ({
    page,
    context,
  }) => {
    await auth(context);
    await page.addInitScript(
      (l) => localStorage.setItem("store-language", l),
      language,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    const stores = (
      await (await page.request.get("/api/platform/stores")).json()
    ).stores;
    const s = stores.find((x) => x.slug === "form-browser");
    await page.goto(`/workspace/stores/${s.id}/products`);
    await expect(
      page.locator(".admin-table-wrap tbody tr").first(),
    ).toBeVisible();
    await page.locator(".admin-action-button").first().click();
    await expect(page).toHaveURL(/product=/);
    const input = page.getByLabel(
      language === "ar" ? "وصف قصير" : "Short subtitle",
      { exact: true },
    );
    await input.fill(
      language === "ar" ? "تعديل الهاتف العربي" : "Edited on mobile",
    );
    const save = page.getByRole("button", {
      name: language === "ar" ? "حفظ المنتج" : "Save product",
      exact: true,
    });
    await expect(save).toBeInViewport();
    await save.click();
    await expect(page.locator(".admin-product-editor")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.locator(".admin-action-button").first().click();
    await page.reload();
    await expect(input).toHaveValue(
      language === "ar" ? "تعديل الهاتف العربي" : "Edited on mobile",
    );
    await expect(
      page.locator(".dashboard-main > div:not(.studio-page-heading)"),
    ).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: `${output}/product-editor-${language}-390.png`,
      fullPage: true,
    });
  });
test("FORM filter drawer applies explicitly, zoom closes by Escape and checkout creates a tracked guest order", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("store-language", "en"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/s/form-browser/shop");
  await page.getByRole("button", { name: /Filters/ }).click();
  const filters = page.getByRole("dialog", { name: "Refine your collection" });
  await filters.getByLabel("In stock", { exact: true }).check();
  await filters
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page).toHaveURL(/in_stock=1/);
  await page.locator('a[href*="/product/"]').first().click();
  await page.getByRole("button", { name: "Zoom image", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Add to bag", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Your bag" })).toBeVisible();
  await page
    .getByRole("link", { name: "Continue to checkout", exact: true })
    .click();
  await page.getByLabel("Full name", { exact: true }).fill("FORM guest buyer");
  await page.getByLabel("Phone number", { exact: true }).fill("01234567890");
  await page
    .getByLabel("Email (optional)", { exact: true })
    .fill("form-guest@fixture.test");
  await page
    .getByLabel("Street address / building / apartment", { exact: true })
    .fill("10 Test Street");
  await page.getByLabel("City", { exact: true }).fill("Cairo");
  await page.getByLabel("Country", { exact: true }).fill("Egypt");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page).toHaveURL(/success/);
  await expect(page.getByText(/confirmed|received/i).first()).toBeVisible();
  await page.screenshot({
    path: `${output}/form-guest-order-390.png`,
    fullPage: true,
  });
  const receipt = page.url();
  await page.goto("/s/form-browser/account");
  await page.getByLabel("Receipt link or token", { exact: true }).fill(receipt);
  await page
    .getByRole("button", { name: "Find my order", exact: true })
    .click();
  await expect(page.locator(".form-order")).toBeVisible();
});
test("Atelier saved catalogue and guest purchase work without sample-only routing", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("store-language", "en"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/s/maison-vera/shop");
  await page
    .getByRole("button", { name: "Save piece", exact: true })
    .first()
    .click();
  await page.goto("/s/maison-vera/saved");
  await expect(page.locator(".atelier-grid article")).toHaveCount(1);
  await page.locator(".atelier-grid a").first().click();
  await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await page.goto("/s/maison-vera/checkout");
  await page.getByLabel("Full name", { exact: true }).fill("Atelier guest");
  await page.getByLabel("Phone number", { exact: true }).fill("01234567890");
  await page
    .getByLabel("Street address / building / apartment", { exact: true })
    .fill("11 Test Street");
  await page.getByLabel("City", { exact: true }).fill("Cairo");
  await page.getByLabel("Country", { exact: true }).fill("Egypt");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page).toHaveURL(/success/);
  await page.screenshot({
    path: `${output}/atelier-guest-order-390.png`,
    fullPage: true,
  });
});
test("import wizard reads Arabic CSV, reviews a missing price and preserves the durable report after reload", async ({
  page,
  context,
}) => {
  await auth(context);
  await page.addInitScript(() => localStorage.setItem("store-language", "ar"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace/import");
  await page.locator("input[type=file]").setInputFiles({
    name: "products.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "معرف,الاسم,الصورة,السعر,العملة,المخزون\nsource-ar,قطعة عربية,https://example.com/image.png,,EGP,\n",
    ),
  });
  await page.locator("form.v-panel input[type=checkbox]").check();
  await page.getByRole("button", { name: "اقرأ المصدر", exact: true }).click();
  await expect(page.locator(".import-item")).toContainText("قطعة عربية");
  await expect(page.locator(".import-item")).toContainText("صحح سعر");
  await page.getByLabel("السعر المؤكد", { exact: true }).fill("100.50");
  await page.getByLabel("مخزون هذا المتغير", { exact: true }).fill("3");
  await page.getByLabel("حدد للنقل", { exact: true }).check();
  await page
    .getByRole("button", { name: "احفظ المراجعة", exact: true })
    .click();
  await expect
    .poll(async () => {
      const jobs = await (
        await page.request.get("/api/platform/import-jobs")
      ).json();
      return jobs.jobs.find((j) => j.sourceType === "csv")?.counts.review;
    })
    .toBe(1);
  await page.screenshot({
    path: `${output}/import-review-ar-390.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.reload();
  await page.locator(".import-job-row").first().click();
  await expect(page.locator(".import-item")).toContainText("قطعة عربية");
});
