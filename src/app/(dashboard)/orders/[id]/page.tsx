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
import { compressImage } from "@/lib/imageCompress";
import type { TranslationKey } from "@/lib/translations";
import { PRODUCTION_STAGES } from "@/types";
import type { UserRole, OrderStatus, ProductCategory } from "@/types";
import { useCategoryPicker } from "@/lib/useCategoryPicker";
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
  Plus,
  Clock,
  Package,
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
  Icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}[] = [
  { status: "CONFIRMED", labelKey: "orderDetail.confirm", style: "border-purple-300 text-purple-700 bg-purple-50 hover:bg-purple-600 hover:text-white hover:border-purple-600", Icon: BadgeCheck, roles: ["ADMIN", "PRODUCTION", "ACCOUNTANT"] },
  { status: "IN_PRODUCTION", labelKey: "orderDetail.inProduction", style: "border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-500 hover:text-white hover:border-amber-500", Icon: Cog, roles: ["ADMIN", "PRODUCTION", "ACCOUNTANT"] },
  { status: "RAW_MATERIAL_NA", labelKey: "orderDetail.rawMaterialNA", style: "border-red-300 text-red-700 bg-red-50 hover:bg-red-500 hover:text-white hover:border-red-500", Icon: AlertTriangle, roles: ["ADMIN", "PRODUCTION", "ACCOUNTANT"] },
  { status: "READY_FOR_DISPATCH", labelKey: "orderDetail.readyForDispatch", style: "border-green-300 text-green-700 bg-green-50 hover:bg-green-600 hover:text-white hover:border-green-600", Icon: PackageCheck, roles: ["ADMIN", "PRODUCTION", "ACCOUNTANT"] },
  { status: "DISPATCHED", labelKey: "orderDetail.dispatched", style: "border-gray-300 text-gray-700 bg-gray-50 hover:bg-gray-600 hover:text-white hover:border-gray-600", Icon: Truck, roles: ["ADMIN", "DISPATCH"] },
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

  // Add item modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemCategory, setNewItemCategory] = useState<ProductCategory>("BOPP_TAPE");
  const [newItemDetails, setNewItemDetails] = useState<Record<string, string>>({});
  const [newItemRate, setNewItemRate] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const { t, tStatus, tProduct } = useLanguage();
  // Unified category list (built-ins + customs + admin overrides) so the Add
  // Item modal shows the same products that the New Order page does.
  const { categories: allCategories } = useCategoryPicker();
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string; fields: string }[]>([]);
  useEffect(() => {
    fetch("/api/product-categories")
      .then((r) => r.json())
      .then((d) => setCustomCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // Real role from session — may be undefined while loading or when session has expired.
  // Do NOT fall back to "SALES" as the default, otherwise an expired session flips
  // the page into SALES mode (showing the rate-save input instead of status buttons).
  const sessionRole = (session?.user as any)?.role as UserRole | undefined;
  const userRole = (sessionRole || "SALES") as UserRole;
  const customPermissions = (session?.user as any)?.customPermissions ?? null;

  // Role-gated UI must not render until we actually have the role from the session.
  // If the session is genuinely expired, the API fetches will return 401 and the page
  // will show the "not found" state — we do NOT force a client-side redirect here,
  // since NextAuth's `status` can flicker to "unauthenticated" during hydration and
  // a forced redirect causes a /login bounce loop.
  const roleKnown = !!sessionRole;
  const showParty = roleKnown && hasPermission(userRole, "view_party", customPermissions);
  const canUpdateStatus = roleKnown && hasPermission(userRole, "update_status", customPermissions);
  const canEditOrder = roleKnown && (userRole === "ADMIN" || userRole === "ACCOUNTANT" || userRole === "SALES");
  const canEditJumbo = roleKnown && (userRole === "PRODUCTION" || userRole === "ADMIN" || userRole === "ACCOUNTANT");
  const canEditChallan = roleKnown && (userRole === "DISPATCH" || userRole === "ACCOUNTANT" || userRole === "ADMIN");
  const canEditStages = roleKnown && (userRole === "PRODUCTION" || userRole === "ADMIN" || userRole === "ACCOUNTANT");
  const canPrintLabel = roleKnown && (userRole === "ADMIN" || userRole === "ACCOUNTANT");
  const canShowRateInput = roleKnown && sessionRole === "SALES"; // gate the rate-save input strictly

  const fetchOrder = () => {
    if (!id) return;
    const orderId = Array.isArray(id) ? id[0] : String(id);
    fetch(`/api/orders/${orderId}`, { cache: 'no-store' })
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
        console.error("[OrderDetail] Fetch error:", err);
        setOrder({ error: "Network error or failed to parse response" });
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!id) return;
    const orderId = Array.isArray(id) ? id[0] : String(id);
    fetch(`/api/orders/${orderId}`, { cache: 'no-store' })
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
        console.error("[OrderDetail] Fetch error:", err);
        setOrder({ error: "Network error or failed to parse response" });
        setLoading(false);
      });
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
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PRODUCTION", notes: "Continued to production after material resolved" }),
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
      { duration: Infinity }
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
      { duration: Infinity }
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

  const handleAddItem = async () => {
    setAddingItem(true);
    try {
      const existingItems = (order.items || []).map((item: any) => ({
        dbId: item.id,
        productCategory: item.productCategory,
        productDetails: item.productDetails,
        rate: item.rate,
        gst: item.gst,
      }));
      const newItem = {
        productCategory: newItemCategory,
        productDetails: newItemDetails,
        rate: newItemRate ? parseFloat(newItemRate) : null,
        gst: null,
      };
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [...existingItems, newItem] }),
      });
      if (res.ok) {
        toast.success("Product added to order");
        setShowAddItemModal(false);
        setNewItemCategory("BOPP_TAPE");
        setNewItemDetails({});
        setNewItemRate("");
        fetchOrder();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add product");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAddingItem(false);
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
    const raw = e.target.files?.[0];
    if (!raw) return;
    setUploading(true);
    try {
      let file = raw;
      try { file = await compressImage(raw); } catch {}
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
        <div className="h-20 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
        <div className="h-48 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
        <div className="h-64 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
        <div className="h-32 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
      </div>
    );
  }

  if (!order || order.error) {
    return (
      <div className="max-w-md mx-auto flex flex-col items-center justify-center text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-base font-semibold text-gray-900">{t("orderDetail.notFound")}</p>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 text-sm font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 ring-1 ring-brand-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
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
    <div className="max-w-2xl mx-auto space-y-4 pb-24 md:pb-6">
      <Toaster position="top-right" />

      {/* ── Header card ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-1 hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight tabular-nums">
                {formattedId}
              </h1>
              <StatusBadge status={order.status} size="sm" />
              {order.priority === "URGENT" && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-md ring-1 ring-rose-200">
                  <Zap className="w-2.5 h-2.5" fill="currentColor" />
                  {t("orderCard.urgent")}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {orderItems.length > 1
                ? `${orderItems.length} ${t("orderDetail.items")}`
                : tProduct(order.productCategory)}
              {order.customer?.partyName && showParty && (
                <> · <span className="text-gray-700 font-medium">{order.customer.partyName}</span></>
              )}
            </p>
          </div>
        </div>

        {/* Action chips — uniform neutral pills, grid on mobile so they line up */}
        <div className="mt-3 grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
          <Link
            href={`/orders/${id}/challan`}
            className="inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.97]"
          >
            <Printer className="w-3.5 h-3.5" />
            {t("orderDetail.printChallan")}
          </Link>
          <Link
            href={`/orders/${id}/share`}
            className="inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.97]"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share PDF
          </Link>
          {canPrintLabel && (order.items?.some((i: any) => i.productCategory === "BOPP_TAPE") || order.productCategory === "BOPP_TAPE") && (
            <button
              onClick={() => setShowLabelModal(true)}
              className="inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.97]"
            >
              <Tag className="w-3.5 h-3.5" />
              Print Label
            </button>
          )}
          {canEditOrder && (
            <Link
              href={`/orders/${id}/edit`}
              className="inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-[0.97]"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t("orderDetail.editOrder")}
            </Link>
          )}
          {canUpdateStatus && order.status === "RAW_MATERIAL_NA" && ["ADMIN", "PRODUCTION", "ACCOUNTANT"].includes(userRole) && (
            <button
              onClick={handleContinueToProduction}
              disabled={updatingStatus === "order-continue"}
              className="col-span-2 sm:col-auto inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-all active:scale-[0.97] disabled:opacity-50"
            >
              <Cog className={`w-3.5 h-3.5 ${updatingStatus === "order-continue" ? "animate-spin" : ""}`} />
              Continue to Production
            </button>
          )}
          {userRole === "ADMIN" && (
            <button
              onClick={handleDeleteOrder}
              className="col-span-2 sm:col-auto sm:ml-auto inline-flex items-center justify-center sm:justify-start gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-all active:scale-[0.97]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("orderDetail.deleteOrder")}
            </button>
          )}
        </div>
      </div>

      {/* ── Pending Confirmation Banner ──────────────────────── */}
      {order.status === "PENDING_CONFIRMATION" && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-50/40 border border-amber-200 rounded-2xl p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 ring-1 ring-amber-200 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">Awaiting Admin Confirmation</p>
              <p className="text-xs text-amber-700/90 mt-0.5">
                This order was submitted by the sales team and is waiting for admin approval.
              </p>
            </div>
          </div>
          {userRole === "ADMIN" && (
            <Link
              href="/pending-approvals"
              className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors active:scale-[0.97] flex-shrink-0"
            >
              Review
            </Link>
          )}
        </div>
      )}

      {/* ── Rejected Banner ──────────────────────────────────── */}
      {order.status === "REJECTED" && (
        <div className="bg-gradient-to-r from-rose-50 to-rose-50/40 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 ring-1 ring-rose-200 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-700" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-rose-900">Order Rejected</p>
            <p className="text-xs text-rose-700/90 mt-0.5">
              This order was rejected by the admin. Please contact the admin for details.
            </p>
          </div>
        </div>
      )}

      {/* ── Overdue Alert ────────────────────────────────────── */}
      {isOverdue && (
        <div className="bg-gradient-to-r from-rose-50 to-rose-50/40 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 ring-1 ring-rose-200 flex items-center justify-center flex-shrink-0 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-rose-700" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-rose-900">{t("orderDetail.overdue")}</p>
            <p className="text-xs text-rose-700/90 mt-0.5">
              {t("orderDetail.deadline")} {formatDate(order.deliveryDeadline)} — {
                Math.ceil((new Date().getTime() - new Date(order.deliveryDeadline).getTime()) / (1000 * 60 * 60 * 24))
              } {t("orderDetail.days")} {t("orderDetail.ago")}
            </p>
          </div>
        </div>
      )}

      {/* ── Raw Material Block Warning ───────────────────────── */}
      {hasRawMaterialBlock && (
        <div className="bg-gradient-to-r from-orange-50 to-orange-50/40 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 ring-1 ring-orange-200 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-orange-700" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-orange-900">{t("orderDetail.rawMaterialIssue")}</p>
            <p className="text-xs text-orange-700/90 mt-0.5">{t("orderDetail.rawMaterialBlockDesc")}</p>
          </div>
        </div>
      )}

      {/* ── Order Info Card ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 space-y-3">
        {showParty && order.customer && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Tag className="w-3.5 h-3.5 text-brand-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">{t("orderDetail.party")}</p>
              <Link
                href={`/customers/${order.customer.id}`}
                className="text-sm font-semibold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 group"
              >
                {order.customer.partyName}
                {order.customer.location && (
                  <span className="text-gray-400 font-normal text-xs"> — {order.customer.location}</span>
                )}
                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            </div>
          </div>
        )}
        {order.deliveryDeadline && (
          <div className="flex items-start gap-3">
            <div className={`w-7 h-7 rounded-lg ring-1 flex items-center justify-center flex-shrink-0 mt-0.5 ${
              isOverdue ? "bg-rose-50 ring-rose-100" : "bg-gray-50 ring-gray-100"
            }`}>
              <Calendar className={`w-3.5 h-3.5 ${isOverdue ? "text-rose-600" : "text-gray-500"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">{t("orderDetail.deadline")}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-semibold ${isOverdue ? "text-rose-700" : "text-gray-900"}`}>
                  {formatDate(order.deliveryDeadline)}
                </span>
                {isOverdue && (
                  <span className="text-[10px] text-rose-700 font-bold bg-rose-100 ring-1 ring-rose-200 px-1.5 py-0.5 rounded-md animate-pulse">
                    OVERDUE
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        {order.createdBy && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Pencil className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">{t("orderDetail.createdBy")}</p>
              <p className="text-sm text-gray-800">
                <span className="font-medium">{order.createdBy.name}</span>
                <span className="text-gray-400 ml-1.5">{t("orderDetail.on")} {formatDate(order.createdAt)}</span>
              </p>
            </div>
          </div>
        )}
        {order.remarks && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <FileText className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">{t("orderDetail.remarks")}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.remarks}</p>
            </div>
          </div>
        )}
        {order.jumboCode && !orderItems.some((item: any) => item.productCategory === "BOPP_TAPE") && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Hash className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">{t("orderDetail.jumboCode")}</p>
              <p className="text-sm font-medium text-gray-900 font-mono">{order.jumboCode}</p>
            </div>
          </div>
        )}
        {order.challanNumber && (
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Truck className="w-3.5 h-3.5 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">{t("challan.challanNo")}</p>
              <p className="text-sm font-medium text-gray-900 font-mono">{order.challanNumber}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Order Items ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
              <Package className="w-4 h-4 text-brand-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">
              {t("orderDetail.orderItems")}
              <span className="text-gray-400 font-medium ml-1.5">({orderItems.length})</span>
            </h2>
          </div>
          {(userRole === "ADMIN" || userRole === "ACCOUNTANT") && order.status !== "DISPATCHED" && (
            <button
              onClick={() => { setNewItemDetails({}); setShowAddItemModal(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 border border-brand-200 rounded-xl text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-all active:scale-[0.97]"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Product
            </button>
          )}
        </div>

        {/* Fallback for legacy single-product orders (no items) */}
        {orderItems.length === 0 && order.productCategory && (
          <div className="bg-gray-50/60 rounded-xl border border-gray-200/80 overflow-hidden">
            <div className="px-4 py-3 bg-white border-b border-gray-200/80 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">
                {getProductCategoryLabel(order.productCategory)}
              </span>
              <StatusBadge status={order.status || "ORDER_PLACED"} size="sm" />
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
              {Object.entries(details as Record<string, any>).map(([key, value]) => {
                if (!value) return null;
                const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
                return (
                  <div key={key} className="min-w-0">
                    <span className="block text-[10px] uppercase tracking-wide font-semibold text-gray-500">{label}</span>
                    <span className="text-sm text-gray-900 font-medium truncate block">{String(value)}</span>
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
              <div key={item.id} className="rounded-2xl border border-gray-200/80 overflow-hidden bg-white">
                {/* Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center ring-1 ring-brand-200 flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {getProductCategoryLabel(item.productCategory)}
                    </span>
                  </div>
                  <StatusBadge status={item.status || "ORDER_PLACED"} size="sm" />
                </div>

                {/* Raw Material N/A note */}
                {item.status === "RAW_MATERIAL_NA" && (() => {
                  const rawLog = (item.statusLogs || []).find(
                    (l: any) => l.toStatus === "RAW_MATERIAL_NA" && l.notes
                  );
                  return rawLog ? (
                    <div className="px-4 py-2.5 bg-rose-50/70 border-b border-rose-100 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-rose-700">Material Issue: </span>
                        <span className="text-xs text-rose-600">{rawLog.notes}</span>
                        <span className="text-xs text-rose-400 ml-2">— {rawLog.changedBy?.name}</span>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Details grid */}
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                  {Object.entries(itemDetails).map(([key, value]) => {
                    if (!value) return null;
                    const label = key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (s) => s.toUpperCase());
                    return (
                      <div key={key} className="min-w-0">
                        <span className="block text-[10px] uppercase tracking-wide font-semibold text-gray-500">{label}</span>
                        <span className="text-sm text-gray-900 font-medium truncate block">{String(value)}</span>
                      </div>
                    );
                  })}
                  {canShowRateInput ? (
                    <div className="col-span-2 sm:col-span-1">
                      <span className="block text-[10px] uppercase tracking-wide font-semibold text-gray-500 mb-1">{t("challan.rate")} (₹)</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={itemRates[item.id] ?? ""}
                          onChange={(e) => setItemRates((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="0.00"
                          className="w-24 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                        />
                        <button
                          onClick={() => handleItemRateSave(item.id)}
                          disabled={saving}
                          className="text-xs px-2.5 py-1 bg-brand-500 text-white font-semibold rounded-lg hover:bg-brand-600 disabled:opacity-50 active:scale-[0.97] transition-all"
                        >
                          {saving ? "..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : item.rate && userRole !== "PRODUCTION" ? (
                    <div className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wide font-semibold text-gray-500">{t("challan.rate")}</span>
                      <span className="text-sm text-gray-900 font-semibold">₹{item.rate}</span>
                    </div>
                  ) : null}
                </div>

                {/* Production Stages */}
                {showStages && (
                  <div className="px-4 py-3 border-t border-gray-200/80 bg-gray-50/40">
                    <p className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wide">{t("orderDetail.productionStages")}</p>
                    <div className="flex items-center gap-0 overflow-x-auto pb-1 -mx-1 px-1">
                      {PRODUCTION_STAGES.map((stage, sIdx) => {
                        const done = itemStages[stage.key];
                        return (
                          <div key={stage.key} className="flex items-center">
                            <button
                              onClick={() => canEditStages && handleItemStageToggle(item.id, item.productionStages, stage.key)}
                              disabled={!canEditStages}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                                done
                                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                                  : "bg-white text-gray-400 ring-1 ring-gray-200"
                              } ${canEditStages ? "cursor-pointer hover:opacity-80 active:scale-[0.97]" : "cursor-default"}`}
                            >
                              {done ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Circle className="w-3.5 h-3.5" />
                              )}
                              {stage.label}
                            </button>
                            {sIdx < PRODUCTION_STAGES.length - 1 && (
                              <div className={`w-4 h-0.5 mx-0.5 ${done ? "bg-emerald-400" : "bg-gray-200"}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Status Update Buttons */}
                {canUpdateStatus && item.status !== "DISPATCHED" && (
                  <div className="px-4 py-3 bg-gray-50/60 border-t border-gray-200/80">
                    <p className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-wide">{t("orderDetail.updateStatus")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {/* Continue to Production — shown only when item is RAW_MATERIAL_NA */}
                      {item.status === "RAW_MATERIAL_NA" && ["ADMIN", "PRODUCTION", "ACCOUNTANT"].includes(userRole) && (
                        <button
                          onClick={() => confirmItemStatusUpdate(item.id, "IN_PRODUCTION")}
                          disabled={updatingStatus !== null}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all disabled:opacity-40 active:scale-[0.97] border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-500 hover:text-white hover:border-amber-500"
                        >
                          <Cog className={`w-3.5 h-3.5 ${updatingStatus === (item.id + "IN_PRODUCTION") ? "animate-spin" : ""}`} />
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
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all disabled:opacity-40 active:scale-[0.97] ${btn.style}`}
                          >
                            {isUpdating ? (
                              <Cog className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <btn.Icon className="w-3.5 h-3.5" />
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

      {/* ── Editable Fields ──────────────────────────────────── */}
      {(canEditOrder || canEditJumbo || canEditChallan) && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-gray-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">{t("orderDetail.editDetails")}</h2>
          </div>

          {canEditOrder && (
            <>
              <div>
                <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">{t("orderDetail.remarks")}</label>
                <div className="flex gap-2">
                  <textarea
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none placeholder:text-gray-400 transition-all"
                  />
                  <button
                    onClick={() => handleSaveField("remarks", editRemarks)}
                    disabled={saving}
                    className="self-end inline-flex items-center justify-center px-3 py-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-sm"
                    aria-label="Save"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">{t("orderDetail.deliveryDeadline")}</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                  />
                  <button
                    onClick={() => handleSaveField("deliveryDeadline", editDeadline)}
                    disabled={saving}
                    className="inline-flex items-center justify-center px-3 py-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-sm"
                    aria-label="Save"
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
              return (
                <div className="space-y-2.5">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">{t("orderDetail.jumboCode")} ({t("orderDetail.items")})</p>
                  {boppItems.map((item: any) => (
                    <div key={item.id}>
                      <label className="block text-[10px] text-gray-500 mb-1">
                        {t("orderDetail.items")} {orderItems.indexOf(item) + 1} — {getProductCategoryLabel(item.productCategory)}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={itemJumboCodes[item.id] ?? ""}
                          onChange={(e) => setItemJumboCodes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="Enter jumbo code..."
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                        />
                        <button
                          onClick={() => handleItemJumboSave(item.id)}
                          disabled={saving}
                          className="inline-flex items-center justify-center px-3 py-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-sm"
                          aria-label="Save"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <div>
                <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">{t("orderDetail.jumboCode")}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editJumboCode}
                    onChange={(e) => setEditJumboCode(e.target.value)}
                    placeholder="Enter jumbo code..."
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                  />
                  <button
                    onClick={() => handleSaveField("jumboCode", editJumboCode)}
                    disabled={saving}
                    className="inline-flex items-center justify-center px-3 py-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-sm"
                    aria-label="Save"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Extra Boxes & Extra Rolls for BOPP Tape */}
          {canEditStages && (() => {
            const boppItems = orderItems.filter((item: any) => item.productCategory === "BOPP_TAPE");
            if (boppItems.length === 0) return null;
            return (
              <>
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Extra Boxes (BOPP Tape)</p>
                    <p className="text-[10px] text-gray-400">Boxes produced extra — will appear on challan</p>
                  </div>
                  {boppItems.map((item: any) => (
                    <div key={item.id}>
                      <label className="block text-[10px] text-gray-500 mb-1">
                        Item {orderItems.indexOf(item) + 1} — {getProductCategoryLabel(item.productCategory)}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={itemExtraBoxes[item.id] ?? ""}
                          onChange={(e) => setItemExtraBoxes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="0 extra boxes"
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                        />
                        <button
                          onClick={() => handleItemExtraBoxesSave(item.id)}
                          disabled={saving}
                          className="inline-flex items-center justify-center px-3 py-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-sm"
                          aria-label="Save"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500">Extra Rolls (BOPP Tape)</p>
                    <p className="text-[10px] text-gray-400">Rolls produced extra — will appear on challan</p>
                  </div>
                  {boppItems.map((item: any) => (
                    <div key={item.id}>
                      <label className="block text-[10px] text-gray-500 mb-1">
                        Item {orderItems.indexOf(item) + 1} — {getProductCategoryLabel(item.productCategory)}
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={itemExtraRolls[item.id] ?? ""}
                          onChange={(e) => setItemExtraRolls((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="0 extra rolls"
                          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                        />
                        <button
                          onClick={() => handleItemExtraRollsSave(item.id)}
                          disabled={saving}
                          className="inline-flex items-center justify-center px-3 py-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-sm"
                          aria-label="Save"
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
              <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">{t("orderDetail.challanNumber")}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editChallan}
                  onChange={(e) => setEditChallan(e.target.value)}
                  placeholder="Enter challan number..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                />
                <button
                  onClick={() => handleSaveField("challanNumber", editChallan)}
                  disabled={saving}
                  className="inline-flex items-center justify-center px-3 py-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-sm"
                  aria-label="Save"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Photo Attachments ────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center flex-shrink-0">
              <ImageIcon className="w-4 h-4 text-brand-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900 truncate">
              {t("orderDetail.photos")}
              <span className="text-gray-400 font-medium ml-1.5">({(order.attachments || []).length})</span>
            </h2>
          </div>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 ring-1 ring-brand-100 text-brand-700 text-xs font-semibold rounded-xl cursor-pointer hover:bg-brand-100 active:scale-[0.97] transition-all">
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
                className="relative group rounded-xl overflow-hidden ring-1 ring-gray-200 aspect-square hover:ring-brand-300 transition-all"
              >
                <img
                  src={att.filePath}
                  alt={att.fileName}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                  <p className="text-white text-[11px] font-medium truncate">
                    {att.fileName}
                  </p>
                  <p className="text-white/70 text-[9px]">
                    by {att.user?.name} · {formatDate(att.createdAt)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-6">{t("orderDetail.noPhotos")}</p>
        )}
      </div>

      {/* ── Comments / Internal Notes ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-brand-600" />
          </div>
          <h2 className="text-sm font-bold text-gray-900">
            {t("orderDetail.notesComments")}
            <span className="text-gray-400 font-medium ml-1.5">({(order.comments || []).length})</span>
          </h2>
        </div>

        {/* Post comment */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
            placeholder={t("orderDetail.addNotePlaceholder")}
            className="flex-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
          />
          <button
            onClick={handlePostComment}
            disabled={postingComment || !commentText.trim()}
            className="inline-flex items-center justify-center px-3 py-2.5 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-sm hover:shadow"
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Comments list */}
        {(order.comments || []).length > 0 ? (
          <div className="space-y-2">
            {order.comments.map((comment: any) => (
              <div key={comment.id} className="bg-gray-50/70 ring-1 ring-gray-200/80 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-900">{comment.user.name}</span>
                  <span className="text-[10px] text-gray-400 capitalize bg-white ring-1 ring-gray-200 px-1.5 py-0.5 rounded-md">
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
          <p className="text-xs text-gray-400 text-center py-4">{t("orderDetail.noComments")}</p>
        )}
      </div>

      {/* ── Status Timeline ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
            <Clock className="w-4 h-4 text-gray-600" />
          </div>
          <h2 className="text-sm font-bold text-gray-900">{t("orderDetail.statusLog")}</h2>
        </div>
        <OrderStatusTimeline statusLogs={statusLogs} />
      </div>

      {/* Item-level Raw Material N/A Modal */}
      {showItemRawMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl ring-1 ring-gray-200/60 overflow-hidden">
            <div className="px-5 pt-5 pb-3 bg-gradient-to-r from-rose-50 to-rose-50/40 border-b border-rose-100/70">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 ring-1 ring-rose-200 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-rose-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-900">
                    {t("orderDetail.rawMaterialShortage")}
                  </h3>
                  <p className="text-xs text-rose-700/90 mt-0.5">
                    {t("orderDetail.materialQuestion")}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-4">
              <textarea
                value={itemRawMaterialNote}
                onChange={(e) => setItemRawMaterialNote(e.target.value)}
                rows={3}
                autoFocus
                placeholder="e.g. BOPP film 42 micron finished, Core 3 inch not available..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400/30 focus:border-rose-400 resize-none placeholder:text-gray-400 transition-all"
              />
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => {
                  setShowItemRawMaterialModal(null);
                  setItemRawMaterialNote("");
                }}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] transition-all"
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
                className="flex-1 px-4 py-2.5 bg-rose-500 text-white text-sm font-semibold rounded-xl hover:bg-rose-600 active:scale-[0.97] disabled:opacity-50 transition-all shadow-sm hover:shadow"
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

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl ring-1 ring-gray-200/60 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-200/70 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-brand-600" />
                </div>
                <h3 className="text-base font-bold text-gray-900">
                  Add Product to Order
                </h3>
              </div>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Category selector */}
              <div>
                <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-2">Product Category</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {allCategories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => { setNewItemCategory(cat.value as ProductCategory); setNewItemDetails({}); }}
                      className={`px-3 py-2 text-sm rounded-xl border font-semibold transition-all active:scale-[0.97] ${
                        newItemCategory === cat.value
                          ? "border-brand-300 bg-brand-50 text-brand-700 ring-1 ring-brand-200 shadow-sm"
                          : "border-gray-200 text-gray-600 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {cat.builtin ? tProduct(cat.value as any) : cat.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Product details form */}
              {(() => {
                const customCat = customCategories.find((c) => c.name === newItemCategory);
                let customFields: string[] | undefined;
                if (customCat) {
                  try { customFields = JSON.parse(customCat.fields); } catch {}
                }
                return (
                  <ProductForm
                    productCategory={newItemCategory}
                    productDetails={newItemDetails}
                    onChange={(details) => setNewItemDetails(details)}
                    customFields={customFields}
                  />
                );
              })()}
              {/* Rate */}
              <div>
                <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                  Rate (₹) <span className="text-gray-400 font-normal normal-case">(optional)</span>
                </label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={newItemRate}
                    onChange={(e) => setNewItemRate(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowAddItemModal(false)}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={addingItem}
                className="flex-1 px-4 py-2.5 bg-brand-500 text-white text-sm font-semibold rounded-xl hover:bg-brand-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
              >
                {addingItem ? (
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {addingItem ? "Adding..." : "Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Raw Material N/A Modal */}
      {showRawMaterialModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl ring-1 ring-gray-200/60 overflow-hidden">
            <div className="px-5 pt-5 pb-3 bg-gradient-to-r from-rose-50 to-rose-50/40 border-b border-rose-100/70">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 ring-1 ring-rose-200 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-4 h-4 text-rose-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-900">
                    {t("orderDetail.rawMaterialShortage")}
                  </h3>
                  <p className="text-xs text-rose-700/90 mt-0.5">
                    {t("orderDetail.materialQuestion")}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-5 py-4">
              <textarea
                value={rawMaterialNote}
                onChange={(e) => setRawMaterialNote(e.target.value)}
                rows={3}
                autoFocus
                placeholder="e.g. BOPP film 42 micron finished, Core 3 inch not available..."
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400/30 focus:border-rose-400 resize-none placeholder:text-gray-400 transition-all"
              />
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => {
                  setShowRawMaterialModal(false);
                  setRawMaterialNote("");
                }}
                className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] transition-all"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => handleStatusUpdate("RAW_MATERIAL_NA", rawMaterialNote || "Raw material not available")}
                disabled={updatingStatus !== null}
                className="flex-1 px-4 py-2.5 bg-rose-500 text-white text-sm font-semibold rounded-xl hover:bg-rose-600 disabled:opacity-50 active:scale-[0.97] transition-all shadow-sm hover:shadow"
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
