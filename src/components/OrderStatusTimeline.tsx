"use client";

import { formatDateTime, getStatusLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

interface StatusLog {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  changedBy: string;
  changedAt: string | Date;
  notes?: string;
}

interface OrderStatusTimelineProps {
  statusLogs: StatusLog[];
}

const STATUS_DOT_COLORS: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: "bg-amber-500",
  ORDER_PLACED: "bg-blue-500",
  CONFIRMED: "bg-purple-500",
  IN_PRODUCTION: "bg-amber-500",
  RAW_MATERIAL_NA: "bg-red-500",
  READY_FOR_DISPATCH: "bg-green-500",
  DISPATCHED: "bg-gray-400",
  REJECTED: "bg-red-600",
};

export default function OrderStatusTimeline({
  statusLogs,
}: OrderStatusTimelineProps) {
  if (!statusLogs || statusLogs.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-6 text-center">
        No status history available.
      </div>
    );
  }

  // Most recent first
  const sorted = [...statusLogs].sort(
    (a, b) =>
      new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  );

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {sorted.map((log, idx) => {
          const isLast = idx === sorted.length - 1;
          const dotColor =
            STATUS_DOT_COLORS[log.toStatus] || "bg-gray-400";

          return (
            <li key={log.id}>
              <div className="relative pb-8">
                {/* Connector line */}
                {!isLast && (
                  <span
                    className="absolute left-3 top-5 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}

                <div className="relative flex items-start gap-3">
                  {/* Dot */}
                  <div className="flex-shrink-0 mt-0.5">
                    <div
                      className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center ring-4 ring-white",
                        dotColor
                      )}
                    >
                      <div className="h-2 w-2 rounded-full bg-white" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">
                        {log.fromStatus
                          ? `${getStatusLabel(log.fromStatus)} \u2192 ${getStatusLabel(log.toStatus)}`
                          : getStatusLabel(log.toStatus)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                      <span>by {log.changedBy}</span>
                      <span>{formatDateTime(log.changedAt)}</span>
                    </div>
                    {log.notes && (
                      <p className="mt-1.5 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                        {log.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
