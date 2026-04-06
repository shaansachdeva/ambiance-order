"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { OrderStatus } from "@/types";

interface StatusBadgeProps {
  status: OrderStatus;
}

const STATUS_STYLES: Record<OrderStatus, { bg: string; text: string; dot: string }> = {
  ORDER_PLACED: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  CONFIRMED: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  IN_PRODUCTION: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  RAW_MATERIAL_NA: {
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  READY_FOR_DISPATCH: {
    bg: "bg-green-50",
    text: "text-green-700",
    dot: "bg-green-500",
  },
  DISPATCHED: {
    bg: "bg-gray-100",
    text: "text-gray-600",
    dot: "bg-gray-400",
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.ORDER_PLACED;
  const isActive = status !== "DISPATCHED";
  const { tStatus } = useLanguage();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        style.bg,
        style.text
      )}
    >
      <span className="relative flex h-2 w-2">
        {isActive && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              style.dot
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            style.dot
          )}
        />
      </span>
      {tStatus(status)}
    </span>
  );
}
