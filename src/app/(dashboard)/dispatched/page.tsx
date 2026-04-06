"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { formatDate, hasPermission, getProductCategoryLabel } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UserRole } from "@/types";
import { Truck, Search, ArrowLeft, Package } from "lucide-react";

interface DispatchedOrder {
  id: string;
  orderId: string;
  originalOrderId: string;
  productCategory: string;
  productDetails: string;
  customer: { partyName: string } | null;
  deliveryDeadline: string | null;
  createdAt: string;
}

type TabFilter = "READY_FOR_DISPATCH" | "DISPATCHED";

export default function DispatchedOrdersPage() {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<DispatchedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabFilter>("READY_FOR_DISPATCH");

  const { t } = useLanguage();
  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const showParty = hasPermission(userRole, "view_party");

  const fetchOrders = useCallback(() => {
    setLoading(true);
    fetch("/api/order-items?includeDispatched=true")
      .then((res) => res.json())
      .then((data) => {
        const items = (Array.isArray(data) ? data : []).filter(
          (item: any) => item.status === "DISPATCHED" || item.status === "READY_FOR_DISPATCH"
        );
        setOrders(items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const readyCount      = orders.filter((o: any) => o.status === "READY_FOR_DISPATCH").length;
  const dispatchedCount = orders.filter((o: any) => o.status === "DISPATCHED").length;

  const filtered = orders.filter((order: any) => {
    if (order.status !== tab) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      order.orderId?.toLowerCase().includes(q) ||
      order.productCategory?.toLowerCase().includes(q) ||
      order.customer?.partyName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/production-queue" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Truck className="w-5 h-5 text-gray-500" />
          {t("dispatch.title")}
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("READY_FOR_DISPATCH")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === "READY_FOR_DISPATCH"
              ? "bg-brand-500 text-white shadow-sm"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {t("dispatch.readyTab")}
          {readyCount > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              tab === "READY_FOR_DISPATCH" ? "bg-white text-brand-600" : "bg-brand-100 text-brand-700"
            }`}>
              {readyCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("DISPATCHED")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            tab === "DISPATCHED"
              ? "bg-gray-800 text-white shadow-sm"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {t("dispatch.dispatchedTab")}
          {dispatchedCount > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
              tab === "DISPATCHED" ? "bg-white text-gray-700" : "bg-gray-100 text-gray-600"
            }`}>
              {dispatchedCount}
            </span>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={t("dispatch.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {search
              ? t("dispatch.noMatch")
              : tab === "READY_FOR_DISPATCH"
              ? t("dispatch.noReady")
              : t("dispatch.noDispatched")}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => {
            let details: Record<string, any> = {};
            try {
              details =
                typeof order.productDetails === "string"
                  ? JSON.parse(order.productDetails)
                  : order.productDetails || {};
            } catch {
              // ignore
            }

            const summaryParts: string[] = [];
            if (details.type) summaryParts.push(details.type);
            if (details.sizeInches) summaryParts.push(`${details.sizeInches}"`);
            if (details.sizeMm) summaryParts.push(`${details.sizeMm}mm`);
            if (details.micron) summaryParts.push(`${details.micron}μ`);

            return (
              <Link
                key={order.id}
                href={`/orders/${order.originalOrderId}`}
                className="block bg-white rounded-xl border border-gray-200 px-4 py-3 hover:shadow-sm hover:border-gray-300 transition-all"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">
                      {order.orderId}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                      {getProductCategoryLabel(order.productCategory)}
                    </span>
                  </div>
                  <StatusBadge status={(order as any).status} />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-3">
                    {showParty && order.customer && (
                      <span>{order.customer.partyName}</span>
                    )}
                    {summaryParts.length > 0 && (
                      <span className="text-gray-400">
                        {summaryParts.join(" · ")}
                      </span>
                    )}
                  </div>
                  <span>
                    {formatDate(order.createdAt)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
