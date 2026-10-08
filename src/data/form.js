import { defaultSettings } from "./settings.js";
export const formSettings = {
  ...structuredClone(defaultSettings),
  name: "FORM",
  tagline: "Everyday. Reconsidered.",
  metaDescription: "A new perspective on everyday essentials.",
  brand: {
    ...defaultSettings.brand,
    primary: "#2a5547",
    button: "#2a5547",
    background: "#f7f9fa",
    foreground: "#172321",
    surface: "#ffffff",
    muted: "#5b6864",
    headingStyle: "sans",
    radius: "sharp",
  },
  hero: {
    title: "Everyday.\nReconsidered.",
    text: "Discover a new perspective on the things you choose.",
    image: "/assets/form-hero.webp",
    alt: "Contemporary clothing in a cool architectural setting",
    button: "Explore the collection",
  },
  story: {
    title: "Made for your everyday.",
    text: "Find your next favourite. Explore the collection and make it yours.",
  },
  collection: { title: "New arrivals", text: "A fresh point of view." },
  footer: {
    ...defaultSettings.footer,
    text: "Everyday, reconsidered.",
    email: "",
    phone: "",
    location: "",
  },
  checkout: {
    ...defaultSettings.checkout,
    deliveryNote:
      "Delivery details and available payment methods are confirmed at checkout.",
  },
  pages: {
    ...defaultSettings.pages,
    terms:
      "Product availability and final totals are confirmed at checkout. Cash on delivery and configured online payment methods may be available. Contact the store for delivery arrangements, returns and cancellation requests.",
  },
  form: {
    heroPosition: 15,
    mobilePosition: 85,
    campaignImage: "/assets/form-campaign.webp",
    campaignEnabled: true,
    categoriesEnabled: true,
    arrivalsEnabled: true,
  },
  translations: {
    ar: {
      name: "FORM",
      tagline: "تفاصيل يومك، برؤية جديدة.",
      metaDescription: "نظرة جديدة لاختياراتك اليومية.",
      hero: {
        title: "كل يوم.\nبرؤية جديدة.",
        text: "اكتشف ما يناسبك، واختر تفاصيل تشبهك.",
        alt: "أزياء عصرية وسط تصميم معماري هادئ",
        button: "اكتشف المجموعة",
      },
      story: {
        title: "اختيارات تعيش معك.",
        text: "اكتشف مجموعتنا واختر ما يناسب يومك.",
      },
      collection: {
        title: "وصل حديثًا",
        text: "اختيارات جديدة، ونظرة مختلفة.",
      },
      footer: {
        text: "تفاصيل يومك، برؤية جديدة.",
        rights: "جميع الحقوق محفوظة.",
        quickLinks: [
          { label: "الرئيسية" },
          { label: "تسوق" },
          { label: "عن المتجر" },
          { label: "تواصل معنا" },
        ],
      },
      checkout: {
        deliveryNote: "تظهر تفاصيل التوصيل وطرق الدفع المتاحة عند إتمام الطلب.",
      },
      pages: {
        shipping:
          "تظهر مناطق التوصيل ورسومه عند إتمام الطلب. تواصل مع المتجر لمعرفة موعد الوصول المتوقع قبل تأكيد الطلب.",
        returns:
          "يمكنك إرسال طلب استرجاع أو استبدال من حسابك بعد استلام الطلب. يراجع المتجر الطلب ويؤكد الأهلية والخطوات وفقًا لسياسته والقانون المعمول به. الموافقة على الطلب لا تعني إتمام رد المبلغ.",
        privacy:
          "نستخدم بياناتك لإتمام الطلب وإدارة حسابك ومشترياتك. لا نخزّن بيانات بطاقتك المصرفية. تحترم إحصاءات المتجر إعداد عدم التتبع في متصفحك. تواصل مع المتجر لطلبات الوصول إلى بياناتك أو حذفها.",
        terms:
          "تُؤكّد الأسعار والمخزون والمجموع النهائي عند إتمام الطلب. قد تتوفر خدمة الدفع عند الاستلام أو الدفع الإلكتروني حسب إعدادات المتجر. تواصل مع المتجر بشأن التوصيل والاسترجاع وإلغاء الطلب.",
      },
    },
  },
};
