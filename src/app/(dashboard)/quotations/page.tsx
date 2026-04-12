"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { UserRole } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import { PlusCircle, FileText, Search, Trash2, CheckSquare, Square } from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT:    { label: "Draft",    color: "bg-gray-100 text-gray-700" },
  SENT:     { label: "Sent",     color: "bg-blue-100 text-blue-800" },
  ACCEPTED: { label: "Accepted", color: "bg-green-100 text-green-800" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800" },
  EXPIRED:  { label: "Expired",  color: "bg-orange-100 text-orange-800" },
};

export default function QuotationsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draftQuotation, setDraftQuotation] = useState<any>(null);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const canCreate = ["ADMIN", "SALES", "ACCOUNTANT"].includes(userRole);

  useEffect(() => {
    try {
      const d = localStorage.getItem("quotation_draft");
      if (d) setDraftQuotation(JSON.parse(d));
    } catch {}
  }, []);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    fetch(`/api/quotations?${params}`)
      .then((r) => r.json())
      .then((d) => { setQuotations(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionStatus, statusFilter, search]);

  const handleDelete = async (id: string, qId: string) => {
    if (!confirm(`Delete quotation ${qId}? This cannot be undone.`)) return;
    const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setQuotations((prev) => prev.filter((q) => q.id !== id));
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      toast.success("Quotation deleted");
    } else {
      toast.error("Failed to delete");
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!confirm(`Delete ${selectedIds.size} selected quotation(s)? This cannot be undone.`)) return;
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((id) => fetch(`/api/quotations/${id}`, { method: "DELETE" })));
    setQuotations((prev) => prev.filter((q) => !selectedIds.has(q.id)));
    setSelectedIds(new Set());
    toast.success(`${ids.length} quotation(s) deleted`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === quotations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(quotations.map((q) => q.id)));
    }
  };

  if (sessionStatus === "loading") {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-500" />
          Quotations
        </h1>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && canCreate && (
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete {selectedIds.size} selected
            </button>
          )}
          {canCreate && (
            <Link
              href="/quotations/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              New Quotation
            </Link>
          )}
        </div>
      </div>

      {/* Saved Draft Banner */}
      {draftQuotation && canCreate && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-800">Unsaved Quotation Draft</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {draftQuotation.savedAt
                ? `Last saved ${new Date(draftQuotation.savedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                : "Saved earlier"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href="/quotations/new" className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg">
              Continue
            </Link>
            <button
              onClick={() => { localStorage.removeItem("quotation_draft"); setDraftQuotation(null); }}
              className="px-3 py-1.5 border border-amber-300 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-100"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quotations..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}</div>
      ) : quotations.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No quotations found.</p>
          {canCreate && (
            <Link href="/quotations/new" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm rounded-lg transition-colors">
              <PlusCircle className="w-4 h-4" />
              Create First Quotation
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Select-all row */}
          {canCreate && quotations.length > 1 && (
            <div className="flex items-center gap-2 px-1">
              <button type="button" onClick={toggleSelectAll} className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700">
                {selectedIds.size === quotations.length
                  ? <CheckSquare className="w-4 h-4 text-brand-500" />
                  : <Square className="w-4 h-4" />}
                {selectedIds.size === quotations.length ? "Deselect all" : "Select all"}
              </button>
            </div>
          )}
          {quotations.map((q) => {
            const st = STATUS_LABELS[q.status] || STATUS_LABELS.DRAFT;
            const isSelected = selectedIds.has(q.id);
            return (
              <div key={q.id} className={`bg-white rounded-xl border p-4 hover:border-brand-300 transition-colors ${isSelected ? "border-brand-400 bg-brand-50" : "border-gray-200"}`}>
                <div className="flex items-start gap-3">
                  {canCreate && (
                    <button type="button" onClick={() => toggleSelect(q.id)} className="mt-0.5 shrink-0">
                      {isSelected
                        ? <CheckSquare className="w-4 h-4 text-brand-500" />
                        : <Square className="w-4 h-4 text-gray-300 hover:text-gray-500" />}
                    </button>
                  )}
                  <Link href={`/quotations/${q.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{q.quotationId}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.color}`}>{st.label}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{q.customer?.partyName}{q.customer?.location ? ` — ${q.customer.location}` : ""}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>{q.items?.length || 0} item{q.items?.length !== 1 ? "s" : ""}</span>
                      <span>Created {formatDate(q.createdAt)}</span>
                      {q.validUntil && <span>Valid until {formatDate(q.validUntil)}</span>}
                    </div>
                  </Link>
                  {canCreate && (
                    <button
                      onClick={() => handleDelete(q.id, q.quotationId)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mobile FAB */}
      {canCreate && (
        <Link
          href="/quotations/new"
          className="md:hidden fixed bottom-24 right-4 z-40 w-14 h-14 bg-brand-500 hover:bg-brand-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-all"
        >
          <PlusCircle className="w-6 h-6" />
        </Link>
      )}
    </div>
  );
}
