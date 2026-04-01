"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import OrderStatusTimeline from "@/components/OrderStatusTimeline";
import ProductForm from "@/components/ProductForm";
import {
  getProductCategoryLabel,
  getStatusLabel,
  formatDate,
  formatDateTime,
  hasPermission,
} from "@/lib/utils";
import { PRODUCT_CATEGORIES, PRODUCTION_STAGES } from "@/types";
import type { UserRole, OrderStatus, ProductCategory } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import {
  ArrowLeft,
  Calendar,
  FileText,
  Hash,
  Truck,
  Wrench,
  Save,
  Pencil,
  X,
  CheckCircle2,
  Circle,
  MessageSquare,
  Send,
  Paperclip,
  Image as ImageIcon,
  Printer,
  Share2,
  AlertTriangle,
  IndianRupee,
  Zap,
} from "lucide-react";
import Link from "next/link";

const STATUS_BUTTONS: {
  status: OrderStatus;
  label: string;
  color: string;
  roles: string[];
}[] = [
  { status: "CONFIRMED", label: "Confirm", color: "bg-purple-500 hover:bg-purple-600", roles: ["ADMIN", "PRODUCTION"] },
  { status: "IN_PRODUCTION", label: "In Production", color: "bg-amber-500 hover:bg-amber-600", roles: ["ADMIN", "PRODUCTION"] },
  { status: "RAW_MATERIAL_NA", label: "Raw Material N/A", color: "bg-red-500 hover:bg-red-600", roles: ["ADMIN", "PRODUCTION"] },
  { status: "READY_FOR_DISPATCH", label: "Ready for Dispatch", color: "bg-green-500 hover:bg-green-600", roles: ["ADMIN", "PRODUCTION"] },
  { status: "DISPATCHED", label: "Dispatched", color: "bg-gray-500 hover:bg-gray-600", roles: ["ADMIN", "DISPATCH"] },
];

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusNotes, setStatusNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Editable fields
  const [editRemarks, setEditRemarks] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editJumboCode, setEditJumboCode] = useState("");
  const [editChallan, setEditChallan] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit order mode
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState<ProductCategory | "">("");
  const [editProductDetails, setEditProductDetails] = useState<Record<string, string>>({});

  // Comments
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  // Attachments
  const [uploading, setUploading] = useState(false);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const showParty = hasPermission(userRole, "view_party");
  const canUpdateStatus = hasPermission(userRole, "update_status");
  const canEditOrder = userRole === "ADMIN" || userRole === "ACCOUNTANT";
  const canEditJumbo = userRole === "PRODUCTION" || userRole === "ADMIN";
  const canEditChallan = userRole === "DISPATCH" || userRole === "ACCOUNTANT" || userRole === "ADMIN";
  const canEditStages = userRole === "PRODUCTION" || userRole === "ADMIN";

  const fetchOrder = () => {
    fetch(`/api/orders/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setOrder(data);
        setEditRemarks(data.remarks || "");
        setEditDeadline(
          data.deliveryDeadline
            ? new Date(data.deliveryDeadline).toISOString().split("T")[0]
            : ""
        );
        setEditJumboCode(data.jumboCode || "");
        setEditChallan(data.challanNumber || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdatingStatus(newStatus);
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes: statusNotes || null }),
      });

      if (res.ok) {
        toast.success(`Status updated to ${getStatusLabel(newStatus)}`);
        setStatusNotes("");
        fetchOrder();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update status");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleSaveField = async (field: string, value: string | null) => {
    setSaving(true);
    try {
      const body: any = {};
      if (field === "remarks") body.remarks = value;
      if (field === "deliveryDeadline") body.deliveryDeadline = value || null;
      if (field === "jumboCode") body.jumboCode = value;
      if (field === "challanNumber") body.challanNumber = value;

      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success("Saved");
        fetchOrder();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    const details =
      typeof order.productDetails === "string"
        ? JSON.parse(order.productDetails)
        : order.productDetails;
    setEditCategory(order.productCategory as ProductCategory);
    setEditProductDetails(details);
    setIsEditing(true);
  };

  const handleSaveProductDetails = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productDetails: editProductDetails,
          productCategory: editCategory,
        }),
      });
      if (res.ok) {
        toast.success("Order updated");
        setIsEditing(false);
        fetchOrder();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleStageToggle = async (stage: string) => {
    const currentStages = order.productionStages
      ? JSON.parse(order.productionStages)
      : { printing: false, coating: false, slitting: false };
    const updated = { ...currentStages, [stage]: !currentStages[stage] };

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionStages: JSON.stringify(updated) }),
      });
      if (res.ok) {
        toast.success(`${stage.charAt(0).toUpperCase() + stage.slice(1)} ${updated[stage] ? "completed" : "unchecked"}`);
        fetchOrder();
      }
    } catch {
      toast.error("Failed to update stage");
    }
  };

  // Comments
  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/orders/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: commentText }),
      });
      if (res.ok) {
        setCommentText("");
        fetchOrder();
      } else {
        toast.error("Failed to post comment");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setPostingComment(false);
    }
  };

  // Attachments
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/orders/${id}/attachments`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        toast.success("Photo uploaded");
        fetchOrder();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to upload");
      }
    } catch {
      toast.error("Failed to upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // WhatsApp share
  const shareWhatsApp = () => {
    if (!order) return;
    const formattedId =
      typeof order.orderId === "number"
        ? `ORD-${String(order.orderId).padStart(4, "0")}`
        : order.orderId;

    const itemsText = (order.items || []).length > 0
      ? order.items.map((item: any, i: number) => {
          const details = typeof item.productDetails === "string" ? JSON.parse(item.productDetails) : item.productDetails;
          return `Item ${i + 1}: ${getProductCategoryLabel(item.productCategory)}${details.type ? ` (${details.type})` : ""}`;
        }).join("\n")
      : getProductCategoryLabel(order.productCategory);

    const text = [
      `*Order ${formattedId}*`,
      `Status: ${getStatusLabel(order.status)}`,
      order.customer ? `Party: ${order.customer.partyName}` : "",
      `\n${itemsText}`,
      order.deliveryDeadline ? `Deadline: ${formatDate(order.deliveryDeadline)}` : "",
      order.challanNumber ? `Challan: ${order.challanNumber}` : "",
      order.remarks ? `Remarks: ${order.remarks}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />
        <div className="h-32 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!order || order.error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Order not found.</p>
        <Link href="/orders" className="text-brand-500 text-sm mt-2 inline-block">
          Back to Orders
        </Link>
      </div>
    );
  }

  const details =
    typeof order.productDetails === "string"
      ? JSON.parse(order.productDetails)
      : order.productDetails;

  const formattedId =
    typeof order.orderId === "number"
      ? `ORD-${String(order.orderId).padStart(4, "0")}`
      : order.orderId;

  const statusLogs = (order.statusLogs || []).map((log: any) => ({
    id: log.id,
    fromStatus: log.fromStatus || null,
    toStatus: log.toStatus,
    changedBy: log.changedBy?.name || "System",
    changedAt: log.changedAt,
    notes: log.notes,
  }));

  const stages = order.productionStages
    ? JSON.parse(order.productionStages)
    : { printing: false, coating: false, slitting: false };

  const showStages = ["IN_PRODUCTION", "READY_FOR_DISPATCH", "DISPATCHED"].includes(order.status);

  const isOverdue =
    order.deliveryDeadline &&
    new Date(order.deliveryDeadline) < new Date() &&
    order.status !== "DISPATCHED";

  const orderItems = order.items || [];
  const orderTotal = orderItems.reduce((s: number, i: any) => s + (i.amount || 0), 0);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900">{formattedId}</h1>
            {order.priority === "URGENT" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                <Zap className="w-3 h-3" />
                URGENT
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {orderItems.length > 1
              ? `${orderItems.length} items`
              : getProductCategoryLabel(order.productCategory)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Link
          href={`/orders/${id}/challan`}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Print Challan
        </Link>
        <button
          onClick={shareWhatsApp}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          WhatsApp
        </button>
      </div>

      {/* Overdue Alert */}
      {isOverdue && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">Overdue</p>
            <p className="text-xs text-red-600">
              Deadline was {formatDate(order.deliveryDeadline)} — {
                Math.ceil((new Date().getTime() - new Date(order.deliveryDeadline).getTime()) / (1000 * 60 * 60 * 24))
              } days ago
            </p>
          </div>
        </div>
      )}

      {/* Order Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {showParty && order.customer && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Party:</span>
            <Link
              href={`/customers/${order.customer.id}`}
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              {order.customer.partyName}
              {order.customer.location && (
                <span className="text-gray-400 font-normal"> — {order.customer.location}</span>
              )}
            </Link>
          </div>
        )}
        {order.deliveryDeadline && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500">Deadline:</span>
            <span className={`font-medium ${isOverdue ? "text-red-600" : "text-gray-900"}`}>
              {formatDate(order.deliveryDeadline)}
            </span>
            {isOverdue && (
              <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full animate-pulse">
                OVERDUE
              </span>
            )}
          </div>
        )}
        {order.createdBy && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Created by:</span>
            <span className="text-gray-700">{order.createdBy.name}</span>
            <span className="text-gray-400">on {formatDate(order.createdAt)}</span>
          </div>
        )}
        {order.remarks && (
          <div className="flex items-start gap-2 text-sm">
            <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <span className="text-gray-500">Remarks:</span>{" "}
              <span className="text-gray-700">{order.remarks}</span>
            </div>
          </div>
        )}
        {order.jumboCode && (
          <div className="flex items-center gap-2 text-sm">
            <Hash className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500">Jumbo Code:</span>
            <span className="font-medium text-gray-900">{order.jumboCode}</span>
          </div>
        )}
        {order.challanNumber && (
          <div className="flex items-center gap-2 text-sm">
            <Truck className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500">Challan No:</span>
            <span className="font-medium text-gray-900">{order.challanNumber}</span>
          </div>
        )}
        {orderTotal > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <IndianRupee className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500">Total Amount:</span>
            <span className="font-bold text-brand-600">Rs. {orderTotal.toLocaleString("en-IN")}</span>
          </div>
        )}
      </div>

      {/* Production Stages */}
      {showStages && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Production Stages</h2>
          <div className="flex items-center gap-0">
            {PRODUCTION_STAGES.map((stage, idx) => {
              const key = stage.key;
              const done = stages[key];
              return (
                <div key={key} className="flex items-center">
                  <button
                    onClick={() => canEditStages && handleStageToggle(key)}
                    disabled={!canEditStages}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      done
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-50 text-gray-400"
                    } ${canEditStages ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                    {stage.label}
                  </button>
                  {idx < PRODUCTION_STAGES.length - 1 && (
                    <div className={`w-6 h-0.5 mx-1 ${done ? "bg-green-400" : "bg-gray-200"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Order Items (multi-item) */}
      {orderItems.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Order Items ({orderItems.length})
          </h2>
          <div className="space-y-3">
            {orderItems.map((item: any, idx: number) => {
              const itemDetails =
                typeof item.productDetails === "string"
                  ? JSON.parse(item.productDetails)
                  : item.productDetails;
              return (
                <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {getProductCategoryLabel(item.productCategory)}
                      </span>
                    </div>
                    {item.amount > 0 && (
                      <span className="text-sm font-bold text-brand-600">
                        Rs. {item.amount.toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(itemDetails).map(([key, value]) => {
                      if (!value) return null;
                      const label = key
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (s) => s.toUpperCase());
                      return (
                        <div key={key} className="text-xs">
                          <span className="text-gray-500">{label}:</span>{" "}
                          <span className="text-gray-700 font-medium">{String(value)}</span>
                        </div>
                      );
                    })}
                    {item.rate > 0 && (
                      <div className="text-xs">
                        <span className="text-gray-500">Rate:</span>{" "}
                        <span className="text-gray-700 font-medium">Rs. {item.rate}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Product Details (single item / legacy) */}
      {orderItems.length <= 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Product Details</h2>
            {canEditOrder && !isEditing && (
              <button
                onClick={startEditing}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {PRODUCT_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => {
                      if (cat.value !== editCategory) {
                        setEditCategory(cat.value);
                        setEditProductDetails({});
                      }
                    }}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border-2 font-medium transition-all ${
                      editCategory === cat.value
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-gray-200 text-gray-500"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {editCategory && (
                <ProductForm
                  productCategory={editCategory}
                  productDetails={editProductDetails}
                  onChange={setEditProductDetails}
                />
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSaveProductDetails}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(orderItems.length === 1
                ? (typeof orderItems[0].productDetails === "string" ? JSON.parse(orderItems[0].productDetails) : orderItems[0].productDetails)
                : details
              ).map(([key, value]) => {
                if (!value) return null;
                const label = key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (s) => s.toUpperCase())
                  .replace("Size Mm", "Size (mm)")
                  .replace("Size Inches", "Size (inches)")
                  .replace("Meter Per Roll", "Meter/Roll")
                  .replace("Sticker Per Roll", "Sticker/Roll");

                return (
                  <div key={key} className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-medium text-gray-900">{String(value)}</p>
                  </div>
                );
              })}
              {/* Show rate/amount for single item */}
              {orderItems.length === 1 && orderItems[0].rate > 0 && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-500">Rate</p>
                  <p className="text-sm font-medium text-gray-900">Rs. {orderItems[0].rate}</p>
                </div>
              )}
              {orderItems.length === 1 && orderItems[0].amount > 0 && (
                <div className="bg-brand-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-brand-600">Amount</p>
                  <p className="text-sm font-bold text-brand-700">Rs. {orderItems[0].amount.toLocaleString("en-IN")}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status Update */}
      {canUpdateStatus && order.status !== "DISPATCHED" && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Update Status
          </h2>
          <div className="space-y-3">
            <input
              type="text"
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="Add a note (optional)..."
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div className="flex flex-wrap gap-2">
              {STATUS_BUTTONS.filter(
                (btn) =>
                  btn.roles.includes(userRole) &&
                  btn.status !== order.status
              ).map((btn) => (
                <button
                  key={btn.status}
                  onClick={() => handleStatusUpdate(btn.status)}
                  disabled={updatingStatus !== null}
                  className={`px-3 py-2 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${btn.color}`}
                >
                  {updatingStatus === btn.status ? "Updating..." : btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editable Fields */}
      {(canEditOrder || canEditJumbo || canEditChallan) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Edit Details
          </h2>

          {canEditOrder && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                <div className="flex gap-2">
                  <textarea
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                  <button
                    onClick={() => handleSaveField("remarks", editRemarks)}
                    disabled={saving}
                    className="self-end px-3 py-2 bg-brand-500 text-white text-xs rounded-lg hover:bg-brand-600 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Deadline</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    onClick={() => handleSaveField("deliveryDeadline", editDeadline)}
                    disabled={saving}
                    className="px-3 py-2 bg-brand-500 text-white text-xs rounded-lg hover:bg-brand-600 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}

          {canEditJumbo && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Jumbo Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editJumboCode}
                  onChange={(e) => setEditJumboCode(e.target.value)}
                  placeholder="Enter jumbo code..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={() => handleSaveField("jumboCode", editJumboCode)}
                  disabled={saving}
                  className="px-3 py-2 bg-brand-500 text-white text-xs rounded-lg hover:bg-brand-600 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {canEditChallan && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Challan Number</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editChallan}
                  onChange={(e) => setEditChallan(e.target.value)}
                  placeholder="Enter challan number..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  onClick={() => handleSaveField("challanNumber", editChallan)}
                  disabled={saving}
                  className="px-3 py-2 bg-brand-500 text-white text-xs rounded-lg hover:bg-brand-600 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Photo Attachments */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-brand-500" />
            Photos ({(order.attachments || []).length})
          </h2>
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-600 text-xs font-medium rounded-lg cursor-pointer hover:bg-brand-100 transition-colors">
            <Paperclip className="w-3.5 h-3.5" />
            {uploading ? "Uploading..." : "Upload"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadFile}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        {(order.attachments || []).length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {order.attachments.map((att: any) => (
              <a
                key={att.id}
                href={att.filePath}
                target="_blank"
                rel="noopener noreferrer"
                className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square"
              >
                <img
                  src={att.filePath}
                  alt={att.fileName}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
                  <p className="text-white text-xs font-medium px-2 text-center truncate max-w-full">
                    {att.fileName}
                  </p>
                  <p className="text-white/70 text-[10px]">
                    by {att.user?.name} · {formatDate(att.createdAt)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4">No photos yet</p>
        )}
      </div>

      {/* Comments / Internal Notes */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-500" />
          Notes & Comments ({(order.comments || []).length})
        </h2>

        {/* Post comment */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
            placeholder="Add a note..."
            className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={handlePostComment}
            disabled={postingComment || !commentText.trim()}
            className="px-3 py-2.5 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Comments list */}
        {(order.comments || []).length > 0 ? (
          <div className="space-y-3">
            {order.comments.map((comment: any) => (
              <div key={comment.id} className="bg-gray-50 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-900">{comment.user.name}</span>
                  <span className="text-[10px] text-gray-400 capitalize">
                    {comment.user.role.toLowerCase().replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-auto">
                    {formatDateTime(comment.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{comment.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-2">No comments yet</p>
        )}
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Status History</h2>
        <OrderStatusTimeline statusLogs={statusLogs} />
      </div>
    </div>
  );
}
