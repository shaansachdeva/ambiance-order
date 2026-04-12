"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  Plus,
  Target,
  Phone,
  ChevronRight,
  Calendar,
  Building2,
  ArrowUpDown,
  CheckSquare,
  Square,
  Download,
  Trash2,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UserRole } from "@/types";
import toast, { Toaster } from "react-hot-toast";

interface Lead {
  id: string;
  companyName: string;
  contacts: { name: string; phone: string | null }[];
  status: string;
  nextFollowUp: string | null;
  salesPerson: { name: string };
  createdAt: string;
}

interface SalesUser {
  id: string;
  name: string;
}

type SortKey = "newest" | "oldest" | "name_asc" | "name_desc" | "status" | "followup";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "status", label: "By Status" },
  { value: "followup", label: "Follow-up Date" },
];

function sortLeads(leads: Lead[], sort: SortKey): Lead[] {
  const copy = [...leads];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "oldest":
      return copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case "name_asc":
      return copy.sort((a, b) => a.companyName.localeCompare(b.companyName));
    case "name_desc":
      return copy.sort((a, b) => b.companyName.localeCompare(a.companyName));
    case "status":
      return copy.sort((a, b) => a.status.localeCompare(b.status));
    case "followup":
      return copy.sort((a, b) => {
        if (!a.nextFollowUp && !b.nextFollowUp) return 0;
        if (!a.nextFollowUp) return 1;
        if (!b.nextFollowUp) return -1;
        return new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime();
      });
    default:
      return copy;
  }
}

