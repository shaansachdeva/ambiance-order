"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; ring: string }> = {
  ORDER_PLACED: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
    ring: "ring-blue-100",
  },
  CONFIRMED: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    dot: "bg-purple-500",
    ring: "ring-purple-100",
  },
  IN_PRODUCTION: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    ring: "ring-amber-100",
  },
  RAW_MATERIAL_NA: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    dot: "bg-rose-500",
    ring: "ring-rose-100",
  },
  READY_FOR_DISPATCH: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    ring: "ring-emerald-100",
  },
  DISPATCHED: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    dot: "bg-slate-400",
    ring: "ring-slate-200",
  },
  PENDING_CONFIRMATION: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    ring: "ring-amber-100",
  },
  REJECTED: {
    bg: "bg-rose-100",
    text: "text-rose-800",
    dot: "bg-rose-600",
    ring: "ring-rose-200",
  },
};

export default function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.ORDER_PLACED;
  const isActive = status !== "DISPATCHED" && status !== "REJECTED";
  const { tStatus } = useLanguage();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 transition-colors",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        style.bg,
        style.text,
        style.ring
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
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
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            style.dot
          )}
        />
      </span>
      {tStatus(status)}
    </span>
  );
}
