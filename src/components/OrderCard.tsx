"use client";

import Link from "next/link";
import {
  Package, Calendar, ChevronRight, AlertTriangle, Zap,
  CheckSquare, Square, Clock, Truck,
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { formatDate, cn, extractQuantity, getProductCategoryLabel } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { OrderStatus, ProductCategory } from "@/types";

interface OrderCardProps {
  order: {
    id: string;
    orderId: number | string;
    productCategory: ProductCategory;
    status: OrderStatus;
    productDetails: Record<string, string>;
    partyName?: string;
    createdAt: string | Date;
    deliveryDeadline?: string | Date | null;
    priority?: string;
    itemCount?: number;
    dispatchedAt?: string | Date | null;
  };
  showParty: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggle?: () => void;
}

// Status → left accent bar color (matches StatusBadge tones)
const STATUS_ACCENT: Record<string, string> = {
  ORDER_PLACED: "bg-blue-400",
  CONFIRMED: "bg-purple-400",
  IN_PRODUCTION: "bg-amber-400",
  RAW_MATERIAL_NA: "bg-rose-400",
  READY_FOR_DISPATCH: "bg-emerald-400",
  DISPATCHED: "bg-slate-300",
  PENDING_CONFIRMATION: "bg-amber-400",
  REJECTED: "bg-rose-500",
};

function getQuantityLabel(
  category: ProductCategory | string,
  details: Record<string, string>,
  t: (key: any) => string
): string {
  // Use the shared extractor (works for built-ins AND custom products).
  const { value, key } = extractQuantity(category, details);
  if (!value) return "";
  // Pick a unit label that fits the field name; fall back to the user's own field name.
  const k = key.toLowerCase();
  if (k.includes("box"))    return `${value} ${t("orderCard.boxes")}`;
  if (k.includes("packet")) return `${value} ${t("orderCard.packets")}`;
  if (k.includes("roll"))   return `${value} ${k.endsWith("s") ? "rolls" : "roll"}`;
  if (k.includes("carton")) return `${value} cartons`;
  if (k === "qty" || k === "quantity") return `${value} ${t("orderCard.qty")}`;
  // Custom field name → use it verbatim
  return `${value} ${key}`;
}

export default function OrderCard({ order, showParty, selectionMode, isSelected, onToggle }: OrderCardProps) {
  const { t, tProduct } = useLanguage();
  const quantity = getQuantityLabel(order.productCategory, order.productDetails, t);
  const formattedId =
    typeof order.orderId === "number"
      ? `ORD-${String(order.orderId).padStart(4, "0")}`
      : order.orderId;

  const isOverdue =
    order.deliveryDeadline &&
    new Date(order.deliveryDeadline) < new Date() &&
    order.status !== "DISPATCHED";

  const isUrgent = order.priority === "URGENT";
  const accent = STATUS_ACCENT[order.status] || "bg-gray-300";

  const cardClass = cn(
    "group relative flex items-stretch bg-white rounded-2xl border overflow-hidden transition-all duration-200",
    selectionMode
      ? isSelected
        ? "border-brand-400 bg-brand-50/40 shadow-sm cursor-pointer"
        : "border-gray-200 cursor-pointer hover:border-brand-200 active:scale-[0.99]"
      : "border-gray-200/80 hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
  );

  const cardContent = (
    <>
      {/* Status accent bar */}
      <div
        className={cn(
          "w-1 flex-shrink-0",
          accent,
          (order.status === "DISPATCHED" || order.status === "REJECTED") ? "" : "shadow-[inset_-1px_0_2px_rgba(0,0,0,0.05)]"
        )}
      />

      <div className="flex items-center gap-3 p-3.5 sm:p-4 flex-1 min-w-0">
        {selectionMode && (
          <div className="flex-shrink-0">
            {isSelected
              ? <CheckSquare className="w-5 h-5 text-brand-500" />
              : <Square className="w-5 h-5 text-gray-300" />
            }
          </div>
        )}

        <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Row 1: Order ID + badges + product label */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900 tracking-tight tabular-nums">
                {formattedId}
              </span>
              {isUrgent && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-md ring-1 ring-rose-200">
                  <Zap className="w-2.5 h-2.5" fill="currentColor" />
                  <span className="hidden sm:inline">{t("orderCard.urgent")}</span>
                </span>
              )}
              {isOverdue && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-bold rounded-md ring-1 ring-rose-200 animate-pulse">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  <span className="hidden sm:inline">{t("orderCard.overdue")}</span>
                </span>
              )}
              <span className="text-[11px] text-gray-400 hidden sm:inline">·</span>
              <span className="text-xs text-gray-500 truncate">
                {tProduct(order.productCategory)}
                {(order.itemCount || 0) > 1 && (
                  <span className="ml-1 text-brand-600 font-semibold">
                    +{(order.itemCount || 0) - 1} {t("orderCard.more")}
                  </span>
                )}
              </span>
            </div>

            {/* Row 2: Party Name + status */}
            <div className="flex items-center gap-2 flex-wrap">
              {showParty && order.partyName && (
                <p className="text-[15px] sm:text-base text-gray-800 font-semibold truncate min-w-0">
                  {order.partyName}
                </p>
              )}
              <StatusBadge status={order.status} size="sm" />
            </div>

            {/* Row 3: Meta */}
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              {quantity && (
                <span className="flex items-center gap-1 font-medium">
                  <Package className="w-3.5 h-3.5 text-gray-400" />
                  {quantity}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {formatDate(order.createdAt)}
              </span>
              {order.deliveryDeadline && (
                <span className={cn(
                  "flex items-center gap-1 font-medium",
                  isOverdue ? "text-rose-600" : "text-gray-600"
                )}>
                  <Clock className="w-3.5 h-3.5" />
                  {t("orderCard.due")} {formatDate(order.deliveryDeadline)}
                </span>
              )}
              {order.status === "DISPATCHED" && order.dispatchedAt && (
                <span className="flex items-center gap-1 font-medium text-slate-600">
                  <Truck className="w-3.5 h-3.5 text-slate-400" />
                  Dispatched {formatDate(order.dispatchedAt)}
                </span>
              )}
            </div>
          </div>

          {/* Chevron */}
          {!selectionMode && (
            <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1 transition-all group-hover:text-brand-500 group-hover:translate-x-0.5" />
          )}
        </div>
      </div>
    </>
  );

  if (selectionMode) {
    return <div className={cardClass} onClick={onToggle}>{cardContent}</div>;
  }

  return (
    <Link href={`/orders/${order.id}`} className={cardClass}>
      {cardContent}
    </Link>
  );
}
