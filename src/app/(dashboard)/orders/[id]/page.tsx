"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import OrderStatusTimeline from "@/components/OrderStatusTimeline";
import ProductForm from "@/components/ProductForm";
import {
  formatDate,
  formatDateTime,
  hasPermission,
  getProductCategoryLabel,
  getStatusLabel,
  safeParseJSON,
} from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/translations";
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
  Trash2,
  BadgeCheck,
  Cog,
  PackageCheck,
  ChevronRight,
  Tag,
} from "lucide-react";
import Link from "next/link";
import OrderLabelModal from "@/components/OrderLabelModal";

const STATUS_ORDER: OrderStatus[] = [
  "ORDER_PLACED", "CONFIRMED", "IN_PRODUCTION", "RAW_MATERIAL_NA", "READY_FOR_DISPATCH", "DISPATCHED",
];

const STATUS_BUTTONS: {
  status: OrderStatus;
  labelKey: TranslationKey;
  style: string;
  icon: React.ReactNode;
  roles: string[];
}[] = [
  { status: "CONFIRMED", labelKey: "orderDetail.confirm", style: "border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-600 hover:text-white hover:border-purple-600", icon: <BadgeCheck className="w-3.5 h-3.5" />, roles: ["ADMIN", "PRODUCTION", "ACCOUNTANT"] },
  { status: "IN_PRODUCTION", labelKey: "orderDetail.inProduction", style: "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-500 hover:text-white hover:border-amber-500", icon: <Cog className="w-3.5 h-3.5" />, roles: ["ADMIN", "PRODUCTION", "ACCOUNTANT"] },
  { status: "RAW_MATERIAL_NA", labelKey: "orderDetail.rawMaterialNA", style: "border-red-300 text-red-700 bg-red-50 hover:bg-red-500 hover:text-white hover:border-red-500", icon: <AlertTriangle className="w-3.5 h-3.5" />, roles: ["ADMIN", "PRODUCTION", "ACCOUNTANT"] },
  { status: "READY_FOR_DISPATCH", labelKey: "orderDetail.readyForDispatch", style: "border-green-300 text-green-700 bg-green-50 hover:bg-green-600 hover:text-white hover:border-green-600", icon: <PackageCheck className="w-3.5 h-3.5" />, roles: ["ADMIN", "PRODUCTION", "ACCOUNTANT"] },
  { status: "DISPATCHED", labelKey: "orderDetail.dispatched", style: "border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-600 hover:text-white hover:border-gray-600", icon: <Truck className="w-3.5 h-3.5" />, roles: ["ADMIN", "DISPATCH"] },
];

