import { defaultSettings } from "./settings.js";
import reference from "./gala-reference.js";
const asset = (path) =>
  "/assets/gala-" + path.replace("/assets/seeds/", "").replaceAll("/", "-");
const arNames = [
  "معطف من الصوف",
  "فستان حريري ميدي",
  "شورت دنيم مريح",
  "تيشيرت قطني ثقيل",
  "حذاء شمواه بروغ",
  "كنزة كشمير",
  "قميص كتان",
  "نظارة أسيتات",
];
const arCategories = {
  Outerwear: "معاطف",
  Dresses: "فساتين",
  Knitwear: "تريكو",
  Shoes: "أحذية",
  Tops: "ملابس علوية",
  Accessories: "إكسسوارات",
  Trousers: "سراويل",
};
export const galaProducts = reference.map((p, i) => {
  const id = p.title.toLowerCase().replaceAll(" ", "-");
  const combos = p.options.reduce(
    (a, o) =>
      a.flatMap((x) => o.values.map((v) => [...x, { name: o.name, value: v }])),
    [[]],
  );
  const images = (p.images.length ? p.images : [p.image]).map((url) => ({
    url: asset(url),
  }));
  return {
    id,
    title: p.title,
    category: p.category,
    description: p.description,
    subtitle: "",
    ribbon_text: "",
    image: images[0].url,
    images,
    status: "published",
    purchasable: true,
    options: [],
    additional_info: p.specs.map(([title, description], j) => ({
      id: id + "-info-" + j,
      order: j,
      title,
      description,
    })),
    merchandising: {
      relatedIds: [],
      bundleIds: ["cashmere-crew", "linen-shirt"].filter((x) => x !== id),
      recommendedIds: ["cashmere-crew", "linen-shirt"].filter((x) => x !== id),
    },
    variants: combos.map((c, j) => ({
      id: id + "-" + (j + 1),
      title: c.map((x) => x.value).join(" / "),
      sku: "MV-AW26-" + String(i + 1).padStart(3, "0") + "-" + (j + 1),
      attributes: Object.fromEntries(
        c.map((x) => [
          x.name.toLowerCase().includes("colo") ? "color" : "size",
          x.value,
        ]),
      ),
      optionValues: c,
      image_url: null,
      price_in_cents: Math.round(
        (i === 5 ? 360 : i === 6 ? 180 : p.price) * 100,
      ),
      sale_price_in_cents:
        i === 5 || i === 6 ? Math.round(p.price * 100) : null,
      currency: "EUR",
      currency_info: { code: "EUR", symbol: "€", decimal_digits: 2 },
      manage_inventory: true,
      inventory_quantity: j === 0 ? [12, 8, 20, 45, 10, 6, 14, 30][i] : 12,
      options: [],
    })),
    translations: {
      ar: {
        title: arNames[i],
        category: arCategories[p.category],
        description: [
          "صوف إيطالي بوجهين وأكتاف منسدلة وأزرار من القرن. طول يصل أسفل الركبة.",
          "حرير ناعم بقصّة ميدي وبطانة داخلية وسحاب جانبي مخفي.",
          "دنيم قطني بقصّة مريحة وطول فوق الركبة.",
          "قطن ثقيل ناعم بقصّة مريحة للاستخدام اليومي.",
          "حذاء شمواه مصنوع بعناية بتفاصيل كلاسيكية.",
          "كشمير ناعم وخفيف يمنحك دفئًا مريحًا.",
          "قميص كتان طبيعي بتفاصيل عملية وقصّة مريحة.",
          "إطار أسيتات خفيف بعدسات واقية وتصميم خالد.",
        ][i],
      },
    },
  };
});
export const galaCollections = [
  "Outerwear",
  "Dresses",
  "Knitwear",
  "Shoes",
  "Tops",
  "Accessories",
].map((name) => ({
  id: name.toLowerCase(),
  name,
  nameAr: arCategories[name],
  description: "",
  descriptionAr: "",
  published: true,
  image: galaProducts.find((p) => p.category === name).image,
  productIds: galaProducts.filter((p) => p.category === name).map((p) => p.id),
}));
const text = (en, ar) => ({ en, ar });
export const galaDefaults = {
  schemaVersion: 1,
  palette: {
    background: "#ffffff",
    surface: "#f3f0ed",
    ink: "#151414",
    muted: "#6c6763",
    primary: "#151414",
    onPrimary: "#ffffff",
    accent: "#c23b6b",
    border: "#e6e1dc",
    footerBackground: "#151414",
    footerInk: "#f3f0ed",
  },
  typography: {
    body: "Albert",
    heading: "Reference",
    bodySize: 15,
    headingScale: 1,
  },
  layout: { width: 1440, sectionSpacing: 64, cardRatio: "portrait" },
  navigation: [
    { label: text("Products", "المنتجات"), path: "/shop", menu: "products" },
    {
      label: text("Collections", "المجموعات"),
      path: "/collections",
      menu: "collections",
    },
    { label: text("About", "عن المتجر"), path: "/about", menu: "" },
  ],
  mobileNavigation: true,
  hero: {
    images: [
      "/assets/gala-fashion-3.jpg",
      "/assets/gala-fashion-2.jpg",
      "/assets/gala-fashion-9.jpg",
    ],
    positions: [50, 50, 50],
    primary: text("Shop now", "تسوق الآن"),
    primaryLink: "/shop",
    secondary: text("Browse collections", "تصفح المجموعات"),
    secondaryLink: "/collections",
  },
  sections: [
    "hero",
    "collections",
    "trending",
    "lookbook",
    "story",
    "testimonials",
    "services",
    "faq",
  ].map((id) => ({ id, enabled: true })),
  headings: {
    collections: text("Shop by collection", "تسوق حسب المجموعة"),
    trending: text("Trending now", "الأكثر رواجًا"),
    lookbook: text("Shop the look", "اكتشف الإطلالة"),
    testimonials: text("What customers say", "آراء عملائنا"),
    faq: text("Frequently Asked Questions", "الأسئلة الشائعة"),
  },
  trendingIds: [],
  lookbookIds: [],
  collectionIds: [],
  storyImage: "/assets/gala-fashion-3.jpg",
  storyButton: text("Our story", "حكايتنا"),
  testimonials: [],
  services: [
    {
      icon: "truck",
      title: text("Free Shipping", "شحن مجاني"),
      text: text("On orders over €50.00", "للطلبات فوق ٥٠ يورو"),
      path: "/shipping",
    },
    {
      icon: "lock",
      title: text("Secure Checkout", "دفع آمن"),
      text: text("SSL encrypted", "اتصال مشفر"),
      path: "/privacy",
    },
    {
      icon: "return",
      title: text("Easy Returns", "استرجاع سهل"),
      text: text("14-day guarantee", "خلال ١٤ يومًا"),
      path: "/returns",
    },
    {
      icon: "chat",
      title: text("Questions?", "عندك سؤال؟"),
      text: text("Get in touch", "تواصل معنا"),
      path: "/contact",
    },
  ],
  faq: [
    {
      question: text(
        "What kind of fashion and apparel do you offer?",
        "ما نوع الأزياء التي يقدمها المتجر؟",
      ),
      answer: text(
        "We specialize in fashion and apparel, carefully curated for quality and value. Browse our collections to discover our full range.",
        "نقدم أزياء مختارة بعناية للجودة والقيمة. تصفح مجموعاتنا لاكتشاف جميع المنتجات.",
      ),
    },
    {
      question: text(
        "What shipping options do you offer?",
        "ما خيارات الشحن المتاحة؟",
      ),
      answer: text(
        "We offer standard and express shipping. Orders over €50.00 qualify for free standard shipping.",
        "تتوفر خيارات الشحن حسب عنوانك. الطلبات فوق ٥٠ يورو مؤهلة للشحن القياسي المجاني.",
      ),
    },
    {
      question: text("What is your return policy?", "ما سياسة الاسترجاع؟"),
      answer: text(
        "We offer a 14-day return policy. Contact our support team to start a return.",
        "يمكن طلب الاسترجاع خلال ١٤ يومًا. تواصل معنا لبدء الطلب.",
      ),
    },
    {
      question: text(
        "What payment methods do you accept?",
        "ما طرق الدفع المتاحة؟",
      ),
      answer: text(
        "We accept all major credit cards, debit cards, and cash on delivery (where available). All transactions are secured with SSL encryption.",
        "تظهر طرق الدفع المفعّلة عند إتمام الطلب. تتوفر خدمة الدفع عند الاستلام والدفع الإلكتروني حسب إعدادات المتجر.",
      ),
    },
  ],
  productFaq: [
    {
      question: text("How long does shipping take?", "كم يستغرق التوصيل؟"),
      answer: text(
        "Delivery options, cost and timing are shown at checkout before you pay.",
        "تظهر خيارات التوصيل ورسومه عند إتمام الطلب.",
      ),
    },
    {
      question: text("What is your return policy?", "ما سياسة الاسترجاع؟"),
      answer: text(
        "We offer a 14-day return policy. Contact our support team to start a return.",
        "يمكن طلب الاسترجاع خلال ١٤ يومًا. تواصل معنا لمعرفة الخطوات.",
      ),
    },
    {
      question: text(
        "How do I choose the right size?",
        "كيف أختار المقاس المناسب؟",
      ),
      answer: text(
        "Please refer to the product description for sizing details. If you are between sizes, we generally recommend going up a size. Contact us if you need help.",
        "راجع جدول المواصفات لاختيار المقاس. تواصل معنا إذا احتجت مساعدة.",
      ),
    },
  ],
  product: {
    stickyBuy: true,
    showStock: true,
    showSku: true,
    sharing: true,
    reviews: true,
    bundles: true,
    related: true,
    recent: true,
    recommendations: true,
  },
  cart: { recommendations: true, notes: false, shippingProgress: false },
  newsletter: {
    enabled: true,
    title: text("Stay in the loop", "ابقَ على اطلاع"),
    text: text(
      "New arrivals and offers, now and then.",
      "جديدنا وعروضنا، من وقت لآخر.",
    ),
  },
  footerColumns: [
    {
      title: text("Shop", "تسوق"),
      links: [
        { label: text("All products", "كل المنتجات"), path: "/shop" },
        { label: text("Collections", "المجموعات"), path: "/collections" },
        { label: text("Track order", "تتبع طلبك"), path: "/track" },
      ],
    },
    {
      title: text("Help", "مساعدة"),
      links: [
        { label: text("Contact", "تواصل معنا"), path: "/contact" },
        { label: text("Support", "الدعم"), path: "/contact" },
        { label: text("Shipping", "الشحن"), path: "/shipping" },
        { label: text("Returns", "الاسترجاع"), path: "/returns" },
      ],
    },
    {
      title: text("About", "عن المتجر"),
      links: [
        { label: text("About us", "حكايتنا"), path: "/about" },
        { label: text("Privacy", "الخصوصية"), path: "/privacy" },
        { label: text("Terms", "الشروط"), path: "/terms" },
      ],
    },
  ],
  currency: {
    enabled: true,
    codes: [
      "EUR",
      "USD",
      "GBP",
      "AED",
      "SAR",
      "QAR",
      "KWD",
      "BHD",
      "OMR",
      "EGP",
      "JOD",
      "INR",
      "PKR",
      "TRY",
      "CAD",
      "AUD",
      "JPY",
      "CNY",
      "CHF",
      "ZAR",
      "NGN",
      "MAD",
    ],
  },
};
export const galaDemoTestimonials = [
  {
    name: "Clara",
    title: text("The coat", "المعطف"),
    body: text(
      "Heavy, warm, and the camel is exactly the colour in the photograph.",
      "ثقيل ودافئ، واللون الجملي مطابق للصورة تمامًا.",
    ),
    rating: 5,
  },
  {
    name: "Jonas P.",
    title: text("", ""),
    body: text(
      "Third pair of the derbies. They resole them for you.",
      "هذه ثالث مرة أختار فيها هذا الحذاء. جودة وتفاصيل رائعة.",
    ),
    rating: 5,
  },
  {
    name: "Amira",
    title: text("Size up", "المقاس"),
    body: text(
      "The tee runs boxy, size down if you want it fitted.",
      "قصة التيشيرت واسعة. اختاري مقاسًا أصغر إذا أردته ضيقًا.",
    ),
    rating: 4,
  },
];
export const galaSettings = {
  ...structuredClone(defaultSettings),
  name: "MAISON VERE",
  tagline: "Considered clothing. Everyday luxury.",
  metaDescription:
    "Tailored womenswear and menswear cut in small runs. Made in Portugal from European cloth.",
  brand: {
    ...defaultSettings.brand,
    primary: "#151414",
    button: "#151414",
    background: "#ffffff",
    foreground: "#151414",
    surface: "#f3f0ed",
    muted: "#6c6763",
    radius: "sharp",
  },
  hero: {
    title: "MAISON VERE",
    text: "Tailored womenswear and menswear cut in small runs. Made in Portugal from European cloth.",
    image: "/assets/gala-fashion-3.jpg",
    alt: "A considered collection of clothing",
    button: "Shop now",
  },
  story: {
    title: "About us",
    text: "Tailored womenswear and menswear cut in small runs. Made in Portugal from European cloth.",
  },
  collection: { title: "Trending now", text: "A considered collection of everyday essentials." },
  footer: {
    ...defaultSettings.footer,
    text: "Tailored womenswear and menswear cut in small runs. Made in Portugal from European cloth.",
    email: "",
    phone: "",
    location: "",
  },
  checkout: {
    currency: "EUR",
    symbol: "€",
    shippingInCents: 0,
    deliveryNote: "Delivery options are confirmed at checkout.",
  },
  commerce: { ...defaultSettings.commerce, freeShippingOverInCents: 5000 },
  gala: galaDefaults,
  translations: {
    ar: {
      name: "MAISON VERE",
      tagline: "تفاصيل مدروسة. رفاهية كل يوم.",
      hero: {
        title: "MAISON VERE",
        text: "أزياء نسائية ورجالية مصممة بعناية في مجموعات محدودة. صُنعت في البرتغال من أقمشة أوروبية.",
        alt: "مجموعة أزياء مختارة بعناية",
        button: "تسوق الآن",
      },
      story: {
        title: "عن المتجر",
        text: "أزياء نسائية ورجالية مصممة بعناية في مجموعات محدودة. صُنعت في البرتغال من أقمشة أوروبية.",
      },
      collection: { title: "الأكثر رواجًا", text: "" },
      footer: { text: "أزياء نسائية ورجالية مصممة بعناية في مجموعات محدودة." },
    },
  },
};
