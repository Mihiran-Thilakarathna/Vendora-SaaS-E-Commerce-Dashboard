import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Minus, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import SplitText from "../../components/reactbits/SplitText";
import useStaggerReveal from "../../hooks/useStaggerReveal";
import api from "../../services/api";
import { formatCurrency } from "../../utils/formatCurrency";
import { ORDER_STATUSES, STATUS_STYLES, formatOrderDate, formatOrderTime, shortOrderId } from "../../utils/orderStatus";
import { useToast } from "../../context/ToastContext";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import StatusBadge from "../../components/ui/StatusBadge";

const PAGE_SIZE = 8;

const PlacedBy = ({ person }) => {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [person?.avatarURL]);
  if (!person) return <span className="text-white/35">—</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] text-white/70">
        {person.avatarURL?.trim() && !err ? (
          <img src={person.avatarURL} alt="" className="h-full w-full object-cover" onError={() => setErr(true)} />
        ) : (
          <UserRound size={14} aria-hidden />
        )}
      </span>
      <span className="max-w-[120px] truncate text-sm text-white/70">{person.name}</span>
    </div>
  );
};

const itemsSummary = (order) => {
  const items = order.items || [];
  const first = items[0]?.product?.name || "Item";
  const units = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  return { first, more: Math.max(0, items.length - 1), units };
};

const StatusSelect = ({ value, onChange, disabled }) => (
  <div className="flex items-center gap-2">
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: STATUS_STYLES[value]?.dot || "#737373" }}
      aria-hidden
    />
    <Select
      ariaLabel="Update order status"
      compact
      disabled={disabled}
      value={value}
      onChange={onChange}
      options={ORDER_STATUSES.map((s) => ({ value: s, label: s }))}
      className="min-w-[132px]"
    />
  </div>
);

