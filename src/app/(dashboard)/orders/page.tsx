"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import OrderCard from "@/components/OrderCard";
import { hasPermission, safeParseJSON } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { PRODUCT_CATEGORIES, ORDER_STATUSES } from "@/types";
import type { UserRole, OrderStatus } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import { PlusCircle, Search, Filter, Download, CheckSquare, Trash2 } from "lucide-react";

export default function OrdersPage() {
  const { data: session } = useSession();
  const { t, tStatus, tProduct } = useLanguage();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteToastRef = useRef<string | null>(null);

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const showParty = hasPermission(userRole, "view_party");
  const canCreate = hasPermission(userRole, "create_order");
  const canBulkUpdate = ["ADMIN", "PRODUCTION", "DISPATCH"].includes(userRole);

  // Debounce search input — only fire API after 350ms of no typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("productCategory", categoryFilter);
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`/api/orders?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => { setLoading(false); toast.error(t("common.error")); });
  }, [statusFilter, categoryFilter, debouncedSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const handleBulkUpdate = async (status: OrderStatus) => {
    if (selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const res = await fetch("/api/orders/bulk-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: Array.from(selectedIds), status }),
      });
      const data = await res.json();
      if (res.ok) {
        const msg = data.skipped > 0
          ? `Updated ${data.updated} orders. ${data.skipped} skipped (raw material issue).`
          : `Updated ${data.updated} orders to ${tStatus(status)}`;
        toast.success(msg);
        setSelectionMode(false);
        setSelectedIds(new Set());
        setShowBulkMenu(false);
        fetchOrders();
      } else {
        toast.error(data.error || t("common.failedUpdate"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (deleteToastRef.current) toast.dismiss(deleteToastRef.current);
    deleteToastRef.current = toast(
      (toastInstance) => (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-900">
            Delete {count} order{count !== 1 ? "s" : ""}? This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(toastInstance.id)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(toastInstance.id);
                setBulkUpdating(true);
                try {
                  const res = await fetch("/api/orders/bulk-delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ids: Array.from(selectedIds) }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    toast.success(`${data.deleted} order${data.deleted !== 1 ? "s" : ""} deleted`);
                    setSelectionMode(false);
                    setSelectedIds(new Set());
                    fetchOrders();
                  } else {
                    toast.error(data.error || "Failed to delete orders");
                  }
                } catch {
                  toast.error("Something went wrong");
                } finally {
                  setBulkUpdating(false);
                }
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: Infinity }
    );
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    const now = new Date();
    params.set("month", String(now.getMonth() + 1));
    params.set("year", String(now.getFullYear()));
    window.open(`/api/orders/export?${params}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">{t("orders.title")}</h1>
        <div className="flex items-center gap-2">
          {/* Export button */}
          <button
            onClick={handleExport}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            {t("orders.exportCSV")}
          </button>

          {/* Bulk select toggle */}
          {canBulkUpdate && (
            <button
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedIds(new Set());
                setShowBulkMenu(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors border ${
                selectionMode
                  ? "bg-brand-100 text-brand-700 border-brand-300"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {selectionMode ? t("common.cancel") : "Select"}
            </button>
          )}

          {canCreate && (
            <Link
              href="/orders/new"
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              {t("orders.newOrder")}
            </Link>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectionMode && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="text-xs text-brand-600 font-medium hover:text-brand-700"
            >
              {selectedIds.size === orders.length ? t("orders.deselectAll") : t("orders.selectAll")}
            </button>
            <span className="text-sm font-medium text-brand-700">
              {selectedIds.size} {t("orders.selected")}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowBulkMenu(!showBulkMenu)}
                  disabled={bulkUpdating}
                  className="px-3 py-1.5 bg-brand-500 text-white text-xs font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50"
                >
                  {bulkUpdating ? t("orders.updating") : t("orders.changeStatus")}
                </button>
                {showBulkMenu && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                    {ORDER_STATUSES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => handleBulkUpdate(s.value)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {tStatus(s.value)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {userRole === "ADMIN" && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkUpdating}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter className="w-4 h-4" />
          <span className="font-medium">{t("orders.filters")}</span>
          {/* Mobile export */}
          <button
            onClick={handleExport}
            className="md:hidden ml-auto flex items-center gap-1 text-brand-600 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            {t("orders.export")}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("orders.searchPlaceholder")}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">{t("orders.allStatuses")}</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {tStatus(s.value)}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">{t("orders.allProducts")}</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {tProduct(c.value)}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full sm:w-auto px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="newest">{t("orders.newestFirst")}</option>
            <option value="oldest">{t("orders.oldestFirst")}</option>
            <option value="orderId">{t("orders.orderId")}</option>
            <option value="deadline">{t("orders.deadlineSoonest")}</option>
            <option value="status">{t("orders.statusSort")}</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      {!loading && (
        <p className="text-xs text-gray-500">
          {t("orders.showing")} {orders.length} {orders.length !== 1 ? t("orders.orders") : t("orders.order")}
        </p>
      )}

      {/* Orders List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-sm">{t("orders.noOrders")}</p>
          {canCreate && (
            <Link
              href="/orders/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-lg transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              {t("orders.createFirst")}
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {[...orders].sort((a, b) => {
            switch (sortBy) {
              case "oldest":
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              case "orderId":
                return (a.orderId || "").localeCompare(b.orderId || "", undefined, { numeric: true });
              case "deadline":
                if (!a.deliveryDeadline) return 1;
                if (!b.deliveryDeadline) return -1;
                return new Date(a.deliveryDeadline).getTime() - new Date(b.deliveryDeadline).getTime();
              case "status": {
                const ORDER = ["ORDER_PLACED","CONFIRMED","IN_PRODUCTION","RAW_MATERIAL_NA","READY_FOR_DISPATCH","DISPATCHED"];
                return ORDER.indexOf(a.status) - ORDER.indexOf(b.status);
              }
              case "newest":
              default:
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
          }).map((order: any) => (
            <OrderCard
              key={order.id}
              order={{
                id: order.id,
                orderId: order.orderId,
                productCategory: order.items?.length > 0
                  ? order.items[0].productCategory
                  : order.productCategory,
                status: order.status,
                productDetails:
                  order.items?.length > 0
                    ? safeParseJSON(order.items[0].productDetails)
                    : safeParseJSON(order.productDetails),
                partyName: order.customer?.partyName,
                createdAt: order.createdAt,
                deliveryDeadline: order.deliveryDeadline,
                priority: order.priority,
                itemCount: order.items?.length || 0,
              }}
              showParty={showParty}
              selectionMode={selectionMode}
              isSelected={selectedIds.has(order.id)}
              onToggle={() => toggleSelect(order.id)}
            />
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      {canCreate && (
        <Link
          href="/orders/new"
          className="md:hidden fixed bottom-24 right-4 z-40 w-14 h-14 bg-brand-500 hover:bg-brand-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all"
        >
          <PlusCircle className="w-6 h-6" />
        </Link>
      )}
    </div>
  );
}
