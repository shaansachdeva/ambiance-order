"use client";

import { useEffect, useState } from "react";
import { getProductCategoryLabel, getStatusLabel } from "@/lib/utils";
import { BarChart3, Package, Users, MapPin, Download } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface ReportData {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  productWise: { productCategory: string; count: number }[];
  statusWise: { status: string; count: number }[];
  customerWise: { partyName: string; location: string | null; count: number }[];
  dailyOrders: { date: string; count: number }[];
}

export default function ReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?month=${month}&year=${year}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [month, year]);

  const years = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
    years.push(y);
  }

  const maxDaily = data ? Math.max(...data.dailyOrders.map((d) => d.count), 1) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-brand-500" />
          Monthly Report
        </h1>
        <div className="flex gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => window.open(`/api/orders/export?month=${month}&year=${year}`, "_blank")}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      ) : !data ? (
        <div className="text-center py-12 text-gray-500">Failed to load report.</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-2xl font-bold text-gray-900">{data.totalOrders}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Orders</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-2xl font-bold text-green-600">{data.completedOrders}</p>
              <p className="text-xs text-gray-500 mt-0.5">Dispatched</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-2xl font-bold text-amber-600">{data.pendingOrders}</p>
              <p className="text-xs text-gray-500 mt-0.5">Pending</p>
            </div>
          </div>

          {/* Daily Orders Chart */}
          {data.dailyOrders.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Daily Orders</h2>
              <div className="flex items-end gap-[2px] h-32">
                {data.dailyOrders.map((d) => {
                  const height = maxDaily > 0 ? (d.count / maxDaily) * 100 : 0;
                  const day = parseInt(d.date.split("-")[2]);
                  return (
                    <div
                      key={d.date}
                      className="flex-1 flex flex-col items-center justify-end group relative"
                    >
                      <div
                        className="w-full bg-brand-400 rounded-t-sm min-h-[2px] transition-all hover:bg-brand-600"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                      {d.count > 0 && (
                        <div className="absolute -top-6 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {d.count}
                        </div>
                      )}
                      {(day === 1 || day === 10 || day === 20 || day === data.dailyOrders.length) && (
                        <span className="text-[9px] text-gray-400 mt-1">{day}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Product-wise */}
          {data.productWise.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-500" />
                Product-wise Breakdown
              </h2>
              <div className="space-y-2">
                {data.productWise.map((p) => (
                  <div key={p.productCategory} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-gray-700">
                      {getProductCategoryLabel(p.productCategory)}
                    </span>
                    <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                      {p.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status-wise */}
          {data.statusWise.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Status Breakdown</h2>
              <div className="flex flex-wrap gap-2">
                {data.statusWise.map((s) => (
                  <span
                    key={s.status}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-medium text-gray-700"
                  >
                    {getStatusLabel(s.status)}
                    <span className="bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded-full text-xs font-bold">
                      {s.count}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top Customers */}
          {data.customerWise.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-500" />
                Top Customers
              </h2>
              <div className="divide-y divide-gray-100">
                {data.customerWise.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.partyName}</p>
                      {c.location && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {c.location}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-brand-600">
                      {c.count} order{c.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.totalOrders === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500 text-sm">No orders found for {MONTHS[month - 1]} {year}.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
