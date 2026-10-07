// Standalone regression check against the unmodified supplied project.
// BASELINE_URL should point to an extracted original ZIP running Vite.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
const browser = await chromium.launch({ headless: true });
mkdirSync("screenshots", { recursive: true });
const results = [];
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  const pages = [];
  let baselineHeight;
  let mainHeight;
  for (const [label, url] of [
    ["original", process.env.BASELINE_URL || "http://127.0.0.1:3200"],
    ["updated", process.env.UPDATED_URL || "http://127.0.0.1:3300"],
  ]) {
    const page = await browser.newPage({ viewport });
    if (label === "original") {
      await page.route("https://fonts.googleapis.com/**", (route) =>
        route.fulfill({
          contentType: "text/css",
          body: readFileSync("public/assets/fonts.css", "utf8").replaceAll(
            "url(/assets/",
            `url(${url}/assets/`,
          ),
        }),
      );
      await page.route("https://images.unsplash.com/**", (route) =>
        route.fulfill({
          contentType: "image/jpeg",
          body: readFileSync("public/assets/hero.jpg"),
        }),
      );
    }
    await page.addInitScript(() =>
      localStorage.setItem("store-language", "en"),
    );
    await page.goto(url);
    if (label === "updated")
      await page.addStyleTag({
        content: ".language-toggle {visibility:hidden!important;}",
      });
    await page.locator("h3").filter({ hasText: "Alpaca Wool Scarf" }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.locator("main section").nth(1).scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.locator("main section").nth(2).scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    // Reveal the original whileInView sections, then settle their animations.
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    const main = page.locator("main");
    const box = await main.boundingBox();
    if (label === "original") {
      baselineHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      mainHeight = box.height;
    } else if (mainHeight !== box.height)
      throw new Error(`Main height changed at ${viewport.width}`);
    const bytes = await page.screenshot({
      // Header controls are intentionally revised; compare the unchanged store below it.
      clip: { x: 0, y: 80, width: viewport.width, height: baselineHeight - 80 },
      fullPage: true,
    });
    writeFileSync(`screenshots/design-${label}-${viewport.width}.png`, bytes);
    pages.push(PNG.sync.read(bytes));
    await page.close();
  }
  if (pages[0].width !== pages[1].width || pages[0].height !== pages[1].height)
    throw new Error(
      `Layout dimensions differ at ${viewport.width}: ${pages[0].height} vs ${pages[1].height}`,
    );
  const diff = new PNG({ width: pages[0].width, height: pages[0].height });
  const pixels = pixelmatch(
    pages[0].data,
    pages[1].data,
    diff.data,
    diff.width,
    diff.height,
    { threshold: 0.1 },
  );
  writeFileSync(
    `screenshots/design-diff-${viewport.width}.png`,
    PNG.sync.write(diff),
  );
  results.push({
    viewport: viewport.width,
    height: diff.height,
    differentPixels: pixels,
    totalPixels: diff.width * diff.height,
  });
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
writeFileSync(
  "screenshots/design-comparison.json",
  JSON.stringify(results, null, 2),
);
