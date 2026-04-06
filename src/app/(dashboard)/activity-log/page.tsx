"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import { Activity, Shield, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface LogEntry {
  id: string;
  fromStatus: string;
  toStatus: string;
  notes: string | null;
  changedAt: string;
  changedBy: { id: string; name: string; role: string };
  order: {
    orderId: string;
    id: string;
    customer: { partyName: string } | null;
  };
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

export default function ActivityLogPage() {
  const { data: session } = useSession();
  const { t, tStatus } = useLanguage();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<UserOption[]>([]);

  const [filterUser, setFilterUser] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const userRole = (session?.user as any)?.role;

  useEffect(() => {
    if (userRole !== "ADMIN") {
      setLoading(false);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (filterUser) params.set("userId", filterUser);
    if (filterDate) params.set("date", filterDate);

    fetch(`/api/activity-log?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
        if (data.users) setUsers(data.users);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userRole, page, filterUser, filterDate]);

  if (userRole !== "ADMIN") {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">{t("activityLog.accessDenied")}</p>
        <p className="text-sm text-gray-400 mt-1">{t("activityLog.adminOnly")}</p>
      </div>
    );
  }

  const getStatusChangeColor = (toStatus: string) => {
    switch (toStatus) {
      case "ORDER_PLACED": return "bg-blue-100 text-blue-700";
      case "CONFIRMED": return "bg-purple-100 text-purple-700";
      case "IN_PRODUCTION": return "bg-yellow-100 text-yellow-800";
      case "RAW_MATERIAL_NA": return "bg-red-100 text-red-700";
      case "READY_FOR_DISPATCH": return "bg-green-100 text-green-700";
      case "DISPATCHED": return "bg-gray-100 text-gray-700";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      ADMIN: "bg-red-50 text-red-600",
      SALES: "bg-blue-50 text-blue-600",
      PRODUCTION: "bg-yellow-50 text-yellow-700",
      DISPATCH: "bg-green-50 text-green-600",
      ACCOUNTANT: "bg-purple-50 text-purple-600",
    };
    return colors[role] || "bg-gray-50 text-gray-600";
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-brand-500" />
          {t("activityLog.title")}
        </h1>
        <span className="text-xs text-gray-500">{total} {t("activityLog.totalActions")}</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Filter className="w-4 h-4" />
          <span className="font-medium text-xs">{t("orders.filters")}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select
            value={filterUser}
            onChange={(e) => { setFilterUser(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="">{t("activityLog.allUsers")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role.toLowerCase()})
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
        </div>
        {(filterUser || filterDate) && (
          <button
            onClick={() => { setFilterUser(""); setFilterDate(""); setPage(1); }}
            className="mt-2 text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            {t("activityLog.clearFilters")}
          </button>
        )}
      </div>

      {/* Logs */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 text-sm">{t("activityLog.noActivity")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {logs.map((log) => (
            <div key={log.id} className="p-3 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {log.changedBy.name}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getRoleBadge(log.changedBy.role)}`}>
                      {log.changedBy.role}
                    </span>
                    <span className="text-xs text-gray-400">→</span>
                    <Link
                      href={`/orders/${log.order.id}`}
                      className="text-xs font-bold text-brand-600 hover:text-brand-700"
                    >
                      {log.order.orderId}
                    </Link>
                  </div>

                  <div className="flex items-center gap-1.5 mb-1">
                    {log.fromStatus && (
                      <>
                        <span className="text-[11px] text-gray-500">
                          {tStatus(log.fromStatus)}
                        </span>
                        <span className="text-gray-300">→</span>
                      </>
                    )}
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${getStatusChangeColor(log.toStatus)}`}>
                      {tStatus(log.toStatus)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-gray-400">
                    {log.order.customer && (
                      <span>{log.order.customer.partyName}</span>
                    )}
                    {log.notes && (
                      <span className="italic truncate max-w-[200px]">
                        &quot;{log.notes}&quot;
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                  {formatDateTime(log.changedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            {t("activityLog.previous")}
          </button>
          <span className="text-xs text-gray-500">
            {t("activityLog.page")} {page} {t("activityLog.of")} {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("activityLog.next")}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
