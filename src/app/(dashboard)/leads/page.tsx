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
  FileSpreadsheet,
  FileDown,
  Trash2,
  Search,
  Users,
  X,
  ChevronDown,
  Filter,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useLanguage } from "@/contexts/LanguageContext";
import { useScrollRestoration } from "@/lib/useScrollRestoration";
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
  updatedAt: string;
}

interface SalesUser {
  id: string;
  name: string;
}

type SortKey = "newest" | "oldest" | "recent_edit" | "name_asc" | "name_desc" | "status" | "followup";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent_edit", label: "Recently Edited" },
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
    case "recent_edit":
      return copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
  // Restore scroll position when coming back from a lead detail page.
  useScrollRestoration(!loading);
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

  // Custom export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportSalesPerson, setExportSalesPerson] = useState<string>("all");

  // Status quick-filter
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
    const trimmed = debouncedSearch.trim();
    if (trimmed) params.set("search", trimmed);
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

  const STATUS_STYLE: Record<string, { badge: string; accent: string; dot: string }> = {
    NEW:         { badge: "bg-blue-50 text-blue-700 ring-blue-100",       accent: "bg-blue-400",    dot: "bg-blue-500" },
    FOLLOW_UP:   { badge: "bg-amber-50 text-amber-700 ring-amber-100",    accent: "bg-amber-400",   dot: "bg-amber-500" },
    CONVERTED:   { badge: "bg-emerald-50 text-emerald-700 ring-emerald-100", accent: "bg-emerald-400", dot: "bg-emerald-500" },
    CLOSED_LOST: { badge: "bg-rose-50 text-rose-700 ring-rose-100",       accent: "bg-rose-400",    dot: "bg-rose-500" },
  };
  const getStatusStyle = (s: string) => STATUS_STYLE[s] || { badge: "bg-gray-50 text-gray-700 ring-gray-100", accent: "bg-gray-300", dot: "bg-gray-400" };

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

  const handleCustomExport = () => {
    const params = new URLSearchParams();
    if (exportFrom) params.set("from", exportFrom);
    if (exportTo) params.set("to", exportTo);
    if (userRole === "ADMIN" && exportSalesPerson && exportSalesPerson !== "all") {
      params.set("salesPersonId", exportSalesPerson);
    }
    const qs = params.toString();
    window.open(`/api/leads/export${qs ? "?" + qs : ""}`, "_blank");
    setShowExportModal(false);
    toast.success("Export started");
  };

  const filtered = statusFilter === "all" ? leads : leads.filter((l) => l.status === statusFilter);
  const sorted = sortLeads(filtered, sort);
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label || "Sort";

  // Counts per status for chip badges
  const statusCounts = leads.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const STATUS_CHIPS: { value: string; label: string }[] = [
    { value: "all",         label: "All" },
    { value: "NEW",         label: "New" },
    { value: "FOLLOW_UP",   label: "Follow-up" },
    { value: "CONVERTED",   label: "Converted" },
    { value: "CLOSED_LOST", label: "Lost" },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-24 md:pb-6">
      <Toaster position="top-right" />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
            {t("leads.title")}
          </h1>
          {!loading && (
            <p className="text-xs text-gray-500 mt-0.5">
              {sorted.length} lead{sorted.length !== 1 ? "s" : ""}
              {selectionMode && selectedIds.size > 0 && (
                <span className="ml-1 text-brand-600 font-medium">· {selectedIds.size} selected</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowExportModal(true)}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-xl hover:bg-emerald-100 hover:border-emerald-300 transition-all active:scale-[0.97]"
            title="Export leads to Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export
          </button>

          {canDelete && (
            <button
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedIds(new Set());
                setShowSort(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-all border active:scale-[0.97] ${
                selectionMode
                  ? "bg-brand-100 text-brand-700 border-brand-300 shadow-sm"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span className="hidden sm:inline">{selectionMode ? t("common.cancel") : t("leads.select")}</span>
            </button>
          )}

          {!selectionMode && (
            <Link
              href="/leads/new"
              className="hidden md:inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              {t("leads.newLead")}
            </Link>
          )}
        </div>
      </div>

      {/* ── Bulk action bar ────────────────────────────────────── */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="sticky top-16 md:top-0 z-30 bg-gradient-to-r from-brand-50 to-brand-100/50 border border-brand-200 rounded-2xl p-3 flex items-center justify-between gap-2 flex-wrap shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="text-xs text-brand-700 font-semibold hover:text-brand-800 underline-offset-2 hover:underline"
            >
              {selectedIds.size === sorted.length ? t("orders.deselectAll") : t("orders.selectAll")}
            </button>
            <span className="text-sm font-bold text-brand-800">
              {selectedIds.size} <span className="font-medium text-brand-700">{t("orders.selected")}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport(true)}
              disabled={bulkWorking}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl hover:bg-emerald-50 disabled:opacity-50 transition-all active:scale-[0.97]"
            >
              <FileDown className="w-3.5 h-3.5" />
              {t("leads.exportSelected")}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkWorking}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-500 text-white text-xs font-semibold rounded-xl hover:bg-rose-600 disabled:opacity-50 shadow-sm transition-all active:scale-[0.97]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {bulkWorking ? t("leads.deleting") : t("common.delete")}
            </button>
          </div>
        </div>
      )}

      {/* ── Inline toolbar: search + sort ─────────────────────── */}
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads by company, contact or remarks..."
            className="w-full h-10 pl-10 pr-9 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowSort((v) => !v)}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.97]"
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="hidden sm:inline">{currentSortLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>
          {showSort && (
            <div className="absolute right-0 top-11 z-20 w-44 bg-white rounded-xl shadow-lg ring-1 ring-gray-200/40 border border-gray-200 py-1.5 overflow-hidden">
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
      </div>

      {/* ── Status quick-filter chips ──────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_CHIPS.map((chip) => {
          const isActive = statusFilter === chip.value;
          const count = chip.value === "all" ? leads.length : (statusCounts[chip.value] || 0);
          const style = chip.value === "all" ? null : getStatusStyle(chip.value);
          return (
            <button
              key={chip.value}
              onClick={() => setStatusFilter(chip.value)}
              className={`inline-flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97] ring-1 ${
                isActive
                  ? "bg-brand-500 text-white ring-brand-500 shadow-sm shadow-brand-500/20"
                  : style
                    ? `bg-white text-gray-700 ring-gray-200 hover:ring-gray-300 hover:bg-gray-50`
                    : "bg-white text-gray-700 ring-gray-200 hover:ring-gray-300 hover:bg-gray-50"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {style && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white/80" : style.dot}`} />
                )}
                {chip.label}
              </span>
              <span className={`inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[10px] font-bold rounded-md ${
                isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Admin: Sales-person filter ─────────────────────────── */}
      {userRole === "ADMIN" && salesUsers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap bg-white rounded-2xl border border-gray-200/80 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-gray-500">
            <Filter className="w-3.5 h-3.5" />
            View as
          </div>
          <button
            onClick={() => setFilterSalesPerson("all")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
              filterSalesPerson === "all"
                ? "bg-brand-500 text-white shadow-sm"
                : "bg-gray-50 text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
            }`}
          >
            All
          </button>
          {salesUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => setFilterSalesPerson(u.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-[0.97] ${
                filterSalesPerson === u.id
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-gray-50 text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
              }`}
            >
              {u.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Leads list ─────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-stretch bg-white rounded-2xl border border-gray-200/80 overflow-hidden animate-pulse">
              <div className="w-1 bg-gray-200" />
              <div className="flex-1 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-40 bg-gray-200 rounded" />
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                </div>
                <div className="flex gap-3">
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                  <div className="h-3 w-28 bg-gray-100 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 sm:py-16 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100/50 ring-1 ring-brand-100 flex items-center justify-center mb-4">
            <Target className="w-6 h-6 text-brand-500" />
          </div>
          <p className="text-base font-semibold text-gray-900">{t("leads.noLeads")}</p>
          <p className="text-xs text-gray-500 mt-1">
            {search ? "Try adjusting your search" : t("leads.noLeadsDesc")}
          </p>
          <Link
            href="/leads/new"
            className="inline-flex items-center gap-2 mt-5 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            {t("leads.newLead")}
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((lead) => {
            const style = getStatusStyle(lead.status);
            const followUpDate = lead.nextFollowUp ? new Date(lead.nextFollowUp) : null;
            if (followUpDate) followUpDate.setHours(0, 0, 0, 0);
            const isFollowUpOverdue = followUpDate && followUpDate < today && lead.status !== "CONVERTED" && lead.status !== "CLOSED_LOST";
            const isFollowUpToday = followUpDate && followUpDate.getTime() === today.getTime();
            const isSelected = selectedIds.has(lead.id);

            const cardCls = `group relative flex items-stretch bg-white rounded-2xl border overflow-hidden transition-all duration-200 ${
              selectionMode
                ? isSelected
                  ? "border-brand-400 bg-brand-50/40 shadow-sm cursor-pointer"
                  : "border-gray-200 cursor-pointer hover:border-brand-200 active:scale-[0.99]"
                : "border-gray-200/80 hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
            }`;

            const inner = (
              <>
                {/* Status accent bar */}
                <div className={`w-1 flex-shrink-0 ${style.accent}`} />

                <div className="flex items-center gap-3 p-3.5 sm:p-4 flex-1 min-w-0">
                  {selectionMode && (
                    <div className="flex-shrink-0">
                      {isSelected
                        ? <CheckSquare className="w-5 h-5 text-brand-500" />
                        : <Square className="w-5 h-5 text-gray-300" />}
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3 flex-1 min-w-0">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Row 1: Name + status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[15px] sm:text-base text-gray-900 font-bold tracking-tight truncate">
                          {lead.companyName}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg ring-1 text-[10px] font-bold ${style.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          {lead.status.replace("_", " ")}
                        </span>
                      </div>

                      {/* Row 2: Contact info */}
                      {(lead.contacts?.[0]?.name || lead.contacts?.[0]?.phone) && (
                        <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                          {lead.contacts[0]?.name && (
                            <span className="flex items-center gap-1 font-medium">
                              <Building2 className="w-3.5 h-3.5 text-gray-400" />
                              {lead.contacts[0].name}
                            </span>
                          )}
                          {lead.contacts[0]?.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              {lead.contacts[0].phone}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Row 3: Meta */}
                      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        {lead.nextFollowUp && (
                          <span className={`flex items-center gap-1 font-semibold ${
                            isFollowUpOverdue ? "text-rose-600" : isFollowUpToday ? "text-amber-600" : "text-brand-600"
                          }`}>
                            <Calendar className="w-3.5 h-3.5" />
                            {isFollowUpOverdue ? "Overdue · " : isFollowUpToday ? "Today · " : `${t("leads.followUpLabel")} `}
                            {format(new Date(lead.nextFollowUp), "MMM d")}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-gray-400">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(lead.createdAt), "MMM d, yyyy")}
                        </span>
                        {lead.updatedAt && new Date(lead.updatedAt).getTime() - new Date(lead.createdAt).getTime() > 60_000 && (
                          <span className="flex items-center gap-1 text-gray-500 font-medium" title={`Edited ${format(new Date(lead.updatedAt), "PPp")}`}>
                            <Pencil className="w-3 h-3" />
                            Edited {format(new Date(lead.updatedAt), "MMM d")}
                          </span>
                        )}
                        {userRole === "ADMIN" && lead.salesPerson && (
                          <span className="flex items-center gap-1 text-gray-400">
                            <Users className="w-3.5 h-3.5" />
                            {lead.salesPerson.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {!selectionMode && (
                      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1 transition-all group-hover:text-brand-500 group-hover:translate-x-0.5" />
                    )}
                  </div>
                </div>
              </>
            );

            return selectionMode ? (
              <div key={lead.id} className={cardCls} onClick={() => toggleSelect(lead.id)}>
                {inner}
              </div>
            ) : (
              <Link key={lead.id} href={`/leads/${lead.id}`} className={cardCls}>
                {inner}
              </Link>
            );
          })}
        </div>
      )}

      {/* Mobile FAB */}
      {!selectionMode && (
        <Link
          href="/leads/new"
          className="md:hidden fixed bottom-24 right-4 z-40 w-14 h-14 bg-gradient-to-br from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-2xl shadow-lg shadow-brand-500/30 flex items-center justify-center active:scale-95 transition-all"
          aria-label={t("leads.newLead")}
        >
          <Plus className="w-6 h-6" />
        </Link>
      )}

      {/* ── Custom Export Modal ────────────────────────────────── */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl ring-1 ring-gray-200/60 overflow-hidden">
            <div className="px-5 pt-5 pb-3 bg-gradient-to-r from-emerald-50 to-emerald-50/40 border-b border-emerald-100/70 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 ring-1 ring-emerald-200 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-900">Export Leads to Excel</h3>
                  <p className="text-xs text-emerald-700/90 mt-0.5">
                    Filter by date range and salesperson, then download an .xlsx file.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/60 rounded-lg transition-colors flex-shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">From</label>
                  <input
                    type="date"
                    value={exportFrom}
                    onChange={(e) => setExportFrom(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">To</label>
                  <input
                    type="date"
                    value={exportTo}
                    onChange={(e) => setExportTo(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                  />
                </div>
              </div>

              {/* Quick presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Today", days: 0 },
                  { label: "Last 7 days", days: 7 },
                  { label: "Last 30 days", days: 30 },
                  { label: "This month", thisMonth: true },
                  { label: "All time", clear: true },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      if (p.clear) { setExportFrom(""); setExportTo(""); return; }
                      const today = new Date();
                      const fmt = (d: Date) => d.toISOString().slice(0, 10);
                      if (p.thisMonth) {
                        const first = new Date(today.getFullYear(), today.getMonth(), 1);
                        setExportFrom(fmt(first)); setExportTo(fmt(today));
                      } else if (typeof p.days === "number") {
                        const start = new Date(); start.setDate(start.getDate() - p.days);
                        setExportFrom(fmt(start)); setExportTo(fmt(today));
                      }
                    }}
                    className="px-2.5 py-1 text-[11px] font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg ring-1 ring-gray-200 active:scale-[0.97] transition-all"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Sales-person selector (admin only) */}
              {userRole === "ADMIN" && (
                <div>
                  <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">Sales Person</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <select
                      value={exportSalesPerson}
                      onChange={(e) => setExportSalesPerson(e.target.value)}
                      className="w-full pl-9 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 appearance-none cursor-pointer transition-all"
                    >
                      <option value="all">All sales people</option>
                      {salesUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2 ring-1 ring-gray-200/70">
                {exportFrom || exportTo ? (
                  <>Date: <span className="font-semibold text-gray-700">{exportFrom || "earliest"} → {exportTo || "today"}</span></>
                ) : (
                  <>Date: <span className="font-semibold text-gray-700">All time</span></>
                )}
                {userRole === "ADMIN" && exportSalesPerson !== "all" && (
                  <> · Salesperson: <span className="font-semibold text-gray-700">{salesUsers.find(u => u.id === exportSalesPerson)?.name || "—"}</span></>
                )}
              </div>
            </div>

            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomExport}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl active:scale-[0.97] transition-all shadow-sm hover:shadow"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Download .xlsx
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
