"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { PRODUCT_CATEGORIES } from "@/types";
import type { UserRole, ProductCategory } from "@/types";
import { hasPermission } from "@/lib/utils";
import toast, { Toaster } from "react-hot-toast";
import { ArrowLeft, Send, Plus, Trash2, ChevronDown, ChevronUp, IndianRupee, ImagePlus, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Customer {
  id: string;
  partyName: string;
  location?: string | null;
}

interface OrderItemData {
  id: string; // client-side key
  productCategory: ProductCategory | "";
  productDetails: Record<string, string>;
  rate: string;
  gst: string;
  expanded: boolean;
  image: File | null;
  imagePreview: string;
}

let itemCounter = 0;
function newItem(): OrderItemData {
  return {
    id: `item-${++itemCounter}`,
    productCategory: "",
    productDetails: {},
    rate: "",
    gst: "",
    expanded: true,
    image: null,
    imagePreview: "",
  };
}

export default function NewOrderPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const partyParam = searchParams.get("partyName");
  const leadId = searchParams.get("leadId");
  const initialNewPartyState = !!partyParam && !leadId;
  const { t, tProduct } = useLanguage();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [newPartyName, setNewPartyName] = useState(partyParam || "");
  const [newPartyLocation, setNewPartyLocation] = useState("");
  const [showNewParty, setShowNewParty] = useState(initialNewPartyState);
  const [items, setItems] = useState<OrderItemData[]>([newItem()]);
  const [deliveryDeadline, setDeliveryDeadline] = useState("");
  const [remarks, setRemarks] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [submitting, setSubmitting] = useState(false);
  const [leadLoaded, setLeadLoaded] = useState(false);
  const [leadCompany, setLeadCompany] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string; fields: string }[]>([]);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const customPermissions = (session?.user as any)?.customPermissions ?? null;
  const canCreate = hasPermission(userRole, "create_order", customPermissions);

  const [draftBanner, setDraftBanner] = useState<any>(null);

  // Load draft from localStorage — show a persistent banner instead of a fleeting toast
  useEffect(() => {
    if (leadId) return; // don't restore draft when converting a lead
    const saved = localStorage.getItem("order_draft");
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setDraftBanner(draft);
      } catch { localStorage.removeItem("order_draft"); }
    }
  }, [leadId]);

  const restoreDraft = (draft: any) => {
    setCustomerId(draft.customerId || "");
    setItems(draft.items?.length ? draft.items : [newItem()]);
    setDeliveryDeadline(draft.deliveryDeadline || "");
    setRemarks(draft.remarks || "");
    setPriority(draft.priority || "NORMAL");
    setIsDirty(true);
    setDraftBanner(null);
    toast.success("Draft restored");
  };

  const discardDraft = () => {
    // Store a snapshot in discarded_drafts for the user to review later
    const saved = localStorage.getItem("order_draft");
    if (saved) {
      try {
        const existing: any[] = JSON.parse(localStorage.getItem("discarded_drafts") || "[]");
        const parsed = JSON.parse(saved);
        existing.unshift({ ...parsed, discardedAt: new Date().toISOString() });
        localStorage.setItem("discarded_drafts", JSON.stringify(existing.slice(0, 10))); // keep last 10
      } catch {}
    }
    localStorage.removeItem("order_draft");
    setDraftBanner(null);
  };

  // Auto-save draft whenever form data changes (works independently of isDirty)
  useEffect(() => {
    if (submitting || leadId) return;
    // Only save if the form has meaningful data (customer selected or items filled)
    const hasData = customerId || items.some(i => i.productCategory || Object.keys(i.productDetails).length > 0) || remarks || deliveryDeadline;
    if (!hasData) return;
    const draft = {
      customerId,
      items: items.map(item => ({ ...item, image: null, imagePreview: "" })),
      deliveryDeadline,
      remarks,
      priority,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("order_draft", JSON.stringify(draft));
  }, [customerId, items, deliveryDeadline, remarks, priority, submitting, leadId]);

  useEffect(() => {
    fetch("/api/product-categories")
      .then((r) => r.json())
      .then((d) => setCustomCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setCustomers(list);
        setCustomersLoaded(true);
        // If leadId is present, auto-select matching customer by party name
        if (partyParam && leadId) {
          const match = list.find((c: Customer) => c.partyName.toLowerCase() === partyParam.toLowerCase());
          if (match) setCustomerId(match.id);
        }
      })
      .catch(() => { setCustomersLoaded(true); });
  }, []);

  // Fetch lead data and pre-fill the form
  useEffect(() => {
    if (!leadId || leadLoaded || !customersLoaded) return;

    fetch(`/api/leads/${leadId}`)
      .then((res) => res.json())
      .then(async (lead) => {
        if (!lead || lead.error) return;

        setLeadCompany(lead.companyName || "");

        // Pre-fill remarks
        if (lead.remarks) setRemarks(lead.remarks);

        // Pre-fill items from lead
        if (lead.items && lead.items.length > 0) {
          const prefilled: OrderItemData[] = lead.items.map((li: any) => {
            let details: Record<string, string> = {};
            try {
              details = typeof li.productDetails === "string" ? JSON.parse(li.productDetails) : li.productDetails || {};
            } catch { /* ignore */ }

            return {
              id: `item-${++itemCounter}`,
              productCategory: li.productCategory || "",
              productDetails: details,
              rate: li.rate ? String(li.rate) : "",
              gst: "",
              expanded: true,
              image: null,
              imagePreview: "",
            };
          });
          setItems(prefilled);
        }

        // Auto-find or create customer from lead's company name
        const companyName = lead.companyName || "";
        if (companyName) {
          const existing = customers.find(
            (c) => c.partyName.toLowerCase() === companyName.toLowerCase()
          );
          if (existing) {
            setCustomerId(existing.id);
          } else {
            // Auto-create the customer
            try {
              const res = await fetch("/api/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ partyName: companyName.trim() }),
              });
              const newCustomer = await res.json();
              if (res.ok) {
                setCustomers((prev) => [...prev, newCustomer]);
                setCustomerId(newCustomer.id);
              }
            } catch { /* ignore */ }
          }
        }

        setLeadLoaded(true);
      })
      .catch(() => {});
  }, [leadId, leadLoaded, customersLoaded]);

  useEffect(() => {
    if (sessionStatus === "authenticated" && !canCreate) {
      router.push("/");
    }
  }, [sessionStatus, canCreate, router]);

  // Warn before browser close/refresh when form is dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Intercept browser back button when form is dirty
  useEffect(() => {
    if (!isDirty) return;
    window.history.pushState(null, "", window.location.href);
    const handler = () => {
      window.history.pushState(null, "", window.location.href);
      showBackConfirm();
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [isDirty]);

  const showBackConfirm = () => {
    toast(
      (t) => (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-900">Discard this order?</p>
          <p className="text-xs text-gray-500">All entered data will be lost.</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Keep editing
            </button>
            <button
              onClick={() => { toast.dismiss(t.id); setIsDirty(false); router.push("/orders"); }}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
            >
              Discard
            </button>
          </div>
        </div>
      ),
      { duration: Infinity }
    );
  };

  const updateItem = (id: string, updates: Partial<OrderItemData>) => {
    setIsDirty(true);
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addItem = () => {
    setItems((prev) => {
      // Collapse all existing items
      const collapsed = prev.map((item) => ({ ...item, expanded: false }));
      return [...collapsed, newItem()];
    });
  };

  const handleCreateCustomer = async () => {
    if (!newPartyName.trim()) return;

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyName: newPartyName.trim(), location: newPartyLocation.trim() || null }),
      });
      const newCustomer = await res.json();
      if (res.ok) {
        setCustomers((prev) => [...prev, newCustomer]);
        setCustomerId(newCustomer.id);
        setNewPartyName("");
        setNewPartyLocation("");
        setShowNewParty(false);
        toast.success(`Party "${newCustomer.partyName}" added`);
      } else {
        toast.error(newCustomer.error || "Failed to add party");
      }
    } catch {
      toast.error("Failed to add party");
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId) {
      toast.error("Please select a party name");
      return;
    }

    // Validate all items have a category
    for (let i = 0; i < items.length; i++) {
      if (!items[i].productCategory) {
        toast.error(`Please select a product category for Item ${i + 1}`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          items: items.map((item) => ({
            productCategory: item.productCategory,
            productDetails: item.productDetails,
            rate: item.rate ? parseFloat(item.rate) : null,
            gst: item.gst ? parseFloat(item.gst) : null,
          })),
          deliveryDeadline: deliveryDeadline || null,
          remarks: remarks || null,
          priority,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Upload images as attachments
        const orderId = data.id;
        for (const item of items) {
          if (item.image) {
            const formData = new FormData();
            formData.append("file", item.image);
            try {
              await fetch(`/api/orders/${orderId}/attachments`, {
                method: "POST",
                body: formData,
              });
            } catch { /* image upload failed silently */ }
          }
        }
        setIsDirty(false);
        localStorage.removeItem("order_draft");
        toast.success(`Order ${data.orderId} created successfully!`);
        setTimeout(() => router.push("/orders"), 500);
      } else {
        toast.error((data.detail ? `${data.error}: ${data.detail}` : data.error) || "Failed to create order");
      }
    } catch (err: any) {
      toast.error(`Something went wrong: ${err?.message || String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionStatus === "loading") {
    return <div className="h-48 bg-gray-200 rounded-xl animate-pulse" />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => isDirty ? showBackConfirm() : router.push("/orders")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{leadId ? t("newOrder.confirmCreate") : t("newOrder.title")}</h1>
      </div>

      {/* Draft restore banner — shown whenever a draft is found in localStorage */}
      {draftBanner && !leadId && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-2">
          <p className="text-sm font-semibold text-amber-800 mb-2">You have an unsaved draft from {draftBanner.savedAt ? new Date(draftBanner.savedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "earlier"}.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => restoreDraft(draftBanner)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700"
            >
              Restore Draft
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Lead Conversion Banner */}
      {leadId && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-2">
          <p className="text-sm font-medium text-green-800">
            📋 Converting lead: <span className="font-bold">{leadCompany || partyParam}</span>
          </p>
          <p className="text-xs text-green-600 mt-0.5">
            Review the products below, make any changes to quantity or details, add more items if needed, then create the order.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Party Name */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            {t("newOrder.partyName")}
          </label>

          {!showNewParty ? (
            <div className="space-y-2">
              <select
                value={customerId}
                onChange={(e) => { setIsDirty(true); setCustomerId(e.target.value); }}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">{t("newOrder.selectParty")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.partyName}{c.location ? ` — ${c.location}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewParty(true)}
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                {t("newOrder.addNewParty")}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={newPartyName}
                onChange={(e) => setNewPartyName(e.target.value)}
                placeholder={t("newOrder.enterPartyName")}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPartyLocation}
                  onChange={(e) => setNewPartyLocation(e.target.value)}
                  placeholder={t("newOrder.locationOptional")}
                  className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={handleCreateCustomer}
                  className="px-4 py-2.5 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600 transition-colors"
                >
                  {t("newOrder.add")}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowNewParty(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {t("newOrder.backToList")}
              </button>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-900">
              {t("newOrder.orderItems")} ({items.length})
            </label>
          </div>

          {items.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Item header */}
              <div
                className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer"
                onClick={() => updateItem(item.id, { expanded: !item.expanded })}
              >
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    {item.productCategory
                      ? tProduct(item.productCategory)
                      : t("newOrder.selectProduct")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {item.expanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Item content */}
              {item.expanded && (
                <div className="p-4 space-y-4">
                  {/* Category selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t("newOrder.productCategory")}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PRODUCT_CATEGORIES.map((cat) => (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => {
                            if (cat.value !== item.productCategory) {
                              updateItem(item.id, {
                                productCategory: cat.value,
                                productDetails: {},
                              });
                            }
                          }}
                          className={`px-3 py-2 text-sm rounded-lg border-2 font-medium transition-all ${
                            item.productCategory === cat.value
                              ? "border-brand-500 bg-brand-50 text-brand-700"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {tProduct(cat.value)}
                        </button>
                      ))}
                      {customCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            if (cat.name !== item.productCategory) {
                              updateItem(item.id, { productCategory: cat.name as ProductCategory, productDetails: {} });
                            }
                          }}
                          className={`px-3 py-2 text-sm rounded-lg border-2 font-medium transition-all ${
                            item.productCategory === cat.name
                              ? "border-purple-500 bg-purple-50 text-purple-700"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Product details form */}
                  {item.productCategory && (() => {
                    const customCat = customCategories.find((c) => c.name === item.productCategory);
                    let customFields: string[] | undefined;
                    if (customCat) {
                      try { customFields = JSON.parse(customCat.fields); } catch {}
                    }
                    return (
                      <ProductForm
                        productCategory={item.productCategory as ProductCategory}
                        productDetails={item.productDetails}
                        onChange={(details) => updateItem(item.id, { productDetails: details })}
                        customFields={customFields}
                      />
                    );
                  })()}

                  {/* Rate & GST */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {t("newOrder.rate")} <span className="text-gray-400 font-normal">{t("newOrder.optional")}</span>
                      </label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(item.id, { rate: e.target.value })}
                          placeholder="0"
                          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        GST % <span className="text-gray-400 font-normal">{t("newOrder.optional")}</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">%</span>
                        <input
                          type="number"
                          value={item.gst}
                          onChange={(e) => updateItem(item.id, { gst: e.target.value })}
                          placeholder="e.g. 18"
                          min="0"
                          max="100"
                          className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Image Upload */}
                  <div className="pt-2 border-t border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {t("newOrder.designImage")} <span className="text-gray-400 font-normal">{t("newOrder.optional")}</span>
                    </label>
                    {item.imagePreview ? (
                      <div className="relative inline-block">
                        <img
                          src={item.imagePreview}
                          alt="Preview"
                          className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, { image: null, imagePreview: "" })}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 cursor-pointer transition-colors">
                        <ImagePlus className="w-4 h-4" />
                        {t("newOrder.uploadImage")}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => updateItem(item.id, { image: file, imagePreview: reader.result as string });
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add Item button */}
          <button
            type="button"
            onClick={addItem}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t("newOrder.addAnother")}
          </button>


        </div>

        {/* Priority & Delivery & Remarks */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <label className="block text-sm font-semibold text-gray-900">
            3. Additional Info
          </label>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPriority("NORMAL")}
                className={`flex-1 px-3 py-2.5 text-sm rounded-lg border-2 font-medium transition-all ${
                  priority === "NORMAL"
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setPriority("URGENT")}
                className={`flex-1 px-3 py-2.5 text-sm rounded-lg border-2 font-medium transition-all ${
                  priority === "URGENT"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-200 text-gray-600"
                }`}
              >
                Urgent
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Delivery Deadline <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={deliveryDeadline}
              onChange={(e) => setDeliveryDeadline(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Remarks <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => { setIsDirty(true); setRemarks(e.target.value); }}
              rows={3}
              placeholder="Any special instructions..."
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !customerId || !items[0]?.productCategory}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating Order...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Create Order ({items.length} item{items.length !== 1 ? "s" : ""})
            </>
          )}
        </button>
      </form>
    </div>
  );
}
