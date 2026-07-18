"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import DashboardStats from "@/components/DashboardStats";
import OrderCard from "@/components/OrderCard";
import { hasPermission, safeParseJSON } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UserRole } from "@/types";
import {
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  PackageSearch,
  Calculator,
  Barcode,
} from "lucide-react";
import Link from "next/link";

interface DashboardData {
  totalOrders: number;
  pendingOrders: number;
  inProduction: number;
  todayProduction: number;
  readyForDispatch: number;
  dispatched: number;
  rawMaterialNA: number;
  pendingApprovals: number;
  recentOrders: any[];
  productWiseCounts: { productCategory: string; count: number }[];
  delayedOrders: any[];
}

function ShortcutTools() {
  const shortcuts = [
    { href: "/calculator", label: "Calculator",        icon: Calculator, hint: "Tape / roll cost math" },
    { href: "/barcode",    label: "Barcode Generator", icon: Barcode,    hint: "Design and print labels" },
  ];
  return (
    <section>
      <h2 className="text-[11px] uppercase tracking-wider font-bold text-gray-500 mb-2 px-1">Tools</h2>
      <div className="grid grid-cols-2 gap-3">
        {shortcuts.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-center gap-3 bg-white border border-gray-200/80 rounded-2xl p-3 sm:p-4 hover:border-gray-300 hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center group-hover:bg-gray-100 transition-colors flex-shrink-0">
              <s.icon className="w-5 h-5 text-gray-700" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{s.label}</p>
              <p className="text-[11px] text-gray-500 truncate">{s.hint}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function greetingFor(date: Date) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const now = useMemo(() => new Date(), []);

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
      <div className="space-y-6 animate-pulse">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-64 bg-gray-200 rounded-lg" />
            <div className="h-4 w-48 bg-gray-200 rounded-lg" />
          </div>
          <div className="h-10 w-44 bg-gray-200 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-2xl" />
          ))}
        </div>
        <div className="h-32 bg-gray-200 rounded-2xl" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-gray-500 py-12">
        {t("dashboard.failedLoad")}
      </div>
    );
  }

  const greeting = greetingFor(now);
  const firstName = (session?.user?.name || "there").split(" ")[0];

  return (
    <div className="space-y-6">
      {/* ── Hero / Greeting ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-brand-50/30 to-white p-5 md:p-6">
        {/* decorative blob */}
        <div className="pointer-events-none absolute -right-16 -top-16 w-48 h-48 rounded-full bg-brand-100/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 w-56 h-56 rounded-full bg-sky-100/30 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 text-xs font-medium text-brand-700 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{formatLongDate(now)}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t("dashboard.overview")}</p>
        </div>
      </div>

      {/* ── Pending Approvals Banner (Admin only) ──────────────── */}
      {userRole === "ADMIN" && data.pendingApprovals > 0 && (
        <Link
          href="/pending-approvals"
          className="group relative overflow-hidden flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-amber-50 to-amber-50/60 border border-amber-200 rounded-2xl hover:border-amber-300 hover:shadow-sm transition-all"
        >
          <span className="relative flex h-2.5 w-2.5 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {data.pendingApprovals} order
              {data.pendingApprovals !== 1 ? "s" : ""} awaiting your confirmation
            </p>
            <p className="text-xs text-amber-700/80">
              Submitted by sales team — tap to review
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-amber-500 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {/* ── Stats Grid ─────────────────────────────────────────── */}
      <DashboardStats
        stats={{
          pendingOrders: data.pendingOrders,
          inProduction: data.inProduction ?? 0,
          todaysProduction: data.todayProduction,
          readyForDispatch: data.readyForDispatch,
          dispatched: data.dispatched,
          rawMaterialNA: data.rawMaterialNA,
        }}
      />

      {/* ── Shortcut tools (Admin/Sales) ─────────────────────────── */}
      <ShortcutTools />


      {/* ── Delayed Orders ──────────────────────────────────────── */}
      {data.delayedOrders.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-rose-700 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-rose-50 ring-1 ring-rose-100 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              </span>
              {t("dashboard.delayedOrders")}
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold">
                {data.delayedOrders.length}
              </span>
            </h2>
          </div>
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
        </section>
      )}

      {/* ── Recent Orders ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center">
              <PackageSearch className="w-3.5 h-3.5 text-gray-600" />
            </span>
            {t("dashboard.recentOrders")}
          </h2>
          {data.recentOrders.length > 0 && (
            <Link
              href="/orders"
              className="group flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              View all
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
        {data.recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <PackageSearch className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700">
              {t("dashboard.noOrders")}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              New orders will appear here as they come in
            </p>
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
      </section>
    </div>
  );
}
