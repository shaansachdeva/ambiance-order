"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ProductForm from "@/components/ProductForm";
import type { UserRole, ProductCategory } from "@/types";
import { useCategoryPicker, type PickerCategory } from "@/lib/useCategoryPicker";
import toast, { Toaster } from "react-hot-toast";
import {
  ArrowLeft, Send, Plus, Trash2, ChevronDown, ChevronUp, IndianRupee,
  FileText, Building2, MapPin, UserPlus, Search, Check, X, Package,
  Calendar,
} from "lucide-react";

interface Customer {
  id: string;
  partyName: string;
  location?: string | null;
}

interface CustomCategory {
  id: string;
  name: string;
  fields: string;
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

/**
 * Unified searchable picker — same one used in /orders/new and /leads/new.
 * Picks the canonical category NAME (or built-in key) — never the cuid id.
 */
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

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

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
              <button
                type="button"
                onClick={() => { setSearch(""); setHighlight(0); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
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
                  <button
                    key={c.value}
                    type="button"
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => { onChange(c.value); setOpen(false); setSearch(""); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      idx === highlight ? "bg-brand-50" : "hover:bg-gray-50"
                    }`}
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

export default function NewQuotationPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const { categories: allCategories, loaded: categoriesLoaded } = useCategoryPicker();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerHighlight, setCustomerHighlight] = useState(0);
  const customerBoxRef = useRef<HTMLDivElement>(null);

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

  // Load customers + custom categories + draft
  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => setCustomers(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/product-categories")
      .then((r) => r.json())
      .then((d) => setCustomCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
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

  // Auto-save draft
  useEffect(() => {
    const hasData = customerId || items.some((i) => i.productCategory || i.rate) || remarks || validUntil || termsAndCond;
    if (!hasData) return;
    const draft = { customerId, items, validUntil, remarks, termsAndCond, savedAt: new Date().toISOString() };
    try { localStorage.setItem("quotation_draft", JSON.stringify(draft)); } catch {}
  }, [customerId, items, validUntil, remarks, termsAndCond]);

  // Navigation guard — prompt once when Back is hit with unsaved data, then
  // let further Back presses through. Re-pushing state on every popstate
  // trapped users between pages and made multiple-Back navigation impossible.
  const backIntercepted = useRef(false);
  useEffect(() => {
    const hasData = customerId || items.some((i) => i.productCategory || i.rate) || remarks;
    if (!hasData) { backIntercepted.current = false; return; }
    const handlePopState = () => {
      if (backIntercepted.current) return;
      backIntercepted.current = true;
      window.history.pushState({ __dirtyGuard: true }, "", window.location.href);
      setNavGuardModal(true);
    };
    window.history.pushState({ __dirtyGuard: true }, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [customerId, items, remarks]);

  // Close customer combobox on outside click
  useEffect(() => {
    if (!customerDropdownOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (customerBoxRef.current && !customerBoxRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [customerDropdownOpen]);

  useEffect(() => {
    if (sessionStatus === "authenticated" && !canCreate) router.push("/quotations");
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

      {/* ── Nav Guard Modal ────────────────────────────────────── */}
      {navGuardModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200/60 max-w-sm w-full overflow-hidden">
            <div className="px-5 pt-5 pb-3 bg-gradient-to-r from-amber-50 to-amber-50/40 border-b border-amber-100/70 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 ring-1 ring-amber-200 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-900">Unsaved changes</h3>
                <p className="text-xs text-amber-700/90 mt-0.5">
                  Your form has data that hasn&apos;t been submitted.
                </p>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-2">
              <button
                onClick={() => { setNavGuardModal(false); router.push(pendingNavUrl || "/quotations"); }}
                className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow active:scale-[0.97] transition-all"
              >
                Save draft &amp; leave
              </button>
              <button
                onClick={() => { discardDraft(); setNavGuardModal(false); router.push(pendingNavUrl || "/quotations"); }}
                className="w-full py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] transition-all"
              >
                Discard &amp; leave
              </button>
              <button
                onClick={() => setNavGuardModal(false)}
                className="w-full py-2 text-xs text-gray-500 hover:text-gray-700"
              >
                Stay on page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header card ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleNavAway("/quotations")}
            className="p-2 -ml-1 hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-500 flex-shrink-0" />
              New Quotation
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {items.length} item{items.length !== 1 ? "s" : ""}
              {hasFormData && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-amber-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  draft saved
                </span>
              )}
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

          {!showNewParty ? (() => {
            const selected = customers.find((c) => c.id === customerId);
            const q = customerSearch.trim().toLowerCase();
            const filtered = customers.filter((c) =>
              !q ||
              c.partyName.toLowerCase().includes(q) ||
              (c.location || "").toLowerCase().includes(q)
            );
            const exactMatch = q && customers.some((c) => c.partyName.toLowerCase() === q);
            const showCreateRow = q.length > 0 && !exactMatch;
            const totalRows = filtered.length + (showCreateRow ? 1 : 0);
            return (
              <div ref={customerBoxRef} className="relative">
                {selected && !customerDropdownOpen ? (
                  <button
                    type="button"
                    onClick={() => { setCustomerDropdownOpen(true); setCustomerSearch(""); setCustomerHighlight(0); }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-brand-50 border border-brand-200 ring-1 ring-brand-100 rounded-xl hover:border-brand-300 hover:bg-brand-100/60 transition-all group active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-brand-500 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">
                        {selected.partyName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-gray-900 truncate">{selected.partyName}</p>
                        {selected.location && (
                          <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{selected.location}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setCustomerId(""); setCustomerSearch(""); setCustomerDropdownOpen(true); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setCustomerId(""); setCustomerSearch(""); setCustomerDropdownOpen(true); } }}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg shrink-0 cursor-pointer transition-colors"
                      aria-label="Clear selection"
                    >
                      <X className="w-4 h-4" />
                    </span>
                  </button>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        value={customerSearch}
                        onFocus={() => { setCustomerDropdownOpen(true); setCustomerHighlight(0); }}
                        onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); setCustomerHighlight(0); }}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown") { e.preventDefault(); setCustomerDropdownOpen(true); setCustomerHighlight((h) => Math.min(totalRows - 1, h + 1)); }
                          else if (e.key === "ArrowUp") { e.preventDefault(); setCustomerHighlight((h) => Math.max(0, h - 1)); }
                          else if (e.key === "Enter") {
                            e.preventDefault();
                            if (customerHighlight < filtered.length) {
                              const pick = filtered[customerHighlight];
                              if (pick) { setCustomerId(pick.id); setCustomerDropdownOpen(false); setCustomerSearch(""); }
                            } else if (showCreateRow) {
                              setNewPartyName(customerSearch.trim()); setShowNewParty(true); setCustomerDropdownOpen(false);
                            }
                          } else if (e.key === "Escape") {
                            setCustomerDropdownOpen(false);
                          }
                        }}
                        placeholder={customers.length === 0 ? "No parties yet — type to add new" : "Search or add new party..."}
                        className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
                      />
                      {customerSearch && (
                        <button
                          type="button"
                          onClick={() => { setCustomerSearch(""); setCustomerHighlight(0); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {customerDropdownOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg ring-1 ring-gray-200/40 max-h-72 overflow-y-auto">
                        {filtered.length === 0 && !showCreateRow && (
                          <div className="px-4 py-6 text-center">
                            <div className="w-10 h-10 rounded-xl bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center mx-auto mb-2">
                              <Building2 className="w-5 h-5 text-gray-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-700">
                              {customers.length === 0 ? "No parties yet" : "No matching parties"}
                            </p>
                          </div>
                        )}
                        {filtered.map((c, idx) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseEnter={() => setCustomerHighlight(idx)}
                            onClick={() => { setCustomerId(c.id); setCustomerDropdownOpen(false); setCustomerSearch(""); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                              idx === customerHighlight ? "bg-brand-50" : "hover:bg-gray-50"
                            }`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center text-xs font-bold shrink-0">
                              {c.partyName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{c.partyName}</p>
                              {c.location && (
                                <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />{c.location}
                                </p>
                              )}
                            </div>
                            {c.id === customerId && <Check className="w-4 h-4 text-brand-500 shrink-0" />}
                          </button>
                        ))}
                        {showCreateRow && (
                          <button
                            type="button"
                            onMouseEnter={() => setCustomerHighlight(filtered.length)}
                            onClick={() => { setNewPartyName(customerSearch.trim()); setShowNewParty(true); setCustomerDropdownOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-t border-gray-200/70 transition-colors ${
                              customerHighlight === filtered.length ? "bg-brand-50" : "hover:bg-gray-50"
                            }`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-brand-100 ring-1 ring-brand-200 text-brand-700 flex items-center justify-center shrink-0">
                              <UserPlus className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-brand-700 truncate">Add new: <span className="font-bold">&ldquo;{customerSearch.trim()}&rdquo;</span></p>
                              <p className="text-xs text-gray-500">Create as a new party</p>
                            </div>
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
                {!selected && !customerSearch && !customerDropdownOpen && (
                  <button
                    type="button"
                    onClick={() => setShowNewParty(true)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-800 font-semibold"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add new party
                  </button>
                )}
              </div>
            );
          })() : (
            <div className="space-y-2.5 bg-gradient-to-br from-brand-50 to-brand-50/30 border border-brand-200 ring-1 ring-brand-100 rounded-xl p-3.5">
              <div className="flex items-center gap-2 text-xs text-brand-800 font-semibold mb-0.5">
                <UserPlus className="w-3.5 h-3.5" />
                Add a new party
              </div>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  placeholder="Party name"
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={newPartyLocation}
                  onChange={(e) => setNewPartyLocation(e.target.value)}
                  placeholder="Location (optional)"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowNewParty(false); setNewPartyName(""); setNewPartyLocation(""); }}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] transition-all"
                >
                  Back to list
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustomer}
                  disabled={!newPartyName.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-500 text-white text-sm font-semibold rounded-xl hover:bg-brand-600 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>
          )}
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
              {/* Item header */}
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
                    // Custom categories use NAME as productCategory (consistent with orders/new flow).
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
          {submitting
            ? <><span className="animate-spin border-2 border-white border-t-transparent rounded-full w-4 h-4" /> Creating...</>
            : <><Send className="w-4 h-4" /> Create Quotation</>}
        </button>
      </form>
    </div>
  );
}
