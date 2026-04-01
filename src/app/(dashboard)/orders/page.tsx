"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import OrderCard from "@/components/OrderCard";
import { hasPermission, getStatusLabel } from "@/lib/utils";
import { PRODUCT_CATEGORIES, ORDER_STATUSES } from "@/types";
import type { UserRole, OrderStatus } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import { PlusCircle, Search, Filter, Download, CheckSquare, Square, X } from "lucide-react";

export default function OrdersPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const showParty = hasPermission(userRole, "view_party");
  const canCreate = hasPermission(userRole, "create_order");
  const canBulkUpdate = ["ADMIN", "PRODUCTION", "DISPATCH"].includes(userRole);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("productCategory", categoryFilter);
    if (search) params.set("search", search);

    fetch(`/api/orders?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [statusFilter, categoryFilter, search]);

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
        toast.success(`Updated ${data.updated} orders to ${getStatusLabel(status)}`);
        setSelectionMode(false);
        setSelectedIds(new Set());
        setShowBulkMenu(false);
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setBulkUpdating(false);
    }
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
        <h1 className="text-xl font-bold text-gray-900">Orders</h1>
        <div className="flex items-center gap-2">
          {/* Export button */}
          <button
            onClick={handleExport}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          {/* Bulk select toggle */}
          {canBulkUpdate && (
            <button
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedIds(new Set());
                setShowBulkMenu(false);
              }}
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectionMode
                  ? "bg-brand-100 text-brand-700 border border-brand-300"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {selectionMode ? "Cancel" : "Bulk Update"}
            </button>
          )}

          {canCreate && (
            <Link
              href="/orders/new"
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              New Order
            </Link>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="text-xs text-brand-600 font-medium hover:text-brand-700"
            >
              {selectedIds.size === orders.length ? "Deselect all" : "Select all"}
            </button>
            <span className="text-sm font-medium text-brand-700">
              {selectedIds.size} selected
            </span>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowBulkMenu(!showBulkMenu)}
              disabled={bulkUpdating}
              className="px-3 py-1.5 bg-brand-500 text-white text-xs font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50"
            >
              {bulkUpdating ? "Updating..." : "Change Status"}
            </button>
            {showBulkMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                {ORDER_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleBulkUpdate(s.value)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter className="w-4 h-4" />
          <span className="font-medium">Filters</span>
          {/* Mobile export */}
          <button
            onClick={handleExport}
            className="md:hidden ml-auto flex items-center gap-1 text-brand-600 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order ID..."
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">All Statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">All Products</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      {!loading && (
        <p className="text-xs text-gray-500">
          Showing {orders.length} order{orders.length !== 1 ? "s" : ""}
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
          <p className="text-gray-500 text-sm">No orders found.</p>
          {canCreate && (
            <Link
              href="/orders/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-lg transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Create First Order
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order: any) => {
            const isOverdue =
              order.deliveryDeadline &&
              new Date(order.deliveryDeadline) < new Date() &&
              order.status !== "DISPATCHED";

            return (
              <div key={order.id} className="relative">
                {/* Selection checkbox */}
                {selectionMode && (
                  <button
                    onClick={() => toggleSelect(order.id)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1"
                  >
                    {selectedIds.has(order.id) ? (
                      <CheckSquare className="w-5 h-5 text-brand-500" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-300" />
                    )}
                  </button>
                )}

                <div className={selectionMode ? "ml-9" : ""}>
                  {/* Overdue border indicator */}
                  <div className={isOverdue ? "ring-2 ring-red-300 rounded-xl" : ""}>
                    <OrderCard
                      order={{
                        id: order.id,
                        orderId: order.orderId,
                        productCategory: order.items?.length > 0
                          ? order.items[0].productCategory
                          : order.productCategory,
                        status: order.status,
                        productDetails:
                          order.items?.length > 0
                            ? (typeof order.items[0].productDetails === "string"
                                ? JSON.parse(order.items[0].productDetails)
                                : order.items[0].productDetails)
                            : (typeof order.productDetails === "string"
                                ? JSON.parse(order.productDetails)
                                : order.productDetails),
                        partyName: order.customer?.partyName,
                        createdAt: order.createdAt,
                        deliveryDeadline: order.deliveryDeadline,
                        priority: order.priority,
                        itemCount: order.items?.length || 0,
                      }}
                      showParty={showParty}
                    />
                  </div>
                </div>
              </div>
            );
          })}
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
