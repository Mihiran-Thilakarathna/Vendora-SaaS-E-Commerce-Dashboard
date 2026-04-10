import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Truck, Plus, Minus, X, UserRound } from "lucide-react";
import api from "../../services/api";
import { formatCurrency } from "../../utils/formatCurrency";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Select from "../../components/ui/Select";

const statusOptions = ["Pending", "Processing", "Shipped", "Delivered"];

const PlacedByAvatar = ({ person }) => {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [person?.avatarURL]);
  if (!person) return <span className="text-white/40">—</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#2a2a2a] text-white/85">
        {person.avatarURL?.trim() && !err ? (
          <img
            src={person.avatarURL}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setErr(true)}
          />
        ) : (
          <UserRound size={17} strokeWidth={2} aria-hidden />
        )}
      </div>
      <span className="max-w-[120px] truncate text-sm text-white/80">{person.name}</span>
    </div>
  );
};

const OrdersPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const pageSize = 7;
  const [createOpen, setCreateOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [orderForm, setOrderForm] = useState({
    customerName: "",
    shippingAddress: "",
  });
  const [lineItems, setLineItems] = useState([{ productId: "", quantity: 1 }]);

  const fetchOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/orders");
      setOrders(data.data || []);
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to load orders.";
      setError(message);
      toast.error("Orders load failed", message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    const q = searchParams.get("search") || "";
    setSearch(q);
  }, [searchParams]);

  const loadProductsForOrder = async () => {
    setProductsLoading(true);
    try {
      const { data } = await api.get("/products");
      setProducts(data.data || []);
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to load products.";
      toast.error("Products load failed", message);
    } finally {
      setProductsLoading(false);
    }
  };

  const openCreateOrder = () => {
    setOrderForm({ customerName: "", shippingAddress: "" });
    setLineItems([{ productId: "", quantity: 1 }]);
    setCreateOpen(true);
    loadProductsForOrder();
  };

  const orderTotal = useMemo(() => {
    return lineItems.reduce((sum, line) => {
      if (!line.productId) return sum;
      const product = products.find((p) => String(p._id) === String(line.productId));
      if (!product) return sum;
      const qty = Math.max(0, Number(line.quantity) || 0);
      return sum + Number(product.price) * qty;
    }, 0);
  }, [lineItems, products]);

  const updateLine = (index, field, value) => {
    setLineItems((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const incrementQty = (index) => {
    setLineItems((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, quantity: Math.max(1, Number(row.quantity || 1) + 1) } : row
      )
    );
  };

  const decrementQty = (index) => {
    setLineItems((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, quantity: Math.max(1, Number(row.quantity || 1) - 1) } : row
      )
    );
  };

  const parseQty = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(1, n) : 1;
  };

  const addLine = () => {
    setLineItems((prev) => [...prev, { productId: "", quantity: 1 }]);
  };

  const removeLine = (index) => {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const submitNewOrder = async (event) => {
    event.preventDefault();
    const items = lineItems
      .filter((row) => row.productId && Number(row.quantity) >= 1)
      .map((row) => ({
        product: row.productId,
        quantity: Number(row.quantity),
      }));
    if (!items.length) {
      toast.error("Invalid order", "Add at least one product line with quantity.");
      return;
    }
    if (!orderForm.customerName.trim() || !orderForm.shippingAddress.trim()) {
      toast.error("Invalid order", "Customer name and shipping address are required.");
      return;
    }
    setCreateSubmitting(true);
    setError("");
    try {
      await api.post("/orders", {
        customerName: orderForm.customerName.trim(),
        shippingAddress: orderForm.shippingAddress.trim(),
        items,
        totalAmount: orderTotal,
        status: "Pending",
      });
      toast.success("Order created", "The new order is in the list as Pending.");
      setCreateOpen(false);
      await fetchOrders();
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to create order.";
      setError(message);
      toast.error("Create order failed", message);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = orders.filter((order) => {
      const productNames = (order.items || [])
        .map((item) => item?.product?.name)
        .filter(Boolean)
        .join(" ");
      const matchesTerm =
        !term ||
        [order.customerName, order.shippingAddress, order._id, productNames]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesStatus = statusFilter === "All" || order.status === statusFilter;
      return matchesTerm && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "amountAsc") return Number(a.totalAmount) - Number(b.totalAmount);
      if (sortBy === "amountDesc") return Number(b.totalAmount) - Number(a.totalAmount);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [orders, search, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortBy]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const updateStatus = async (orderId, status) => {
    const previous = orders;
    setOrders((prev) => prev.map((order) => (order._id === orderId ? { ...order, status } : order)));
    setUpdatingId(orderId);
    setError("");
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      toast.success("Order updated", `Status changed to ${status}.`);
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to update order status.";
      setOrders(previous);
      setError(message);
      toast.error("Status update failed", message);
    } finally {
      setUpdatingId("");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">Orders</h2>
          <p className="mt-2 text-sm text-white/50 md:text-base">
            Track orders and update fulfilment status in real time.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={openCreateOrder}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-v-accent px-5 py-2.5 text-sm font-bold text-black shadow-v-glow transition hover:bg-v-accent-hover"
          >
            <Plus size={18} strokeWidth={2.5} />
            New order
          </button>
          <div className="inline-flex items-center justify-center gap-2 rounded-full border border-v-green/35 bg-v-green/10 px-4 py-2.5 text-sm font-semibold text-v-green">
            <Truck size={17} strokeWidth={2} />
            {user?.role}
          </div>
        </div>
      </div>

      {createOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-order-title"
          onClick={() => !createSubmitting && setCreateOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && !createSubmitting && setCreateOpen(false)}
        >
          <form
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-white/[0.08] bg-v-card p-6 shadow-v-card"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitNewOrder}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="new-order-title" className="text-xl font-bold text-white">
                  Create order
                </h3>
                <p className="mt-1 text-sm text-white/55">
                  Stock is reserved on the server when the order is saved.
                </p>
              </div>
              <button
                type="button"
                disabled={createSubmitting}
                onClick={() => setCreateOpen(false)}
                className="rounded-full border border-white/15 p-2 text-white/80 hover:bg-white/10 disabled:opacity-50"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <input
                required
                placeholder="Customer name"
                value={orderForm.customerName}
                onChange={(e) => setOrderForm((p) => ({ ...p, customerName: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-v-surface px-3 py-2.5 text-sm outline-none focus:border-v-accent/40"
              />
              <textarea
                required
                placeholder="Shipping address"
                value={orderForm.shippingAddress}
                onChange={(e) => setOrderForm((p) => ({ ...p, shippingAddress: e.target.value }))}
                className="min-h-[72px] w-full rounded-2xl border border-white/10 bg-v-surface px-3 py-2.5 text-sm outline-none focus:border-v-accent/40"
              />
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white/80">Line items</h4>
                <button
                  type="button"
                  onClick={addLine}
                  disabled={productsLoading}
                  className="text-xs font-semibold text-v-green hover:underline disabled:opacity-50"
                >
                  + Add line
                </button>
              </div>
              {productsLoading ? (
                <p className="mt-3 text-sm text-white/50">Loading products…</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {lineItems.map((row, index) => (
                    <li
                      key={`line-${index}`}
                      className="grid grid-cols-1 gap-2 rounded-2xl border border-white/[0.08] bg-v-surface/80 p-3 sm:grid-cols-[1fr,100px,auto] sm:items-end"
                    >
                      <div>
                        <label className="text-xs text-white/45">Product</label>
                        <div className="mt-1">
                          <Select
                            ariaLabel="Select product"
                            value={row.productId}
                            onChange={(v) => updateLine(index, "productId", v)}
                            placeholder="Select product"
                            options={(products || []).map((p) => ({
                              value: p._id,
                              label: `${p.name} — ${formatCurrency(p.price)} (stock ${p.stockQuantity})`,
                            }))}
                            buttonClassName="bg-v-elevated"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-white/45">Qty</label>
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => decrementQty(index)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-v-accent text-base font-extrabold leading-none text-black shadow-v-glow hover:bg-v-accent-hover"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={14} strokeWidth={3} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={parseQty(row.quantity)}
                            onChange={(e) => updateLine(index, "quantity", parseQty(e.target.value))}
                            className="no-spinner h-8 w-16 rounded-xl border border-white/10 bg-v-elevated px-2 py-1 text-center text-sm text-white outline-none focus:border-v-accent/40"
                          />
                          <button
                            type="button"
                            onClick={() => incrementQty(index)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-v-accent text-base font-extrabold leading-none text-black shadow-v-glow hover:bg-v-accent-hover"
                            aria-label="Increase quantity"
                          >
                            <Plus size={14} strokeWidth={3} />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-end sm:pb-0.5">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          disabled={lineItems.length <= 1}
                          className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/70 hover:bg-white/10 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-white/70">
                Order total:{" "}
                <span className="font-bold text-v-accent">{formatCurrency(orderTotal)}</span>
              </p>
              <button
                type="submit"
                disabled={createSubmitting || productsLoading || !products.length}
                className="rounded-full bg-v-accent px-6 py-2.5 text-sm font-bold text-black shadow-v-glow disabled:opacity-50"
              >
                {createSubmitting ? "Saving…" : "Place order"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 rounded-[28px] border border-white/[0.08] bg-v-card p-4 shadow-v-card md:grid-cols-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by customer, address, or order id"
          className="rounded-2xl border border-white/10 bg-v-surface px-4 py-2.5 text-sm outline-none focus:border-v-accent/40"
        />
        <Select
          ariaLabel="Order status filter"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={[
            { value: "All", label: "All statuses" },
            ...statusOptions.map((s) => ({ value: s, label: s })),
          ]}
        />
        <Select
          ariaLabel="Sort orders"
          value={sortBy}
          onChange={(v) => setSortBy(v)}
          options={[
            { value: "newest", label: "Newest" },
            { value: "amountAsc", label: "Amount: Low to High" },
            { value: "amountDesc", label: "Amount: High to Low" },
          ]}
        />
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-white/70">Loading orders...</p>
      ) : (
        <div className="overflow-x-auto rounded-[28px] border border-white/[0.08] bg-v-card shadow-v-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-white/45">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Placed by</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total Amount</th>
                <th className="px-4 py-3">Shipping Address</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((order) => {
                const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <tr key={order._id} className="border-t border-white/[0.06]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{order.customerName}</p>
                      <p className="text-xs text-white/50">#{order._id.slice(-6).toUpperCase()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <PlacedByAvatar person={order.createdBy} />
                    </td>
                    <td className="px-4 py-3 text-white/80">{totalItems} item(s)</td>
                    <td className="px-4 py-3 font-semibold text-v-accent">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="max-w-[280px] px-4 py-3 text-white/70">{order.shippingAddress}</td>
                    <td className="px-4 py-3">
                      <Select
                        ariaLabel="Update order status"
                        compact
                        disabled={updatingId === order._id}
                        value={order.status}
                        onChange={(v) => updateStatus(order._id, v)}
                        options={statusOptions.map((s) => ({ value: s, label: s }))}
                        className="min-w-[140px]"
                      />
                    </td>
                  </tr>
                );
              })}
              {!paginatedOrders.length ? (
                <tr className="border-t border-white/10">
                  <td colSpan={6} className="px-4 py-8 text-center text-white/60">
                    No orders found for the current search/filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between rounded-[28px] border border-white/[0.08] bg-v-card px-5 py-3.5 text-sm text-white/65 shadow-v-card">
        <span>
          Showing {paginatedOrders.length} of {filteredOrders.length} order(s)
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

export default OrdersPage;
