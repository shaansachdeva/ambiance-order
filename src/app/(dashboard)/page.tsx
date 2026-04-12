"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import DashboardStats from "@/components/DashboardStats";
import OrderCard from "@/components/OrderCard";
import { formatDate, hasPermission, safeParseJSON } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UserRole } from "@/types";
import { AlertTriangle, TrendingUp, Columns3, ArrowRight } from "lucide-react";
import Link from "next/link";

interface DashboardData {
  totalOrders: number;
  pendingOrders: number;
  todayProduction: number;
  readyForDispatch: number;
  dispatched: number;
  rawMaterialNA: number;
  recentOrders: any[];
  productWiseCounts: { productCategory: string; count: number }[];
  delayedOrders: any[];
}

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { t, tProduct } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const customPermissions = (session?.user as any)?.customPermissions ?? null;
  const showParty = hasPermission(userRole, "view_party", customPermissions);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || sessionStatus === "loading") {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-gray-500 py-12">{t("dashboard.failedLoad")}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      {/* Greeting & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {t("dashboard.welcome")} {session?.user?.name || "User"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatDate(new Date())} — {t("dashboard.overview")}
          </p>
        </div>
        {["ADMIN", "PRODUCTION", "DISPATCH"].includes(userRole) && (
          <Link
            href="/production-queue"
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm w-max"
          >
            <Columns3 className="w-4 h-4" />
            {t("dashboard.openProduction")}
            <ArrowRight className="w-4 h-4 ml-2 opacity-70" />
          </Link>
        )}
      </div>

      {/* Stats */}
      <DashboardStats
        stats={{
          pendingOrders: data.pendingOrders,
          todaysProduction: data.todayProduction,
          readyForDispatch: data.readyForDispatch,
          dispatched: data.dispatched,
          rawMaterialNA: data.rawMaterialNA,
        }}
      />

      {/* Product-wise Summary */}
      {data.productWiseCounts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-brand-500" />
            {t("dashboard.productWise")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.productWiseCounts.map((item) => (
              <span
                key={item.productCategory}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-700"
              >
                {tProduct(item.productCategory)}
                <span className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full text-xs font-bold">
                  {item.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Delayed Orders */}
      {data.delayedOrders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {t("dashboard.delayedOrders")} ({data.delayedOrders.length})
          </h2>
          <div className="space-y-2">
            {data.delayedOrders.map((order: any) => (
              <OrderCard
                key={order.id}
                order={{
                  id: order.id,
                  orderId: order.orderId,
                  productCategory: order.productCategory,
                  status: order.status,
                  productDetails: safeParseJSON(order.productDetails),
                  partyName: order.customer?.partyName,
                  createdAt: order.createdAt,
                }}
                showParty={showParty}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          {t("dashboard.recentOrders")}
        </h2>
        {data.recentOrders.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8 bg-white rounded-xl border border-gray-200">
            {t("dashboard.noOrders")}
          </div>
        ) : (
          <div className="space-y-2">
            {data.recentOrders.map((order: any) => (
              <OrderCard
                key={order.id}
                order={{
                  id: order.id,
                  orderId: order.orderId,
                  productCategory: order.productCategory,
                  status: order.status,
                  productDetails: safeParseJSON(order.productDetails),
                  partyName: order.customer?.partyName,
                  createdAt: order.createdAt,
                }}
                showParty={showParty}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
