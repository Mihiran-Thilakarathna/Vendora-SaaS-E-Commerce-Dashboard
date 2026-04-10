import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Minus, PencilLine, Plus, Trash2 } from "lucide-react";
import api from "../../services/api";
import { formatCurrency } from "../../utils/formatCurrency";
import { useToast } from "../../context/ToastContext";
import Select from "../../components/ui/Select";

const emptyForm = {
  name: "",
  description: "",
  price: "",
  costPrice: "",
  stockQuantity: "",
  category: "",
  imageURL: "",
};

const InventoryPage = () => {
  const toast = useToast();
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
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const categoryOptions = useMemo(() => {
    const defaults = [
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
    const fromData = products.map((p) => p.category).filter(Boolean);
    const merged = [...new Set([...defaults, ...fromData].map((c) => String(c).trim()).filter(Boolean))];
    return merged.sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = products.filter((product) => {
      if (!term) return true;
      return [product.name, product.category, product.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));
    });

    const sorted = [...base].sort((a, b) => {
      if (sortBy === "priceAsc") return Number(a.price) - Number(b.price);
      if (sortBy === "priceDesc") return Number(b.price) - Number(a.price);
      if (sortBy === "stockAsc") return Number(a.stockQuantity) - Number(b.stockQuantity);
      if (sortBy === "stockDesc") return Number(b.stockQuantity) - Number(a.stockQuantity);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
    return sorted;
  }, [products, search, sortBy]);
  const negativeMarginCount = useMemo(
    () =>
      products.filter((product) => Number(product.price || 0) < Number(product.costPrice || 0)).length,
    [products]
  );

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page]);

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
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(
    () => () => {
      if (imagePreviewURL) URL.revokeObjectURL(imagePreviewURL);
    },
    [imagePreviewURL]
  );

  const handleInput = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "imageURL") {
      setImagePreviewURL("");
      setImagePreviewError(false);
      setSelectedImageFile("");
    }
  };

  const parseStockValue = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };

  const incrementStock = () => {
    setForm((prev) => ({
      ...prev,
      stockQuantity: String(parseStockValue(prev.stockQuantity) + 1),
    }));
  };

  const decrementStock = () => {
    setForm((prev) => ({
      ...prev,
      stockQuantity: String(Math.max(0, parseStockValue(prev.stockQuantity) - 1)),
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCustomCategory("");
    setImagePreviewURL("");
    setImagePreviewError(false);
    setSelectedImageFile("");
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
    setCustomCategory("");
    setImagePreviewURL("");
    setImagePreviewError(false);
    setSelectedImageFile("");
    setShowForm(true);
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedImageFile(file.name || "");
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file", "Please choose an image file.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("File too large", "Please use an image under 3MB.");
      return;
    }
    const localURL = URL.createObjectURL(file);
    setImagePreviewURL(localURL);
    setImagePreviewError(false);
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, imageURL: String(reader.result || "") }));
      toast.success("Image selected", "It will be saved with this product.");
    };
    reader.onerror = () => toast.error("Upload failed", "Could not read that file.");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const categoryValue =
        form.category === "__custom__" ? customCategory.trim() : String(form.category || "").trim();
      if (!categoryValue) {
        toast.error("Missing category", "Please select or enter a category.");
        return;
      }
      const payload = {
        ...form,
        category: categoryValue,
        price: Number(form.price),
        costPrice: Number(form.costPrice),
        stockQuantity: Number(form.stockQuantity),
      };

      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        toast.success("Product updated", `${payload.name} was updated successfully.`);
      } else {
        await api.post("/products", payload);
        toast.success("Product created", `${payload.name} was added to inventory.`);
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      await fetchProducts();
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to save product.";
      setError(message);
      toast.error("Save failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (productId) => {
    const approved = window.confirm("Delete this product?");
    if (!approved) {
      return;
    }
    try {
      await api.delete(`/products/${productId}`);
      setProducts((prev) => prev.filter((product) => product._id !== productId));
      toast.success("Product deleted", "Item removed from inventory.");
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to delete product.";
      setError(message);
      toast.error("Delete failed", message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Inventory
          </h2>
          <p className="mt-2 text-sm text-white/50 md:text-base">
            Products, Rs. pricing, and stock health across categories.
          </p>
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

      <div className="grid grid-cols-1 gap-3 rounded-[28px] border border-white/[0.08] bg-v-card p-4 shadow-v-card md:grid-cols-[1fr,200px]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by product name, category, or description"
          className="rounded-2xl border border-white/10 bg-v-surface px-4 py-2.5 text-sm outline-none transition focus:border-v-accent/40 focus:ring-1 focus:ring-v-accent/20"
        />
        <Select
          ariaLabel="Sort products"
          value={sortBy}
          onChange={(v) => setSortBy(v)}
          options={[
            { value: "newest", label: "Newest" },
            { value: "priceAsc", label: "Price: Low to High" },
            { value: "priceDesc", label: "Price: High to Low" },
            { value: "stockAsc", label: "Stock: Low to High" },
            { value: "stockDesc", label: "Stock: High to Low" },
          ]}
        />
      </div>

      {negativeMarginCount > 0 ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Pricing alert: <strong>{negativeMarginCount}</strong> product(s) have cost price above selling
          price.
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-3 rounded-[28px] border border-white/[0.08] bg-v-card p-5 shadow-v-card md:grid-cols-2"
        >
          <input
            name="name"
            required
            placeholder="Product name"
            value={form.name}
            onChange={handleInput}
            className="rounded-2xl border border-white/10 bg-v-surface px-3 py-2.5 text-sm outline-none focus:border-v-accent/40"
          />
          <div className="space-y-2">
            <Select
              ariaLabel="Product category"
              value={form.category}
              onChange={(v) => {
                handleInput({ target: { name: "category", value: v } });
                if (v !== "__custom__") setCustomCategory("");
              }}
              placeholder="Select category"
              options={[
                ...categoryOptions.map((c) => ({ value: c, label: c })),
                { value: "__custom__", label: "Custom…" },
              ]}
            />
            {form.category === "__custom__" ? (
              <input
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter category"
                className="w-full rounded-2xl border border-white/10 bg-v-surface px-3 py-2.5 text-sm outline-none focus:border-v-accent/40"
              />
            ) : null}
          </div>
          <input
            name="price"
            required
            type="number"
            min="0"
            placeholder="Price (Rs.)"
            value={form.price}
            onChange={handleInput}
            className="rounded-2xl border border-white/10 bg-v-surface px-3 py-2.5 text-sm outline-none focus:border-v-accent/40"
          />
          <input
            name="costPrice"
            required
            type="number"
            min="0"
            placeholder="Cost price (Rs.)"
            value={form.costPrice}
            onChange={handleInput}
            className="rounded-2xl border border-white/10 bg-v-surface px-3 py-2.5 text-sm outline-none focus:border-v-accent/40"
          />
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={decrementStock}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-v-accent text-base font-extrabold leading-none text-black shadow-v-glow hover:bg-v-accent-hover"
                aria-label="Decrease stock quantity"
              >
                <Minus size={14} strokeWidth={3} />
              </button>
              <input
                name="stockQuantity"
                required
                type="number"
                min="0"
                placeholder="Stock quantity"
                value={form.stockQuantity}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, stockQuantity: String(parseStockValue(e.target.value)) }))
                }
                className="no-spinner w-full rounded-2xl border border-white/10 bg-v-surface px-3 py-2.5 text-sm outline-none focus:border-v-accent/40"
              />
              <button
                type="button"
                onClick={incrementStock}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-v-accent text-base font-extrabold leading-none text-black shadow-v-glow hover:bg-v-accent-hover"
                aria-label="Increase stock quantity"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-white/45">Product image</label>
            <div className="mt-2 grid gap-3 md:grid-cols-[1fr,220px] md:items-start">
              <div className="space-y-2">
                <input
                  name="imageURL"
                  placeholder="Image URL (optional)"
                  value={form.imageURL}
                  onChange={handleInput}
                  className="w-full rounded-2xl border border-white/10 bg-v-surface px-3 py-2.5 text-sm outline-none focus:border-v-accent/40"
                />
                <label className="block">
                  <span className="sr-only">Upload image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="block w-full text-xs text-white/55 file:mr-3 file:rounded-full file:border-0 file:bg-v-accent file:px-3 file:py-2 file:font-bold file:text-black hover:file:bg-v-accent-hover"
                  />
                </label>
                <p className="text-xs text-white/45">
                  {selectedImageFile ? selectedImageFile : "No file selected"}
                </p>
                <div className="flex items-center gap-2 text-xs text-white/45">
                  <ImagePlus size={16} />
                  Choose from this PC or paste a URL.
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-v-surface">
                {((imagePreviewURL || form.imageURL) && !imagePreviewError) ? (
                  <img
                    src={imagePreviewURL || form.imageURL}
                    alt=""
                    className="h-40 w-full object-cover"
                    onLoad={() => {
                      if (imagePreviewURL) {
                        URL.revokeObjectURL(imagePreviewURL);
                        setImagePreviewURL("");
                      }
                    }}
                    onError={() => setImagePreviewError(true)}
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center text-xs text-white/35">
                    No image selected
                  </div>
                )}
              </div>
            </div>
          </div>
          <textarea
            name="description"
            required
            placeholder="Description"
            value={form.description}
            onChange={handleInput}
            className="min-h-[90px] rounded-2xl border border-white/10 bg-v-surface px-3 py-2 outline-none focus:border-v-accent/40 md:col-span-2"
          />
          <div className="flex items-center gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-v-accent px-5 py-2.5 text-sm font-bold text-black shadow-v-glow disabled:opacity-60"
            >
              {submitting ? "Saving..." : editingId ? "Update Product" : "Create Product"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-white/70">Loading products...</p>
      ) : (
        <div className="overflow-x-auto rounded-[28px] border border-white/[0.08] bg-v-card shadow-v-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-white/45">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Margin</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.map((product) => (
                (() => {
                  const price = Number(product.price || 0);
                  const cost = Number(product.costPrice || 0);
                  const marginPct = price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : null;
                  const isNegativeMargin = cost > price;
                  return (
                <tr
                  key={product._id}
                  className={`border-t border-white/[0.06] ${
                    isNegativeMargin
                      ? "bg-red-500/20"
                      : product.stockQuantity < 10
                        ? "bg-red-500/10"
                        : "bg-transparent"
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.imageURL || "https://via.placeholder.com/60x60?text=Item"}
                        alt={product.name}
                        className="h-12 w-12 rounded-lg border border-white/10 object-cover"
                      />
                      <div>
                        <p className="font-semibold text-white">{product.name}</p>
                        <p className="line-clamp-1 max-w-[280px] text-xs text-white/55">
                          {product.description}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white">{formatCurrency(product.price)}</td>
                  <td className="px-4 py-3 text-white/80">{formatCurrency(product.costPrice || 0)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        marginPct === null
                          ? "bg-white/10 text-white/70"
                          : marginPct < 0
                            ? "bg-red-500/20 text-red-200"
                            : "bg-v-green/15 text-v-green"
                      }`}
                    >
                      {marginPct === null ? "—" : `${marginPct}%`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        product.stockQuantity < 10
                          ? "bg-red-500/20 text-red-200"
                          : "bg-v-green/15 text-v-green"
                      }`}
                    >
                      {product.stockQuantity} units
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/80">{product.category}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(product)}
                        className="rounded-lg border border-white/20 p-2 text-white/80 hover:bg-white/10"
                      >
                        <PencilLine size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(product._id)}
                        className="rounded-lg border border-red-400/40 p-2 text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
                  );
                })()
              ))}
              {!paginatedProducts.length ? (
                <tr className="border-t border-white/10">
                  <td colSpan={7} className="px-4 py-8 text-center text-white/60">
                    No products found for the current search/filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between rounded-[28px] border border-white/[0.08] bg-v-card px-5 py-3.5 text-sm text-white/65 shadow-v-card">
        <span>
          Showing {paginatedProducts.length} of {filteredProducts.length} product(s)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="rounded-lg border border-white/20 px-3 py-1.5 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-white">Page {page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-white/20 px-3 py-1.5 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default InventoryPage;
