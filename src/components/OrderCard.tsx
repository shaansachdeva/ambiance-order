"use client";

import Link from "next/link";
import { Package, Calendar, ChevronRight, AlertTriangle, Zap, CheckSquare, Square } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { formatDate } from "@/lib/utils";
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
  };
  showParty: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggle?: () => void;
}

function getQuantityLabel(
  category: ProductCategory,
  details: Record<string, string>,
  t: (key: any) => string
): string {
  switch (category) {
    case "BOPP_TAPE":
      return details.boxes ? `${details.boxes} ${t("orderCard.boxes")}` : "";
    case "BOPP_JUMBO":
      return details.quantity ? `${details.quantity} ${t("orderCard.qty")}` : "";
    case "THERMAL_ROLL":
      return details.boxes ? `${details.boxes} ${t("orderCard.boxes")}` : "";
    case "BARCODE_LABEL":
      return details.quantity ? `${details.quantity} ${t("orderCard.qty")}` : "";
    case "COMPUTER_STATIONERY":
      return details.packets ? `${details.packets} ${t("orderCard.packets")}` : "";
    default:
      return "";
  }
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

  const cardClass = `flex items-center gap-3 bg-white rounded-xl border p-4 transition-all ${
    selectionMode
      ? isSelected
        ? "border-brand-400 bg-brand-50 cursor-pointer"
        : "border-gray-200 cursor-pointer hover:border-brand-200"
      : "border-gray-200 hover:border-brand-300 hover:shadow-sm active:scale-[0.99]"
  }`;

  const cardContent = (
    <>
      {selectionMode && (
        <div className="flex-shrink-0">
          {isSelected
            ? <CheckSquare className="w-5 h-5 text-brand-500" />
            : <Square className="w-5 h-5 text-gray-300" />
          }
        </div>
      )}
      <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
        <div className="min-w-0 flex-1">
          {/* Header: Order ID + Category + Badges */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {formattedId}
            </span>
            {isUrgent && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                <Zap className="w-2.5 h-2.5" />
                {t("orderCard.urgent")}
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full animate-pulse">
                <AlertTriangle className="w-2.5 h-2.5" />
                {t("orderCard.overdue")}
              </span>
            )}
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-500">
              {tProduct(order.productCategory)}
              {(order.itemCount || 0) > 1 && (
                <span className="ml-1 text-brand-600 font-medium">
                  +{(order.itemCount || 0) - 1} {t("orderCard.more")}
                </span>
              )}
            </span>
          </div>

          {/* Party Name */}
          {showParty && order.partyName && (
            <p className="text-sm text-gray-700 font-medium truncate mb-1.5">
              {order.partyName}
            </p>
          )}

          {/* Status Badge */}
          <div className="mb-2">
            <StatusBadge status={order.status} />
          </div>

          {/* Meta: Quantity + Date + Deadline */}
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            {quantity && (
              <span className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                {quantity}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(order.createdAt)}
            </span>
            {order.deliveryDeadline && (
              <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-semibold" : ""}`}>
                {t("orderCard.due")} {formatDate(order.deliveryDeadline)}
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        {!selectionMode && <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" />}
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
