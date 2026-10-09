import { test, expect } from "@playwright/test";
const openNav = async (page) => {
  await page.locator(".admin-tabs").waitFor({ state: "attached" });
  if (!(await page.locator(".admin-tabs").isVisible()))
    await page.locator(".dashboard-header .admin-mobile-menu").click();
};
for (const locale of ["en", "ar"]) {
  test(`populated analytics and dashboard hero fit mobile in ${locale}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (language) => localStorage.setItem("store-language", language),
      locale,
    );
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto("/");
    await expect(page.locator(".store-theme")).toBeVisible();
    const originalColors = await page.evaluate(() => ({
      background: getComputedStyle(document.querySelector(".store-theme"))
        .getPropertyValue("--background")
        .trim(),
      primary: getComputedStyle(document.querySelector(".store-theme"))
        .getPropertyValue("--primary")
        .trim(),
    }));
    const session = crypto.randomUUID();
    const long = (
      locale === "ar"
        ? "منتج_باسم_طويل_جداً_"
        : "very_long_product_and_campaign_name_"
    ).repeat(12);
    const analytics = await page.request.post("/api/analytics", {
      data: {
        visitor: crypto.randomUUID(),
        session,
        referrer: `https://${"referrer".repeat(20)}.example.com/`,
        source: long,
        medium: long,
        campaign: long,
        events: [
          {
            id: crypto.randomUUID(),
            at: Date.now(),
            type: "page_view",
            path: `/product/${long}`,
          },
          {
            id: crypto.randomUUID(),
            at: Date.now(),
            type: "click",
            path: `/product/${long}`,
            label: long,
          },
        ],
      },
    });
    expect(analytics.status()).toBe(204);
    await page.goto("/admin");
    await page
      .getByLabel(
        locale === "ar" ? "كلمة مرور لوحة الإدارة" : "Dashboard password",
        { exact: true },
      )
      .fill("admin@admin");
    await page
      .getByRole("button", {
        name: locale === "ar" ? "الدخول إلى لوحة الإدارة" : "Enter dashboard",
        exact: true,
      })
      .click();
    await openNav(page);
    await expect(page.locator(".admin-tabs")).toBeVisible();
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 740 });
      await openNav(page);
      await page
        .getByRole("button", {
          name: locale === "ar" ? "التحليلات" : "Analytics",
          exact: true,
        })
        .click();
      await expect(page.locator(".analytics-breakdowns")).toBeVisible();
      await page
        .locator(".admin-analytics .admin-panel")
        .last()
        .scrollIntoViewIfNeeded();
      const overflow = await page.locator(".admin-scope").evaluate((scope) =>
        [
          ...scope.querySelectorAll(
            "header,header a,header button,section,.admin-panel,select,.admin-table-wrap,td,.admin-journey,.analytics-breakdown-row,.analytics-breakdown-count",
          ),
        ]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return (
              r.width && r.height && (r.left < -1 || r.right > innerWidth + 1)
            );
          })
          .map((el) => ({
            class: el.className,
            text: el.textContent.slice(0, 80),
          })),
      );
      expect(overflow).toEqual([]);
      for (const row of await page.locator(".analytics-breakdown-row").all()) {
        const label = await row
          .locator(".analytics-breakdown-label")
          .boundingBox();
        const count = await row
          .locator(".analytics-breakdown-count")
          .boundingBox();
        expect(label.y).toBe(count.y);
        expect(Math.max(label.x, count.x)).toBeGreaterThanOrEqual(
          Math.min(label.x + label.width, count.x + count.width),
        );
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390) {
        await page
          .locator(".analytics-breakdowns .admin-panel")
          .first()
          .screenshot({ path: `screenshots/analytics-list-${locale}.png` });
        await page
          .locator("header")
          .screenshot({ path: `screenshots/dashboard-header-${locale}.png` });
        await page.screenshot({
          path: `screenshots/analytics-populated-${locale}.png`,
          fullPage: true,
        });
      }
      await page
        .getByRole("button", {
          name: locale === "ar" ? "التسلسل الزمني" : "Timeline",
          exact: true,
        })
        .first()
        .click();
      await expect(page.locator(".admin-journey")).toBeVisible();
      expect(
        await page
          .locator(".admin-journey")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await openNav(page);
      await page
        .getByRole("button", {
          name: locale === "ar" ? "محتوى المتجر" : "Store content",
          exact: true,
        })
        .click();
      await page
        .getByLabel(locale === "ar" ? "عنوان القسم الرئيسي" : "Hero heading", {
          exact: true,
        })
        .scrollIntoViewIfNeeded();
      const hero = page
        .locator(".admin-image-picker")
        .filter({ has: page.locator(".hero") });
      await expect(hero).toBeVisible();
      expect(
        await hero.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      if (width === 390) {
        await hero.screenshot({
          path: `screenshots/hero-editor-${locale}.png`,
        });
        await page.screenshot({
          path: `screenshots/dashboard-hero-${locale}.png`,
          fullPage: true,
        });
      }
    }
    const adminColors = await page.locator(".admin-scope").evaluate((el) => ({
      background: getComputedStyle(el).getPropertyValue("--background").trim(),
      primary: getComputedStyle(el).getPropertyValue("--primary").trim(),
    }));
    expect(adminColors.background).toBe("42 25% 96%");
    expect(adminColors.background).not.toBe(originalColors.background);
    expect(parseInt(adminColors.primary.split(" ").at(-1))).toBeLessThan(
      parseInt(originalColors.primary.split(" ").at(-1)),
    );
  });
}
