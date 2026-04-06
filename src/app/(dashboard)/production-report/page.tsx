"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDate, formatDateTime, getStatusLabel, getProductCategoryLabel } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ClipboardList, ArrowLeft, ArrowRight, Package, Truck, Factory, ChevronRight } from "lucide-react";

interface Summary {
  ordersReceived: number;
  movedToProduction: number;
  madeReady: number;
  dispatched: number;
  totalStatusChanges: number;
}

interface StatusChange {
  id: string;
  fromStatus: string;
  toStatus: string;
  notes: string | null;
  changedAt: string;
  changedBy: { name: string };
  order: {
    orderId: string;
    id: string;
    productCategory: string;
    customer: { partyName: string } | null;
  };
}

interface ReportData {
  date: string;
  summary: Summary;
  pipelineSnapshot: { status: string; count: number }[];
  ordersCreated: any[];
  statusChanges: StatusChange[];
  dispatchedOrders: any[];
}

export default function ProductionReportPage() {
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/production-report?date=${date}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [date]);

  const changeDate = (days: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split("T")[0]);
  };

  const isToday = date === new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-brand-500" />
          Daily Production Report
        </h1>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => changeDate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
          {isToday && (
            <p className="text-[10px] text-brand-600 font-medium mt-1">Today</p>
          )}
        </div>
        <button
          onClick={() => changeDate(1)}
          disabled={isToday}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-30"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      ) : !data ? (
        <div className="text-center py-12 text-gray-500">Failed to load report.</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="Orders Received"
              value={data.summary.ordersReceived}
              icon={<Package className="w-4 h-4 text-blue-500" />}
              color="bg-blue-50 border-blue-200"
            />
            <SummaryCard
              label="In Production"
              value={data.summary.movedToProduction}
              icon={<Factory className="w-4 h-4 text-yellow-600" />}
              color="bg-yellow-50 border-yellow-200"
            />
            <SummaryCard
              label="Made Ready"
              value={data.summary.madeReady}
              icon={<Package className="w-4 h-4 text-green-600" />}
              color="bg-green-50 border-green-200"
            />
            <SummaryCard
              label="Dispatched"
              value={data.summary.dispatched}
              icon={<Truck className="w-4 h-4 text-gray-600" />}
              color="bg-gray-50 border-gray-200"
            />
          </div>

          {/* Pipeline Snapshot */}
          {data.pipelineSnapshot.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Current Pipeline</h2>
              <div className="flex flex-wrap gap-2">
                {data.pipelineSnapshot.map((item) => (
                  <span
                    key={item.status}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-medium text-gray-700"
                  >
                    {getStatusLabel(item.status)}
                    <span className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full text-xs font-bold">
                      {item.count}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Activity Timeline ({data.statusChanges.length} changes)
            </h2>
            {data.statusChanges.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No activity on this day</p>
            ) : (
              <div className="space-y-0">
                {data.statusChanges.map((change, idx) => (
                  <div
                    key={change.id}
                    className="flex gap-3 pb-3 relative"
                  >
                    {/* Timeline line */}
                    {idx < data.statusChanges.length - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200" />
                    )}
                    {/* Dot */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      change.toStatus === "DISPATCHED"
                        ? "bg-gray-200"
                        : change.toStatus === "IN_PRODUCTION"
                        ? "bg-yellow-200"
                        : change.toStatus === "READY_FOR_DISPATCH"
                        ? "bg-green-200"
                        : change.toStatus === "RAW_MATERIAL_NA"
                        ? "bg-red-200"
                        : "bg-blue-200"
                    }`}>
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/orders/${change.order.id}`}
                          className="text-xs font-bold text-brand-600 hover:text-brand-700"
                        >
                          {change.order.orderId}
                        </Link>
                        <span className="text-[10px] text-gray-400">
                          {getStatusLabel(change.fromStatus || "New")} → {getStatusLabel(change.toStatus)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {change.order.customer && (
                          <span className="text-[11px] text-gray-500">
                            {change.order.customer.partyName}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          by {change.changedBy.name} at{" "}
                          {new Date(change.changedAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {change.notes && (
                        <p className="text-[11px] text-gray-500 mt-0.5 italic">&quot;{change.notes}&quot;</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dispatched Orders */}
          {data.dispatchedOrders.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4 text-brand-500" />
                Dispatched Today ({data.dispatchedOrders.length})
              </h2>
              <div className="divide-y divide-gray-100">
                {data.dispatchedOrders.map((order: any) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
                  >
                    <div>
                      <span className="text-sm font-semibold text-gray-900">
                        {order.orderId}
                      </span>
                      <p className="text-xs text-gray-500">
                        {order.customer?.partyName} · {getProductCategoryLabel(order.productCategory)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data.summary.totalStatusChanges === 0 &&
            data.summary.ordersReceived === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <p className="text-gray-400 text-sm">No production activity on {formatDate(date)}</p>
              </div>
            )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[11px] font-medium text-gray-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
