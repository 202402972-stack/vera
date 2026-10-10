import { test, expect } from "@playwright/test";

for (const language of ["ar", "en"]) {
  for (const width of [390, 1440]) {
    test(`landing gallery keeps ${language} preview and actions synchronized at ${width}`, async ({
      page,
    }) => {
      await page.addInitScript(
        (lang) => localStorage.setItem("store-language", lang),
        language,
      );
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
        const { templates } = await (
          await page.request.get("/api/platform/config")
        ).json();
      await expect(page.locator(".v-header")).toHaveCSS("position", "fixed");
      const next = page.locator(".v-collection-controls > button").last();
      for (const template of ["atelier", "form", "gala"]) {
        await next.click();
        await expect(
          page.locator(".v-store-showcase .v-button"),
        ).toHaveAttribute("href", `/login?intent=create&template=${template}`);
        await expect(
          page.locator(".v-store-showcase .v-text-link"),
        ).toHaveAttribute("href", `/demo/${template}`);
          await expect(page.locator(".v-showcase-device img")).toHaveAttribute(
            "src",
            templates.find((item) => item.id === template).image,
          );
        await expect(
          page.locator(".v-portrait[aria-pressed=true]"),
        ).toHaveCount(1);
        const selected = page.locator(
          ".v-collection-track article.is-selected",
        );
        await expect(selected.locator("h3")).toHaveText(
          template === "atelier" ? "The Atelier" : template.toUpperCase(),
        );
      }
      if (width < 768) {
        // Native horizontal scrolling (including RTL) must update the selected template.
        await page
          .locator(".v-collection-track article")
          .nth(2)
          .evaluate((e) =>
            e.scrollIntoView({
              block: "nearest",
              inline: "center",
              behavior: "instant",
            }),
          );
        await expect(
          page.locator(".v-store-showcase .v-button"),
        ).toHaveAttribute("href", /template=form$/);
        await page.locator(".v-menu").click();
        await page.locator('.v-nav a[href="/#pricing"]').click();
        await expect(page.locator(".v-nav")).not.toBeVisible();
        await expect(page).toHaveURL(/#pricing$/);
      }
      await page.locator(".v-dashboard-frame").scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          page
            .locator(".v-dashboard-frame img")
            .evaluate((e) => e.naturalWidth),
        )
        .toBe(width < 768 ? 390 : 1440);
      const image = await page
        .locator(".v-dashboard-frame img")
        .evaluate((e) => ({
          original: e.naturalWidth / e.naturalHeight,
          shown: e.clientWidth / e.clientHeight,
        }));
      expect(Math.abs(image.original - image.shown)).toBeLessThan(0.005);
      await page.locator(".v-hero .v-button").click();
      await expect(page).toHaveURL(/\/login\?intent=create$/);
      await expect(page.locator(".v-landing")).toHaveCount(0);
      await expect(page.locator(".v-header")).toHaveCSS("position", "absolute");
    });
  }
}
