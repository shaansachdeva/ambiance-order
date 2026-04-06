"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UserRole } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import {
  Plus,
  Users,
  MapPin,
  ChevronRight,
  Search,
  Trash2,
  Package,
  CheckSquare,
  Square,
  Download,
  X,
} from "lucide-react";
import Link from "next/link";

interface Customer {
  id: string;
  partyName: string;
  location?: string | null;
  createdAt: string;
  _count?: { orders: number };
}

export default function CustomersPage() {
  const { data: session } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Multi-select
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const deleteToastRef = useRef<string | null>(null);

  const { t } = useLanguage();
  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const canAdd = hasPermission(userRole, "create_order");
  const isAdmin = userRole === "ADMIN";

  const fetchCustomers = useCallback(() => {
    setLoading(true);
    fetch("/api/customers?withCount=true")
      .then((res) => res.json())
      .then((data) => {
        setCustomers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => { setLoading(false); toast.error("Failed to load parties"); });
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyName: newName.trim(), location: newLocation.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setCustomers((prev) => [...prev, data].sort((a, b) => a.partyName.localeCompare(b.partyName)));
        setNewName("");
        setNewLocation("");
        toast.success(`"${data.partyName}" ${t("customers.added")}`);
      } else {
        toast.error(data.error || "Failed to add");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (deleteToastRef.current) toast.dismiss(deleteToastRef.current);
    deleteToastRef.current = toast(
      (toastInstance) => (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-900">Delete &quot;{name}&quot;?</p>
          <p className="text-xs text-gray-500">{t("customers.cannotUndo")}</p>
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
                setDeletingId(id);
                try {
                  const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
                  const data = await res.json();
                  if (res.ok) {
                    setCustomers((prev) => prev.filter((c) => c.id !== id));
                    toast.success(data.softDeleted ? `"${name}" ${t("customers.deactivated")}` : `"${name}" deleted`);
                  } else {
                    toast.error(data.error || "Failed to delete");
                  }
                } catch {
                  toast.error("Something went wrong");
                } finally {
                  setDeletingId(null);
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
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
            Delete {count} {count !== 1 ? "parties" : "party"}?
          </p>
          <p className="text-xs text-gray-500">Parties with orders will be deactivated instead.</p>
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
                  const res = await fetch("/api/customers/bulk", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "delete", ids: Array.from(selectedIds) }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    toast.success(
                      `${data.deleted} ${t("customers.bulkDeleteResult")} ${data.deactivated} ${t("customers.bulkDeactivated")}`
                    );
                    exitSelection();
                    fetchCustomers();
                  } else {
                    toast.error(data.error || t("common.failedUpdate"));
                  }
                } catch {
                  toast.error("Something went wrong");
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
    window.open(`/api/customers/export${params}`, "_blank");
  };

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.partyName.toLowerCase().includes(q) ||
      c.location?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-brand-500" />
          {t("customers.title")}
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{customers.length} {t("customers.total")}</span>
          {/* Export all button */}
          <button
            onClick={() => handleExport(false)}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {t("customers.exportAll")}
          </button>
          {/* Select toggle */}
          {isAdmin && (
            <button
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedIds(new Set());
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                selectionMode
                  ? "bg-brand-100 text-brand-700 border-brand-300"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              {selectionMode ? t("common.cancel") : t("customers.select")}
            </button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="text-xs text-brand-600 font-medium hover:text-brand-700"
            >
              {selectedIds.size === filtered.length ? t("orders.deselectAll") : t("orders.selectAll")}
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
              {t("customers.exportWithOrders")}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkWorking}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {bulkWorking ? t("customers.deleting") : t("common.delete")}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("customers.searchPlaceholder")}
          className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
        />
      </div>

      {/* Add Customer */}
      {canAdd && !selectionMode && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{t("customers.addNew")}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={t("customers.partyName")}
              className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {t("customers.add")}
            </button>
          </div>
          <input
            type="text"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            placeholder={t("customers.locationOptional")}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {/* Customer List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-sm">
            {search ? t("customers.noMatch") : t("customers.noParties")}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center group">
              {/* Checkbox (selection mode) */}
              {selectionMode && (
                <button
                  onClick={() => toggleSelect(c.id)}
                  className="pl-3 pr-1 py-3 flex-shrink-0"
                >
                  {selectedIds.has(c.id) ? (
                    <CheckSquare className="w-5 h-5 text-brand-500" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-300" />
                  )}
                </button>
              )}

              <Link
                href={selectionMode ? "#" : `/customers/${c.id}`}
                onClick={selectionMode ? (e) => { e.preventDefault(); toggleSelect(c.id); } : undefined}
                className="flex items-center gap-3 flex-1 px-4 py-3 hover:bg-gray-50 transition-colors min-w-0"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-600 text-xs font-bold flex-shrink-0">
                  {c.partyName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.partyName}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {c.location && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />
                        {c.location}
                      </span>
                    )}
                    {c._count?.orders !== undefined && (
                      <span className="flex items-center gap-0.5">
                        <Package className="w-3 h-3" />
                        {c._count.orders} order{c._count.orders !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                {!selectionMode && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
              </Link>

              {/* Single delete button (non-selection mode) */}
              {isAdmin && !selectionMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c.id, c.partyName);
                  }}
                  disabled={deletingId === c.id}
                  className="mr-3 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="Delete party"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
