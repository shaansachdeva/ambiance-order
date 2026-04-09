"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Trash2, RotateCcw, AlertTriangle, ArrowLeft } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { safeParseJSON } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";

export default function RecycleBinPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  const userRole = (session?.user as any)?.role;

  useEffect(() => {
    if (sessionStatus === "authenticated" && userRole !== "ADMIN") {
      router.push("/");
    }
  }, [sessionStatus, userRole, router]);

  const fetchBin = () => {
    setLoading(true);
    fetch("/api/recycle-bin")
      .then((r) => r.json())
      .then((d) => { setOrders(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchBin(); }, []);

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setSelected(selected.size === orders.length ? new Set() : new Set(orders.map((o) => o.id)));

  const handleRestore = async (ids: string[]) => {
    setWorking(true);
    try {
      await Promise.all(ids.map((id) =>
        fetch("/api/recycle-bin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
      ));
      toast.success(`${ids.length} order${ids.length !== 1 ? "s" : ""} restored`);
      setSelected(new Set());
      fetchBin();
    } catch {
      toast.error("Failed to restore");
    } finally {
      setWorking(false);
    }
  };

  const handlePermanentDelete = async (ids: string[]) => {
    toast(
      (t) => (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-900">
            Permanently delete {ids.length} order{ids.length !== 1 ? "s" : ""}? This cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                setWorking(true);
                try {
                  const res = await fetch("/api/recycle-bin", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ids }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    toast.success(`${data.deleted} order${data.deleted !== 1 ? "s" : ""} permanently deleted`);
                    setSelected(new Set());
                    fetchBin();
                  } else {
                    toast.error(data.error || "Failed to delete");
                  }
                } catch {
                  toast.error("Something went wrong");
                } finally {
                  setWorking(false);
                }
              }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
            >
              Delete Forever
            </button>
          </div>
        </div>
      ),
      { duration: Infinity }
    );
  };

  if (sessionStatus === "loading") return <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />;
  if (userRole !== "ADMIN") return null;

  return (
    <div className="space-y-4">
      <Toaster position="top-right" />

      <div className="flex items-center gap-3">
        <Link href="/orders" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Recycle Bin
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Deleted orders — restore or permanently remove</p>
        </div>
      </div>

      {/* Bulk actions */}
      {orders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <button onClick={toggleAll} className="text-xs text-brand-600 font-medium hover:text-brand-700">
              {selected.size === orders.length ? "Deselect All" : "Select All"}
            </button>
            {selected.size > 0 && (
              <span className="text-sm font-medium text-gray-700">{selected.size} selected</span>
            )}
          </div>
          {selected.size > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => handleRestore(Array.from(selected))}
                disabled={working}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore
              </button>
              <button
                onClick={() => handlePermanentDelete(Array.from(selected))}
                disabled={working}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Forever
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Trash2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm font-medium">Recycle bin is empty</p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const firstItem = order.items?.[0];
            const details = firstItem ? safeParseJSON(firstItem.productDetails) : {};
            const isSelected = selected.has(order.id);
            return (
              <div
                key={order.id}
                onClick={() => toggleSelect(order.id)}
                className={`bg-white border rounded-xl p-4 cursor-pointer transition-all ${isSelected ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${isSelected ? "bg-red-500 border-red-500" : "border-gray-300"}`}>
                      {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900">{order.orderId}</span>
                        <StatusBadge status={order.status} />
                        {order.priority === "URGENT" && (
                          <span className="text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">URGENT</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{order.customer?.partyName}</p>
                      {order.items?.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                          {details?.width ? ` · ${details.width}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-red-500 font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Deleted
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {order.deletedAt ? new Date(order.deletedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                    </p>
                    <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleRestore([order.id])}
                        disabled={working}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restore
                      </button>
                      <button
                        onClick={() => handlePermanentDelete([order.id])}
                        disabled={working}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
