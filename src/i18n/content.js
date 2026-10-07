export const arabicStore = {
  name: "بوتيك صوف الألبكة",
  tagline: "قطع صوف ألبكة مصنوعة يدوياً",
  metaDescription:
    "اكتشف مجموعتنا من قطع صوف الألبكة المصنوعة يدوياً، من مصادر مسؤولة وبعناية لمن يقدّر الجودة والحرفية.",
  hero: {
    title: "فخامة صوف الألبكة بحرفية يدوية",
    text: "اكتشف مجموعتنا المختارة من الملابس والقبعات والجوارب والأوشحة، من مصادر مسؤولة وبحرفية متقنة. قطع دافئة صُنعت بعناية لمن يقدّر الأناقة التي تدوم.",
    alt: "فخامة صوف الألبكة المصنوع يدوياً",
    button: "تسوّق المجموعة",
  },
  story: {
    title: "حكايتنا",
    text: "في بوتيك صوف الألبكة، نؤمن بجمال الأزياء المتأنية والحرفية المستدامة. كل قطعة في مجموعتنا صُنعت بعناية من صوف ألبكة من مصادر مسؤولة، يشتهر بنعومته الفائقة ودفئه ومتانته. نتعاون مع مجتمعات حرفية تشاركنا الالتزام بالجودة واحترام البيئة، لتروي كل قطعة حكاية من العناية والتقاليد، وترافقك بأناقة لسنوات.",
  },
  collection: {
    title: "مجموعتنا",
    text: "اكتشف قطع صوف الألبكة المصنوعة يدوياً لترافقك مدى الحياة",
  },
  footer: {
    text: "قطع صوف ألبكة مصنوعة يدوياً، من مصادر مسؤولة وبعناية لمن يقدّر الجودة والحرفية.",
    location: "بورتلاند، أوريغون",
    rights: "جميع الحقوق محفوظة.",
    quickLinks: [
      { label: "الرئيسية", path: "/" },
      { label: "المتجر", path: "/shop" },
      { label: "حكايتنا", path: "/about" },
      { label: "تواصل معنا", path: "/contact" },
    ],
  },
  pages: {
    shipping:
      "تُحدّد إتاحة التوصيل ورسومه عند إتمام الطلب. تواصل مع المتجر لمعرفة مدة التوصيل المتوقعة قبل تأكيد طلبك.",
    returns:
      "تواصل مع المتجر برقم طلبك لطلب الإرجاع أو الإلغاء. سيؤكد المتجر أهلية الطلب والخطوات التالية وفق شروطه والقانون المعمول به.",
    privacy:
      "نستخدم المعلومات التي تقدّمها عند إتمام الطلب لتنفيذه وتوصيله. تسجّل التحليلات المحلية الصفحات التي تزورها وتفاعلاتك مع المتجر بمعرّفات متصفح مجهولة. لا نحتفظ بعناوين الإنترنت الكاملة أو بيانات البطاقات المصرفية. نحترم إعداد عدم التتبع في متصفحك. تواصل معنا لطلب الاطلاع على معلومات طلبك أو حذفها.",
    terms:
      "تُدفع قيمة الطلب نقداً عند الاستلام. نتحقق من توفر المنتجات والمبلغ النهائي عند إرسال الطلب. تواصل مع المتجر لترتيبات التوصيل والإرجاع أو لطلب إلغاء الطلب.",
  },
  checkout: {
    deliveryNote: "سنتواصل معك لترتيب التوصيل. ادفع نقداً عند وصول طلبك.",
  },
};
export const arabicProducts = {
  "alpaca-scarf": {
    title: "وشاح من صوف الألبكة",
    subtitle: "ناعم ودافئ وخفيف",
    ribbon_text: "الأكثر مبيعاً",
    description:
      "وشاح واسع منسوج من صوف الألبكة الفاخر. يمنحك دفئاً طبيعياً، ويسمح للبشرة بالتنفس، ويلامسها بنعومة.",
    variants: ["كريمي", "جملي", "رمادي"],
    additional_info: [
      { title: "الخامة", description: "صوف ألبكة فاخر بنسبة ١٠٠٪" },
      {
        title: "العناية",
        description: "يُغسل يدوياً بالماء البارد ويُجفف مفروداً",
      },
    ],
  },
  "alpaca-beanie": {
    title: "قبعة من صوف الألبكة",
    subtitle: "قبعة محبوكة لكل يوم",
    ribbon_text: "",
    description:
      "قبعة محبوكة بخطوط بارزة وقصّة مريحة، تحميك من البرد بنعومة دون الشعور بالحكة.",
    variants: ["شوفاني", "فحمي"],
    additional_info: [
      { title: "الخامة", description: "٨٠٪ صوف ألبكة و٢٠٪ صوف ميرينو" },
    ],
  },
  "alpaca-gloves": {
    title: "قفازات من صوف الألبكة",
    subtitle: "دفء يرافق يديك طوال الشتاء",
    ribbon_text: "جديد",
    description:
      "قفازات بحياكة دقيقة وملمس ناعم مع أساور مريحة تحافظ على الدفء.",
    variants: ["صغير", "متوسط", "كبير"],
    additional_info: [{ title: "الخامة", description: "صوف ألبكة بنسبة ١٠٠٪" }],
  },
  "alpaca-blanket": {
    title: "بطانية من صوف الألبكة",
    subtitle: "دفء وراحة على الأريكة",
    ribbon_text: "",
    description:
      "بطانية واسعة وسميكة بملمس ناعم. أكثر دفئاً من صوف الأغنام ولطيفة بطبيعتها على البشرة الحساسة.",
    variants: ["عاجي"],
    additional_info: [
      { title: "المقاس", description: "١٣٠ × ١٨٠ سم" },
      { title: "الخامة", description: "صوف ألبكة بنسبة ١٠٠٪" },
    ],
  },
};
const storeFields = {
  root: ["name", "tagline", "metaDescription"],
  hero: ["title", "text", "alt", "button"],
  story: ["title", "text"],
  collection: ["title", "text"],
  footer: ["text", "location", "rights"],
  pages: ["privacy", "terms", "shipping", "returns"],
  checkout: ["deliveryNote"],
};
export function localizeSettings(base, language) {
  if (language !== "ar") return base;
  const tr = base.translations?.ar || {};
  const out = { ...base };
  for (const key of storeFields.root)
    if (tr[key] !== undefined) out[key] = tr[key];
  for (const [group, keys] of Object.entries(storeFields)) {
    if (group === "root") continue;
    out[group] = { ...base[group] };
    for (const key of keys)
      if (tr[group]?.[key] !== undefined) out[group][key] = tr[group][key];
  }
  for (const key of ["quickLinks", "socials"])
    out.footer[key] = (base.footer[key] || []).map((link, i) => ({
      ...link,
      label: tr.footer?.[key]?.[i]?.label || link.label,
    }));
  return out;
}
export function updateStoreContent(base, language, group, key, value) {
  const localized =
    storeFields[group || "root"]?.includes(key) ||
    (group === "footer" && ["quickLinks", "socials"].includes(key));
  if (language === "ar" && localized) {
    const next = structuredClone(base);
    next.translations ||= {};
    next.translations.ar ||= {};
    if (group) {
      next.translations.ar[group] ||= {};
      next.translations.ar[group][key] = value;
      if (!next[group][key] || base._arabicFallback?.[group + "." + key]) {
        next[group][key] = value;
        next._arabicFallback = {
          ...base._arabicFallback,
          [group + "." + key]: true,
        };
      }
    } else {
      next.translations.ar[key] = value;
      if (!next[key] || base._arabicFallback?.[key]) {
        next[key] = value;
        next._arabicFallback = { ...base._arabicFallback, [key]: true };
      }
    }
    if (group === "footer" && ["quickLinks", "socials"].includes(key))
      next.footer[key] = value.map((link, i) => {
        const previous =
          base.footer[key].find((x) => x.path === link.path) ||
          base.footer[key][i];
        return { ...link, label: previous?.label || link.label };
      });
    return next;
  }
  if (
    group === "footer" &&
    ["quickLinks", "socials"].includes(key) &&
    base.translations?.ar?.footer?.[key]
  ) {
    const next = structuredClone(base);
    next.footer[key] = value;
    next.translations.ar.footer[key] = value.map((link, i) => {
      const oldIndex = base.footer[key].findIndex((x) => x.path === link.path);
      return (
        base.translations.ar.footer[key][oldIndex < 0 ? i : oldIndex] || {
          label: link.label,
        }
      );
    });
    return next;
  }
  return group
    ? { ...base, [group]: { ...base[group], [key]: value } }
    : { ...base, [key]: value };
}
export function localizeProduct(base, language) {
  if (language !== "ar") return base;
  const tr = base.translations?.ar || {};
  return {
    ...base,
    ...Object.fromEntries(
      ["title", "subtitle", "description", "ribbon_text"].map((key) => [
        key,
        tr[key] === undefined ? base[key] : tr[key],
      ]),
    ),
    variants: base.variants.map((v, i) => ({
      ...v,
      title:
        tr.variants?.find((x) => x.id === v.id)?.title ??
        (v.title === "Default" ? "الافتراضي" : v.title),
    })),
    additional_info: (base.additional_info || []).map((info, i) => ({
      ...info,
      ...tr.additional_info?.[i],
    })),
  };
}
export function updateProductContent(base, language, key, value) {
  if (key === "images")
    return {
      ...base,
      images: value,
      variants: base.variants.map((v) => ({
        ...v,
        image_url: value.some((image) => image.url === v.image_url)
          ? v.image_url
          : null,
      })),
    };
  if (key === "variants") {
    const next = {
      ...base,
      variants: value.map((v) => ({
        ...v,
        title: base.variants.find((old) => old.id === v.id)?.title ?? v.title,
      })),
    };
    if (language === "ar")
      next.translations = {
        ...base.translations,
        ar: {
          ...base.translations?.ar,
          variants: value.map((v) => ({
            id: v.id,
            title: base.variants.some((old) => old.id === v.id)
              ? v.title
              : v.title === "Default"
                ? "الافتراضي"
                : v.title,
          })),
        },
      };
    return next;
  }
  if (
    language !== "ar" ||
    ![
      "title",
      "subtitle",
      "description",
      "ribbon_text",
      "additional_info",
    ].includes(key)
  ) {
    const next = { ...base, [key]: value };
    if (key === "additional_info" && base.translations?.ar?.additional_info)
      next.translations = {
        ...base.translations,
        ar: {
          ...base.translations.ar,
          additional_info: value.map((info, i) => {
            const index = base.additional_info.findIndex(
              (old) => old.id && old.id === info.id,
            );
            return (
              base.translations.ar.additional_info[index < 0 ? i : index] || {
                title: info.title,
                description: info.description,
              }
            );
          }),
        },
      };
    return next;
  }
  const next = {
    ...base,
    translations: {
      ...base.translations,
      ar: { ...base.translations?.ar, [key]: value },
    },
  };
  if (key === "additional_info")
    next.additional_info = value.map((info, i) => {
      const previous = info.id
        ? base.additional_info.find((old) => old.id === info.id)
        : base.additional_info[i];
      const item = { ...info, ...previous };
      for (const field of ["title", "description"])
        if (!previous?.[field] || previous?._arabicFallback?.[field]) {
          item[field] = info[field];
          item._arabicFallback = { ...item._arabicFallback, [field]: true };
        }
      return item;
    });
  else if (!base[key] || base._arabicFallback?.[key]) {
    next[key] = value;
    next._arabicFallback = { ...base._arabicFallback, [key]: true };
  }
  return next;
}
export function updateVariantContent(base, language, index, key, value) {
  if (language !== "ar" || key !== "title")
    return {
      ...base,
      variants: base.variants.map((v, i) =>
        i === index ? { ...v, [key]: value } : v,
      ),
    };
  const variants = base.variants.map((v, i) => ({
    id: v.id,
    title:
      i === index
        ? value
        : (base.translations?.ar?.variants?.find((x) => x.id === v.id)?.title ??
          v.title),
  }));
  return {
    ...base,
    translations: {
      ...base.translations,
      ar: { ...base.translations?.ar, variants },
    },
  };
}
export function productSeedTranslation(product) {
  const tr = arabicProducts[product.id];
  return tr
    ? {
        ...tr,
        variants: product.variants.map((v, i) => ({
          id: v.id,
          title: tr.variants[i],
        })),
      }
    : null;
}
export { storeFields };