const OrdersPage = () => {
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
  const [detailsId, setDetailsId] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [orderForm, setOrderForm] = useState({ customerName: "", shippingAddress: "" });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
  }, [searchParams]);

  /* ---------------- Create order ---------------- */

  const loadProductsForOrder = async () => {
    setProductsLoading(true);
    try {
      const { data } = await api.get("/products");
      setProducts(data.data || []);
    } catch (err) {
      toast.error("Products load failed", err?.response?.data?.message || "Failed to load products.");
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

  const productById = useMemo(() => new Map(products.map((p) => [String(p._id), p])), [products]);

  const orderTotal = useMemo(
    () =>
      lineItems.reduce((sum, line) => {
        const product = productById.get(String(line.productId));
        return product ? sum + Number(product.price) * Math.max(0, Number(line.quantity) || 0) : sum;
      }, 0),
    [lineItems, productById]
  );

  const stockFor = (productId) => Number(productById.get(String(productId))?.stockQuantity ?? Infinity);

  /** `value` is a number, or a function of the current quantity (so rapid +/- clicks stack correctly). */
  const setQty = (index, value) => {
    setLineItems((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const max = stockFor(row.productId);
        const next = typeof value === "function" ? value(Number(row.quantity) || 1) : value;
        const n = Math.max(1, Math.min(Number.isFinite(max) ? Math.max(max, 1) : Infinity, Number(next) || 1));
        return { ...row, quantity: n };
      })
    );
  };

  const setProduct = (index, productId) => {
    setLineItems((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const max = stockFor(productId);
        return { productId, quantity: Math.max(1, Math.min(row.quantity, Number.isFinite(max) ? max : row.quantity)) };
      })
    );
  };

  const chosenIds = lineItems.map((l) => String(l.productId)).filter(Boolean);
  const overStock = lineItems.some((l) => l.productId && Number(l.quantity) > stockFor(l.productId));

  const submitNewOrder = async (event) => {
    event.preventDefault();
    const items = lineItems
      .filter((row) => row.productId && Number(row.quantity) >= 1)
      .map((row) => ({ product: row.productId, quantity: Number(row.quantity) }));
    if (!items.length) {
      toast.error("Add a product", "Choose at least one product for this order.");
      return;
    }
    if (!orderForm.customerName.trim() || !orderForm.shippingAddress.trim()) {
      toast.error("Missing details", "Customer name and shipping address are required.");
      return;
    }
    if (overStock) {
      toast.error("Not enough stock", "Lower the quantity to what's available.");
      return;
    }
    setCreateSubmitting(true);
    try {
      await api.post("/orders", {
        customerName: orderForm.customerName.trim(),
        shippingAddress: orderForm.shippingAddress.trim(),
        items,
        totalAmount: orderTotal,
        status: "Pending",
      });
      toast.success("Order created", "Added to the list as Pending.");
      setCreateOpen(false);
      await fetchOrders();
    } catch (err) {
      toast.error("Create order failed", err?.response?.data?.message || "Failed to create order.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  /* ---------------- List, filters, status ---------------- */

  const statusCounts = useMemo(() => {
    const counts = { All: orders.length };
    ORDER_STATUSES.forEach((s) => {
      counts[s] = orders.filter((o) => o.status === s).length;
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = orders.filter((order) => {
      const productNames = (order.items || []).map((item) => item?.product?.name).filter(Boolean).join(" ");
      const matchesTerm =
        !term ||
        [order.customerName, order.shippingAddress, order._id, shortOrderId(order._id), productNames]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return matchesTerm && (statusFilter === "All" || order.status === statusFilter);
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === "amountAsc") return Number(a.totalAmount) - Number(b.totalAmount);
      if (sortBy === "amountDesc") return Number(b.totalAmount) - Number(a.totalAmount);
      if (sortBy === "oldest") return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [orders, search, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = useMemo(
    () => filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredOrders, page]
  );

  useEffect(() => setPage(1), [search, statusFilter, sortBy]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const updateStatus = async (orderId, status) => {
    const previous = orders;
    setOrders((prev) => prev.map((o) => (o._id === orderId ? { ...o, status } : o)));
    setUpdatingId(orderId);
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      toast.success("Order updated", `${shortOrderId(orderId)} is now ${status}.`);
    } catch (err) {
      setOrders(previous);
      toast.error("Status update failed", err?.response?.data?.message || "Failed to update order status.");
    } finally {
      setUpdatingId("");
    }
  };

  const details = orders.find((o) => o._id === detailsId) || null;

  const pageRef = useRef(null);
  useStaggerReveal(pageRef, [loading], { y: 16, stagger: 0.04 });

  const rangeStart = filteredOrders.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredOrders.length);

  return (
    <div ref={pageRef} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            <SplitText text="Orders" />
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {orders.length} order{orders.length === 1 ? "" : "s"} · click a row to see its details.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateOrder}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-v-accent px-5 py-2.5 text-sm font-bold text-black shadow-v-glow transition hover:bg-v-accent-hover"
        >
          <Plus size={18} strokeWidth={2.5} />
          New order
        </button>
      </div>

      {/* Status tabs */}
      <div data-reveal className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Filter by status">
        {["All", ...ORDER_STATUSES].map((s) => {
          const active = statusFilter === s;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatusFilter(s)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                active
                  ? "border-v-accent bg-v-accent text-black"
                  : "border-white/10 bg-v-card text-white/65 hover:border-white/20 hover:text-white"
              }`}
            >
              {s !== "All" ? (
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_STYLES[s].dot }} aria-hidden />
              ) : null}
              {s}
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-black/15" : "bg-white/[0.06] text-white/50"}`}>
                {statusCounts[s] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + sort */}
      <div data-reveal className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
        <label className="relative block">
          <span className="sr-only">Search orders</span>
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, product, address or order #"
            className="w-full rounded-2xl border border-white/10 bg-v-card py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-v-accent/50"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/40 transition hover:text-white"
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          ) : null}
        </label>
        <Select
          ariaLabel="Sort orders"
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: "newest", label: "Newest first" },
            { value: "oldest", label: "Oldest first" },
            { value: "amountDesc", label: "Amount: high to low" },
            { value: "amountAsc", label: "Amount: low to high" },
          ]}
        />
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {/* Table */}
      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : (
        <div data-reveal className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-v-card shadow-v-card">
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Items</th>
                  <th className="px-4 py-3 font-semibold">Placed by</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order) => {
                  const summary = itemsSummary(order);
                  return (
                    <tr
                      key={order._id}
                      onClick={() => setDetailsId(order._id)}
                      className="cursor-pointer border-t border-white/[0.05] transition-colors hover:bg-white/[0.025]"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-xs font-semibold text-white/80">{shortOrderId(order._id)}</p>
                        <p className="mt-0.5 text-xs text-white/40">{formatOrderDate(order.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-white">{order.customerName}</p>
                        <p className="mt-0.5 max-w-[220px] truncate text-xs text-white/40">{order.shippingAddress}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="max-w-[200px] truncate text-white/80">{summary.first}</p>
                        <p className="mt-0.5 text-xs text-white/40">
                          {summary.units} unit{summary.units === 1 ? "" : "s"}
                          {summary.more ? ` · +${summary.more} more` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <PlacedBy person={order.createdBy} />
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-white">
                        {formatCurrency(order.totalAmount)}
                      </td>
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <StatusSelect
                          value={order.status}
                          disabled={updatingId === order._id}
                          onChange={(v) => v !== order.status && updateStatus(order._id, v)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {!paginatedOrders.length ? (
                  <tr className="border-t border-white/[0.05]">
                    <td colSpan={6} className="px-4 py-14 text-center">
                      <p className="text-sm font-semibold text-white/70">No orders match</p>
                      <p className="mt-1 text-xs text-white/40">Try another status or clear the search.</p>
                      {search || statusFilter !== "All" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setStatusFilter("All");
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

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3 text-sm text-white/50 sm:flex-row">
            <span>
              {rangeStart}–{rangeEnd} of {filteredOrders.length}
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
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .map((n, i, arr) => (
                  <span key={n} className="flex items-center">
                    {i > 0 && n - arr[i - 1] > 1 ? <span className="px-1 text-white/30">…</span> : null}
                    <button
                      type="button"
                      onClick={() => setPage(n)}
                      aria-current={n === page ? "page" : undefined}
                      className={`h-8 min-w-8 rounded-lg px-2 text-sm font-semibold transition ${
                        n === page ? "bg-v-accent text-black" : "text-white/60 hover:bg-white/[0.06]"
                      }`}
                    >
                      {n}
                    </button>
                  </span>
                ))}
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

      {/* Order details */}
      <Modal
        open={Boolean(details)}
        onClose={() => setDetailsId(null)}
        eyebrow={details ? `Order ${shortOrderId(details._id)}` : ""}
        title={details?.customerName}
        description={details ? `${formatOrderDate(details.createdAt)} · ${formatOrderTime(details.createdAt)}` : ""}
        size="md"
      >
        {details ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-v-surface p-3.5">
              <div className="flex items-center gap-2 text-sm text-white/60">
                Status <StatusBadge status={details.status} />
              </div>
              <StatusSelect
                value={details.status}
                disabled={updatingId === details._id}
                onChange={(v) => v !== details.status && updateStatus(details._id, v)}
              />
            </div>

            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-white/40">Shipping address</dt>
                <dd className="mt-1 text-white/85">{details.shippingAddress}</dd>
              </div>
              <div>
                <dt className="text-xs text-white/40">Placed by</dt>
                <dd className="mt-1">
                  <PlacedBy person={details.createdBy} />
                </dd>
              </div>
            </dl>

            <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/40">
                  <tr>
                    <th className="px-3.5 py-2.5 font-semibold">Product</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Qty</th>
                    <th className="px-3.5 py-2.5 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(details.items || []).map((it, i) => (
                    <tr key={`${it.product?._id || i}`} className="border-t border-white/[0.05]">
                      <td className="px-3.5 py-2.5">
                        <p className="text-white">{it.product?.name || "Removed product"}</p>
                        {it.product?.price ? (
                          <p className="text-xs text-white/40">{formatCurrency(it.product.price)} each</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-white/80">{it.quantity}</td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums text-white/85">
                        {it.product?.price ? formatCurrency(it.product.price * it.quantity) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/[0.08] bg-white/[0.02]">
                    <td colSpan={2} className="px-3.5 py-3 text-sm font-semibold text-white/70">
                      Order total
                    </td>
                    <td className="px-3.5 py-3 text-right text-base font-bold tabular-nums text-v-accent">
                      {formatCurrency(details.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Create order */}
      <Modal
        open={createOpen}
        onClose={() => !createSubmitting && setCreateOpen(false)}
        dismissible={!createSubmitting}
        title="New order"
        description="Stock is reserved as soon as the order is saved."
        size="md"
        footer={
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-white/60">
              Total <span className="ml-1 text-lg font-bold tabular-nums text-v-accent">{formatCurrency(orderTotal)}</span>
            </p>
            <button
              type="submit"
              form="new-order-form"
              disabled={createSubmitting || productsLoading || !products.length || overStock}
              className="rounded-full bg-v-accent px-6 py-2.5 text-sm font-bold text-black shadow-v-glow transition hover:bg-v-accent-hover disabled:opacity-50"
            >
              {createSubmitting ? "Saving…" : "Place order"}
            </button>
          </div>
        }
      >
        <form id="new-order-form" onSubmit={submitNewOrder} className="space-y-5">
          <div className="grid gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/55">Customer name</span>
              <input
                required
                autoFocus
                placeholder="e.g. Kasun Perera"
                value={orderForm.customerName}
                onChange={(e) => setOrderForm((p) => ({ ...p, customerName: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-v-surface px-3.5 py-2.5 text-sm outline-none focus:border-v-accent/50"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-white/55">Shipping address</span>
              <textarea
                required
                rows={2}
                placeholder="No. 14, Lake Road, Colombo 08"
                value={orderForm.shippingAddress}
                onChange={(e) => setOrderForm((p) => ({ ...p, shippingAddress: e.target.value }))}
                className="w-full resize-none rounded-xl border border-white/10 bg-v-surface px-3.5 py-2.5 text-sm outline-none focus:border-v-accent/50"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/55">Products</span>
              <button
                type="button"
                onClick={() => setLineItems((prev) => [...prev, { productId: "", quantity: 1 }])}
                disabled={productsLoading}
                className="inline-flex items-center gap-1 text-xs font-semibold text-v-accent hover:underline disabled:opacity-50"
              >
                <Plus size={13} /> Add product
              </button>
            </div>

            {productsLoading ? (
              <div className="mt-2 h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
            ) : (
              <ul className="mt-2 space-y-2">
                {lineItems.map((row, index) => {
                  const product = productById.get(String(row.productId));
                  const max = product ? Number(product.stockQuantity) : null;
                  const tooMany = max !== null && Number(row.quantity) > max;
                  return (
                    <li key={`line-${index}`} className="rounded-2xl border border-white/[0.08] bg-v-surface/70 p-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <Select
                            ariaLabel="Select product"
                            value={row.productId}
                            onChange={(v) => setProduct(index, v)}
                            placeholder="Choose a product"
                            buttonClassName="bg-v-elevated"
                            options={products.map((p) => ({
                              value: p._id,
                              label:
                                Number(p.stockQuantity) <= 0
                                  ? `${p.name} (out of stock)`
                                  : `${p.name} · ${formatCurrency(p.price)}`,
                              disabled:
                                Number(p.stockQuantity) <= 0 ||
                                (chosenIds.includes(String(p._id)) && String(row.productId) !== String(p._id)),
                            }))}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
                          }
                          disabled={lineItems.length <= 1}
                          className="rounded-xl p-2.5 text-white/40 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30"
                          aria-label="Remove product"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setQty(index, (q) => q - 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/80 transition hover:bg-white/10"
                            aria-label="Decrease quantity"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={max ?? undefined}
                            value={row.quantity}
                            onChange={(e) => setQty(index, e.target.value)}
                            aria-label="Quantity"
                            className="no-spinner h-8 w-14 rounded-lg border border-white/10 bg-v-elevated text-center text-sm text-white outline-none focus:border-v-accent/50"
                          />
                          <button
                            type="button"
                            onClick={() => setQty(index, (q) => q + 1)}
                            disabled={max !== null && Number(row.quantity) >= max}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/80 transition hover:bg-white/10 disabled:opacity-30"
                            aria-label="Increase quantity"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <p className={`text-xs ${tooMany ? "text-red-300" : "text-white/40"}`}>
                          {product ? `${max} in stock` : "Pick a product"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default OrdersPage;
