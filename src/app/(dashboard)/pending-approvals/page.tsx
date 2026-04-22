"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Package,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  ChevronRight,
  AlertTriangle,
  IndianRupee,
} from "lucide-react";
import Link from "next/link";
import { formatDate, getProductCategoryLabel, safeParseJSON } from "@/lib/utils";
import toast, { Toaster } from "react-hot-toast";

export default function PendingApprovalsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role;

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === "authenticated" && userRole !== "ADMIN") {
      router.push("/");
    }
  }, [sessionStatus, userRole, router]);

  const fetchOrders = () => {
    setLoading(true);
    fetch("/api/orders?status=PENDING_CONFIRMATION", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleAction = async (orderId: string, action: "confirm" | "reject") => {
    setProcessing(orderId + action);
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: action === "reject" ? (rejectNotes[orderId] || "Rejected by admin") : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(action === "confirm" ? "Order confirmed!" : "Order rejected");
        fetchOrders();
      } else {
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Toaster position="top-right" />

      <div className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-brand-500" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pending Approvals</h1>
          <p className="text-sm text-gray-500">Orders submitted by sales team awaiting confirmation</p>
        </div>
        {orders.length > 0 && (
          <span className="ml-auto px-2.5 py-1 bg-amber-100 text-amber-700 text-sm font-bold rounded-full">
            {orders.length}
          </span>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <p className="text-gray-900 font-medium">All clear!</p>
          <p className="text-gray-500 text-sm mt-1">No orders pending confirmation</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const items = order.items || [];
            const isExpanded = expandedOrder === order.id;

            return (
              <div key={order.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Order header */}
                <div className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base font-bold text-gray-900">
                          {typeof order.orderId === "number"
                            ? `ORD-${String(order.orderId).padStart(4, "0")}`
                            : order.orderId}
                        </span>
                        {order.priority === "URGENT" && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                            URGENT
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                          Pending Confirmation
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                        {order.customer && (
                          <span className="flex items-center gap-1.5 font-medium text-gray-700">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            {order.customer.partyName}
                            {order.customer.location && (
                              <span className="text-gray-400 font-normal">— {order.customer.location}</span>
                            )}
                          </span>
                        )}
                        {order.createdBy && (
                          <span className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5" />
                            By {order.createdBy?.name || "Sales"}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(order.createdAt)}
                        </span>
                        {order.deliveryDeadline && (
                          <span className="flex items-center gap-1.5 text-brand-600">
                            <Calendar className="w-3.5 h-3.5" />
                            Due: {formatDate(order.deliveryDeadline)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/orders/${order.id}`}
                      className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium shrink-0 mt-1"
                    >
                      View <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* Items summary */}
                  <div className="mt-3">
                    <button
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1"
                    >
                      <Package className="w-3.5 h-3.5" />
                      {items.length} item{items.length !== 1 ? "s" : ""}
                      <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-2">
                        {items.map((item: any, idx: number) => {
                          const details = safeParseJSON(item.productDetails);
                          return (
                            <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="text-sm font-semibold text-gray-900">
                                  {getProductCategoryLabel(item.productCategory)}
                                </span>
                                {item.rate && (
                                  <span className="ml-auto flex items-center gap-0.5 text-xs font-medium text-gray-600">
                                    <IndianRupee className="w-3 h-3" />
                                    {item.rate}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(details as Record<string, any>).map(([key, value]) => {
                                  if (!value) return null;
                                  const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
                                  return (
                                    <div key={key} className="text-xs">
                                      <span className="text-gray-400">{label}: </span>
                                      <span className="text-gray-800 font-medium">{String(value)}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {order.remarks && (
                    <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-medium">Remarks:</span> {order.remarks}
                    </p>
                  )}
                </div>

                {/* Reject notes input */}
                <div className="px-4 pb-2">
                  <input
                    type="text"
                    value={rejectNotes[order.id] || ""}
                    onChange={(e) => setRejectNotes((prev) => ({ ...prev, [order.id]: e.target.value }))}
                    placeholder="Rejection reason (optional)..."
                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 bg-gray-50"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex border-t border-gray-100">
                  <button
                    onClick={() => handleAction(order.id, "reject")}
                    disabled={processing !== null}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40 border-r border-gray-100"
                  >
                    <XCircle className="w-4 h-4" />
                    {processing === order.id + "reject" ? "Rejecting..." : "Reject"}
                  </button>
                  <button
                    onClick={() => handleAction(order.id, "confirm")}
                    disabled={processing !== null}
                    className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {processing === order.id + "confirm" ? "Confirming..." : "Confirm Order"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
