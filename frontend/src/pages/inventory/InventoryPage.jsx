import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Minus,
  Package,
  PackageX,
  PencilLine,
  Plus,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import SplitText from "../../components/reactbits/SplitText";
import CountUp from "../../components/reactbits/CountUp";
import useStaggerReveal from "../../hooks/useStaggerReveal";
import api from "../../services/api";
import { formatCurrency } from "../../utils/formatCurrency";
import { useToast } from "../../context/ToastContext";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/layout/ConfirmDialog";

const LOW_STOCK = 10;
const PAGE_SIZE = 8;

const emptyForm = {
  name: "",
  description: "",
  price: "",
  costPrice: "",
  stockQuantity: "",
  category: "",
  imageURL: "",
};

const DEFAULT_CATEGORIES = [
  "Electronics",
  "Wearables",
  "Accessories",
  "Storage",
  "Clothing",
  "Bags",
  "Home",
  "Beauty",
  "Groceries",
  "Other",
];

const ProductThumb = ({ src, name }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/30">
        <Package size={18} />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-11 w-11 shrink-0 rounded-xl border border-white/10 object-cover"
    />
  );
};

const Field = ({ label, hint, children, className = "", as: Tag = "label" }) => (
  <Tag className={`block ${className}`}>
    <span className="mb-1.5 flex items-baseline justify-between text-xs font-medium text-white/55">
      {label}
      {hint ? <span className="text-[11px] font-normal text-white/35">{hint}</span> : null}
    </span>
    {children}
  </Tag>
);

const inputClass =
  "w-full rounded-xl border border-white/10 bg-v-surface px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-v-accent/50";

