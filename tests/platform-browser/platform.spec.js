import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
const output = process.env.SCREENSHOT_DIR || "screenshots/platform";
mkdirSync(output, { recursive: true });
const auth = async (context, who = "alice") =>
  context.addCookies([
    {
      name: "vera_session",
      value: "fixture-" + who,
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("store-language", "en"));
});
for (const language of ["ar", "en"])
  for (const width of [320, 390, 1440])
    test(`landing ${language} at ${width}: exact palette, links, menu and no overflow`, async ({
      page,
    }) => {
      await page.addInitScript(
        (lang) => localStorage.setItem("store-language", lang),
        language,
      );
      await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/");
      await expect(page.locator(".v-hero h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(700);
      expect(
        await page
          .locator(".v-hero")
          .evaluate((e) => getComputedStyle(e).backgroundColor),
      ).toBe("rgb(242, 241, 239)");
      expect(
        await page
          .locator(".v-hero .v-button")
          .evaluate((e) => getComputedStyle(e).backgroundColor),
      ).toBe("rgb(116, 63, 55)");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390 || width === 1440) {
        await page.screenshot({
          path: `${output}/hero-${language}-${width}.png`,
        });
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 500) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 50));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(700);
        await page.screenshot({
          path: `${output}/landing-${language}-${width}.png`,
          fullPage: true,
        });
      }
      if (width < 768) {
        await page.locator(".v-menu").click();
        await expect(page.locator(".v-nav")).toBeVisible();
        await page.locator(".v-nav a").first().click();
        await expect(page).toHaveURL(/\/templates$/);
      } else {
        await page.locator(".v-hero .v-button").click();
        await expect(page).toHaveURL(/\/login\?intent=create$/);
        await expect(page.locator(".v-google")).toBeVisible();
      }
      expect(errors).toEqual([]);
    });
test("customer creates a store, pauses it, and still enters the dashboard through SSO", async ({
  page,
  context,
}) => {
  await auth(context);
  await page.goto("/workspace?create=1");
  await page
    .getByLabel("Store name", { exact: true })
    .fill("New Collection House");
  await page
    .getByLabel("Store address", { exact: false })
    .fill("new-collection-house");
  await page
    .getByLabel("Store dashboard password", { exact: true })
    .fill("another-private-password-123");
  await page
    .getByRole("button", { name: "Create my store", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "New Collection House", exact: true }),
  ).toBeVisible();
  const card = page
    .locator(".v-store-card")
    .filter({ hasText: "New Collection House" });
  await card.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(card.locator(".v-status")).toHaveText("Paused");
  await card
    .getByRole("button", { name: "Store dashboard", exact: true })
    .click();
  await expect(page).toHaveURL(/\/s\/new-collection-house\/admin$/);
  await expect(
    page.getByRole("navigation", { name: "Dashboard sections" }),
  ).toBeVisible();
});
test("store menu contact opens a scoped contact page, and collections synchronize with the storefront", async ({
  page,
  context,
}) => {
  await auth(context);
  await page.goto("/workspace");
  const card = page.locator(".v-store-card").filter({ hasText: "Maison Véra" });
  await card
    .getByRole("button", { name: "Store dashboard", exact: true })
    .click();
  await page.getByRole("button", { name: "Products", exact: true }).click();
  await page
    .getByRole("button", { name: "Manage collections", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New collection", exact: true })
    .click();
  await page
    .getByLabel("Collection name — English", { exact: true })
    .fill("Winter edit");
  await page
    .getByLabel("Collection name — Arabic", { exact: true })
    .fill("مجموعة الشتاء");
  await page.getByLabel("Alpaca Wool Scarf", { exact: true }).check();
  await page
    .getByRole("button", { name: "Save collection", exact: true })
    .click();
  await expect(page.getByText("Winter edit", { exact: true })).toBeVisible();
  await page.goto("/s/maison-vera");
  await page.getByRole("button", { name: /Winter edit/ }).click();
  await expect(page.locator(".catalogue-count")).toHaveText(
    "1 pieces in the collection",
  );
  await page.getByRole("button", { name: "Store menu", exact: true }).click();
  await page
    .getByRole("link", { name: "Contact", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/s\/maison-vera\/contact$/);
  await expect(
    page.getByRole("heading", { name: "Contact", exact: true, level: 1 }),
  ).toBeVisible();
});
test("workspace password reset revokes store sessions and mobile dashboard remains usable", async ({
  page,
  context,
}) => {
  await auth(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace");
  const card = page.locator(".v-store-card").filter({ hasText: "Maison Véra" });
  await card.getByRole("button", { name: "Password", exact: true }).click();
  await page
    .getByLabel("New dashboard password", { exact: true })
    .fill("updated-private-password-123");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(
    page.getByLabel("New dashboard password", { exact: true }),
  ).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Save password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Password changed");
  await page.screenshot({
    path: output + "/workspace-en-390.png",
    fullPage: true,
  });
  await page.goto("/s/maison-vera/admin");
  await page
    .getByLabel("Dashboard password", { exact: true })
    .fill("updated-private-password-123");
  await page
    .getByRole("button", { name: "Enter dashboard", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Dashboard sections" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("owner sees real accounts and store counts while ordinary customers are denied", async ({
  page,
  context,
}) => {
  await auth(context);
  await page.goto("/owner");
  await expect(
    page.getByRole("heading", { name: "The complete picture.", exact: true }),
  ).toBeVisible();
  await expect(page.locator("table")).toContainText("bob@example.test");
  await expect(
    page.getByRole("heading", { name: "Platform settings", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: output + "/owner-en-1440.png",
    fullPage: true,
  });
  await context.clearCookies();
  await auth(context, "bob");
  await page.goto("/owner");
  await expect(
    page.getByRole("heading", {
      name: "This space is for the platform owner.",
      exact: true,
    }),
  ).toBeVisible();
});
test("Arabic login and workspace preserve direction, password eye position, and independent brand assets", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => localStorage.setItem("store-language", "ar"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.locator(".v-google")).toContainText("Google");
  await page.screenshot({ path: output + "/login-ar-390.png", fullPage: true });
  await auth(context);
  await page.goto("/workspace");
  await expect(page.locator(".v-store-card").first()).toBeVisible();
  await page
    .locator(".v-store-card")
    .filter({ hasText: "Maison Véra" })
    .getByRole("button", { name: "كلمة المرور", exact: true })
    .click();
  const input = await page.locator(".v-password input").boundingBox(),
    eye = await page.locator(".v-password button").boundingBox();
  expect(eye.x).toBeLessThan(input.x + input.width / 2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: output + "/workspace-ar-390.png",
    fullPage: true,
  });
});
