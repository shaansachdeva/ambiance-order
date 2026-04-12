"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { formatDate, hasPermission, getProductCategoryLabel } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UserRole, OrderStatus } from "@/types";
import { ORDER_STATUSES } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import { Columns3, ChevronRight, Zap, AlertTriangle, GripVertical, X, AlertCircle } from "lucide-react";

const KANBAN_COLUMNS: { status: OrderStatus; label: string; color: string; bgColor: string }[] = [
  { status: "ORDER_PLACED", label: "Order Placed", color: "border-blue-400", bgColor: "bg-blue-50" },
  { status: "CONFIRMED", label: "Confirmed", color: "border-purple-400", bgColor: "bg-purple-50" },
  { status: "IN_PRODUCTION", label: "In Production", color: "border-yellow-400", bgColor: "bg-yellow-50" },
  { status: "RAW_MATERIAL_NA", label: "Raw Material N/A", color: "border-red-400", bgColor: "bg-red-50" },
  { status: "READY_FOR_DISPATCH", label: "Ready", color: "border-green-400", bgColor: "bg-green-50" },
];

interface OrderItem {
  id: string;
  orderId: string;
  originalOrderId: string;
  status: OrderStatus;
  productCategory: string;
  priority: string;
  deliveryDeadline: string | null;
  customer: { partyName: string } | null;
  createdAt: string;
}

interface PendingMove {
  orderId: string;
  dbId: string;
  newStatus: OrderStatus;
}

