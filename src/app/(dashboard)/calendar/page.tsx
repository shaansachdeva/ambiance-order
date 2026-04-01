"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { hasPermission, formatDate, getProductCategoryLabel, getStatusLabel } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import type { UserRole, OrderStatus } from "@/types";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Zap,
} from "lucide-react";
import Link from "next/link";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface CalendarOrder {
  id: string;
  orderId: string;
  status: OrderStatus;
  productCategory: string;
  priority?: string;
  customer?: { partyName: string } | null;
  deliveryDeadline: string;
}

export default function CalendarPage() {
  const { data: session } = useSession();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [orders, setOrders] = useState<CalendarOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const showParty = hasPermission(userRole, "view_party");

  useEffect(() => {
    setLoading(true);
    fetch("/api/orders")
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        // Only keep orders with delivery deadlines
        const withDeadlines = arr.filter((o: any) => o.deliveryDeadline);
        setOrders(withDeadlines);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group orders by date
  const ordersByDate: Record<string, CalendarOrder[]> = {};
  for (const order of orders) {
    const dateStr = new Date(order.deliveryDeadline).toISOString().split("T")[0];
    if (!ordersByDate[dateStr]) ordersByDate[dateStr] = [];
    ordersByDate[dateStr].push(order);
  }

  const selectedOrders = selectedDate ? (ordersByDate[selectedDate] || []) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-brand-500" />
          Delivery Calendar
        </h1>
      </div>

      {/* Month navigation */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">
            {MONTHS[month]} {year}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before the 1st */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-14 md:h-20" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayOrders = ordersByDate[dateStr] || [];
              const isToday =
                day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear();
              const isPast = new Date(year, month, day) < today;
              const hasOverdue = dayOrders.some(
                (o) => isPast && o.status !== "DISPATCHED"
              );
              const isSelected = selectedDate === dateStr;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`h-14 md:h-20 rounded-lg border text-left p-1 transition-all relative ${
                    isSelected
                      ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                      : isToday
                      ? "border-brand-300 bg-brand-50/50"
                      : hasOverdue
                      ? "border-red-300 bg-red-50/50"
                      : dayOrders.length > 0
                      ? "border-gray-200 bg-white hover:border-brand-300"
                      : "border-transparent hover:bg-gray-50"
                  }`}
                >
                  <span
                    className={`text-xs font-medium ${
                      isToday
                        ? "text-brand-600 font-bold"
                        : isPast
                        ? "text-gray-400"
                        : "text-gray-700"
                    }`}
                  >
                    {day}
                  </span>
                  {dayOrders.length > 0 && (
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {dayOrders.slice(0, 3).map((o) => {
                        const isOrderOverdue = isPast && o.status !== "DISPATCHED";
                        return (
                          <div
                            key={o.id}
                            className={`w-full h-1.5 rounded-full ${
                              isOrderOverdue
                                ? "bg-red-400"
                                : o.priority === "URGENT"
                                ? "bg-orange-400"
                                : o.status === "DISPATCHED"
                                ? "bg-gray-300"
                                : "bg-brand-400"
                            }`}
                          />
                        );
                      })}
                      {dayOrders.length > 3 && (
                        <span className="text-[8px] text-gray-400">
                          +{dayOrders.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <div className="w-3 h-1.5 rounded-full bg-brand-400" /> Active
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-1.5 rounded-full bg-red-400" /> Overdue
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-1.5 rounded-full bg-orange-400" /> Urgent
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-1.5 rounded-full bg-gray-300" /> Dispatched
        </span>
      </div>

      {/* Selected date orders */}
      {selectedDate && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Orders due on {formatDate(selectedDate)} ({selectedOrders.length})
          </h2>
          {selectedOrders.length === 0 ? (
            <p className="text-xs text-gray-500">No orders due on this date.</p>
          ) : (
            <div className="space-y-2">
              {selectedOrders.map((order) => {
                const isPastDue =
                  new Date(order.deliveryDeadline) < today && order.status !== "DISPATCHED";
                return (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className={`block p-3 rounded-lg border transition-colors hover:border-brand-300 ${
                      isPastDue ? "border-red-200 bg-red-50/50" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{order.orderId}</span>
                        {order.priority === "URGENT" && (
                          <Zap className="w-3.5 h-3.5 text-red-500" />
                        )}
                        {isPastDue && (
                          <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
                            OVERDUE
                          </span>
                        )}
                      </div>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{getProductCategoryLabel(order.productCategory)}</span>
                      {showParty && order.customer && (
                        <>
                          <span>·</span>
                          <span>{order.customer.partyName}</span>
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
