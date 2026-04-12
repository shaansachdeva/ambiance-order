"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { PRODUCT_CATEGORIES } from "@/types";
import type { UserRole, ProductCategory } from "@/types";

interface CustomCategory {
  id: string;
  name: string;
  fields: string; // JSON string
}
import toast, { Toaster } from "react-hot-toast";
import { ArrowLeft, Send, Plus, Trash2, ChevronDown, ChevronUp, IndianRupee } from "lucide-react";

interface Customer {
  id: string;
  partyName: string;
  location?: string | null;
}

interface QuotationItemData {
  id: string;
  productCategory: ProductCategory | "";
  productDetails: Record<string, string>;
  rate: string;
  gst: string;
  expanded: boolean;
}

let itemCounter = 0;
function newItem(): QuotationItemData {
  return {
    id: `item-${++itemCounter}`,
    productCategory: "",
    productDetails: {},
    rate: "",
    gst: "",
    expanded: true,
  };
}

export default function NewQuotationPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyLocation, setNewPartyLocation] = useState("");
  const [showNewParty, setShowNewParty] = useState(false);
  const [items, setItems] = useState<QuotationItemData[]>([newItem()]);
  const [validUntil, setValidUntil] = useState("");
  const [remarks, setRemarks] = useState("");
  const [termsAndCond, setTermsAndCond] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [navGuardModal, setNavGuardModal] = useState(false);
  const [pendingNavUrl, setPendingNavUrl] = useState<string | null>(null);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const canCreate = ["ADMIN", "SALES", "ACCOUNTANT"].includes(userRole);

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/product-categories")
      .then((r) => r.json())
      .then((d) => setCustomCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
    // Restore saved draft if present
    try {
      const saved = localStorage.getItem("quotation_draft");
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.customerId) setCustomerId(draft.customerId);
        if (draft.items?.length) setItems(draft.items);
        if (draft.validUntil) setValidUntil(draft.validUntil);
        if (draft.remarks) setRemarks(draft.remarks);
        if (draft.termsAndCond) setTermsAndCond(draft.termsAndCond);
      }
    } catch {}
  }, []);

  // Auto-save draft whenever form has meaningful data
  useEffect(() => {
    const hasData = customerId || items.some((i) => i.productCategory || i.rate) || remarks || validUntil || termsAndCond;
    if (!hasData) return;
    const draft = { customerId, items, validUntil, remarks, termsAndCond, savedAt: new Date().toISOString() };
    try { localStorage.setItem("quotation_draft", JSON.stringify(draft)); } catch {}
  }, [customerId, items, validUntil, remarks, termsAndCond]);

  // Navigation guard — intercept back button while form has data
  useEffect(() => {
    const hasData = customerId || items.some((i) => i.productCategory || i.rate) || remarks;
    if (!hasData) return;
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.pushState(null, "", window.location.href);
      setNavGuardModal(true);
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [customerId, items, remarks]);

  useEffect(() => {
    if (sessionStatus === "authenticated" && !canCreate) {
      router.push("/quotations");
    }
  }, [sessionStatus, canCreate, router]);

  const hasFormData = !!(customerId || items.some((i) => i.productCategory || i.rate) || remarks || validUntil || termsAndCond);

  const discardDraft = () => {
    try {
      const snap = localStorage.getItem("quotation_draft");
      if (snap) {
        const existing: any[] = JSON.parse(localStorage.getItem("discarded_quotations") || "[]");
        existing.unshift({ ...JSON.parse(snap), discardedAt: new Date().toISOString(), type: "quotation" });
        localStorage.setItem("discarded_quotations", JSON.stringify(existing.slice(0, 10)));
      }
    } catch {}
    localStorage.removeItem("quotation_draft");
  };

  const handleNavAway = (url: string) => {
    if (hasFormData) {
      setPendingNavUrl(url);
      setNavGuardModal(true);
    } else {
      router.push(url);
    }
  };

  const updateItem = (id: string, updates: Partial<QuotationItemData>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addItem = () => {
    setItems((prev) => [...prev.map((i) => ({ ...i, expanded: false })), newItem()]);
  };

  const handleCreateCustomer = async () => {
    if (!newPartyName.trim()) return;
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partyName: newPartyName.trim(), location: newPartyLocation.trim() || null }),
    });
    const data = await res.json();
    if (res.ok) {
      setCustomers((prev) => [data, ...prev]);
      setCustomerId(data.id);
      setShowNewParty(false);
      setNewPartyName("");
      setNewPartyLocation("");
      toast.success(`Party "${data.partyName}" created`);
    } else {
      toast.error(data.error || "Failed to create party");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) { toast.error("Select a party / customer"); return; }
    const invalidItem = items.find((i) => !i.productCategory);
    if (invalidItem) { toast.error("Select a product type for all items"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          remarks: remarks || null,
          validUntil: validUntil || null,
          termsAndCond: termsAndCond || null,
          items: items.map((item) => ({
            productCategory: item.productCategory,
            productDetails: item.productDetails,
            rate: item.rate || null,
            gst: item.gst || null,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.removeItem("quotation_draft");
        toast.success(`Quotation ${data.quotationId} created!`);
        setTimeout(() => router.push(`/quotations/${data.id}`), 500);
      } else {
        toast.error(data.error || "Failed to create quotation");
      }
    } catch (err: any) {
      toast.error(`Error: ${err?.message || "Something went wrong"}`);
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

      {/* Nav Guard Modal */}
      {navGuardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-base font-bold text-gray-900 mb-1">Unsaved changes</h3>
            <p className="text-sm text-gray-500 mb-5">Your form has data that hasn&apos;t been submitted. Would you like to save it as a draft to continue later?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setNavGuardModal(false);
                  // Draft already auto-saved; just navigate
                  router.push(pendingNavUrl || "/quotations");
                }}
                className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl"
              >
                Save draft &amp; leave
              </button>
              <button
                onClick={() => {
                  discardDraft();
                  setNavGuardModal(false);
                  router.push(pendingNavUrl || "/quotations");
                }}
                className="w-full py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50"
              >
                Discard &amp; leave
              </button>
              <button
                onClick={() => setNavGuardModal(false)}
                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600"
              >
                Stay on page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={() => handleNavAway("/quotations")} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Quotation</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Party Name */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-sm font-semibold text-gray-900 mb-3">Party / Customer</label>
          {!showNewParty ? (
            <div className="space-y-2">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">Select Party</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.partyName}{c.location ? ` — ${c.location}` : ""}</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowNewParty(true)} className="text-sm text-brand-600 hover:text-brand-700 font-medium">
                + Add New Party
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input type="text" value={newPartyName} onChange={(e) => setNewPartyName(e.target.value)} placeholder="Party name" className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <div className="flex gap-2">
                <input type="text" value={newPartyLocation} onChange={(e) => setNewPartyLocation(e.target.value)} placeholder="Location (optional)" className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <button type="button" onClick={handleCreateCustomer} className="px-4 py-2.5 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600">Add</button>
                <button type="button" onClick={() => setShowNewParty(false)} className="px-3 py-2.5 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Quote Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Quotation Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valid Until</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
              <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional note" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Terms &amp; Conditions</label>
            <textarea
              value={termsAndCond}
              onChange={(e) => setTermsAndCond(e.target.value)}
              rows={2}
              placeholder="e.g. Prices valid for 30 days. GST extra. Subject to availability."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>

        {/* Product Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Products ({items.length})</h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>

          {items.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Item header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {item.productCategory
                      ? PRODUCT_CATEGORIES.find((c) => c.value === item.productCategory)?.label
                        || customCategories.find((c) => c.id === item.productCategory)?.name
                        || item.productCategory
                      : "Select product"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(item.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button type="button" onClick={() => updateItem(item.id, { expanded: !item.expanded })} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
                    {item.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {item.expanded && (
                <div className="p-4 space-y-3">
                  {/* Product type select */}
                  <select
                    value={item.productCategory}
                    onChange={(e) => updateItem(item.id, { productCategory: e.target.value as ProductCategory, productDetails: {} })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="">Select product type</option>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                    {customCategories.length > 0 && (
                      <optgroup label="Custom Categories">
                        {customCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>

                  {/* Product details form */}
                  {item.productCategory && (
                    <ProductForm
                      productCategory={item.productCategory as ProductCategory}
                      productDetails={item.productDetails}
                      onChange={(details) => updateItem(item.id, { productDetails: details })}
                      customFields={
                        customCategories.find((c) => c.id === item.productCategory)
                          ? (() => { try { return JSON.parse(customCategories.find((c) => c.id === item.productCategory)!.fields); } catch { return []; } })()
                          : undefined
                      }
                    />
                  )}

                  {/* Rate & GST */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Rate (₹)</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          type="number"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => updateItem(item.id, { rate: e.target.value })}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">GST %</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.gst}
                        onChange={(e) => updateItem(item.id, { gst: e.target.value })}
                        placeholder="18"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {submitting ? "Creating..." : "Create Quotation"}
        </button>
      </form>
    </div>
  );
}