export default function ProductionQueuePage() {
  const { data: session, status: sessionStatus } = useSession();
  const { t, tStatus } = useLanguage();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [mobileColumn, setMobileColumn] = useState<OrderStatus>("IN_PRODUCTION");
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);

  // Raw Material N/A popup state
  const [rawMaterialModal, setRawMaterialModal] = useState<PendingMove | null>(null);
  const [rawMaterialNote, setRawMaterialNote] = useState("");

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const customPermissions = (session?.user as any)?.customPermissions ?? null;
  const showParty = hasPermission(userRole, "view_party", customPermissions);
  const canUpdateStatus = ["ADMIN", "PRODUCTION", "DISPATCH", "ACCOUNTANT"].includes(userRole);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedOrderId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, newStatus: OrderStatus) => {
    e.preventDefault();
    if (!draggedOrderId || !canUpdateStatus) return;

    const orderToMove = orders.find((o) => o.id === draggedOrderId);
    if (!orderToMove || orderToMove.status === newStatus) {
      setDraggedOrderId(null);
      return;
    }

    requestMove(orderToMove.orderId, orderToMove.id, newStatus);
    setDraggedOrderId(null);
  };

  const fetchOrders = useCallback(() => {
    setLoading(true);
    fetch("/api/order-items")
      .then((res) => res.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => { setLoading(false); toast.error("Failed to load orders"); });
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Intercept moves to RAW_MATERIAL_NA and show popup
  const requestMove = (orderId: string, dbId: string, newStatus: OrderStatus) => {
    if (newStatus === "RAW_MATERIAL_NA") {
      setRawMaterialNote("");
      setRawMaterialModal({ orderId, dbId, newStatus });
    } else {
      handleMoveOrder(orderId, dbId, newStatus);
    }
  };

  const handleMoveOrder = async (orderId: string, dbId: string, newStatus: OrderStatus, notes?: string) => {
    if (!canUpdateStatus) return;
    setUpdatingId(dbId);
    try {
      const res = await fetch(`/api/order-items/${dbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes: notes || undefined }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === dbId ? { ...o, status: newStatus } : o))
        );
        toast.success(`${orderId} ${t("productionQueue.movedTo")} ${tStatus(newStatus)}`);
      } else {
        toast.error(t("common.failedUpdate"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmRawMaterial = () => {
    if (!rawMaterialModal) return;
    handleMoveOrder(
      rawMaterialModal.orderId,
      rawMaterialModal.dbId,
      rawMaterialModal.newStatus,
      rawMaterialNote.trim() || undefined
    );
    setRawMaterialModal(null);
    setRawMaterialNote("");
  };

  const getColumnOrders = (status: OrderStatus) =>
    orders.filter((o) => o.status === status);

  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const idx = KANBAN_COLUMNS.findIndex((c) => c.status === current);
    if (idx < 0 || idx >= KANBAN_COLUMNS.length - 1) return null;
    return KANBAN_COLUMNS[idx + 1].status;
  };

  const getPrevStatus = (current: OrderStatus): OrderStatus | null => {
    const idx = KANBAN_COLUMNS.findIndex((c) => c.status === current);
    if (idx <= 0) return null;
    return KANBAN_COLUMNS[idx - 1].status;
  };

  return (
    <div className="space-y-4">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Columns3 className="w-5 h-5 text-brand-500" />
          {t("productionQueue.title")}
        </h1>
        <span className="text-xs text-gray-500">
          {orders.length} {t("productionQueue.activeItems")}
        </span>
      </div>

      {/* Mobile: Column Selector Tabs */}
      <div className="md:hidden overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-1 min-w-max pb-1">
          {KANBAN_COLUMNS.map((col) => {
            const count = getColumnOrders(col.status).length;
            return (
              <button
                key={col.status}
                onClick={() => setMobileColumn(col.status)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  mobileColumn === col.status
                    ? "bg-brand-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {tStatus(col.status)}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  mobileColumn === col.status
                    ? "bg-white/20 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading || sessionStatus === "loading" ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {KANBAN_COLUMNS.map((col) => (
            <div key={col.status} className="hidden md:block">
              <div className="h-8 bg-gray-200 rounded-lg animate-pulse mb-2" />
              <div className="space-y-2">
                <div className="h-24 bg-gray-200 rounded-lg animate-pulse" />
                <div className="h-24 bg-gray-200 rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
          <div className="md:hidden space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Desktop: Full Kanban Board */}
          <div className="hidden md:grid md:grid-cols-5 gap-3 items-start">
            {KANBAN_COLUMNS.map((col) => {
              const columnOrders = getColumnOrders(col.status);
              return (
                <div
                  key={col.status}
                  className="min-h-[200px]"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, col.status)}
                >
                  <div className={`${col.bgColor} rounded-lg px-3 py-2 mb-2 border-t-4 ${col.color}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">{tStatus(col.status)}</span>
                      <span className="text-xs font-bold text-gray-500 bg-white/60 px-1.5 py-0.5 rounded">
                        {columnOrders.length}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {columnOrders.map((order) => (
                      <KanbanCard
                        key={order.id}
                        order={order}
                        showParty={showParty}
                        canUpdate={canUpdateStatus}
                        updating={updatingId === order.id}
                        onMoveNext={() => {
                          const next = getNextStatus(order.status);
                          if (next) requestMove(order.orderId, order.id, next);
                        }}
                        onMovePrev={() => {
                          const prev = getPrevStatus(order.status);
                          if (prev) requestMove(order.orderId, order.id, prev);
                        }}
                        hasNext={!!getNextStatus(order.status)}
                        hasPrev={!!getPrevStatus(order.status)}
                        draggable={canUpdateStatus}
                        onDragStart={(e) => handleDragStart(e, order.id)}
                      />
                    ))}
                    {columnOrders.length === 0 && (
                      <div className="text-center py-6 text-xs text-gray-400">
                        {t("productionQueue.noOrders")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile: Single Column View */}
          <div className="md:hidden space-y-2">
            {getColumnOrders(mobileColumn).length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <p className="text-gray-400 text-sm">{t("productionQueue.noOrdersInStage")}</p>
              </div>
            ) : (
              getColumnOrders(mobileColumn).map((order) => (
                <KanbanCard
                  key={order.id}
                  order={order}
                  showParty={showParty}
                  canUpdate={canUpdateStatus}
                  updating={updatingId === order.id}
                  onMoveNext={() => {
                    const next = getNextStatus(order.status);
                    if (next) requestMove(order.orderId, order.id, next);
                  }}
                  onMovePrev={() => {
                    const prev = getPrevStatus(order.status);
                    if (prev) requestMove(order.orderId, order.id, prev);
                  }}
                  hasNext={!!getNextStatus(order.status)}
                  hasPrev={!!getPrevStatus(order.status)}
                  mobile
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Raw Material N/A Modal */}
      {rawMaterialModal && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Raw Material N/A</h2>
                  <p className="text-xs text-gray-500">{rawMaterialModal.orderId}</p>
                </div>
              </div>
              <button
                onClick={() => setRawMaterialModal(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                What material is not available?
              </label>
              <textarea
                value={rawMaterialNote}
                onChange={(e) => setRawMaterialNote(e.target.value)}
                placeholder="e.g. BOPP Film 40 micron, Adhesive..."
                rows={3}
                autoFocus
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none placeholder:text-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1.5">Optional — leave blank if unknown</p>
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setRawMaterialModal(null)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRawMaterial}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanCard({
  order,
  showParty,
  canUpdate,
  updating,
  onMoveNext,
  onMovePrev,
  hasNext,
  hasPrev,
  mobile,
  draggable,
  onDragStart,
}: {
  order: OrderItem;
  showParty: boolean;
  canUpdate: boolean;
  updating: boolean;
  onMoveNext: () => void;
  onMovePrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  mobile?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const isOverdue =
    order.deliveryDeadline &&
    new Date(order.deliveryDeadline) < new Date() &&
    order.status !== "DISPATCHED";
  const isUrgent = order.priority === "URGENT";

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={`bg-white rounded-lg border ${
        isOverdue ? "border-red-300 ring-1 ring-red-200" : "border-gray-200"
      } ${updating ? "opacity-50" : ""} transition-all ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <Link
            href={`/orders/${order.originalOrderId}`}
            className="text-xs font-bold text-brand-600 hover:text-brand-700"
          >
            {order.orderId}
          </Link>
          <div className="flex items-center gap-1">
            {isUrgent && (
              <span className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded">
                <Zap className="w-2 h-2" />
                URGENT
              </span>
            )}
            {isOverdue && (
              <span className="inline-flex items-center px-1 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold rounded animate-pulse">
                OVERDUE
              </span>
            )}
          </div>
        </div>

        <p className="text-[11px] text-gray-500 mb-1">
          {getProductCategoryLabel(order.productCategory)}
        </p>

        {showParty && order.customer?.partyName && (
          <p className="text-xs text-gray-700 font-medium truncate mb-1">
            {order.customer.partyName}
          </p>
        )}

        {order.deliveryDeadline && (
          <p className={`text-[10px] ${isOverdue ? "text-red-600 font-semibold" : "text-gray-400"}`}>
            Due: {formatDate(order.deliveryDeadline)}
          </p>
        )}
      </div>

      {canUpdate && (hasPrev || hasNext) && (
        <div className="flex border-t border-gray-100">
          {hasPrev && (
            <button
              onClick={onMovePrev}
              disabled={updating}
              className="flex-1 py-1.5 text-[10px] font-medium text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50 border-r border-gray-100"
            >
              ← Back
            </button>
          )}
          {hasNext && (
            <button
              onClick={onMoveNext}
              disabled={updating}
              className="flex-1 py-1.5 text-[10px] font-medium text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50"
            >
              Move →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
