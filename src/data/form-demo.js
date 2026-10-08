// Illustrative inventory belongs only to the read-only template preview.
const examples = [
  ["jacket", "Technical overshirt", "قميص خارجي عملي", "Clothing", 8900],
  ["shoes", "Everyday sneakers", "حذاء رياضي يومي", "Footwear", 11500],
  ["bag", "Structured tote", "حقيبة يومية", "Accessories", 6400],
  ["lamp", "Column table lamp", "مصباح مكتبي", "Objects", 7200],
];
export const formDemoProducts = examples.map(
  ([id, title, ar, category, price], i) => ({
    id: `form-${id}`,
    title,
    subtitle: "Illustrative demo product",
    category,
    status: "published",
    purchasable: true,
    ribbon_text: "DEMO",
    description:
      "<p>Illustrative merchandise for the FORM template preview. Replace with your own products, specifications and prices.</p>",
    image: `/assets/form-${id}.webp`,
    images: [{ url: `/assets/form-${id}.webp` }],
    additional_info: [],
    translations: {
      ar: {
        category: ["أزياء", "أحذية", "إكسسوارات", "أشياء"][i],
        title: ar,
        subtitle: "منتج توضيحي للمعاينة",
        ribbon_text: "معاينة",
        description:
          "<p>منتج توضيحي لمعاينة قالب FORM. أضف منتجاتك ومواصفاتها وأسعارها الحقيقية.</p>",
        variants: [{ id: `form-${id}-default`, title: "الافتراضي" }],
      },
    },
    variants: [
      {
        id: `form-${id}-default`,
        title: "Default",
        price_in_cents: price,
        sale_price_in_cents: null,
        currency: "USD",
        currency_info: { code: "USD", symbol: "$", decimal_digits: 2 },
        manage_inventory: true,
        inventory_quantity: 20,
        image_url: null,
        attributes: i === 0 ? { color: "Forest", size: "M" } : {},
        options: [],
      },
    ],
    options: [],
  }),
);
