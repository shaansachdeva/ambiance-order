"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import OrderCard from "@/components/OrderCard";
import { hasPermission, safeParseJSON } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollRestoration } from "@/lib/useScrollRestoration";
import { PRODUCT_CATEGORIES, ORDER_STATUSES } from "@/types";
import type { UserRole, OrderStatus } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import {
  PlusCircle, Search, Filter, Download, CheckSquare, Trash2,
  FileEdit, Clock, ChevronDown, ChevronUp, Package, X,
  ArrowUpDown, SlidersHorizontal,
} from "lucide-react";

function OrdersPageContent() {
  const { data: session, status: sessionStatus } = useSession();
  const { t, tStatus, tProduct } = useLanguage();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deleteToastRef = useRef<string | null>(null);

  // Draft management
  const [draftOrder, setDraftOrder] = useState<any>(null);

  useEffect(() => {
    try {
      const d = localStorage.getItem("order_draft");
      if (d) setDraftOrder(JSON.parse(d));
    } catch {}
    // Clean up any lingering discarded-drafts history from older versions —
    // we no longer keep this list, Discard is now a one-shot delete.
    try { localStorage.removeItem("discarded_drafts"); } catch {}
  }, []);

  const deleteDraftPermanently = () => {
    try { localStorage.removeItem("order_draft"); } catch {}
    setDraftOrder(null);
  };

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const customPermissions = (session?.user as any)?.customPermissions ?? null;
  const showParty = hasPermission(userRole, "view_party", customPermissions);
  const canCreate = hasPermission(userRole, "create_order", customPermissions);
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

    fetch(`/api/orders?${params}`, { cache: 'no-store' })
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

  // Restore the scroll position after returning from an order detail/edit so
  // users land back on the row they clicked into instead of the top of the list.
  // `!loading` ensures the list has rendered before we scroll.
  useScrollRestoration(!loading);

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

  const activeFilterCount =
    (statusFilter ? 1 : 0) + (categoryFilter ? 1 : 0) + (sortBy !== "newest" ? 1 : 0);

  const clearAllFilters = () => {
    setStatusFilter("");
    setCategoryFilter("");
    setSortBy("newest");
  };

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      <Toaster position="top-right" />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
            {t("orders.title")}
          </h1>
          {!loading && (
            <p className="text-xs text-gray-500 mt-0.5">
              {orders.length} {orders.length !== 1 ? t("orders.orders") : t("orders.order")}
              {activeFilterCount > 0 && (
                <span className="ml-1 text-brand-600 font-medium">
                  · {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          )}
        </div>
        {/* Desktop-only header actions. Mobile uses the unified action row in the
            filter bar below (so buttons don't end up scattered across two rows). */}
        <div className="hidden md:flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-white text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all"
          >
            <Download className="w-4 h-4" />
            {t("orders.exportCSV")}
          </button>
          {canBulkUpdate && (
            <button
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedIds(new Set());
                setShowBulkMenu(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-all border ${
                selectionMode
                  ? "bg-brand-100 text-brand-700 border-brand-300 shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {selectionMode ? t("common.cancel") : "Select"}
            </button>
          )}
          {canCreate && (
            <Link
              href="/orders/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              {t("orders.newOrder")}
            </Link>
          )}
        </div>
      </div>

      {/* ── Bulk action bar (sticky on mobile) ────────────────── */}
      {selectionMode && (
        <div className="sticky top-16 md:top-0 z-30 bg-gradient-to-r from-brand-50 to-brand-100/50 border border-brand-200 rounded-2xl p-3 flex items-center justify-between gap-2 flex-wrap shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="text-xs text-brand-700 font-semibold hover:text-brand-800 underline-offset-2 hover:underline"
            >
              {selectedIds.size === orders.length ? t("orders.deselectAll") : t("orders.selectAll")}
            </button>
            <span className="text-sm font-bold text-brand-800">
              {selectedIds.size} <span className="font-medium text-brand-700">{t("orders.selected")}</span>
            </span>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowBulkMenu(!showBulkMenu)}
                  disabled={bulkUpdating}
                  className="px-3 py-2 bg-brand-500 text-white text-xs font-semibold rounded-xl hover:bg-brand-600 disabled:opacity-50 shadow-sm transition-all active:scale-[0.97]"
                >
                  {bulkUpdating ? t("orders.updating") : t("orders.changeStatus")}
                </button>
                {showBulkMenu && (
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 overflow-hidden">
                    {ORDER_STATUSES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => handleBulkUpdate(s.value)}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
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
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-500 text-white text-xs font-semibold rounded-xl hover:bg-rose-600 disabled:opacity-50 shadow-sm transition-all active:scale-[0.97]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Filter toolbar ─────────────────────────────────────── */}
      <div className="space-y-2">
        {/* Single inline row: search + 3 dropdowns (desktop) / search + toggle (mobile) */}
        <div className="flex items-stretch gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("orders.searchPlaceholder")}
              className="w-full h-10 pl-10 pr-9 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Desktop: inline dropdowns */}
          <div className="hidden md:flex items-stretch gap-2 flex-shrink-0">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 pl-9 pr-8 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 appearance-none cursor-pointer transition-all hover:border-gray-300 max-w-[160px]"
                title={t("orders.allStatuses")}
              >
                <option value="">{t("orders.allStatuses")}</option>
                {ORDER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{tStatus(s.value)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-10 pl-9 pr-8 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 appearance-none cursor-pointer transition-all hover:border-gray-300 max-w-[160px]"
                title={t("orders.allProducts")}
              >
                <option value="">{t("orders.allProducts")}</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{tProduct(c.value)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-10 pl-9 pr-8 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 appearance-none cursor-pointer transition-all hover:border-gray-300 max-w-[150px]"
                title="Sort"
              >
                <option value="newest">{t("orders.newestFirst")}</option>
                <option value="oldest">{t("orders.oldestFirst")}</option>
                <option value="orderId">{t("orders.orderId")}</option>
                <option value="deadline">{t("orders.deadlineSoonest")}</option>
                <option value="status">{t("orders.statusSort")}</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Mobile: single uniform icon strip — filter / select / export, all 10×10 */}
          <div className="md:hidden flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`relative inline-flex items-center justify-center h-10 w-10 rounded-xl border transition-all active:scale-[0.97] ${
                showFilters || activeFilterCount > 0
                  ? "bg-brand-50 text-brand-700 border-brand-200"
                  : "bg-white text-gray-600 border-gray-200"
              }`}
              aria-label="Filters"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold rounded-full bg-brand-500 text-white ring-2 ring-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {canBulkUpdate && (
              <button
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedIds(new Set());
                  setShowBulkMenu(false);
                }}
                className={`inline-flex items-center justify-center h-10 w-10 rounded-xl border transition-all active:scale-[0.97] ${
                  selectionMode
                    ? "bg-brand-50 text-brand-700 border-brand-200"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
                aria-label="Select"
              >
                {selectionMode ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={handleExport}
              className="inline-flex items-center justify-center h-10 w-10 text-gray-600 bg-white border border-gray-200 rounded-xl active:scale-[0.97]"
              aria-label={t("orders.export")}
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile: collapsible dropdowns row */}
        {showFilters && (
          <div className="md:hidden grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-10 pl-9 pr-8 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 appearance-none cursor-pointer transition-all"
              >
                <option value="">{t("orders.allStatuses")}</option>
                {ORDER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{tStatus(s.value)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full h-10 pl-9 pr-8 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 appearance-none cursor-pointer transition-all"
              >
                <option value="">{t("orders.allProducts")}</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{tProduct(c.value)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full h-10 pl-9 pr-8 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 appearance-none cursor-pointer transition-all"
              >
                <option value="newest">{t("orders.newestFirst")}</option>
                <option value="oldest">{t("orders.oldestFirst")}</option>
                <option value="orderId">{t("orders.orderId")}</option>
                <option value="deadline">{t("orders.deadlineSoonest")}</option>
                <option value="status">{t("orders.statusSort")}</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Active filter chips + clear all */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {statusFilter && (
              <button
                onClick={() => setStatusFilter("")}
                className="inline-flex items-center gap-1 px-2 py-1 bg-brand-50 text-brand-700 text-[11px] font-semibold rounded-lg ring-1 ring-brand-100 hover:bg-brand-100 transition-colors"
              >
                {tStatus(statusFilter)}
                <X className="w-3 h-3" />
              </button>
            )}
            {categoryFilter && (
              <button
                onClick={() => setCategoryFilter("")}
                className="inline-flex items-center gap-1 px-2 py-1 bg-brand-50 text-brand-700 text-[11px] font-semibold rounded-lg ring-1 ring-brand-100 hover:bg-brand-100 transition-colors"
              >
                {tProduct(categoryFilter)}
                <X className="w-3 h-3" />
              </button>
            )}
            {sortBy !== "newest" && (
              <button
                onClick={() => setSortBy("newest")}
                className="inline-flex items-center gap-1 px-2 py-1 bg-brand-50 text-brand-700 text-[11px] font-semibold rounded-lg ring-1 ring-brand-100 hover:bg-brand-100 transition-colors"
              >
                {sortBy === "oldest" && t("orders.oldestFirst")}
                {sortBy === "orderId" && t("orders.orderId")}
                {sortBy === "deadline" && t("orders.deadlineSoonest")}
                {sortBy === "status" && t("orders.statusSort")}
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={clearAllFilters}
              className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Saved Draft Banner ─────────────────────────────────── */}
      {draftOrder && canCreate && (
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
              <FileEdit className="w-4 h-4 text-gray-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-tight">Unsaved draft</p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">
                {draftOrder.savedAt
                  ? `Last saved ${new Date(draftOrder.savedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                  : "Draft found"
                }
                {draftOrder.customerId ? " · party selected" : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={deleteDraftPermanently}
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              Discard
            </button>
            <Link
              href="/orders/new"
              className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-semibold text-white bg-gray-900 hover:bg-black rounded-md transition-colors leading-none"
            >
              Continue
            </Link>
          </div>
        </div>
      )}

      {/* Discarded-drafts history removed — Discard is now a hard delete. */}

      {/* ── Orders List ────────────────────────────────────────── */}
      {loading || sessionStatus === "loading" ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-stretch bg-white rounded-2xl border border-gray-200/80 overflow-hidden animate-pulse">
              <div className="w-1 bg-gray-200" />
              <div className="flex-1 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-20 bg-gray-200 rounded" />
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                </div>
                <div className="h-5 w-48 bg-gray-200 rounded" />
                <div className="flex gap-3">
                  <div className="h-3 w-16 bg-gray-100 rounded" />
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 sm:py-16 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100/50 ring-1 ring-brand-100 flex items-center justify-center mb-4">
            <Package className="w-6 h-6 text-brand-500" />
          </div>
          <p className="text-base font-semibold text-gray-900">{t("orders.noOrders")}</p>
          <p className="text-xs text-gray-500 mt-1">
            {activeFilterCount > 0
              ? "Try adjusting your filters"
              : "Create your first order to get started"}
          </p>
          {canCreate && activeFilterCount === 0 && (
            <Link
              href="/orders/new"
              className="inline-flex items-center gap-2 mt-5 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              {t("orders.createFirst")}
            </Link>
          )}
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="mt-5 px-4 py-2 text-sm font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-xl transition-colors"
            >
              Clear all filters
            </button>
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
                dispatchedAt: order.statusLogs?.[0]?.changedAt || null,
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
          className="md:hidden fixed bottom-24 right-4 z-40 w-14 h-14 bg-gradient-to-br from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-2xl shadow-lg shadow-brand-500/30 flex items-center justify-center active:scale-95 transition-all"
          aria-label={t("orders.newOrder")}
        >
          <PlusCircle className="w-6 h-6" />
        </Link>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />
        ))}
      </div>
    }>
      <OrdersPageContent />
    </Suspense>
  );
}