export default function LeadsPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("newest");
  const [showSort, setShowSort] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Admin filter by sales person
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [filterSalesPerson, setFilterSalesPerson] = useState<string>("all");

  // Multi-select
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const deleteToastRef = useRef<string | null>(null);

  const canDelete = ["ADMIN", "SALES"].includes(userRole);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Fetch SALES users for admin filter
  useEffect(() => {
    if (userRole === "ADMIN") {
      fetch("/api/users?role=SALES")
        .then((r) => r.json())
        .then((data) => setSalesUsers(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [userRole]);

  const fetchLeads = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (userRole === "ADMIN" && filterSalesPerson !== "all") {
      params.set("salesPersonId", filterSalesPerson);
    }

    fetch(`/api/leads?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setLeads(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => { setLoading(false); toast.error(t("common.error")); });
  };

  useEffect(() => {
    fetchLeads();
  }, [debouncedSearch, filterSalesPerson]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NEW": return "bg-blue-100 text-blue-800";
      case "FOLLOW_UP": return "bg-yellow-100 text-yellow-800";
      case "CONVERTED": return "bg-green-100 text-green-800";
      case "CLOSED_LOST": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((l) => l.id)));
    }
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (deleteToastRef.current) toast.dismiss(deleteToastRef.current);
    deleteToastRef.current = toast(
      (toastInstance) => (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-900">
            Delete {count} {count !== 1 ? "leads" : "lead"}?
          </p>
          <p className="text-xs text-gray-500">This cannot be undone.</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(toastInstance.id)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(toastInstance.id);
                setBulkWorking(true);
                try {
                  const res = await fetch("/api/leads/bulk", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "delete", ids: Array.from(selectedIds) }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    toast.success(`${data.deleted} ${t("leads.deleted")}`);
                    exitSelection();
                    fetchLeads();
                  } else {
                    toast.error(data.error || t("common.failedUpdate"));
                  }
                } catch {
                  toast.error(t("common.error"));
                } finally {
                  setBulkWorking(false);
                }
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: Infinity }
    );
  };

  const handleExport = (selectedOnly: boolean) => {
    const ids = selectedOnly ? Array.from(selectedIds) : [];
    const params = ids.length > 0 ? `?ids=${ids.join(",")}` : "";
    window.open(`/api/leads/export${params}`, "_blank");
  };

  const sorted = sortLeads(leads, sort);
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label || "Sort";

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Target className="w-5 h-5 text-brand-500" />
          {t("leads.title")}
        </h1>
        <div className="flex items-center gap-2">
          {/* Export all */}
          <button
            onClick={() => handleExport(false)}
            className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {t("leads.exportAll")}
          </button>

          {/* Select toggle */}
          {canDelete && (
            <button
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedIds(new Set());
                setShowSort(false);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors border ${
                selectionMode
                  ? "bg-brand-100 text-brand-700 border-brand-300"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {selectionMode ? t("common.cancel") : t("leads.select")}
            </button>
          )}

          {/* Sort button (hidden in selection mode) */}
          {!selectionMode && (
            <div className="relative">
              <button
                onClick={() => setShowSort((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <ArrowUpDown className="w-4 h-4" />
                <span className="hidden sm:inline">{currentSortLabel}</span>
              </button>
              {showSort && (
                <div className="absolute right-0 top-10 z-20 w-44 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSort(opt.value); setShowSort(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        sort === opt.value
                          ? "bg-brand-50 text-brand-700 font-semibold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!selectionMode && (
            <Link
              href="/leads/new"
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {t("leads.newLead")}
            </Link>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leads by company, contact or remarks..."
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-shadow shadow-sm"
        />
      </div>

      {/* Admin: Sales person filter */}
      {userRole === "ADMIN" && salesUsers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-xs text-gray-500 font-medium">View as:</span>
          <button
            onClick={() => setFilterSalesPerson("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterSalesPerson === "all"
                ? "bg-brand-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {salesUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => setFilterSalesPerson(u.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterSalesPerson === u.id
                  ? "bg-brand-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {u.name}
            </button>
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="text-xs text-brand-600 font-medium hover:text-brand-700"
            >
              {selectedIds.size === sorted.length ? t("orders.deselectAll") : t("orders.selectAll")}
            </button>
            <span className="text-sm font-medium text-brand-700">
              {selectedIds.size} {t("orders.selected")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport(true)}
              disabled={bulkWorking}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {t("leads.exportSelected")}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkWorking}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {bulkWorking ? t("leads.deleting") : t("common.delete")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">{t("leads.noLeads")}</p>
          <p className="text-gray-500 text-sm mt-1">{t("leads.noLeadsDesc")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 shadow-sm">
          {sorted.map((lead) => (
            <div key={lead.id} className="flex items-center">
              {/* Checkbox */}
              {selectionMode && (
                <button
                  onClick={() => toggleSelect(lead.id)}
                  className="pl-4 pr-2 py-4 flex-shrink-0"
                >
                  {selectedIds.has(lead.id) ? (
                    <CheckSquare className="w-5 h-5 text-brand-500" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-300" />
                  )}
                </button>
              )}

              <Link
                href={selectionMode ? "#" : `/leads/${lead.id}`}
                onClick={selectionMode ? (e) => { e.preventDefault(); toggleSelect(lead.id); } : undefined}
                className="flex items-center gap-4 flex-1 px-5 py-4 hover:bg-gray-50 transition-colors min-w-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {lead.companyName}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${getStatusColor(lead.status)}`}>
                      {lead.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    {lead.contacts && lead.contacts[0] && (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {lead.contacts[0].name}
                      </span>
                    )}
                    {lead.contacts && lead.contacts[0]?.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {lead.contacts[0].phone}
                      </span>
                    )}
                    {lead.nextFollowUp && (
                      <span className="flex items-center gap-1.5 text-brand-600 font-medium">
                        <Calendar className="w-4 h-4" />
                        {t("leads.followUpLabel")} {format(new Date(lead.nextFollowUp), "MMM d, yyyy")}
                      </span>
                    )}
                    {userRole === "ADMIN" && lead.salesPerson && (
                      <span className="flex items-center gap-1.5 text-gray-400">
                        <Users className="w-3.5 h-3.5" />
                        {lead.salesPerson.name}
                      </span>
                    )}
                  </div>
                </div>
                {!selectionMode && <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