const InventoryPage = () => {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [customCategory, setCustomCategory] = useState("");
  const [imagePreviewURL, setImagePreviewURL] = useState("");
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState(() => (searchParams.get("filter") === "low" ? "low" : "all"));
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const categoryOptions = useMemo(() => {
    const fromData = products.map((p) => p.category).filter(Boolean);
    return [...new Set([...DEFAULT_CATEGORIES, ...fromData].map((c) => String(c).trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [products]);

  const usedCategories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const stats = useMemo(() => {
    const low = products.filter((p) => Number(p.stockQuantity) > 0 && Number(p.stockQuantity) < LOW_STOCK).length;
    const out = products.filter((p) => Number(p.stockQuantity) <= 0).length;
    const value = products.reduce((sum, p) => sum + Number(p.costPrice || 0) * Number(p.stockQuantity || 0), 0);
    const negative = products.filter((p) => Number(p.price || 0) < Number(p.costPrice || 0)).length;
    return { total: products.length, low, out, value, negative };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = products.filter((p) => {
      const qty = Number(p.stockQuantity);
      if (stockFilter === "low" && !(qty < LOW_STOCK)) return false;
      if (stockFilter === "out" && qty > 0) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (!term) return true;
      return [p.name, p.category, p.description].filter(Boolean).some((v) => v.toLowerCase().includes(term));
    });
    return [...base].sort((a, b) => {
      if (sortBy === "priceAsc") return Number(a.price) - Number(b.price);
      if (sortBy === "priceDesc") return Number(b.price) - Number(a.price);
      if (sortBy === "stockAsc") return Number(a.stockQuantity) - Number(b.stockQuantity);
      if (sortBy === "stockDesc") return Number(b.stockQuantity) - Number(a.stockQuantity);
      if (sortBy === "name") return String(a.name).localeCompare(String(b.name));
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [products, search, stockFilter, categoryFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = useMemo(
    () => filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredProducts, page]
  );

  const fetchProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/products");
      setProducts(data.data || []);
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to load products.";
      setError(message);
      toast.error("Inventory load failed", message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setPage(1), [search, sortBy, stockFilter, categoryFilter]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  useEffect(
    () => () => {
      if (imagePreviewURL) URL.revokeObjectURL(imagePreviewURL);
    },
    [imagePreviewURL]
  );

  /* ---------------- Form ---------------- */

  const handleInput = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "imageURL") {
      setImagePreviewURL("");
      setImagePreviewError(false);
      setSelectedImageFile("");
    }
  };

  const parseStock = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  };

  const resetImageState = () => {
    setCustomCategory("");
    setImagePreviewURL("");
    setImagePreviewError(false);
    setSelectedImageFile("");
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    resetImageState();
    setShowForm(true);
  };

  const openEdit = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name || "",
      description: product.description || "",
      price: product.price ?? "",
      costPrice: product.costPrice ?? "",
      stockQuantity: product.stockQuantity ?? "",
      category: product.category || "",
      imageURL: product.imageURL || "",
    });
    resetImageState();
    setShowForm(true);
  };

  const closeForm = () => {
    if (submitting) return;
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file", "Please choose an image file.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("File too large", "Please use an image under 3MB.");
      return;
    }
    setSelectedImageFile(file.name || "");
    const localURL = URL.createObjectURL(file);
    setImagePreviewURL(localURL);
    setImagePreviewError(false);
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, imageURL: String(reader.result || "") }));
    reader.onerror = () => toast.error("Upload failed", "Could not read that file.");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const formPrice = Number(form.price);
  const formCost = Number(form.costPrice);
  const formMargin =
    form.price !== "" && form.costPrice !== "" && formPrice > 0
      ? Math.round(((formPrice - formCost) / formPrice) * 1000) / 10
      : null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const categoryValue =
      form.category === "__custom__" ? customCategory.trim() : String(form.category || "").trim();
    if (!categoryValue) {
      toast.error("Missing category", "Please select or enter a category.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        category: categoryValue,
        price: Number(form.price),
        costPrice: Number(form.costPrice),
        stockQuantity: parseStock(form.stockQuantity),
      };
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        toast.success("Product updated", `${payload.name} was saved.`);
      } else {
        await api.post("/products", payload);
        toast.success("Product added", `${payload.name} is now in inventory.`);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      await fetchProducts();
    } catch (err) {
      toast.error("Save failed", err?.response?.data?.message || "Failed to save product.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/products/${deleteTarget._id}`);
      setProducts((prev) => prev.filter((p) => p._id !== deleteTarget._id));
      toast.success("Product deleted", `${deleteTarget.name} was removed.`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error("Delete failed", err?.response?.data?.message || "Failed to delete product.");
    } finally {
      setDeleting(false);
    }
  };

  const pageRef = useRef(null);
  useStaggerReveal(pageRef, [loading], { y: 16, stagger: 0.04 });

  const statCards = [
    { label: "Products", value: stats.total, icon: Package, tone: "text-white", filter: "all" },
    { label: "Low stock", value: stats.low, icon: AlertTriangle, tone: "text-amber-300", filter: "low" },
    { label: "Out of stock", value: stats.out, icon: PackageX, tone: "text-red-300", filter: "out" },
    { label: "Stock value (cost)", value: stats.value, icon: Wallet, tone: "text-v-accent", money: true },
  ];

  const rangeStart = filteredProducts.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredProducts.length);
  const previewSrc = imagePreviewURL || form.imageURL;

  return (
    <div ref={pageRef} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            <SplitText text="Inventory" />
          </h1>
          <p className="mt-2 text-sm text-white/50">Products, pricing and stock levels in one place.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-v-accent px-5 py-2.5 text-sm font-bold text-black shadow-v-glow transition hover:bg-v-accent-hover"
        >
          <Plus size={18} strokeWidth={2.5} />
          Add product
        </button>
      </div>

      {/* Stats (low / out of stock act as quick filters) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, tone, filter, money }) => {
          const clickable = Boolean(filter);
          const active = clickable && stockFilter === filter && filter !== "all";
          const Tag = clickable ? "button" : "div";
          return (
            <Tag
              key={label}
              data-reveal
              {...(clickable ? { type: "button", onClick: () => setStockFilter(filter) } : {})}
              className={`rounded-2xl border p-4 text-left transition ${
                active ? "border-v-accent/50 bg-v-accent/[0.06]" : "border-white/[0.07] bg-v-card"
              } ${clickable ? "hover:border-white/20" : ""}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/45">{label}</p>
                <Icon size={16} className={tone} />
              </div>
              <p className={`mt-2 text-2xl font-extrabold ${tone}`}>
                <CountUp
                  value={value}
                  format={(n) => (money ? formatCurrency(Math.round(n)) : Math.round(n).toLocaleString())}
                />
              </p>
            </Tag>
          );
        })}
      </div>

      {stats.negative > 0 ? (
        <div className="flex items-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          <AlertTriangle size={16} className="shrink-0 text-red-300" />
          {stats.negative} product{stats.negative === 1 ? " is" : "s are"} priced below cost.
        </div>
      ) : null}

      {/* Toolbar */}
      <div data-reveal className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex shrink-0 gap-1 rounded-2xl border border-white/10 bg-v-card p-1" role="tablist" aria-label="Stock filter">
          {[
            ["all", "All"],
            ["low", "Low stock"],
            ["out", "Out of stock"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={stockFilter === id}
              onClick={() => setStockFilter(id)}
              className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold transition ${
                stockFilter === id ? "bg-white/[0.09] text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search products</span>
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, category or description"
            className="w-full rounded-2xl border border-white/10 bg-v-card py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-v-accent/50"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/40 hover:text-white"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          ) : null}
        </label>
        <div className="grid grid-cols-2 gap-3 lg:w-[400px]">
          <Select
            ariaLabel="Filter by category"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[{ value: "all", label: "All categories" }, ...usedCategories.map((c) => ({ value: c, label: c }))]}
          />
          <Select
            ariaLabel="Sort products"
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: "newest", label: "Newest" },
              { value: "name", label: "Name A–Z" },
              { value: "priceDesc", label: "Price: high–low" },
              { value: "priceAsc", label: "Price: low–high" },
              { value: "stockAsc", label: "Stock: low–high" },
              { value: "stockDesc", label: "Stock: high–low" },
            ]}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {/* Table */}
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <div data-reveal className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-v-card shadow-v-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 text-right font-semibold">Price</th>
                  <th className="px-4 py-3 text-right font-semibold">Cost</th>
                  <th className="px-4 py-3 font-semibold">Margin</th>
                  <th className="px-4 py-3 font-semibold">Stock</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product) => {
                  const price = Number(product.price || 0);
                  const cost = Number(product.costPrice || 0);
                  const margin = price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : null;
                  const qty = Number(product.stockQuantity || 0);
                  const stockTone = qty <= 0 ? "text-red-300" : qty < LOW_STOCK ? "text-amber-300" : "text-v-green";
                  const barColor = qty <= 0 ? "#f87171" : qty < LOW_STOCK ? "#fbbf24" : "#4ade80";
                  return (
                    <tr key={product._id} className="border-t border-white/[0.05] transition-colors hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <ProductThumb src={product.imageURL} name={product.name} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-white">{product.name}</p>
                            <p className="text-xs text-white/40">{product.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-white">{formatCurrency(price)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-white/60">{formatCurrency(cost)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            margin === null
                              ? "bg-white/10 text-white/60"
                              : margin < 0
                                ? "bg-red-500/15 text-red-300"
                                : "bg-v-green/10 text-v-green"
                          }`}
                        >
                          {margin === null ? "—" : `${margin}%`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`text-sm font-semibold tabular-nums ${stockTone}`}>
                          {qty <= 0 ? "Out of stock" : `${qty} units`}
                        </p>
                        <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(100, (qty / 60) * 100)}%`, backgroundColor: barColor }}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className="rounded-lg border border-white/10 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                            aria-label={`Edit ${product.name}`}
                            title="Edit"
                          >
                            <PencilLine size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(product)}
                            className="rounded-lg border border-red-400/25 p-2 text-red-300/80 transition hover:bg-red-500/10 hover:text-red-300"
                            aria-label={`Delete ${product.name}`}
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!paginatedProducts.length ? (
                  <tr className="border-t border-white/[0.05]">
                    <td colSpan={6} className="px-4 py-14 text-center">
                      <p className="text-sm font-semibold text-white/70">No products match</p>
                      <p className="mt-1 text-xs text-white/40">Try another filter or clear the search.</p>
                      {search || stockFilter !== "all" || categoryFilter !== "all" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setStockFilter("all");
                            setCategoryFilter("all");
                          }}
                          className="mt-4 rounded-full border border-white/15 px-4 py-1.5 text-xs font-semibold text-white/75 hover:bg-white/5"
                        >
                          Clear filters
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3 text-sm text-white/50 sm:flex-row">
            <span>
              {rangeStart}–{rangeEnd} of {filteredProducts.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg p-2 text-white/70 transition hover:bg-white/[0.06] disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 text-white/70">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg p-2 text-white/70 transition hover:bg-white/[0.06] disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / edit product */}
      <Modal
        open={showForm}
        onClose={closeForm}
        dismissible={!submitting}
        title={editingId ? "Edit product" : "Add product"}
        description={editingId ? "Update details, pricing or stock." : "Fill in the details to add it to inventory."}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              disabled={submitting}
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="product-form"
              disabled={submitting}
              className="rounded-full bg-v-accent px-6 py-2.5 text-sm font-bold text-black shadow-v-glow transition hover:bg-v-accent-hover disabled:opacity-60"
            >
              {submitting ? "Saving…" : editingId ? "Save changes" : "Add product"}
            </button>
          </div>
        }
      >
        <form id="product-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Product name" className="sm:col-span-2">
            <input name="name" required autoFocus placeholder="e.g. Wireless Earbuds" value={form.name} onChange={handleInput} className={inputClass} />
          </Field>

          <Field label="Category" as="div">
            <Select
              ariaLabel="Product category"
              value={form.category}
              onChange={(v) => {
                handleInput({ target: { name: "category", value: v } });
                if (v !== "__custom__") setCustomCategory("");
              }}
              placeholder="Select category"
              options={[...categoryOptions.map((c) => ({ value: c, label: c })), { value: "__custom__", label: "New category…" }]}
            />
            {form.category === "__custom__" ? (
              <input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Category name"
                className={`${inputClass} mt-2`}
              />
            ) : null}
          </Field>

          <Field label="Stock quantity" as="div">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, stockQuantity: String(Math.max(0, parseStock(p.stockQuantity) - 1)) }))}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/80 transition hover:bg-white/10"
                aria-label="Decrease stock"
              >
                <Minus size={15} />
              </button>
              <input
                name="stockQuantity"
                required
                type="number"
                min="0"
                placeholder="0"
                value={form.stockQuantity}
                onChange={(e) => setForm((p) => ({ ...p, stockQuantity: e.target.value === "" ? "" : String(parseStock(e.target.value)) }))}
                className={`${inputClass} no-spinner text-center`}
              />
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, stockQuantity: String(parseStock(p.stockQuantity) + 1) }))}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/80 transition hover:bg-white/10"
                aria-label="Increase stock"
              >
                <Plus size={15} />
              </button>
            </div>
          </Field>

          <Field label="Selling price (Rs.)">
            <input name="price" required type="number" min="0" placeholder="0" value={form.price} onChange={handleInput} className={inputClass} />
          </Field>
          <Field
            label="Cost price (Rs.)"
            hint={
              formMargin === null ? null : (
                <span className={formMargin < 0 ? "text-red-300" : "text-v-green"}>Margin {formMargin}%</span>
              )
            }
          >
            <input name="costPrice" required type="number" min="0" placeholder="0" value={form.costPrice} onChange={handleInput} className={inputClass} />
          </Field>

          <Field label="Description" className="sm:col-span-2">
            <textarea
              name="description"
              required
              rows={3}
              placeholder="Short description shown in the product list"
              value={form.description}
              onChange={handleInput}
              className={`${inputClass} resize-none`}
            />
          </Field>

          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-xs font-medium text-white/55">Image (optional)</span>
            <div className="flex gap-4">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-v-surface">
                {previewSrc && !imagePreviewError ? (
                  <img src={previewSrc} alt="" className="h-full w-full object-cover" onError={() => setImagePreviewError(true)} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/25">
                    <ImagePlus size={22} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  name="imageURL"
                  placeholder="Paste an image URL"
                  value={form.imageURL.startsWith("data:") ? "" : form.imageURL}
                  onChange={handleInput}
                  className={inputClass}
                />
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/5">
                    Upload from computer
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="sr-only" />
                  </label>
                  <span className="min-w-0 truncate text-xs text-white/40">{selectedImageFile || "PNG or JPG, up to 3MB"}</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this product?"
        message={deleteTarget ? `"${deleteTarget.name}" will be removed from inventory. This can't be undone.` : ""}
        confirmLabel="Delete product"
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        busy={deleting}
        danger
      />
    </div>
  );
};

export default InventoryPage;
