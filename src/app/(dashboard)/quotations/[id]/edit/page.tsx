"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import type { ProductCategory } from "@/types";
import { useCategoryPicker, type PickerCategory } from "@/lib/useCategoryPicker";
import toast, { Toaster } from "react-hot-toast";
import { safeParseJSON } from "@/lib/utils";
import {
  ArrowLeft, Save, Plus, Trash2, ChevronDown, ChevronUp, IndianRupee, Loader2,
  FileText, Building2, Calendar, Package, Search, Check, X,
} from "lucide-react";
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

function CategoryPicker({
  value, categories, onChange, loaded,
}: {
  value: string;
  categories: PickerCategory[];
  onChange: (value: string) => void;
  loaded: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);

  const selected = categories.find((c) => c.value === value) || null;
  const q = search.trim().toLowerCase();
  const filtered = q
    ? categories.filter((c) => c.label.toLowerCase().includes(q) || c.value.toLowerCase().includes(q))
    : categories;

  return (
    <div ref={boxRef} className="relative">
      {selected && !open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setSearch(""); setHighlight(0); }}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-brand-50 border border-brand-200 ring-1 ring-brand-100 rounded-xl hover:border-brand-300 hover:bg-brand-100/60 transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-gray-900 truncate">{selected.label}</p>
              <p className="text-[11px] text-gray-500">Tap to change</p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        </button>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onFocus={() => { setOpen(true); setHighlight(0); }}
              onChange={(e) => { setSearch(e.target.value); setOpen(true); setHighlight(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHighlight((h) => Math.min(filtered.length - 1, h + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); }
                else if (e.key === "Enter") {
                  e.preventDefault();
                  const pick = filtered[highlight];
                  if (pick) { onChange(pick.value); setOpen(false); setSearch(""); }
                } else if (e.key === "Escape") { setOpen(false); }
              }}
              placeholder={loaded ? (categories.length === 0 ? "No products yet" : "Search products...") : "Loading..."}
              className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
            />
            {search && (
              <button type="button" onClick={() => { setSearch(""); setHighlight(0); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {open && (
            <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg ring-1 ring-gray-200/40 max-h-72 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center mx-auto mb-2">
                    <Package className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">
                    {loaded ? (categories.length === 0 ? "No products yet" : "No matching products") : "Loading..."}
                  </p>
                </div>
              ) : (
                filtered.map((c, idx) => (
                  <button key={c.value} type="button" onMouseEnter={() => setHighlight(idx)}
                    onClick={() => { onChange(c.value); setOpen(false); setSearch(""); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${idx === highlight ? "bg-brand-50" : "hover:bg-gray-50"}`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.label}</p>
                    </div>
                    {c.value === value && <Check className="w-4 h-4 text-brand-500 shrink-0" />}
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function EditQuotationPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { categories: allCategories, loaded: categoriesLoaded } = useCategoryPicker();

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
  }, [sessionStatus, canEdit, id, router]);

  // Load quotation + customers + custom categories
  useEffect(() => {
    Promise.all([
      fetch(`/api/quotations/${id}`).then((r) => r.json()),
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/product-categories").then((r) => r.json()),
    ]).then(([q, c, cats]) => {
      if (q.error) { router.push("/quotations"); return; }

      const customerList: Customer[] = Array.isArray(c) ? c : [];
      const catList: CustomCategory[] = Array.isArray(cats) ? cats : [];
      setCustomers(customerList);
      setCustomCategories(catList);
      setCustomerId(q.customerId || "");
      setValidUntil(q.validUntil ? q.validUntil.slice(0, 10) : "");
      setRemarks(q.remarks || "");
      setTermsAndCond(q.termsAndCond || "");

      if (q.items?.length) {
        // Normalize legacy productCategory values: old quotations may have stored
        // a custom category's cuid id instead of its name. Convert id → name on load
        // so the unified picker (which keys on name) works correctly.
        const idToName: Record<string, string> = {};
        for (const cat of catList) idToName[cat.id] = cat.name;

        setItems(q.items.map((item: any) => ({
          id: item.id,
          productCategory: idToName[item.productCategory] ?? (item.productCategory || ""),
          productDetails: safeParseJSON(item.productDetails),
          rate: item.rate != null ? String(item.rate) : "",
          gst: item.gst != null ? String(item.gst) : "",
          expanded: true,
        })));
      }
      setLoading(false);
    }).catch(() => { setLoading(false); toast.error("Failed to load quotation"); });
  }, [id, router]);

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
    } catch { toast.error("Something went wrong"); }
    finally { setSubmitting(false); }
  };

  if (loading || sessionStatus === "loading") {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-20 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
        <div className="h-48 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
        <div className="h-64 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24 md:pb-6">
      <Toaster position="top-right" />

      {/* ── Header card ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/quotations/${id}`}
            className="p-2 -ml-1 hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-500 flex-shrink-0" />
              Edit Quotation
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Party / Customer ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-brand-600" />
            </div>
            <label className="text-sm font-bold text-gray-900">Party / Customer</label>
          </div>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white appearance-none cursor-pointer transition-all"
            >
              <option value="">Select Party</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.partyName}{c.location ? ` — ${c.location}` : ""}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* ── Quotation Details ───────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-gray-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">Quotation Details</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">Valid Until</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                Remarks <span className="text-gray-400 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional note"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
              Terms &amp; Conditions <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={termsAndCond}
              onChange={(e) => setTermsAndCond(e.target.value)}
              rows={2}
              placeholder="e.g. Prices valid for 30 days. GST extra. Subject to availability."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 resize-none transition-all"
            />
          </div>
        </div>

        {/* ── Product Items ───────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
                <Package className="w-4 h-4 text-brand-600" />
              </div>
              <label className="text-sm font-bold text-gray-900">
                Products
                <span className="text-gray-400 font-medium ml-1.5">({items.length})</span>
              </label>
            </div>
          </div>

          {items.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-200/80">
              <div
                className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200/70 rounded-t-2xl cursor-pointer hover:from-gray-100/60 transition-colors"
                onClick={() => updateItem(item.id, { expanded: !item.expanded })}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-brand-100 text-brand-700 text-xs font-bold ring-1 ring-brand-200 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 truncate">
                    {item.productCategory
                      ? (allCategories.find((c) => c.value === item.productCategory)?.label || item.productCategory)
                      : "Select product"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors active:scale-[0.97]"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {item.expanded
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {item.expanded && (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                      Product Category
                    </label>
                    <CategoryPicker
                      value={item.productCategory}
                      categories={allCategories}
                      onChange={(value) => {
                        if (value !== item.productCategory) {
                          updateItem(item.id, { productCategory: value as ProductCategory, productDetails: {} });
                        }
                      }}
                      loaded={categoriesLoaded}
                    />
                  </div>

                  {item.productCategory && (() => {
                    const customCat = customCategories.find((c) => c.name === item.productCategory);
                    let customFields: string[] | undefined;
                    if (customCat) { try { customFields = JSON.parse(customCat.fields); } catch {} }
                    return (
                      <ProductForm
                        productCategory={item.productCategory as ProductCategory}
                        productDetails={item.productDetails}
                        onChange={(details) => updateItem(item.id, { productDetails: details })}
                        customFields={customFields}
                      />
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200/70">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                        Rate <span className="text-gray-400 font-normal normal-case">(₹)</span>
                      </label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => updateItem(item.id, { rate: e.target.value })}
                          placeholder="0.00"
                          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                        GST % <span className="text-gray-400 font-normal normal-case">(optional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">%</span>
                        <input
                          type="number"
                          step="0.01"
                          value={item.gst}
                          onChange={(e) => updateItem(item.id, { gst: e.target.value })}
                          placeholder="18"
                          className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-2xl text-sm font-semibold text-gray-500 hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700 transition-all active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>

        {/* ── Submit ─────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-gradient-to-br from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 active:from-brand-700 active:to-brand-800 text-white font-bold rounded-2xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30 active:scale-[0.99]"
        >
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </form>
    </div>
  );
}