export default function OrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusNotes, setStatusNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Inline edit states
  const [editRemarks, setEditRemarks] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editJumboCode, setEditJumboCode] = useState("");
  const [editChallan, setEditChallan] = useState("");
  const [saving, setSaving] = useState(false);

  // Product editing
  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState<ProductCategory>("BOPP_TAPE");
  const [editProductDetails, setEditProductDetails] = useState<Record<string, string>>({});

  // Per-item states
  const [itemJumboCodes, setItemJumboCodes] = useState<Record<string, string>>({});
  const [itemExtraBoxes, setItemExtraBoxes] = useState<Record<string, string>>({});
  const [itemExtraRolls, setItemExtraRolls] = useState<Record<string, string>>({});
  const [itemRates, setItemRates] = useState<Record<string, string>>({});

  // Raw material modal
  const [showRawMaterialModal, setShowRawMaterialModal] = useState(false);
  const [rawMaterialNote, setRawMaterialNote] = useState("");
  const [showItemRawMaterialModal, setShowItemRawMaterialModal] = useState<{ itemId: string } | null>(null);
  const [itemRawMaterialNote, setItemRawMaterialNote] = useState("");

  // Comments & attachments
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Label print modal
  const [showLabelModal, setShowLabelModal] = useState(false);

  const { t, tStatus, tProduct } = useLanguage();

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const customPermissions = (session?.user as any)?.customPermissions ?? null;

  // Only treat as "loading" when we have no session data at all.
  // If session data exists (even during a background refetch) use it directly —
  // this prevents the status-buttons from disappearing on page refresh.
  const isSessionLoading = !session && sessionStatus === "loading";
  const showParty = !isSessionLoading && hasPermission(userRole, "view_party", customPermissions);
  const canUpdateStatus = !isSessionLoading && hasPermission(userRole, "update_status", customPermissions);
  const canEditOrder = !isSessionLoading && (userRole === "ADMIN" || userRole === "ACCOUNTANT" || userRole === "SALES");
  const canEditJumbo = !isSessionLoading && (userRole === "PRODUCTION" || userRole === "ADMIN" || userRole === "ACCOUNTANT");
  const canEditChallan = !isSessionLoading && (userRole === "DISPATCH" || userRole === "ACCOUNTANT" || userRole === "ADMIN");
  const canEditStages = !isSessionLoading && (userRole === "PRODUCTION" || userRole === "ADMIN" || userRole === "ACCOUNTANT");
  const canPrintLabel = !isSessionLoading && (userRole === "ADMIN" || userRole === "ACCOUNTANT");

  const fetchOrder = () => {
    // Disable cache to ensure we get the fresh order immediately after creation
    fetch(`/api/orders/${id}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setOrder({ error: data.error || "Failed to load order" });
          setLoading(false);
          return;
        }
        
        setOrder(data);
        setEditRemarks(data.remarks || "");
        setEditDeadline(
          data.deliveryDeadline
            ? new Date(data.deliveryDeadline).toISOString().split("T")[0]
            : ""
        );
        setEditJumboCode(data.jumboCode || "");
        setEditChallan(data.challanNumber || "");
        // Init per-item jumbo codes, extra boxes and extra rolls for BOPP_TAPE items
        const codes: Record<string, string> = {};
        const boxes: Record<string, string> = {};
        const rolls: Record<string, string> = {};
        for (const item of data.items || []) {
          if (item.productCategory === "BOPP_TAPE") {
            const d = safeParseJSON(item.productDetails);
            codes[item.id] = d.jumboCode || "";
            rolls[item.id] = d.extraRolls || "";
            boxes[item.id] = d.extraBoxes || "";
          }
        }
        const rates: Record<string, string> = {};
        for (const item of data.items || []) {
          rates[item.id] = item.rate != null ? String(item.rate) : "";
        }
        setItemJumboCodes(codes);
        setItemExtraBoxes(boxes);
        setItemExtraRolls(rolls);
        setItemRates(rates);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fetch error:", err);
        setOrder({ error: "Network error or failed to parse response" });
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const handleStatusUpdate = async (newStatus: string, notes?: string) => {
    // Intercept RAW_MATERIAL_NA — show modal to ask what material is finished
    if (newStatus === "RAW_MATERIAL_NA" && !notes && !showRawMaterialModal) {
      setShowRawMaterialModal(true);
      return;
    }

    setUpdatingStatus(newStatus);
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes: notes || statusNotes || null }),
      });

      if (res.ok) {
        toast.success(`${t("orderDetail.statusUpdated")} ${tStatus(newStatus)}`);
        setStatusNotes("");
        setShowRawMaterialModal(false);
        setRawMaterialNote("");
        fetchOrder();
      } else {
        const data = await res.json();
        toast.error(data.error || t("common.failedToUpdate"));
      }
    } catch {
      toast.error(t("common.error"));
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
        toast.success(t("orderDetail.saved"));
        fetchOrder();
      } else {
        const data = await res.json();
        toast.error(data.error || t("orderDetail.failedToSave"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleContinueToProduction = async () => {
    setUpdatingStatus("order-continue");
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PRODUCTION" }),
      });
      if (res.ok) {
        toast.success(t("orderDetail.statusUpdated"));
        fetchOrder();
      } else {
        const data = await res.json();
        toast.error(data.error || t("common.failedToUpdate"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteOrder = () => {
    toast(
      (toastInstance) => (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-900">{t("orderDetail.deleteConfirm")}</p>
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
                try {
                  const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
                  if (res.ok) {
                    toast.success(t("orderDetail.deleted"));
                    router.push("/orders");
                  } else {
                    toast.error(t("orderDetail.failedToDelete"));
                  }
                } catch {
                  toast.error(t("orderDetail.errorDeleting"));
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

  const startEditing = () => {
    const details = safeParseJSON(order.productDetails);
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

  const handleItemStageToggle = async (itemId: string, currentStagesRaw: string | null, stage: string) => {
    const currentStages = safeParseJSON(currentStagesRaw);
    const updated = { ...currentStages, [stage]: !currentStages[stage] };

    try {
      const res = await fetch(`/api/order-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionStages: JSON.stringify(updated) }),
      });
      if (res.ok) {
        toast.success(`${stage.charAt(0).toUpperCase() + stage.slice(1)} updated`);
        fetchOrder();
      }
    } catch {
      toast.error("Failed to update stage");
    }
  };

  // Confirmation toast before status change
  const confirmStatusUpdate = (newStatus: string) => {
    // RAW_MATERIAL_NA already has its own modal — pass straight through
    if (newStatus === "RAW_MATERIAL_NA") { handleStatusUpdate(newStatus); return; }
    const toStatus = tStatus(newStatus);
    toast(
      (ti) => (
        <div className="flex flex-col gap-2 min-w-[220px]">
          <p className="text-sm font-medium text-gray-900">Change status to <span className="font-bold">{toStatus}</span>?</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => toast.dismiss(ti.id)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
            <button onClick={() => { toast.dismiss(ti.id); handleStatusUpdate(newStatus); }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600">
              Confirm
            </button>
          </div>
        </div>
      ),
      { duration: 8000 }
    );
  };

  const confirmItemStatusUpdate = (itemId: string, newStatus: string) => {
    // RAW_MATERIAL_NA has its own modal
    if (newStatus === "RAW_MATERIAL_NA") { handleItemStatusUpdate(itemId, newStatus); return; }
    toast(
      (ti) => (
        <div className="flex flex-col gap-2 min-w-[220px]">
          <p className="text-sm font-medium text-gray-900">Change item status to <span className="font-bold">{tStatus(newStatus)}</span>?</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => toast.dismiss(ti.id)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
            <button onClick={() => { toast.dismiss(ti.id); handleItemStatusUpdate(itemId, newStatus); }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600">
              Confirm
            </button>
          </div>
        </div>
      ),
      { duration: 8000 }
    );
  };

  const handleItemStatusUpdate = async (itemId: string, newStatus: string, notes?: string) => {
    // Intercept RAW_MATERIAL_NA to ask for details
    if (newStatus === "RAW_MATERIAL_NA" && notes === undefined) {
      setItemRawMaterialNote("");
      setShowItemRawMaterialModal({ itemId });
      return;
    }

    setUpdatingStatus(itemId + newStatus);
    try {
      const res = await fetch(`/api/order-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          notes: notes || null,
        }),
      });

      if (res.ok) {
        toast.success(t("orderDetail.statusUpdated"));
        setShowItemRawMaterialModal(null);
        setItemRawMaterialNote("");
        fetchOrder();
      } else {
        const data = await res.json();
        toast.error(data.error || t("common.failedToUpdate"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleItemJumboSave = async (itemId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/order-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productDetails: { jumboCode: itemJumboCodes[itemId] || "" },
        }),
      });
      if (res.ok) {
        toast.success(t("orderDetail.saved"));
        fetchOrder();
      } else {
        toast.error(t("orderDetail.failedToSave"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleItemExtraBoxesSave = async (itemId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/order-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productDetails: { extraBoxes: itemExtraBoxes[itemId] || "" },
        }),
      });
      if (res.ok) {
        toast.success(t("orderDetail.saved"));
        fetchOrder();
      } else {
        toast.error(t("orderDetail.failedToSave"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleItemExtraRollsSave = async (itemId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/order-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productDetails: { extraRolls: itemExtraRolls[itemId] || "" },
        }),
      });
      if (res.ok) {
        toast.success(t("orderDetail.saved"));
        fetchOrder();
      } else {
        toast.error(t("orderDetail.failedToSave"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleItemRateSave = async (itemId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/order-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rate: itemRates[itemId] }),
      });
      if (res.ok) {
        toast.success(t("orderDetail.saved"));
        fetchOrder();
      } else {
        toast.error(t("orderDetail.failedToSave"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
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


  if (loading || sessionStatus === "loading") {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />
        <div className="h-32 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!order || order.error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t("orderDetail.notFound")}</p>
        <Link href="/orders" className="text-brand-500 text-sm mt-2 inline-block">
          {t("orderDetail.backToOrders")}
        </Link>
      </div>
    );
  }

  const details = safeParseJSON(order?.productDetails);

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

  const stages = (() => {
    try { return order.productionStages ? JSON.parse(order.productionStages) : {}; } catch { return {}; }
  })();

  const showStages = ["IN_PRODUCTION", "READY_FOR_DISPATCH", "DISPATCHED"].includes(order.status);

  const isOverdue =
    order.deliveryDeadline &&
    new Date(order.deliveryDeadline) < new Date() &&
    order.status !== "DISPATCHED";

  const orderItems = order.items || [];
  const hasRawMaterialBlock = orderItems.some((item: any) => item.status === "RAW_MATERIAL_NA");

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
                {t("orderCard.urgent")}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {orderItems.length > 1
              ? `${orderItems.length} ${t("orderDetail.items")}`
              : tProduct(order.productCategory)}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/orders/${id}/challan`}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          {t("orderDetail.printChallan")}
        </Link>
        <Link
          href={`/orders/${id}/share`}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
        >
          <Share2 className="w-3.5 h-3.5" />
          Share PDF
        </Link>
        {canPrintLabel && (order.items?.some((i: any) => i.productCategory === "BOPP_TAPE") || order.productCategory === "BOPP_TAPE") && (
          <button
            onClick={() => setShowLabelModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
          >
            <Tag className="w-3.5 h-3.5" />
            Print Label
          </button>
        )}
        {canEditOrder && (
          <Link
            href={`/orders/${id}/edit`}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t("orderDetail.editOrder")}
          </Link>
        )}
        {canUpdateStatus && order.status === "RAW_MATERIAL_NA" && ["ADMIN", "PRODUCTION", "ACCOUNTANT"].includes(userRole) && (
          <button
            onClick={handleContinueToProduction}
            disabled={updatingStatus === "order-continue"}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-500 hover:text-white hover:border-amber-500 transition-colors disabled:opacity-50"
          >
            <Cog className={`w-3.5 h-3.5 ${updatingStatus === "order-continue" ? "animate-spin" : ""}`} />
            Continue to Production
          </button>
        )}
        {userRole === "ADMIN" && (
          <button
            onClick={handleDeleteOrder}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t("orderDetail.deleteOrder")}
          </button>
        )}
      </div>

      {/* Overdue Alert */}
      {isOverdue && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-700">{t("orderDetail.overdue")}</p>
            <p className="text-xs text-red-600">
              {t("orderDetail.deadline")} {formatDate(order.deliveryDeadline)} — {
                Math.ceil((new Date().getTime() - new Date(order.deliveryDeadline).getTime()) / (1000 * 60 * 60 * 24))
              } {t("orderDetail.days")} {t("orderDetail.ago")}
            </p>
          </div>
        </div>
      )}

      {/* Raw Material Block Warning */}
      {hasRawMaterialBlock && (
        <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-700">{t("orderDetail.rawMaterialIssue")}</p>
            <p className="text-xs text-orange-600">{t("orderDetail.rawMaterialBlockDesc")}</p>
          </div>
        </div>
      )}

      {/* Order Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        {showParty && order.customer && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">{t("orderDetail.party")}</span>
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
            <span className="text-gray-500">{t("orderDetail.deadline")}</span>
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
            <span className="text-gray-500">{t("orderDetail.createdBy")}</span>
            <span className="text-gray-700">{order.createdBy.name}</span>
            <span className="text-gray-400">{t("orderDetail.on")} {formatDate(order.createdAt)}</span>
          </div>
        )}
        {order.remarks && (
          <div className="flex items-start gap-2 text-sm">
            <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <span className="text-gray-500">{t("orderDetail.remarks")}:</span>{" "}
              <span className="text-gray-700">{order.remarks}</span>
            </div>
          </div>
        )}
        {order.jumboCode && !orderItems.some((item: any) => item.productCategory === "BOPP_TAPE") && (
          <div className="flex items-center gap-2 text-sm">
            <Hash className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500">{t("orderDetail.jumboCode")}:</span>
            <span className="font-medium text-gray-900">{order.jumboCode}</span>
          </div>
        )}
        {order.challanNumber && (
          <div className="flex items-center gap-2 text-sm">
            <Truck className="w-4 h-4 text-gray-400" />
            <span className="text-gray-500">{t("challan.challanNo")}</span>
            <span className="font-medium text-gray-900">{order.challanNumber}</span>
          </div>
        )}
      </div>

      {/* Order Items (multi-item) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          {t("orderDetail.orderItems")} ({orderItems.length})
        </h2>

        {/* Fallback for legacy single-product orders (no items) */}
        {orderItems.length === 0 && order.productCategory && (
          <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                {getProductCategoryLabel(order.productCategory)}
              </span>
              <StatusBadge status={order.status || "ORDER_PLACED"} />
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(details as Record<string, any>).map(([key, value]) => {
                if (!value) return null;
                const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                return (
                  <div key={key} className="text-xs">
                    <span className="text-gray-500 block mb-0.5">{label}</span>
                    <span className="text-gray-900 font-medium">{String(value)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {orderItems.map((item: any, idx: number) => {
            let itemDetails = typeof item.productDetails === "string"
              ? (() => { try { return JSON.parse(item.productDetails); } catch { return {}; } })()
              : item.productDetails || {};
            // Fallback: if item has no details of its own, use order-level details (legacy compat)
            if (Object.keys(itemDetails).length === 0 && orderItems.length === 1) {
              itemDetails = details;
            }
            
            const itemStages = (() => {
              try { return item.productionStages ? JSON.parse(item.productionStages) : {}; } catch { return {}; }
            })();

            const isPrintedBopp =
              item.productCategory === "BOPP_TAPE" &&
              (itemDetails.type?.toLowerCase() === "printed" || itemDetails.printName?.trim().length > 0);

            const showStages = isPrintedBopp;
            
            return (
              <div key={item.id} className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {getProductCategoryLabel(item.productCategory)}
                    </span>
                  </div>
                  <StatusBadge status={item.status || "ORDER_PLACED"} />
                </div>

                {/* Raw Material N/A note */}
                {item.status === "RAW_MATERIAL_NA" && (() => {
                  const rawLog = (item.statusLogs || []).find(
                    (l: any) => l.toStatus === "RAW_MATERIAL_NA" && l.notes
                  );
                  return rawLog ? (
                    <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-red-700">Material Issue: </span>
                        <span className="text-xs text-red-600">{rawLog.notes}</span>
                        <span className="text-xs text-red-400 ml-2">— {rawLog.changedBy?.name}</span>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Details grid */}
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(itemDetails).map(([key, value]) => {
                    if (!value) return null;
                    const label = key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (s) => s.toUpperCase());
                    return (
                      <div key={key} className="text-xs">
                        <span className="text-gray-500 block mb-0.5">{label}</span>
                        <span className="text-gray-900 font-medium">{String(value)}</span>
                      </div>
                    );
                  })}
                  {userRole === "SALES" ? (
                    <div className="text-xs col-span-2 sm:col-span-1">
                      <span className="text-gray-500 block mb-0.5">{t("challan.rate")} (₹)</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={itemRates[item.id] ?? ""}
                          onChange={(e) => setItemRates((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="0.00"
                          className="w-24 px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <button
                          onClick={() => handleItemRateSave(item.id)}
                          disabled={saving}
                          className="text-xs px-2 py-1 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50"
                        >
                          {saving ? "..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : item.rate && userRole !== "PRODUCTION" ? (
                    <div className="text-xs">
                      <span className="text-gray-500 block mb-0.5">{t("challan.rate")}</span>
                      <span className="text-gray-900 font-medium">₹{item.rate}</span>
                    </div>
                  ) : null}
                </div>

                {/* Production Stages */}
                {showStages && (
                  <div className="px-4 py-3 border-t border-gray-100 bg-white">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{t("orderDetail.productionStages")}</p>
                    <div className="flex items-center gap-0 overflow-x-auto pb-1">
                      {PRODUCTION_STAGES.map((stage, sIdx) => {
                        const done = itemStages[stage.key];
                        return (
                          <div key={stage.key} className="flex items-center">
                            <button
                              onClick={() => canEditStages && handleItemStageToggle(item.id, item.productionStages, stage.key)}
                              disabled={!canEditStages}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                                done
                                  ? "bg-green-50 text-green-700"
                                  : "bg-gray-50 text-gray-400"
                              } ${canEditStages ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                            >
                              {done ? (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              ) : (
                                <Circle className="w-4 h-4" />
                              )}
                              {stage.label}
                            </button>
                            {sIdx < PRODUCTION_STAGES.length - 1 && (
                              <div className={`w-4 h-0.5 mx-0.5 ${done ? "bg-green-400" : "bg-gray-200"}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Status Update Buttons */}
                {canUpdateStatus && item.status !== "DISPATCHED" && (
                  <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-2">{t("orderDetail.updateStatus")}</p>
                    <div className="flex flex-wrap gap-2">
                      {/* Continue to Production — shown only when item is RAW_MATERIAL_NA */}
                      {item.status === "RAW_MATERIAL_NA" && ["ADMIN", "PRODUCTION", "ACCOUNTANT"].includes(userRole) && (
                        <button
                          onClick={() => confirmItemStatusUpdate(item.id, "IN_PRODUCTION")}
                          disabled={updatingStatus !== null}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border-2 transition-all disabled:opacity-40 active:scale-95 border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-500 hover:text-white hover:border-amber-500"
                        >
                          {updatingStatus === (item.id + "IN_PRODUCTION") ? (
                            <Cog className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Cog className="w-3.5 h-3.5" />
                          )}
                          {updatingStatus === (item.id + "IN_PRODUCTION") ? "..." : "Continue to Production"}
                          {updatingStatus !== (item.id + "IN_PRODUCTION") && <ChevronRight className="w-3 h-3 opacity-60" />}
                        </button>
                      )}
                      {STATUS_BUTTONS.filter(
                        (btn) =>
                          btn.roles.includes(userRole) &&
                          STATUS_ORDER.indexOf(btn.status) > STATUS_ORDER.indexOf(item.status as OrderStatus)
                      ).map((btn) => {
                        const isBlocked =
                          hasRawMaterialBlock &&
                          item.status !== "RAW_MATERIAL_NA" &&
                          (btn.status === "READY_FOR_DISPATCH" || btn.status === "DISPATCHED");
                        const isUpdating = updatingStatus === (item.id + btn.status);
                        return (
                          <button
                            key={btn.status}
                            onClick={() => !isBlocked && confirmItemStatusUpdate(item.id, btn.status)}
                            disabled={updatingStatus !== null || isBlocked}
                            title={isBlocked ? t("orderDetail.resolveRawMaterial") : undefined}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border-2 transition-all disabled:opacity-40 active:scale-95 ${btn.style}`}
                          >
                            {isUpdating ? (
                              <Cog className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              btn.icon
                            )}
                            {isUpdating ? "..." : t(btn.labelKey)}
                            {!isUpdating && <ChevronRight className="w-3 h-3 opacity-60" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      </div>

      {/* Editable Fields */}
      {(canEditOrder || canEditJumbo || canEditChallan) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            {t("orderDetail.editDetails")}
          </h2>

          {canEditOrder && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("orderDetail.remarks")}</label>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("orderDetail.deliveryDeadline")}</label>
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

          {canEditJumbo && (() => {
            const boppItems = orderItems.filter((item: any) => item.productCategory === "BOPP_TAPE");
            if (boppItems.length > 0) {
              // Per-item jumbo codes for BOPP_TAPE
              return (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-600">{t("orderDetail.jumboCode")} ({t("orderDetail.items")})</p>
                  {boppItems.map((item: any, idx: number) => (
                    <div key={item.id}>
                      <label className="block text-xs text-gray-500 mb-1">
                        {t("orderDetail.items")} {orderItems.indexOf(item) + 1} — {getProductCategoryLabel(item.productCategory)}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={itemJumboCodes[item.id] ?? ""}
                          onChange={(e) => setItemJumboCodes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="Enter jumbo code..."
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <button
                          onClick={() => handleItemJumboSave(item.id)}
                          disabled={saving}
                          className="px-3 py-2 bg-brand-500 text-white text-xs rounded-lg hover:bg-brand-600 disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            // Order-wide jumbo code for non-BOPP orders
            return (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("orderDetail.jumboCode")}</label>
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
            );
          })()}

          {/* Extra Boxes & Extra Rolls for BOPP Tape (editable by production supervisor) */}
          {canEditStages && (() => {
            const boppItems = orderItems.filter((item: any) => item.productCategory === "BOPP_TAPE");
            if (boppItems.length === 0) return null;
            return (
              <>
                {/* Extra Boxes */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-600">Extra Boxes (BOPP Tape)</p>
                  <p className="text-xs text-gray-400 -mt-2">Boxes produced extra — will appear on challan</p>
                  {boppItems.map((item: any) => (
                    <div key={item.id}>
                      <label className="block text-xs text-gray-500 mb-1">
                        Item {orderItems.indexOf(item) + 1} — {getProductCategoryLabel(item.productCategory)}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={itemExtraBoxes[item.id] ?? ""}
                          onChange={(e) => setItemExtraBoxes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="0 extra boxes"
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <button
                          onClick={() => handleItemExtraBoxesSave(item.id)}
                          disabled={saving}
                          className="px-3 py-2 bg-brand-500 text-white text-xs rounded-lg hover:bg-brand-600 disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Extra Rolls */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-600">Extra Rolls (BOPP Tape)</p>
                  <p className="text-xs text-gray-400 -mt-2">Rolls produced extra — will appear on challan</p>
                  {boppItems.map((item: any) => (
                    <div key={item.id}>
                      <label className="block text-xs text-gray-500 mb-1">
                        Item {orderItems.indexOf(item) + 1} — {getProductCategoryLabel(item.productCategory)}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={itemExtraRolls[item.id] ?? ""}
                          onChange={(e) => setItemExtraRolls((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="0 extra rolls"
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <button
                          onClick={() => handleItemExtraRollsSave(item.id)}
                          disabled={saving}
                          className="px-3 py-2 bg-brand-500 text-white text-xs rounded-lg hover:bg-brand-600 disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}

          {canEditChallan && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("orderDetail.challanNumber")}</label>
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
            {t("orderDetail.photos")} ({(order.attachments || []).length})
          </h2>
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-600 text-xs font-medium rounded-lg cursor-pointer hover:bg-brand-100 transition-colors">
            <Paperclip className="w-3.5 h-3.5" />
            {uploading ? t("orderDetail.uploading") : t("orderDetail.upload")}
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
          <p className="text-xs text-gray-400 text-center py-4">{t("orderDetail.noPhotos")}</p>
        )}
      </div>

      {/* Comments / Internal Notes */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-500" />
          {t("orderDetail.notesComments")} ({(order.comments || []).length})
        </h2>

        {/* Post comment */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
            placeholder={t("orderDetail.addNotePlaceholder")}
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
          <p className="text-xs text-gray-400 text-center py-2">{t("orderDetail.noComments")}</p>
        )}
      </div>

      {/* Status Timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">{t("orderDetail.statusLog")}</h2>
        <OrderStatusTimeline statusLogs={statusLogs} />
      </div>

      {/* Item-level Raw Material N/A Modal */}
      {showItemRawMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="px-5 pt-5 pb-2">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                {t("orderDetail.rawMaterialShortage")}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {t("orderDetail.materialQuestion")}
              </p>
            </div>
            <div className="px-5 py-3">
              <textarea
                value={itemRawMaterialNote}
                onChange={(e) => setItemRawMaterialNote(e.target.value)}
                rows={3}
                autoFocus
                placeholder="e.g. BOPP film 42 micron finished, Core 3 inch not available..."
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => {
                  setShowItemRawMaterialModal(null);
                  setItemRawMaterialNote("");
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => handleItemStatusUpdate(
                  showItemRawMaterialModal.itemId,
                  "RAW_MATERIAL_NA",
                  itemRawMaterialNote || "Raw material not available"
                )}
                disabled={updatingStatus !== null}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {updatingStatus ? t("orderDetail.updating") : t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Label Modal */}
      {showLabelModal && order && (
        <OrderLabelModal order={order} onClose={() => setShowLabelModal(false)} />
      )}

      {/* Raw Material N/A Modal */}
      {showRawMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="px-5 pt-5 pb-2">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                {t("orderDetail.rawMaterialShortage")}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {t("orderDetail.materialQuestion")}
              </p>
            </div>
            <div className="px-5 py-3">
              <textarea
                value={rawMaterialNote}
                onChange={(e) => setRawMaterialNote(e.target.value)}
                rows={3}
                autoFocus
                placeholder="e.g. BOPP film 42 micron finished, Core 3 inch not available..."
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => {
                  setShowRawMaterialModal(false);
                  setRawMaterialNote("");
                }}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => handleStatusUpdate("RAW_MATERIAL_NA", rawMaterialNote || "Raw material not available")}
                disabled={updatingStatus !== null}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {updatingStatus ? t("orderDetail.updating") : t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
