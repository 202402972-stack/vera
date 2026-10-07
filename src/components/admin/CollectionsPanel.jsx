import React, { useEffect, useState } from "react";
import { api, jsonRequest } from "@/api/store";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
export default function CollectionsPanel() {
  const { language } = useLanguage();
  const t = (ar, en) => (language === "ar" ? ar : en);
  const [open, setOpen] = useState(false),
    [data, setData] = useState(null),
    [editing, setEditing] = useState(null),
    [query, setQuery] = useState(""),
    [products, setProducts] = useState([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open)
      api("/admin/collections")
        .then(setData)
        .catch((e) => setError(e.message));
  }, [open]);
  const editingId = editing?.id;
  useEffect(() => {
    if (!editingId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api("/admin/products?search=" + encodeURIComponent(query), {
        signal: controller.signal,
      })
        .then((r) => setProducts(r.products))
        .catch((e) => {
          if (e.name !== "AbortError") setError(e.message);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, editingId]);
  async function save(next) {
    setBusy(true);
    setError("");
    try {
      const r = await api(
        "/admin/collections",
        jsonRequest("PUT", { version: data.version, collections: next }),
      );
      setData(r);
      setEditing(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            {t("مجموعات المتجر", "Store collections")}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              "مجموعات مستقلة، ويمكن أن يظهر المنتج في أكثر من مجموعة.",
              "Create distinct collections. A product can belong to more than one.",
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => setOpen(!open)}>
          {open
            ? t("إغلاق", "Close")
            : t("إدارة المجموعات", "Manage collections")}
        </Button>
      </div>
      {open && (
        <div className="mt-5">
          {error && (
            <p role="alert" className="text-red-700 text-sm mb-4">
              {error}
            </p>
          )}
          {data && !editing && (
            <>
              <div className="grid gap-2 mb-4">
                {data.collections.map((c) => (
                  <div
                    key={c.id}
                    className="flex gap-3 items-center justify-between border rounded-lg p-3"
                  >
                    <div>
                      <strong>
                        {language === "ar" ? c.nameAr || c.name : c.name}
                      </strong>
                      <p className="text-xs text-muted-foreground">
                        {c.productIds.length} {t("منتجات", "products")} ·{" "}
                        {c.published
                          ? t("منشورة", "Published")
                          : t("مسودة", "Draft")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing(structuredClone(c));
                        setQuery("");
                      }}
                    >
                      {t("تعديل", "Edit")}
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                onClick={() => {
                  setEditing({
                    id: "collection-" + crypto.randomUUID().slice(0, 8),
                    name: "",
                    nameAr: "",
                    description: "",
                    descriptionAr: "",
                    productIds: [],
                    published: true,
                  });
                  setQuery("");
                }}
              >
                {t("مجموعة جديدة", "New collection")}
              </Button>
            </>
          )}
          {editing && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                const list = data.collections.some((c) => c.id === editing.id)
                  ? data.collections.map((c) =>
                      c.id === editing.id ? editing : c,
                    )
                  : [...data.collections, editing];
                save(list);
              }}
            >
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  [
                    "name",
                    t("اسم المجموعة — English", "Collection name — English"),
                  ],
                  [
                    "nameAr",
                    t("اسم المجموعة — عربي", "Collection name — Arabic"),
                  ],
                  [
                    "description",
                    t("الوصف — English", "Description — English"),
                  ],
                  ["descriptionAr", t("الوصف — عربي", "Description — Arabic")],
                ].map(([key, label]) => (
                  <label key={key} className="grid gap-2 text-sm">
                    {label}
                    <input
                      className="rounded-md border px-3 py-2"
                      value={editing[key]}
                      required={key === "name"}
                      maxLength={key.startsWith("description") ? 300 : 80}
                      onChange={(e) =>
                        setEditing({ ...editing, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.published}
                  onChange={(e) =>
                    setEditing({ ...editing, published: e.target.checked })
                  }
                />
                {t(
                  "عرض المجموعة في المتجر",
                  "Publish collection in the storefront",
                )}
              </label>
              <label className="grid gap-2 text-sm">
                {t("ابحث لإضافة منتجات", "Search to add products")}
                <input
                  type="search"
                  className="rounded-md border px-3 py-2"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {editing.productIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="border rounded-full text-xs px-3 py-1"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        productIds: editing.productIds.filter((x) => x !== id),
                      })
                    }
                  >
                    {id} ×
                  </button>
                ))}
              </div>
              <div className="max-h-52 overflow-auto grid gap-2 border rounded-lg p-3">
                {products.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={editing.productIds.includes(p.id)}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          productIds: e.target.checked
                            ? [...editing.productIds, p.id]
                            : editing.productIds.filter((x) => x !== p.id),
                        })
                      }
                    />
                    {language === "ar"
                      ? p.translations?.ar?.title || p.title
                      : p.title}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button disabled={busy}>
                  {t("حفظ المجموعة", "Save collection")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(null)}
                >
                  {t("إلغاء", "Cancel")}
                </Button>
                {data.collections.some((c) => c.id === editing.id) && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      save(data.collections.filter((c) => c.id !== editing.id))
                    }
                  >
                    {t("حذف المجموعة", "Delete collection")}
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
