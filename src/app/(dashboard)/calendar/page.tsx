"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { hasPermission, formatDate, getProductCategoryLabel } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import StatusBadge from "@/components/StatusBadge";
import type { UserRole, OrderStatus } from "@/types";
import type { TranslationKey } from "@/lib/translations";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Zap,
} from "lucide-react";
import Link from "next/link";

const DAY_KEYS: TranslationKey[] = [
  "calendar.sun", "calendar.mon", "calendar.tue", "calendar.wed",
  "calendar.thu", "calendar.fri", "calendar.sat",
];
const MONTH_KEYS: TranslationKey[] = [
  "month.january", "month.february", "month.march", "month.april",
  "month.may", "month.june", "month.july", "month.august",
  "month.september", "month.october", "month.november", "month.december",
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

interface CalendarLead {
  id: string;
  companyName: string;
  nextFollowUp: string;
  status: string;
}

export default function CalendarPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { t, tProduct } = useLanguage();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [orders, setOrders] = useState<CalendarOrder[]>([]);
  const [leads, setLeads] = useState<CalendarLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const userId   = (session?.user as any)?.id as string | undefined;
  const customPermissions = (session?.user as any)?.customPermissions ?? null;
  const showParty = hasPermission(userRole, "view_party", customPermissions);

  useEffect(() => {
    if (sessionStatus === "loading") return; // wait for session to resolve
    setLoading(true);

    // Build orders query — SALES sees only their own orders, PRODUCTION sees all orders
    const orderParams = new URLSearchParams();
    if (userRole === "SALES" && userId) orderParams.set("createdById", userId);

    // PRODUCTION doesn't see leads at all; SALES sees their own (API already filters by salesPersonId)
    const showLeads = userRole !== "PRODUCTION";

    const fetches: Promise<any>[] = [
      fetch(`/api/orders?${orderParams}`).then((r) => r.json()),
      ...(showLeads ? [fetch("/api/leads").then((r) => r.json())] : []),
    ];

    Promise.all(fetches)
      .then(([ordersData, leadsData]) => {
        const orderArr = Array.isArray(ordersData) ? ordersData : [];
        // PRODUCTION: only show orders relevant to them (not dispatched ones unless deadline)
        const filteredOrders = userRole === "PRODUCTION"
          ? orderArr.filter((o: any) => o.deliveryDeadline && o.status !== "ORDER_PLACED")
          : orderArr.filter((o: any) => o.deliveryDeadline);
        setOrders(filteredOrders);

        const leadArr = Array.isArray(leadsData) ? leadsData : [];
        setLeads(leadArr.filter((l: any) => l.nextFollowUp && l.status !== "CONVERTED" && l.status !== "CLOSED_LOST"));

        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, userRole, userId]);

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

  const leadsByDate: Record<string, CalendarLead[]> = {};
  for (const lead of leads) {
    const dateStr = new Date(lead.nextFollowUp).toISOString().split("T")[0];
    if (!leadsByDate[dateStr]) leadsByDate[dateStr] = [];
    leadsByDate[dateStr].push(lead);
  }

  const selectedOrders = selectedDate ? (ordersByDate[selectedDate] || []) : [];
  const selectedLeads = selectedDate ? (leadsByDate[selectedDate] || []) : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-brand-500" />
          {t("calendar.title")}
        </h1>
      </div>

      {/* Month navigation */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {t(MONTH_KEYS[month])} {year}
            {loading && (
              <span className="inline-block w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
            )}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_KEYS.map((key) => (
            <div key={key} className="text-center text-xs font-medium text-gray-500 py-1">
              {t(key)}
            </div>
          ))}
        </div>

        {/* Calendar grid — always visible; loading only hides event dots */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before the 1st */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-14 md:h-20" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayOrders = loading ? [] : (ordersByDate[dateStr] || []);
            const dayLeads  = loading ? [] : (leadsByDate[dateStr]  || []);
            const isToday =
              day === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();
            const isPast = new Date(year, month, day) < today;
            const hasOverdueOrder = dayOrders.some(
              (o) => isPast && o.status !== "DISPATCHED"
            );
            const hasOverdueLead = dayLeads.some((l) => isPast);
            const hasOverdue = hasOverdueOrder || hasOverdueLead;
            const isSelected = selectedDate === dateStr;

            const totalItems = dayOrders.length + dayLeads.length;

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
                    : totalItems > 0
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
                {loading ? (
                  /* Subtle shimmer while events load — doesn't hide the date number */
                  null
                ) : totalItems > 0 ? (
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {dayOrders.slice(0, 2).map((o) => {
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
                    {dayLeads.slice(0, 3 - Math.min(dayOrders.length, 2)).map((l) => (
                      <div key={`lead-${l.id}`} className="w-full h-1.5 rounded-full bg-blue-500" />
                    ))}
                    {totalItems > 3 && (
                      <span className="text-[8px] text-gray-400">
                        +{totalItems - 3}
                      </span>
                    )}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <div className="w-3 h-1.5 rounded-full bg-brand-400" /> {t("calendar.activeOrder")}
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-1.5 rounded-full bg-blue-500" /> {t("calendar.followUp")}
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-1.5 rounded-full bg-red-400" /> {t("calendar.overdue")}
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-1.5 rounded-full bg-orange-400" /> {t("calendar.urgent")}
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-1.5 rounded-full bg-gray-300" /> {t("calendar.dispatched")}
        </span>
      </div>

      {/* Selected date orders */}
      {selectedDate && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Items for {formatDate(selectedDate)}
          </h2>
          {selectedOrders.length === 0 && selectedLeads.length === 0 ? (
            <p className="text-xs text-gray-500">No items due on this date.</p>
          ) : (
            <div className="space-y-4">
              {selectedOrders.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase">Orders</h3>
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

              {selectedLeads.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase">Follow-ups</h3>
                  {selectedLeads.map((lead) => {
                    const isPastDue = new Date(lead.nextFollowUp) < today;
                    return (
                      <Link
                        key={lead.id}
                        href={`/leads/${lead.id}`}
                        className={`block p-3 rounded-lg border transition-colors hover:border-blue-300 ${
                          isPastDue ? "border-red-200 bg-red-50/50" : "border-blue-100 bg-blue-50/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">{lead.companyName}</span>
                            {isPastDue && (
                              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold">
                                OVERDUE
                              </span>
                            )}
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            lead.status === 'NEW' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {lead.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          Sales Lead Check-in
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
