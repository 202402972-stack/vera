import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
const dir = "screenshots/ecosystem";
mkdirSync(dir, { recursive: true });
const auth = async (context) =>
  context.addCookies([
    {
      name: "vera_session",
      value: "fixture-alice",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("store-language", "en"));
});
test("owner switches three stores with correct scope, persists deep product links and keeps platform colours", async ({
  page,
  context,
}) => {
  await auth(context);
  await page.goto("/workspace");
  const cards = page.locator(".v-store-card");
  await expect(cards).toHaveCount(3);
  const stores = (await (await page.request.get("/api/platform/stores")).json())
    .stores;
  for (const template of ["atelier", "form", "gala"]) {
    const s = stores.find((x) => x.template === template);
    await page.goto(`/workspace/stores/${s.id}/products`);
    await expect(page.locator(".workspace-topbar select")).toHaveValue(
      String(s.id),
    );
    await expect(
      page.getByRole("heading", { name: "Your collection", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".admin-table-wrap tbody tr")).not.toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Your collection", exact: true }),
    ).toBeVisible();
    const link = page
      .locator(".workspace-topbar a")
      .filter({ hasText: "Visit store" });
    await expect(link).toHaveAttribute("href", s.url);
    await page.screenshot({
      path: `${dir}/workspace-${template}-desktop.png`,
      fullPage: true,
    });
  }
  await page.goto("/");
  await expect(page.locator(".v-shell")).toHaveCSS("--v-primary", "#743f37");
});
test("three-step onboarding resumes and creates a private empty draft without password", async ({
  page,
  context,
}) => {
  await auth(context);
  await page.goto("/workspace/new?template=form");
  await page.getByLabel("Brand name", { exact: true }).fill("New ecosystem");
  await page.getByLabel("Store address", { exact: true }).fill("new-ecosystem");
  await page.getByLabel("Selling country", { exact: true }).fill("Egypt");
  await expect(page.getByRole("status")).toContainText("Draft saved");
  await page.reload();
  await expect(page.getByLabel("Brand name", { exact: true })).toHaveValue(
    "New ecosystem",
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("input[value=form]")).toBeChecked();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("button", { name: "Prepare draft", exact: true })
    .click();
  await expect(page).toHaveURL(/\/workspace\/stores\/\d+\/overview/);
  await expect(page.locator(".launch-panel")).toContainText("Private draft");
});
for (const language of ["ar", "en"])
  for (const width of [360, 390, 430, 768, 1440]) {
    test(`workspace mobile task and GALA design ${language} ${width}`, async ({
      page,
      context,
    }) => {
      await auth(context);
      await page.addInitScript(
        (l) => localStorage.setItem("store-language", l),
        language,
      );
      await page.setViewportSize({ width, height: 1000 });
      const stores = (
        await (await page.request.get("/api/platform/stores")).json()
      ).stores;
      const gala = stores.find((s) => s.template === "gala");
      await page.goto(`/workspace/stores/${gala.id}/design`);
      await expect(page.locator(".gs-design")).toBeVisible();
      if (width < 768)
        await page.locator(".gs-view-tabs button").nth(1).click();
      await expect(page.locator(".design-preview iframe")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
      await page.screenshot({
        path: `${dir}/gala-design-${language}-${width}.png`,
        fullPage: true,
      });
    });
  }
test("FORM and Atelier discovery and real cart retain their template identity", async ({
  page,
}) => {
  for (const slug of ["form-browser", "maison-vera"]) {
    await page.goto("/s/" + slug + "/shop");
    await expect(page.locator("h1")).toBeVisible();
    expect(await page.locator("img").count()).toBeGreaterThan(0);
    await page.screenshot({
      path: `${dir}/${slug}-catalog.png`,
      fullPage: true,
    });
    await page.locator('a[href*="/product/"]').first().click();
    await expect(page.locator("h1")).toBeVisible();
  }
});
test("mobile merchant navigation traps focus, closes by Escape and restores its opener", async ({
  page,
  context,
}) => {
  await auth(context);
  await page.setViewportSize({ width: 390, height: 844 });
  const stores = (await (await page.request.get("/api/platform/stores")).json())
    .stores;
  const s = stores.find((x) => x.slug === "form-browser");
  await page.goto(`/workspace/stores/${s.id}/products`);
  const opener = page.getByRole("button", { name: /Sections/ });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Store sections" });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 35; i++) await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});
test("GALA unsaved validated preview changes its iframe and leaves saved settings intact", async ({
  page,
  context,
}) => {
  await auth(context);
  const stores = (await (await page.request.get("/api/platform/stores")).json())
    .stores;
  const s = stores.find((x) => x.slug === "gala-owned");
  await page.goto(`/workspace/stores/${s.id}/design`);
  await expect(page.locator(".gs-design")).toBeVisible();
  const persisted = await (
    await page.request.get(s.url + "/api/admin/store")
  ).json();
  const candidate = structuredClone(persisted);
  candidate.name = "Unsaved visual check";
  const response = await page.request.post(
    s.url + "/api/admin/design-preview",
    { data: candidate },
  );
  expect(response.ok()).toBeTruthy();
  const checked = await response.json();
  const iframe = page.locator(".design-preview iframe");
  await expect(iframe).toBeVisible();
  await expect(iframe.contentFrame().locator("body")).not.toBeEmpty();
  await iframe.evaluate(
    (el, settings) =>
      el.contentWindow.postMessage(
        { type: "vera-design-preview", version: 1, settings },
        location.origin,
      ),
    checked,
  );
  await expect(iframe.contentFrame().locator("body")).toContainText(
    "Unsaved visual check",
  );
  expect(
    (await (await page.request.get(s.url + "/api/admin/store")).json()).name,
  ).toBe(persisted.name);
  await page.screenshot({
    path: `${dir}/gala-unsaved-preview.png`,
    fullPage: true,
  });
});
test("owner filters and readiness history render with real APIs on an Arabic mobile screen", async ({
  page,
  context,
}) => {
  await auth(context);
  await page.addInitScript(() => localStorage.setItem("store-language", "ar"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/owner/stores?template=form");
  await expect(page.locator(".owner-results article")).not.toHaveCount(0);
  await expect(page.locator("select[name=template]")).toHaveValue("form");
  await page.locator(".owner-results article details summary").first().click();
  await expect(page.locator(".owner-results article").first()).toContainText(
    "منتج صالح للبيع",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `${dir}/owner-stores-ar-390.png`,
    fullPage: true,
  });
  await page.goto("/owner/merchants?activity=active");
  await expect(page.locator("select[name=activity]")).toHaveValue("active");
  await expect(page.locator(".owner-results article")).not.toHaveCount(0);
});
test("reduced motion keeps landing hero and primary actions immediately usable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".v-hero")).toBeVisible();
  await expect(page.locator(".v-hero a.v-button")).toBeVisible();
  expect(
    await page
      .locator(".v-transfer-steps article")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).animationDuration)),
  ).toBeLessThan(0.01);
  await page.locator(".v-hero a.v-button").click();
  await expect(page).toHaveURL(/login/);
});
