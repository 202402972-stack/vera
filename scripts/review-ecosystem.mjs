// Capture additional onboarding and merchant mobile evidence against the temporary platform browser fixture server.
import { chromium, expect } from "@playwright/test";
process.env.PLAYWRIGHT_SKIP_FONT_READY = "1";
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
try {
  for (const language of ["ar", "en"]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addCookies([
      {
        name: "vera_session",
        value: "fixture-alice",
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    await context.addInitScript(
      (l) => localStorage.setItem("store-language", l),
      language,
    );
    const page = await context.newPage();
    const base = "http://127.0.0.1:3300";
    await page.goto(base + "/workspace");
    await expect(page.locator(".v-store-card")).toHaveCount(3);
    await page.screenshot({
      path: `screenshots/ecosystem/stores-${language}-390.png`,
      fullPage: true,
    });
    const stores = (
      await (await page.request.get(base + "/api/platform/stores")).json()
    ).stores;
    const s = stores.find((x) => x.slug === "form-browser");
    await page.goto(`${base}/workspace/stores/${s.id}/products`);
    await expect(page.locator(".admin-table-wrap tr")).toHaveCount(5);
    await expect(
      page.locator(".dashboard-main>div:not(.studio-page-heading)"),
    ).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: `screenshots/ecosystem/product-list-${language}-390.png`,
      fullPage: true,
    });
    await page.locator(".admin-action-button").first().click();
    await expect(page.locator(".admin-product-editor")).toBeVisible();
    await expect(
      page.locator(".dashboard-main>div:not(.studio-page-heading)"),
    ).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: `screenshots/ecosystem/product-editor-${language}-390.png`,
      fullPage: true,
    });
    await page.goto(
      `${base}/workspace/new?template=${language === "ar" ? "atelier" : "form"}`,
    );
    await page
      .getByLabel(language === "ar" ? "اسم العلامة" : "Brand name", {
        exact: true,
      })
      .fill("Woven Studio");
    await page
      .getByLabel(language === "ar" ? "بلد البيع" : "Selling country", {
        exact: true,
      })
      .fill("Egypt");
    await expect(page.getByRole("status")).toContainText(
      language === "ar" ? "حُفظت المسودة" : "Draft saved",
    );
    await page
      .getByRole("button", {
        name: language === "ar" ? "التالي" : "Next",
        exact: true,
      })
      .click();
    await expect(page.locator(".v-template-choice")).toHaveCount(3);
    await page.screenshot({
      path: `screenshots/ecosystem/onboarding-${language}-390.png`,
      fullPage: true,
    });
    await context.close();
  }
} finally {
  await browser.close();
}
