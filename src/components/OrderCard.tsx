"use client";

import Link from "next/link";
import { Package, Calendar, ChevronRight, AlertTriangle, Zap } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { formatDate, getProductCategoryLabel } from "@/lib/utils";
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
}

function getQuantityLabel(
  category: ProductCategory,
  details: Record<string, string>
): string {
  switch (category) {
    case "BOPP_TAPE":
      return details.boxes ? `${details.boxes} Boxes` : "";
    case "BOPP_JUMBO":
      return details.quantity ? `${details.quantity} Qty` : "";
    case "THERMAL_ROLL":
      return details.boxes ? `${details.boxes} Boxes` : "";
    case "BARCODE_LABEL":
      return details.quantity ? `${details.quantity} Qty` : "";
    case "COMPUTER_STATIONERY":
      return details.packets ? `${details.packets} Packets` : "";
    default:
      return "";
  }
}

export default function OrderCard({ order, showParty }: OrderCardProps) {
  const quantity = getQuantityLabel(order.productCategory, order.productDetails);
  const formattedId =
    typeof order.orderId === "number"
      ? `ORD-${String(order.orderId).padStart(4, "0")}`
      : order.orderId;

  const isOverdue =
    order.deliveryDeadline &&
    new Date(order.deliveryDeadline) < new Date() &&
    order.status !== "DISPATCHED";

  const isUrgent = order.priority === "URGENT";

  return (
    <Link
      href={`/orders/${order.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-sm transition-all active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Header: Order ID + Category + Badges */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">
              {formattedId}
            </span>
            {isUrgent && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                <Zap className="w-2.5 h-2.5" />
                URGENT
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full animate-pulse">
                <AlertTriangle className="w-2.5 h-2.5" />
                OVERDUE
              </span>
            )}
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-500">
              {getProductCategoryLabel(order.productCategory)}
              {(order.itemCount || 0) > 1 && (
                <span className="ml-1 text-brand-600 font-medium">
                  +{(order.itemCount || 0) - 1} more
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
                Due: {formatDate(order.deliveryDeadline)}
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" />
      </div>
    </Link>
  );
}
