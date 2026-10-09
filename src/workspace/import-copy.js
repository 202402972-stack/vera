const messages = {
  SOURCE_TIMEOUT: [
    "انتهت مهلة المصدر؛ ستُجرى محاولات محدودة.",
    "Source timed out; bounded retries will run.",
  ],
  SOURCE_NETWORK_UNAVAILABLE: [
    "تعذر اتصال الشبكة بالمصدر؛ ستُجرى محاولات محدودة.",
    "Source network connection failed; bounded retries will run.",
  ],
  SOURCE_DNS_UNAVAILABLE: [
    "تعذر الوصول إلى DNS المصدر؛ يلزم السماح بنطاق المتجر والصور في إعداد شبكة الخادم.",
    "Source DNS is unavailable; allow the store and image domains in the server network configuration.",
  ],
  MIXED_SOURCE_CURRENCIES: [
    "عملات مختلفة داخل المنتج؛ راجع كل سعر وأكد عملة الأرقام يدويًا.",
    "Mixed currencies within this product; review each price and explicitly confirm the numeric price currency.",
  ],
  TITLE_REQUIRED_OR_TOO_LONG: [
    "راجع اسم المنتج (حتى ٩٠ حرفًا).",
    "Review the product title (up to 90 characters).",
  ],
  CURRENCY_REQUIRED_OR_UNSUPPORTED: [
    "أكد عملة أسعار المصدر قبل النقل.",
    "Confirm the source price currency before import.",
  ],
  UNSUPPORTED_VARIANT_COUNT: [
    "عدد الخيارات غير مدعوم؛ الحد ٤٠ متغيرًا دون حذف صامت.",
    "Unsupported variant count; the limit is 40, with no silent truncation.",
  ],
  IMAGE_COUNT_REVIEW: [
    "أضف من صورة إلى ١٢ صورة لهذا المنتج.",
    "Provide 1 to 12 images for this product.",
  ],
  IMAGE_URL_REVIEW_REQUIRED: [
    "راجع رابط الصورة؛ يجب أن يكون عامًا وبروتوكوله HTTP أو HTTPS.",
    "Review the image URL; it must be public HTTP or HTTPS.",
  ],
  PRICE_REQUIRED: [
    "صحح سعر كل خيار؛ لا أسعار مفترضة.",
    "Correct every variant price; prices are never assumed.",
  ],
  INVENTORY_REVIEW_REQUIRED: [
    "أكد المخزون لكل خيار أو سياسة البيع دون حد.",
    "Confirm each variant’s stock or an unlimited inventory policy.",
  ],
  UNSUPPORTED_OPTION_COUNT: [
    "أكثر من ثلاثة محاور خيارات؛ يحتاج معالجة في المصدر.",
    "More than three option axes; edit the source.",
  ],
  CATEGORY_TOO_LONG: [
    "اختصر التصنيف إلى ٤٠ حرفًا.",
    "Shorten the category to 40 characters.",
  ],
  PUBLIC_SOURCE_MAY_BE_PARTIAL: [
    "قد تكون قراءة الموقع العامة جزئية؛ قارنها بالمصدر.",
    "Public reading may be partial; compare it with the source.",
  ],
  INVENTORY_NOT_PUBLIC: [
    "المصدر العام لا يؤكد المخزون.",
    "The public source does not confirm inventory.",
  ],
  STRUCTURED_DATA_REVIEW_REQUIRED: [
    "هذه بيانات عامة منظمة؛ راجع الخيارات والاكتمال.",
    "These are public structured data; review options and completeness.",
  ],
  UNSUPPORTED_PRODUCT_TYPE: [
    "نوع المنتج غير مدعوم؛ لا يُحوّل إلى منتج بسيط تلقائيًا.",
    "Unsupported product type; it is not automatically converted to a simple product.",
  ],
  SOURCE_PRIVATE_ADDRESS: [
    "لا يمكن القراءة من عنوان داخلي أو غير عام.",
    "Internal or non-public destinations cannot be read.",
  ],
  SOURCE_UNSAFE_URL: [
    "الرابط غير صالح للقراءة الآمنة.",
    "The URL cannot be read safely.",
  ],
  SOURCE_REQUIRES_ACCESS: [
    "المصدر محمي؛ استخدم ملف CSV أو اتصالًا رسميًا.",
    "The source is protected; use CSV or an official connection.",
  ],
  SOURCE_RATE_LIMIT: [
    "المصدر يحد الطلبات؛ ستُجرى محاولات محدودة ثم يمكنك إعادة المحاولة.",
    "The source limits requests; bounded retries run before manual retry.",
  ],
  SOURCE_INVALID_TYPE: [
    "المصدر أعاد نوع ملف غير متوقع؛ استخدم CSV أو الاتصال الرسمي.",
    "The source returned an unexpected file type; use CSV or an official connection.",
  ],
  SOURCE_NO_PUBLIC_PRODUCTS_USE_CSV_OR_CONNECTION: [
    "لم نجد منتجات عامة قابلة للقراءة؛ CSV والربط الرسمي بديلان.",
    "No readable public products were found; use CSV or an official connection.",
  ],
  PRODUCT_LIMIT_SOURCE_PARTIAL: [
    "وصلنا إلى حد ٥٠٠ منتج؛ التقرير يمثل الجزء المقروء فقط.",
    "The 500-product limit was reached; the report covers the portion read.",
  ],
  TARGET_CURRENCY_MUST_MATCH_REVIEWED_PRODUCTS: [
    "عملة المتجر يجب أن تطابق أسعار المنتجات التي راجعتها.",
    "Store currency must match the reviewed product prices.",
  ],
  RESOLVE_SELECTED_ITEMS: [
    "أصلح مشكلات العناصر المحددة أو ألغِ تحديدها.",
    "Resolve selected items’ issues or deselect them.",
  ],
  SELECT_PRODUCTS: [
    "حدد منتجًا سليمًا على الأقل للنقل.",
    "Select at least one valid product to import.",
  ],
  ONE_ACTIVE_JOB_PER_ACCOUNT: [
    "لديك مهمة نشطة؛ انتظرها أو ألغِها قبل بدء أخرى.",
    "An import is active; wait or cancel before starting another.",
  ],
  FEATURE_TEMPORARILY_UNAVAILABLE: [
    "هذه الميزة متوقفة مؤقتًا بإعداد مسؤول المنصة.",
    "This feature is temporarily disabled by the platform operator.",
  ],
  IMAGE_PREVIEW_UNAVAILABLE: [
    "تعذرت معاينة الصورة؛ راجع رابطها قبل الاعتماد.",
    "Image preview is unavailable; review its URL before committing.",
  ],
  IMAGE_BUDGET_EXCEEDED: [
    "بلغت المهمة سقف تحميل الصور ٥٠٠ ميجابايت.",
    "The job reached its 500 MB image download budget.",
  ],
  IMAGE_COUNT_BUDGET_EXCEEDED: [
    "بلغت المهمة سقف تحميل ٢٠٠٠ صورة.",
    "The job reached its 2000-image download limit.",
  ],
  SOURCE_TOO_LARGE: [
    "تجاوز ملف المصدر الحد المسموح.",
    "The source file exceeds the allowed size.",
  ],
  CONNECTION_EXPIRED_RECONNECT: [
    "انتهت صلاحية الاتصال؛ أعد الربط.",
    "The connection expired; reconnect.",
  ],
  CONNECTION_DISCONNECTED: [
    "فُصل الاتصال؛ اختر اتصالًا مصرحًا آخر.",
    "The connection was disconnected; choose another authorized connection.",
  ],
};
export const importIssue = (code, language) =>
  messages[code]?.[language === "ar" ? 0 : 1] || code;
export const columnNames = {
  id: ["معرف المنتج", "Product ID"],
  title: ["الاسم", "Title"],
  description: ["الوصف", "Description"],
  image: ["الصورة", "Image"],
  price: ["السعر", "Price"],
  currency: ["العملة", "Currency"],
  stock: ["المخزون", "Stock"],
  sku: ["رمز المنتج", "SKU"],
  variantId: ["معرف المتغير", "Variant ID"],
  option1: ["قيمة الخيار الأول", "Option 1 value"],
  optionName1: ["اسم الخيار الأول", "Option 1 name"],
  option2: ["قيمة الخيار الثاني", "Option 2 value"],
  optionName2: ["اسم الخيار الثاني", "Option 2 name"],
  option3: ["قيمة الخيار الثالث", "Option 3 value"],
  optionName3: ["اسم الخيار الثالث", "Option 3 name"],
  parent: ["المنتج الأب", "Parent product"],
  type: ["نوع المنتج", "Product type"],
  category: ["التصنيف", "Category"],
};
