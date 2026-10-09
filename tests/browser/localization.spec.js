import { test, expect } from "@playwright/test";
import path from "node:path";
const dictionary = {
  ar: {
    password: "كلمة مرور لوحة الإدارة",
    enter: "الدخول إلى لوحة الإدارة",
    nav: "أقسام لوحة الإدارة",
    tabs: [
      "نظرة عامة",
      "الطلبات",
      "المنتجات",
      "استوديو البراند",
      "التجارة",
      "محتوى المتجر",
      "التذييل والإعدادات",
      "التحليلات",
      "الربط والإعدادات",
    ],
  },
  en: {
    password: "Dashboard password",
    enter: "Enter dashboard",
    nav: "Dashboard sections",
    tabs: [
      "Overview",
      "Orders",
      "Products",
      "Brand studio",
      "Commerce",
      "Store content",
      "Footer & settings",
      "Analytics",
      "Connections",
    ],
  },
};
const openNav = async (page) => {
  await page.locator(".admin-tabs").waitFor({ state: "attached" });
  if (!(await page.locator(".admin-tabs").isVisible()))
    await page.locator(".dashboard-header .admin-mobile-menu").click();
};
const login = async (page, locale) => {
  const d = dictionary[locale];
  await page.goto("/admin");
  await page.getByLabel(d.password, { exact: true }).fill("admin@admin");
  await page.getByRole("button", { name: d.enter, exact: true }).click();
  await openNav(page);
  await expect(page.getByRole("navigation", { name: d.nav })).toBeVisible();
};
const switchFromStore = async (page, language) => {
  const storefront = await page.context().newPage();
  await storefront.goto("/");
  await storefront.locator(".store-menu-trigger").click();
  await storefront
    .getByRole("button", {
      name: language === "en" ? "Switch to English" : "التبديل إلى العربية",
      exact: true,
    })
    .click();
  await storefront.close();
};
const noOverflow = async (page) => {
  const overflow = await page.locator(".admin-scope").evaluate((scope) =>
    [
      ...scope.querySelectorAll(
        "section,.admin-panel,nav,table,[role=dialog],input,select,textarea,button",
      ),
    ]
      .filter((node) => {
        const r = node.getBoundingClientRect();
        return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1);
      })
      .map((node) => ({
        tag: node.tagName,
        text: node.innerText?.slice(0, 70),
        left: node.getBoundingClientRect().left,
        right: node.getBoundingClientRect().right,
      })),
  );
  expect(overflow).toEqual([]);
};
for (const locale of ["ar", "en"])
  test(`all dashboard sections and table features fit mobile widths in ${locale}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (l) => localStorage.setItem("store-language", l),
      locale,
    );
    const d = dictionary[locale];
    await login(page, locale);
    // Real rows ensure responsiveness checks cover feature data rather than empty tables.
    const result = await page.request.post("/api/orders", {
      data: {
        idempotency_key: crypto.randomUUID(),
        language: locale,
        payment_method: "cod",
        customer: {
          name: locale === "ar" ? "عميل الهاتف" : "Mobile Customer",
          phone: "+966 555 123 456",
          address: "Testing street 44",
          city: "Riyadh",
          country: "Saudi Arabia",
        },
        items: [{ variant_id: "alpaca-scarf-cream", quantity: 1 }],
      },
    });
    expect(result.status()).toBe(201);
    await page.request.post("/api/analytics", {
      data: {
        session: crypto.randomUUID(),
        visitor: crypto.randomUUID(),
        events: [
          {
            id: crypto.randomUUID(),
            at: Date.now(),
            type: "page_view",
            path: "/mobile-check",
          },
        ],
      },
    });
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      for (const [index, name] of d.tabs.entries()) {
        await openNav(page);
        await page
          .getByRole("navigation", { name: d.nav })
          .getByRole("button", { name, exact: true })
          .click();
        await page.locator(".admin-panel").first().waitFor();
        await page.waitForTimeout(300);
        await noOverflow(page);
        if (width === 390)
          await page.screenshot({
            path: `screenshots/${locale}-${index}-mobile.png`,
            fullPage: true,
          });
        if (index === 1) {
          await page
            .getByRole("button", {
              name: locale === "ar" ? "عرض" : "View",
              exact: true,
            })
            .first()
            .click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await noOverflow(page);
          const bodyOverflow = await page.evaluate(
            () => document.body.style.overflow,
          );
          expect(bodyOverflow).toBe("hidden");
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);
        }
        if (index === 2) {
          await page
            .getByRole("button", {
              name:
                locale === "ar"
                  ? "تعديل وشاح من صوف الألبكة"
                  : "Edit Alpaca Wool Scarf",
              exact: true,
            })
            .click();
          await noOverflow(page);
          await page
            .getByRole("button", {
              name:
                locale === "ar" ? "الخيارات والمخزون" : "Options & inventory",
              exact: true,
            })
            .click();
          await expect(
            page
              .getByLabel(locale === "ar" ? "اسم الخيار" : "Style name", {
                exact: true,
              })
              .first(),
          ).toBeVisible();
          await page
            .getByRole("button", {
              name:
                locale === "ar" ? "إغلاق محرر المنتج" : "Close product editor",
              exact: true,
            })
            .click();
        }
        if (name === (locale === "ar" ? "التحليلات" : "Analytics")) {
          await page
            .getByRole("button", {
              name: locale === "ar" ? "التسلسل الزمني" : "Timeline",
              exact: true,
            })
            .first()
            .click();
          await expect(
            page.getByRole("heading", {
              name: locale === "ar" ? "تسلسل الزيارة" : "Visit timeline",
              exact: true,
            }),
          ).toBeVisible();
          await noOverflow(page);
        }
      }
    }
    expect(errors).toEqual([]);
  });
test("Arabic defaults, typography, shared language choice, product detail and Arabic checkout", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "فخامة صوف الألبكة بحرفية يدوية" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "وشاح من صوف الألبكة", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const loadedFonts = await page.evaluate(() =>
    [...document.fonts]
      .filter((face) => face.status === "loaded")
      .map((face) => face.family),
  );
  expect(loadedFonts.some((name) => name.includes("Noto Naskh Arabic"))).toBe(
    true,
  );
  expect(loadedFonts.some((name) => name.includes("Noto Sans Arabic"))).toBe(
    true,
  );
  const fonts = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(document.querySelector("h1")).fontFamily,
  }));
  expect(fonts.body).toContain("Noto Sans Arabic");
  expect(fonts.heading).toContain("Noto Naskh Arabic");
  await page.screenshot({
    path: "screenshots/arabic-store-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "قائمة المتجر" }).click();
  await page.getByRole("button", { name: "Switch to English" }).click();
  await expect(
    page.getByRole("heading", { name: "Handcrafted Alpaca Wool Luxury" }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByLabel("Dashboard password", { exact: true }),
  ).toBeVisible();
  await switchFromStore(page, "ar");
  await expect(
    page.getByLabel("كلمة مرور لوحة الإدارة", { exact: true }),
  ).toBeVisible();
  await page.goto("/product/alpaca-scarf");
  await expect(
    page.getByRole("heading", { name: "وشاح من صوف الألبكة", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "رمادي", exact: true }).click();
  await page
    .getByRole("button", { name: "أضف إلى السلة", exact: true })
    .click();
  await page.getByRole("button", { name: "عرض السلة", exact: false }).click();
  await page.getByRole("button", { name: "إتمام الطلب", exact: true }).click();
  await page
    .getByLabel("الاسم الكامل", { exact: true })
    .fill("عميل اللغة العربية");
  await page.getByLabel("رقم الهاتف", { exact: true }).fill("+966 555 123 987");
  await page.getByLabel("الدولة", { exact: true }).fill("السعودية");
  await page
    .getByLabel("عنوان الشارع / المبنى / الشقة", { exact: true })
    .fill("شارع الهدوء ٢٤");
  await page.getByLabel("المدينة", { exact: true }).fill("الرياض");
  await page
    .getByRole("button", {
      name: "إرسال الطلب · الدفع عند الاستلام",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/success#/);
  await expect(page.getByText("التوصيل إلى عميل اللغة العربية")).toBeVisible();
  await page.reload();
  await expect(page.getByText("التوصيل إلى عميل اللغة العربية")).toBeVisible();
  await page.screenshot({
    path: "screenshots/arabic-confirmation.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("Arabic dashboard creates, edits and deletes products, styles, details, gallery and footer links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await login(page, "ar");
  const nav = page.getByRole("navigation", { name: dictionary.ar.nav });
  await openNav(page);
  await nav.getByRole("button", { name: "المنتجات", exact: true }).click();
  await page.getByRole("button", { name: "إضافة منتج", exact: true }).click();
  await page
    .getByLabel("اسم المنتج", { exact: true })
    .fill("منتج عربي للاختبار");
  await page
    .getByLabel("معرّف المنتج / الرابط", { exact: true })
    .fill("arabic-test-product");
  await page
    .getByLabel("وصف قصير", { exact: true })
    .fill("نعومة وأناقة في كل تفصيل");
  await page.getByLabel("الظهور", { exact: true }).selectOption("published");
  await page.getByRole("button", { name: "الصور", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles(path.resolve("public/assets/hero.jpg"));
  await expect(page.getByAltText("صورة الغلاف")).toBeVisible();
  await page
    .getByRole("button", { name: "الخيارات والمخزون", exact: true })
    .click();
  await page.getByLabel("السعر", { exact: true }).fill("30");
  await page.getByLabel("المخزون", { exact: true }).fill("4");
  await page
    .getByRole("button", { name: "إضافة خيار / مقاس", exact: true })
    .click();
  await page.getByLabel("اسم الخيار", { exact: true }).nth(1).fill("لون ذهبي");
  await page.getByLabel("السعر", { exact: true }).nth(1).fill("35");
  await page.getByLabel("المخزون", { exact: true }).nth(1).fill("2");
  await page
    .getByRole("button", { name: "التفاصيل والعرض", exact: true })
    .click();
  await page.getByRole("button", { name: "إضافة تفصيل", exact: true }).click();
  await page.getByLabel("العنوان", { exact: true }).fill("الخامة");
  await page.getByLabel("التفصيل", { exact: true }).fill("صوف فاخر");
  await page.getByRole("button", { name: "الصور", exact: true }).click();
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles(path.resolve("public/assets/hero.jpg"));
  await expect(page.getByAltText("صورة المعرض 2")).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: "إنشاء المنتج", exact: true }).click();
  await expect(
    page.getByText("تمت إضافة المنتج.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "تعديل منتج عربي للاختبار", exact: true })
    .click();
  await page.getByLabel("اسم المنتج", { exact: true }).fill("اسم عربي معدّل");
  await page.getByRole("button", { name: "حفظ المنتج", exact: true }).click();
  await expect(
    page.getByText("تم تحديث المنتج.", { exact: true }),
  ).toBeVisible();
  const saved = (
    await (await page.request.get("/api/admin/products")).json()
  ).products.find((p) => p.id === "arabic-test-product");
  expect(saved.title).toBe("منتج عربي للاختبار");
  expect(saved.translations.ar.title).toBe("اسم عربي معدّل");
  expect(saved.variants.length).toBe(2);
  expect(saved.images.length).toBe(2);
  expect(saved.translations.ar.additional_info[0].title).toBe("الخامة");
  await openNav(page);
  await nav
    .getByRole("button", { name: "التذييل والإعدادات", exact: true })
    .click();
  await page.getByRole("button", { name: /إضافة التواصل الاجتماعي/ }).click();
  const links = page.getByLabel("الرابط", { exact: true });
  await links.last().fill("https://instagram.com/test-boutique");
  await page.getByLabel("التسمية", { exact: true }).last().fill("إنستغرام");
  await page
    .getByRole("button", { name: "حفظ التغييرات", exact: true })
    .click();
  await expect(
    page.getByText("تم حفظ المحتوى وتحديث واجهة المتجر.", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await openNav(page);
  await nav.getByRole("button", { name: "المنتجات", exact: true }).click();
  await page
    .getByRole("button", { name: "حذف اسم عربي معدّل", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await noOverflow(page);
  await page.getByRole("button", { name: "حذف المنتج", exact: true }).click();
  await expect(
    page.getByText("تم حذف المنتج. تحتفظ الطلبات السابقة بتفاصيلها الأصلية.", {
      exact: true,
    }),
  ).toBeVisible();
});
test("Arabic store content preserves English and switches immediately inside dashboard", async ({
  page,
}) => {
  await login(page, "ar");
  await page
    .getByRole("navigation", { name: dictionary.ar.nav })
    .getByRole("button", { name: "محتوى المتجر", exact: true })
    .click();
  const before = await (await page.request.get("/api/admin/store")).json();
  await page
    .getByLabel("اسم المتجر", { exact: true })
    .fill("بوتيك الألبكة العربي");
  await page
    .getByLabel("عنوان القسم الرئيسي", { exact: true })
    .fill("أناقة صُنعت بعناية");
  await page
    .getByRole("button", { name: "حفظ التغييرات", exact: true })
    .click();
  await expect(
    page.getByText("تم حفظ المحتوى وتحديث واجهة المتجر.", { exact: true }),
  ).toBeVisible();
  await switchFromStore(page, "en");
  await expect(page.getByLabel("Store name", { exact: true })).toHaveValue(
    before.name,
  );
  await expect(page.getByLabel("Hero heading", { exact: true })).toHaveValue(
    before.hero.title,
  );
  await switchFromStore(page, "ar");
  await expect(page.getByLabel("اسم المتجر", { exact: true })).toHaveValue(
    "بوتيك الألبكة العربي",
  );
  const current = await (await page.request.get("/api/admin/store")).json();
  const restore = await page.request.put("/api/admin/store", {
    data: { ...before, _version: current._version },
  });
  expect(restore.status()).toBe(200);
});
test("mobile Arabic connections, Telegram test, order status, inventory restoration and exports work", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "ar");
  const nav = page.getByRole("navigation", { name: dictionary.ar.nav });
  const product = await (
    await page.request.get("/api/products/alpaca-scarf")
  ).json();
  const stock = product.variants.find(
    (v) => v.id === "alpaca-scarf-camel",
  ).inventory_quantity;
  const placed = await page.request.post("/api/orders", {
    data: {
      idempotency_key: crypto.randomUUID(),
      language: "ar",
      payment_method: "cod",
      customer: {
        name: "عميل إشعار الهاتف",
        phone: "+966 555 000 987",
        address: "عنوان اختبار الهاتف",
        city: "الرياض",
        country: "السعودية",
      },
      items: [{ variant_id: "alpaca-scarf-camel", quantity: 1 }],
    },
  });
  expect(placed.status()).toBe(201);
  const order = (await placed.json()).order;
  await openNav(page);
  await nav
    .getByRole("button", { name: "الربط والإعدادات", exact: true })
    .click();
  await page
    .getByLabel("رمز البوت", { exact: true })
    .fill("123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456");
  await page
    .getByLabel("معرّف المحادثة / اسم القناة", { exact: true })
    .fill("123456789");
  await page.getByRole("button", { name: "حفظ الربط", exact: true }).click();
  await expect(
    page.getByText(
      "تم حفظ إعدادات تيليغرام. ستُرسل الطلبات المعلّقة تلقائياً.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "إرسال اختبار", exact: true }).click();
  await expect(
    page.getByText("تم إرسال رسالة الاختبار إلى تيليغرام.", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await openNav(page);
  await nav.getByRole("button", { name: "الطلبات", exact: true }).click();
  await page.getByLabel("البحث في الطلبات", { exact: true }).fill(order.number);
  await expect(
    page.getByText("عميل إشعار الهاتف", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "عرض", exact: true }).first().click();
  await page
    .getByLabel("تحديث حالة الطلب", { exact: true })
    .selectOption("processing");
  await page.getByRole("button", { name: "تحديث", exact: true }).click();
  await expect(
    page.getByText("تم تحديث حالة الطلب.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("تحديث حالة الطلب", { exact: true })
    .selectOption("cancelled");
  await page.getByRole("button", { name: "تحديث", exact: true }).click();
  await expect(
    page.getByLabel("تحديث حالة الطلب", { exact: true }),
  ).toBeDisabled();
  const restored = await (
    await page.request.get("/api/products/alpaca-scarf")
  ).json();
  expect(
    restored.variants.find((v) => v.id === "alpaca-scarf-camel")
      .inventory_quantity,
  ).toBe(stock);
  await page.keyboard.press("Escape");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "ملف CSV", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("orders.csv");
  await openNav(page);
  await nav.getByRole("button", { name: "التحليلات", exact: true }).click();
  await page.getByLabel("فترة التحليلات", { exact: true }).selectOption("0");
  await expect(
    page.getByText(
      "يعرض المخطط آخر ٣٦٥ يوماً، وتشمل الإجماليات جميع الفترات.",
      { exact: true },
    ),
  ).toBeVisible();
  await noOverflow(page);
  await openNav(page);
  await nav
    .getByRole("button", { name: "الربط والإعدادات", exact: true })
    .click();
  await page.getByRole("button", { name: "فصل تيليغرام", exact: true }).click();
  await expect(
    page.getByText("تم فصل تيليغرام. يستمر حفظ الطلبات في لوحة الإدارة.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("dashboard time is excluded from storefront visit duration", async ({
  page,
}) => {
  const durations = [];
  await page.route("**/api/analytics", async (route) => {
    durations.push(route.request().postDataJSON().duration);
    await route.continue();
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "فخامة صوف الألبكة بحرفية يدوية" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "الإدارة", exact: true }).click();
  await expect(
    page.getByLabel("كلمة مرور لوحة الإدارة", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const actual = Date.now;
    Date.now = () => actual() + 600000;
  });
  await page
    .getByRole("link", { name: "العودة إلى البوتيك", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "فخامة صوف الألبكة بحرفية يدوية" }),
  ).toBeVisible();
  await expect.poll(() => durations.length).toBeGreaterThan(1);
  expect(Math.max(...durations)).toBeLessThan(60000);
});
