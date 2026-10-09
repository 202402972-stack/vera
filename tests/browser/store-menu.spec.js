import { test, expect } from "@playwright/test";
for (const locale of ["en", "ar"]) {
  test(`compact store menu stays aligned and works in ${locale}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (language) => localStorage.setItem("store-language", language),
      locale,
    );
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      const trigger = page.locator(".store-menu-trigger");
      const cart = page.locator(".store-header-actions > button");
      const panel = page.locator("#store-menu-panel");
      const buttons = await Promise.all([
        trigger.boundingBox(),
        cart.boundingBox(),
      ]);
      expect(buttons[0].width).toBe(buttons[1].width);
      expect(buttons[0].height).toBe(buttons[1].height);
      expect(buttons[0].y).toBe(buttons[1].y);
      expect(buttons[0].x).toBeGreaterThan(buttons[1].x);
      const icons = await Promise.all([
        trigger.locator("svg").boundingBox(),
        cart.locator("svg").boundingBox(),
      ]);
      expect(icons[0].width).toBe(icons[1].width);
      expect(icons[0].height).toBe(icons[1].height);
      expect(icons[0].y).toBe(icons[1].y);
      const hero = await page.locator("main > section").first().boundingBox();
      await trigger.click();
      await expect(panel).toBeVisible();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(panel.locator("a")).toHaveCount(7);
      await expect(panel.locator("button")).toHaveCount(1);
      const box = await panel.boundingBox();
      expect(box.width).toBeLessThanOrEqual(209);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await expect
        .poll(async () => {
          const menu = await panel.boundingBox();
          const button = await trigger.boundingBox();
          return Math.round(
            locale === "ar"
              ? menu.x - button.x
              : menu.x + menu.width - button.x - button.width,
          );
        })
        .toBe(0);
      expect(
        await page.locator("main > section").first().boundingBox(),
      ).toEqual(hero);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390)
        await page.screenshot({ path: `screenshots/store-menu-${locale}.png` });
      await page.evaluate(() => window.scrollTo(0, 450));
      const scrolled = await Promise.all([
        trigger.boundingBox(),
        cart.boundingBox(),
      ]);
      expect(scrolled[0].y).toBe(scrolled[1].y);
      expect(scrolled[0].y).toBe(buttons[0].y);
      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await page.mouse.click(1, 600);
      await expect(panel).toBeHidden();
      await trigger.click();
      await panel.locator('a[href="/#story"]').click();
      await expect(panel).toBeHidden();
      await expect
        .poll(() =>
          page
            .locator("#story")
            .evaluate((el) => Math.round(el.getBoundingClientRect().top)),
        )
        .toBe(96);
      await trigger.click();
      await panel.locator('a[href="/"]').click();
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
      await trigger.click();
      await panel.getByRole("button").click();
      await expect(page.locator("html")).toHaveAttribute(
        "lang",
        locale === "ar" ? "en" : "ar",
      );
      await expect(panel).toBeHidden();
      await trigger.click();
      await expect
        .poll(async () => {
          const menu = await panel.boundingBox();
          const button = await trigger.boundingBox();
          if (!menu) return 999;
          return Math.round(
            locale === "en"
              ? menu.x - button.x
              : menu.x + menu.width - button.x - button.width,
          );
        })
        .toBe(0);
      await page.keyboard.press("Escape");
      await page.evaluate(
        (language) => localStorage.setItem("store-language", language),
        locale,
      );
    }
  });
}
for (const locale of ["en", "ar"]) {
  test(`no extra menus or language buttons on product and dashboard in ${locale}`, async ({
    page,
  }) => {
    // Each regression represents a separate browser client behind the hosting proxy.
    await page.setExtraHTTPHeaders({
      "X-Forwarded-For": locale === "en" ? "192.0.2.81" : "192.0.2.82",
    });
    await page.addInitScript(
      (language) => localStorage.setItem("store-language", language),
      locale,
    );
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/product/alpaca-beanie");
      await expect(
        page.getByRole("link", {
          name: locale === "ar" ? "العودة إلى المجموعة" : "Back to Collection",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.locator(".language-toggle,.store-menu-trigger"),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390)
        await page.screenshot({
          path: `screenshots/product-no-language-${locale}.png`,
        });
      await page.goto("/admin");
      await expect
        .poll(() => page.locator("form,.admin-tabs").count())
        .toBeGreaterThan(0);
      await expect(
        page.locator(".language-toggle,.store-menu-trigger"),
      ).toHaveCount(0);
      if (await page.locator("form").count()) {
        await page
          .getByLabel(
            locale === "ar" ? "كلمة مرور لوحة الإدارة" : "Dashboard password",
            { exact: true },
          )
          .fill("admin@admin");
        await page
          .getByRole("button", {
            name:
              locale === "ar" ? "الدخول إلى لوحة الإدارة" : "Enter dashboard",
            exact: true,
          })
          .click();
      }
      if (!(await page.locator(".admin-tabs").isVisible()))
        await page.locator(".dashboard-header .admin-mobile-menu").click();
      await expect(page.locator(".admin-tabs")).toBeVisible();
      const tabs = await page.locator(".admin-tab").all();
      expect(tabs).toHaveLength(17);
      for (const tab of tabs) {
        const r = await tab.boundingBox();
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(width);
      }
      const last = await tabs.at(-1).boundingBox();
      const nav = await page.locator(".admin-tabs").boundingBox();
      if (width < 768) {
        expect(last.width).toBeGreaterThan(nav.width * 0.8);
        await page.keyboard.press("Escape");
        await expect(page.locator(".admin-tabs")).toBeHidden();
      } else {
        expect(last.width).toBeGreaterThan(nav.width * 0.25);
        expect(last.width).toBeLessThan(nav.width * 0.4);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.locator(".language-toggle,.store-menu-trigger"),
      ).toHaveCount(0);
      if (width === 390)
        await page.screenshot({
          path: `screenshots/dashboard-navigation-${locale}.png`,
        });
    }
  });
}
