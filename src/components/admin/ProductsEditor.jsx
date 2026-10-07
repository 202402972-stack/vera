import CollectionsPanel from "./CollectionsPanel";
import { useSearchParams } from "react-router-dom";
import { useUploads } from "./UploadContext";
import ResponsiveTable from "./ResponsiveTable";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import {
  localizeProduct,
  updateProductContent,
  updateVariantContent,
} from "@/i18n/content";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  Copy,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, jsonRequest, formatCurrency } from "@/api/store";
import { useStore } from "@/hooks/useStore";
import {
  Panel,
  Field,
  ImagePicker,
  Notice,
  Busy,
  SaveButton,
  ConfirmDialog,
} from "./AdminUI";
const slug = (v) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
export default function ProductsEditor({ notify }) {
  const { t, language } = useLanguage();
  const [uploadCount] = useUploads();
  const { store } = useStore();
  const [params] = useSearchParams();
  const requestedProduct = params.get("product");
  useEffect(() => {
    if (!requestedProduct) return;
    api(`/admin/products/${encodeURIComponent(requestedProduct)}`)
      .then((p) => {
        setEditor(p);
        setSavedProduct(JSON.stringify(p));
        setIsNew(false);
      })
      .catch((e) => setError(e.message));
  }, [requestedProduct]);
  const [savedProduct, setSavedProduct] = useState("");
  const [products, setProducts] = useState(null),
    [rawEditor, setEditor] = useState(null),
    [isNew, setIsNew] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(null),
    [search, setSearch] = useState("");
  const [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [metadata, setMetadata] = useState({ total: 0, pages: 1 });
  const editorRef = useRef(null);
  const reload = useCallback(
    () =>
      api(`/admin/products?page=${page}&search=${encodeURIComponent(query)}`)
        .then((data) => {
          setProducts(data.products);
          setMetadata(data);
          if (page > data.pages) setPage(data.pages);
        })
        .catch((e) => setError(e.message)),
    [page, query],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const editor = rawEditor ? localizeProduct(rawEditor, language) : null;
  const editorId = editor?.id;
  useEffect(() => {
    if (editorId)
      editorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }, [editorId]);
  const newVariant = () => ({
    id: `style-${crypto.randomUUID().slice(0, 8)}`,
    title: "Default",
    price_in_cents: 0,
    sale_price_in_cents: null,
    currency: store.checkout.currency,
    currency_info: {
      code: store.checkout.currency,
      symbol: store.checkout.symbol,
      decimal_digits: 2,
    },
    manage_inventory: true,
    inventory_quantity: 0,
    image_url: null,
    options: [],
  });
  function create() {
    setEditor({
      id: `product-${crypto.randomUUID().slice(0, 8)}`,
      title: "",
      subtitle: "",
      description: "",
      ribbon_text: "",
      images: [],
      purchasable: true,
      status: "draft",
      variants: [newVariant()],
      additional_info: [],
    });
    setIsNew(true);
    setError("");
  }
  function edit(p) {
    const original = products.find((x) => x.id === p.id) || p;
    setEditor(structuredClone(original));
    setSavedProduct(JSON.stringify(original));
    setIsNew(false);
    setError("");
  }
  const update = (key, value) =>
    setEditor((prev) => updateProductContent(prev, language, key, value));
  const variantUpdate = (i, key, value) =>
    setEditor((prev) => updateVariantContent(prev, language, i, key, value));
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        isNew ? "/admin/products" : `/admin/products/${editor.id}`,
        jsonRequest(isNew ? "POST" : "PUT", rawEditor),
      );
      await reload();
      setEditor(null);
      notify(isNew ? "Product added." : "Product updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api(`/admin/products/${deleting.id}`, {
        method: "DELETE",
      });
      if (editor?.id === deleting.id) setEditor(null);
      setDeleting(null);
      await reload();
      notify("Product deleted. Existing orders keep their original details.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function move(index, direction) {
    if (busy) return;
    setBusy(true);
    try {
      await api(
        `/admin/products/${products[index].id}/move`,
        jsonRequest("POST", { direction }),
      );
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!products)
    return localizeView(error ? <Notice error>{error}</Notice> : <Busy />, t);
  const visible = products.map((p) => localizeProduct(p, language));
  return localizeView(
    <div className="space-y-6">
      {!editor && <CollectionsPanel/>}
      {error && (
        <Notice error>
          {error}
          {editor && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                api(`/admin/products/${editor.id}`)
                  .then((latest) => {
                    setEditor(latest);
                    void reload();
                    setError("");
                  })
                  .catch((e) => setError(e.message))
              }
            >
              Reload latest data
            </Button>
          )}
        </Notice>
      )}
      <Panel
        title="Your collection"
        subtitle={`${metadata.total} products · Existing catalogue, ready to edit.`}
        icon={Package}
        action={
          <Button onClick={create} disabled={uploadCount > 0}>
            <Plus size={16} className="mr-2" /> Add product
          </Button>
        }
      >
        <div className="mb-5">
          <input
            aria-label="Search products"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="admin-table-wrap">
          <ResponsiveTable>
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <img
                        src={p.image}
                        alt={p.title}
                        className="w-10 h-12 rounded-md object-cover"
                      />
                      <div>
                        <strong>{p.title}</strong>
                        <p className="text-[10px] text-muted-foreground">
                          {p.variants.length} styles · {p.subtitle}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    {formatCurrency(
                      p.variants[0].sale_price_in_cents ??
                        p.variants[0].price_in_cents,
                      p.variants[0].currency_info,
                    )}
                  </td>
                  <td>
                    {p.variants.some((v) => !v.manage_inventory)
                      ? "Unlimited"
                      : p.variants.reduce(
                          (n, v) => n + v.inventory_quantity,
                          0,
                        )}
                  </td>
                  <td>
                    <span className={`admin-status ${p.status}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        className="admin-action-button"
                        disabled={uploadCount > 0}
                        onClick={() => edit(p)}
                        aria-label={`Edit ${p.title}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="admin-action-button"
                        disabled={uploadCount > 0}
                        onClick={() => {
                          const copy = structuredClone(
                            products.find((x) => x.id === p.id),
                          );
                          const oldVariants = copy.variants;
                          copy.id = `${slug(copy.title) || "product"}-${crypto.randomUUID().slice(0, 6)}`;
                          copy.title = `${copy.title} Copy`;
                          if (copy.translations?.ar?.title)
                            copy.translations.ar.title += " — نسخة";
                          copy.status = "draft";
                          copy.variants = copy.variants.map((v, i) => ({
                            ...v,
                            id: `${copy.id}-style-${i}`,
                          }));
                          if (copy.translations?.ar?.variants)
                            copy.translations.ar.variants =
                              copy.translations.ar.variants
                                .map((tr) => ({
                                  ...tr,
                                  id: copy.variants[
                                    oldVariants.findIndex((v) => v.id === tr.id)
                                  ]?.id,
                                }))
                                .filter((tr) => tr.id);
                          delete copy._version;
                          setEditor(copy);
                          setIsNew(true);
                        }}
                        aria-label={`Duplicate ${p.title}`}
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        className="admin-action-button"
                        onClick={() =>
                          move(
                            products.findIndex((x) => x.id === p.id),
                            -1,
                          )
                        }
                        disabled={
                          uploadCount > 0 ||
                          busy ||
                          query !== "" ||
                          (page === 1 &&
                            products.findIndex((x) => x.id === p.id) === 0)
                        }
                        aria-label={`Move ${p.title} up`}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        className="admin-action-button"
                        onClick={() =>
                          move(
                            products.findIndex((x) => x.id === p.id),
                            1,
                          )
                        }
                        disabled={
                          uploadCount > 0 ||
                          busy ||
                          query !== "" ||
                          (page === metadata.pages &&
                            products.findIndex((x) => x.id === p.id) ===
                              products.length - 1)
                        }
                        aria-label={`Move ${p.title} down`}
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        className="admin-action-button"
                        disabled={uploadCount > 0}
                        onClick={() => setDeleting(p)}
                        aria-label={`Delete ${p.title}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </div>
        {!visible.length && (
          <div className="admin-empty">
            No matching products. Add your first product to get started.
          </div>
        )}
        {metadata.pages > 1 && (
          <div className="flex justify-between items-center gap-3 mt-5 text-xs">
            <span>
              {page} of {metadata.pages}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadCount > 0 || page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadCount > 0 || page >= metadata.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
      {editor && (
        <form
          ref={editorRef}
          data-dirty={isNew || JSON.stringify(rawEditor) !== savedProduct}
          onSubmit={save}
          className="admin-product-editor space-y-6"
        >
          <Panel
            title={isNew ? "Create a product" : `Edit ${editor.title}`}
            icon={Pencil}
            action={
              <Button
                type="button"
                variant="ghost"
                disabled={uploadCount > 0}
                onClick={() => setEditor(null)}
                aria-label="Close product editor"
              >
                <X size={18} />
              </Button>
            }
          >
            <Notice>
              {language === "ar"
                ? "Editing Arabic copy. Switch language to edit English. Images, stock and prices are shared."
                : "Editing English copy. Switch language to edit Arabic. Images, stock and prices are shared."}
            </Notice>
            <Notice>
              The first image appears on the collection card; the first style
              sets its price. Product names use two lines on cards. Keep names
              to 3–6 words and subtitles to 4–8 words for the original balance.
            </Notice>
            <div className="grid md:grid-cols-2 gap-6">
              <Field
                label="Product name"
                value={editor.title}
                onChange={(v) => update("title", v)}
                required
                maxLength={90}
                hint="3–6 words recommended; maximum 90 characters."
              />
              <Field
                label="Short subtitle"
                value={editor.subtitle}
                onChange={(v) => update("subtitle", v)}
                maxLength={150}
                hint="4–8 words. Displayed under the product name."
              />
              <Field
                label="Product ID / URL"
                value={editor.id}
                onChange={(v) => update("id", v)}
                readOnly={!isNew}
                required
                pattern="[a-z0-9-]+"
                maxLength={100}
                hint="Lowercase letters, numbers and hyphens. Existing IDs stay fixed so links keep working."
              />
              <Field
                label="Category"
                hint="Shared between languages. Used by storefront filters."
                value={editor.category || ""}
                onChange={(v) => update("category", v)}
                maxLength={60}
              />
              <Field
                label="Card badge (optional)"
                value={editor.ribbon_text}
                onChange={(v) => update("ribbon_text", v)}
                maxLength={24}
                hint="1–2 words, such as New or Bestseller."
              />
            </div>
            <Field
              label="Product description"
              value={editor.description}
              onChange={(v) => update("description", v)}
              multiline
              maxLength={12000}
              hint="15–45 words recommended. Basic p, strong, em, ul and li HTML is supported and safely cleaned."
            />
            <div className="flex flex-wrap items-center gap-8">
              <div>
                <label
                  className="text-xs font-semibold block mb-2"
                  htmlFor="product-status"
                >
                  Visibility
                </label>
                <select
                  id="product-status"
                  value={editor.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  <option value="draft">Draft · hidden from store</option>
                  <option value="published">
                    Published · visible in store
                  </option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editor.purchasable}
                  onChange={(e) => update("purchasable", e.target.checked)}
                />{" "}
                Available to buy
              </label>
            </div>
          </Panel>
          <Panel
            title="Product images"
            subtitle="The same 4:5 proportion is used throughout the original design."
            icon={Package}
          >
            {editor.images.map((img, i) => (
              <div key={i}>
                <div className="flex justify-between">
                  <span className="admin-section-label">
                    {i === 0 ? "Cover image" : `Gallery image ${i + 1}`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="admin-action-button"
                      disabled={uploadCount > 0 || i === 0}
                      onClick={() => {
                        const images = [...editor.images];
                        [images[i], images[i - 1]] = [images[i - 1], images[i]];
                        update("images", images);
                      }}
                      aria-label={`Move image ${i + 1} up`}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      className="admin-action-button"
                      disabled={uploadCount > 0}
                      onClick={() =>
                        update(
                          "images",
                          editor.images.filter((_, n) => n !== i),
                        )
                      }
                      aria-label={`Remove image ${i + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <ImagePicker
                  label={
                    i === 0 ? "Cover photograph" : `Gallery photograph ${i + 1}`
                  }
                  value={img.url}
                  onChange={(url) =>
                    update(
                      "images",
                      editor.images.map((x, n) =>
                        n === i
                          ? {
                              url,
                            }
                          : x,
                      ),
                    )
                  }
                  onError={setError}
                />
              </div>
            ))}
            {editor.images.length < 12 && (
              <ImagePicker
                label={
                  editor.images.length
                    ? "Add another gallery image"
                    : "Upload a cover image (required)"
                }
                value=""
                onChange={(url) =>
                  update("images", [
                    ...editor.images,
                    {
                      url,
                    },
                  ])
                }
                onError={setError}
              />
            )}
          </Panel>
          <Panel
            title="Styles, prices & inventory"
            subtitle={`Enter prices in ${store.checkout.currency} (${store.checkout.symbol}), for example 65.00. Currency is managed in Footer & settings.`}
            icon={Package}
          >
            {editor.variants.map((v, i) => (
              <div
                key={v.id}
                className="border border-border rounded-xl p-5 mb-5"
              >
                <div className="flex justify-between mb-4">
                  <h3 className="text-xl">
                    Style {i + 1}
                    {i === 0 ? " · card default" : ""}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={editor.variants.length === 1}
                    onClick={() =>
                      update(
                        "variants",
                        editor.variants.filter((_, n) => n !== i),
                      )
                    }
                    aria-label={`Remove style ${i + 1}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <Field
                    label="Style name"
                    value={v.title}
                    onChange={(value) => variantUpdate(i, "title", value)}
                    maxLength={60}
                    required
                    hint="A colour, size or other option."
                  />
                  <Field
                    label="Price"
                    type="number"
                    value={v.price_in_cents / 100}
                    onChange={(value) =>
                      variantUpdate(
                        i,
                        "price_in_cents",
                        Math.round(Number(value) * 100),
                      )
                    }
                    min="0"
                    max="1000000"
                    step="0.01"
                    required
                  />
                  <Field
                    label="Sale price (optional)"
                    type="number"
                    value={
                      v.sale_price_in_cents == null
                        ? ""
                        : v.sale_price_in_cents / 100
                    }
                    onChange={(value) =>
                      variantUpdate(
                        i,
                        "sale_price_in_cents",
                        value === "" ? null : Math.round(Number(value) * 100),
                      )
                    }
                    min="0"
                    max={v.price_in_cents / 100}
                    step="0.01"
                    hint="Leave empty for no sale."
                  />
                  <Field
                    label="Stock"
                    type="number"
                    value={v.inventory_quantity ?? 0}
                    onChange={(value) =>
                      variantUpdate(i, "inventory_quantity", Number(value))
                    }
                    min="0"
                    step="1"
                    disabled={!v.manage_inventory}
                    hint="0 means sold out when stock is tracked."
                  />
                </div>
                <label className="flex items-center gap-2 text-xs mb-4">
                  <input
                    type="checkbox"
                    checked={v.manage_inventory}
                    onChange={(e) =>
                      variantUpdate(i, "manage_inventory", e.target.checked)
                    }
                  />{" "}
                  Track inventory (uncheck for unlimited stock)
                </label>
                <div>
                  <label
                    className="text-xs font-semibold block mb-2"
                    htmlFor={`variant-image-${i}`}
                  >
                    Style image (optional)
                  </label>
                  <select
                    id={`variant-image-${i}`}
                    value={v.image_url || ""}
                    onChange={(e) =>
                      variantUpdate(i, "image_url", e.target.value || null)
                    }
                  >
                    <option value="">Use cover image</option>
                    {editor.images.map((img, n) => (
                      <option key={n} value={img.url}>
                        Gallery image {n + 1}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="admin-hint">
                  Style ID: {v.id}. Kept stable for carts and orders.
                </p>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={editor.variants.length >= 40}
              onClick={() =>
                update("variants", [...editor.variants, newVariant()])
              }
            >
              <Plus size={16} className="mr-2" /> Add style / size
            </Button>
          </Panel>
          <Panel
            title="Extra product details"
            subtitle="Add material, dimensions, care instructions or other information. Shown below the purchase area."
            icon={Plus}
          >
            {editor.additional_info.map((info, i) => (
              <div
                key={i}
                className="grid md:grid-cols-[1fr_2fr_auto] items-start gap-4"
              >
                <Field
                  label="Heading"
                  value={info.title}
                  onChange={(value) =>
                    update(
                      "additional_info",
                      editor.additional_info.map((x, n) =>
                        n === i
                          ? {
                              ...x,
                              title: value,
                            }
                          : x,
                      ),
                    )
                  }
                  maxLength={60}
                  required
                />
                <Field
                  label="Detail"
                  value={info.description}
                  onChange={(value) =>
                    update(
                      "additional_info",
                      editor.additional_info.map((x, n) =>
                        n === i
                          ? {
                              ...x,
                              description: value,
                            }
                          : x,
                      ),
                    )
                  }
                  multiline
                  maxLength={12000}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-6"
                  onClick={() =>
                    update(
                      "additional_info",
                      editor.additional_info.filter((_, n) => n !== i),
                    )
                  }
                  aria-label={`Remove detail ${i + 1}`}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={editor.additional_info.length >= 20}
              onClick={() =>
                update("additional_info", [
                  ...editor.additional_info,
                  {
                    title: "",
                    description: "",
                  },
                ])
              }
            >
              <Plus size={16} className="mr-2" /> Add detail
            </Button>
          </Panel>
          {error && (
            <Notice error>
              {error}
              {editor && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    api(`/admin/products/${editor.id}`)
                      .then((latest) => {
                        setEditor(latest);
                        void reload();
                        setError("");
                      })
                      .catch((e) => setError(e.message))
                  }
                >
                  Reload latest data
                </Button>
              )}
            </Notice>
          )}
          <div className="sticky bottom-4 bg-card/95 border border-border rounded-xl p-4 flex justify-between items-center backdrop-blur shadow-lg">
            <Button
              type="button"
              variant="ghost"
              disabled={uploadCount > 0}
              onClick={() => setEditor(null)}
            >
              Cancel
            </Button>
            <SaveButton busy={busy}>
              {isNew ? "Create product" : "Save product"}
            </SaveButton>
          </div>
        </form>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this product?"
          onClose={() => setDeleting(null)}
          onConfirm={remove}
          busy={busy}
        >
          “{deleting.title}” will be removed from the collection. Existing
          orders retain their product information and images.
        </ConfirmDialog>
      )}
    </div>,
    t,
  );
}
