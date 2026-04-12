"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { PRODUCT_CATEGORIES } from "@/types";
import type { ProductCategory } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import { safeParseJSON } from "@/lib/utils";
import { ArrowLeft, Save, Plus, Trash2, ChevronDown, ChevronUp, IndianRupee, Loader2 } from "lucide-react";
import Link from "next/link";

interface Customer { id: string; partyName: string; location?: string | null; }
interface CustomCategory { id: string; name: string; fields: string; }

interface QuotationItemData {
  id: string;
  productCategory: ProductCategory | "";
  productDetails: Record<string, string>;
  rate: string;
  gst: string;
  expanded: boolean;
}

let itemCtr = 0;
function newItem(): QuotationItemData {
  return { id: `item-${++itemCtr}`, productCategory: "", productDetails: {}, rate: "", gst: "", expanded: true };
}

export default function EditQuotationPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<QuotationItemData[]>([newItem()]);
  const [validUntil, setValidUntil] = useState("");
  const [remarks, setRemarks] = useState("");
  const [termsAndCond, setTermsAndCond] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const userRole = (session?.user as any)?.role;
  const canEdit = ["ADMIN", "SALES", "ACCOUNTANT"].includes(userRole || "");

  useEffect(() => {
    if (sessionStatus === "authenticated" && !canEdit) router.push(`/quotations/${id}`);
  }, [sessionStatus, canEdit]);

  // Load quotation + customers + custom categories
  useEffect(() => {
    Promise.all([
      fetch(`/api/quotations/${id}`).then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/product-categories").then((r) => r.json()),
    ]).then(([q, c, cats]) => {
      if (q.error) { router.push("/quotations"); return; }

      setCustomers(Array.isArray(c) ? c : []);
      setCustomCategories(Array.isArray(cats) ? cats : []);
      setCustomerId(q.customerId || "");
      setValidUntil(q.validUntil ? q.validUntil.slice(0, 10) : "");
      setRemarks(q.remarks || "");
      setTermsAndCond(q.termsAndCond || "");

      if (q.items?.length) {
        setItems(q.items.map((item: any) => ({
          id: item.id,
          productCategory: item.productCategory || "",
          productDetails: safeParseJSON(item.productDetails),
          rate: item.rate != null ? String(item.rate) : "",
          gst: item.gst != null ? String(item.gst) : "",
          expanded: true,
        })));
      }
      setLoading(false);
    }).catch(() => { setLoading(false); toast.error("Failed to load quotation"); });
  }, [id]);

  const updateItem = (itemId: string, updates: Partial<QuotationItemData>) =>
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, ...updates } : i));

  const removeItem = (itemId: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const addItem = () => setItems((prev) => [...prev.map((i) => ({ ...i, expanded: false })), newItem()]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) { toast.error("Select a party / customer"); return; }
    if (items.some((i) => !i.productCategory)) { toast.error("Select a product type for all items"); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: "PATCH",
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
      if (res.ok) {
        toast.success("Quotation updated");
        setTimeout(() => router.push(`/quotations/${id}`), 400);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || sessionStatus === "loading") {
    return <div className="max-w-2xl mx-auto space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Toaster position="top-right" />

      <div className="flex items-center gap-3 mb-6">
        <Link href={`/quotations/${id}`} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Edit Quotation</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Party */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-sm font-semibold text-gray-900 mb-3">Party / Customer</label>
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
        </div>

        {/* Quotation Details */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Quotation Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Valid Until</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
              <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional note"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Terms &amp; Conditions</label>
            <textarea value={termsAndCond} onChange={(e) => setTermsAndCond(e.target.value)} rows={2}
              placeholder="e.g. Prices valid for 30 days. GST extra."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Products ({items.length})</h2>
            <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          </div>

          {items.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Rate (₹)</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input type="number" step="0.01" value={item.rate}
                          onChange={(e) => updateItem(item.id, { rate: e.target.value })}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">GST %</label>
                      <input type="number" step="0.01" value={item.gst}
                        onChange={(e) => updateItem(item.id, { gst: e.target.value })}
                        placeholder="18"
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit */}
        <button type="submit" disabled={submitting}
          className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {submitting ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
