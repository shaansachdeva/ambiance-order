"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import type { UserRole, ProductCategory } from "@/types";
import { hasPermission } from "@/lib/utils";
import { useCategoryPicker, type PickerCategory } from "@/lib/useCategoryPicker";
import toast, { Toaster } from "react-hot-toast";
import { ArrowLeft, Send, Plus, Trash2, ChevronDown, ChevronUp, IndianRupee, ImagePlus, X, Search, Building2, MapPin, UserPlus, Check, Package } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Unified searchable category picker — shows built-in and custom product
 * categories in a single uniform list. Scales when there are many options.
 */
function CategoryPicker({
  value,
  categories,
  onChange,
  loaded,
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
              placeholder={loaded ? (categories.length === 0 ? "No products yet — add one in Products" : "Search products...") : "Loading products..."}
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
                  {loaded && categories.length === 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">Add products in the Products page</p>
                  )}
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

function NewOrderPageContent() {
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
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerHighlight, setCustomerHighlight] = useState(0);
  const customerBoxRef = useRef<HTMLDivElement>(null);
  const [newPartyName, setNewPartyName] = useState(partyParam || "");
  const [newPartyLocation, setNewPartyLocation] = useState("");
  const [newPartyContactName, setNewPartyContactName] = useState("");
  const [newPartyContactPhone, setNewPartyContactPhone] = useState("");
  const [newPartyContactPosition, setNewPartyContactPosition] = useState("");
  const [showNewParty, setShowNewParty] = useState(initialNewPartyState);
  const [items, setItems] = useState<OrderItemData[]>([newItem()]);
  const [deliveryDeadline, setDeliveryDeadline] = useState("");
  const [remarks, setRemarks] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [submitting, setSubmitting] = useState(false);
  const orderSubmittedRef = useRef(false);
  const [leadLoaded, setLeadLoaded] = useState(false);
  const [leadCompany, setLeadCompany] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string; fields: string }[]>([]);
  const { categories: allCategories, loaded: categoriesLoaded } = useCategoryPicker();

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
    if (submitting || leadId || orderSubmittedRef.current) return;
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

  // Keep custom categories around for ProductForm field lookups (separate from picker list)
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

  // Close party dropdown on outside click
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

  // Show the discard toast once when the user hits Back with a dirty form,
  // then let further Back presses through. The previous implementation
  // pushed history state on every popstate, which trapped users in a loop
  // (Back bounced between this page and the next one and never reached the
  // page they actually came from). The single intercept gives them a chance
  // to confirm without taking over the history stack.
  const backIntercepted = useRef(false);
  useEffect(() => {
    if (!isDirty) { backIntercepted.current = false; return; }
    // Push a single sentinel entry; on the first Back we eat it and warn.
    window.history.pushState({ __dirtyGuard: true }, "", window.location.href);
    const handler = () => {
      if (backIntercepted.current) return;       // already prompted — let Back proceed
      backIntercepted.current = true;
      // Re-push so we're still on this page after the popstate has fired.
      window.history.pushState({ __dirtyGuard: true }, "", window.location.href);
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
        body: JSON.stringify({
          partyName: newPartyName.trim(),
          location: newPartyLocation.trim() || null,
          contactName: newPartyContactName.trim() || null,
          contactPhone: newPartyContactPhone.trim() || null,
          contactPosition: newPartyContactPosition.trim() || null,
        }),
      });
      const newCustomer = await res.json();
      if (res.ok) {
        setCustomers((prev) => [...prev, newCustomer]);
        setCustomerId(newCustomer.id);
        setNewPartyName("");
        setNewPartyLocation("");
        setNewPartyContactName("");
        setNewPartyContactPhone("");
        setNewPartyContactPosition("");
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
        orderSubmittedRef.current = true;
        localStorage.removeItem("order_draft");
        const isPending = data.status === "PENDING_CONFIRMATION";
        toast.success(isPending
          ? `Order ${data.orderId} submitted — awaiting admin confirmation`
          : `Order ${data.orderId} created successfully!`
        );
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
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-20 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
        <div className="h-48 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
        <div className="h-64 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24 md:pb-6">
      <Toaster position="top-right" />

      {/* ── Header card ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => isDirty ? showBackConfirm() : router.push("/orders")}
            className="p-2 -ml-1 hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
              {leadId ? t("newOrder.confirmCreate") : t("newOrder.title")}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {items.length} item{items.length !== 1 ? "s" : ""}
              {isDirty && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-amber-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  unsaved
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Draft restore banner ─────────────────────────────── */}
      {draftBanner && !leadId && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-50/40 border border-amber-200 rounded-2xl p-4 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-100 ring-1 ring-amber-200 flex items-center justify-center flex-shrink-0">
              <Send className="w-4 h-4 text-amber-700" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">Unsaved Draft</p>
              <p className="text-xs text-amber-700/90 mt-0.5">
                Saved {draftBanner.savedAt ? new Date(draftBanner.savedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "earlier"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => restoreDraft(draftBanner)}
              className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors active:scale-[0.97]"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors active:scale-[0.97]"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── Lead Conversion Banner ───────────────────────────── */}
      {leadId && (
        <div className="bg-gradient-to-r from-emerald-50 to-emerald-50/40 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 ring-1 ring-emerald-200 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-900">
              Converting lead: <span className="font-bold">{leadCompany || partyParam}</span>
            </p>
            <p className="text-xs text-emerald-700/90 mt-0.5">
              Review the products below, make changes if needed, then create the order.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ── Party Name ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-brand-600" />
            </div>
            <label className="text-sm font-bold text-gray-900">
              {t("newOrder.partyName")}
            </label>
          </div>

          {!showNewParty ? (() => {
            const selected = customers.find(c => c.id === customerId);
            const q = customerSearch.trim().toLowerCase();
            const filtered = customers.filter(c =>
              !q ||
              c.partyName.toLowerCase().includes(q) ||
              (c.location || "").toLowerCase().includes(q)
            );
            const exactMatch = q && customers.some(c => c.partyName.toLowerCase() === q);
            const showCreateRow = q.length > 0 && !exactMatch;
            const totalRows = filtered.length + (showCreateRow ? 1 : 0);
            return (
              <div ref={customerBoxRef} className="relative flex items-stretch gap-2">
                {/* Picker takes the rest of the row; "+" button sits on the side. */}
                <div className="flex-1 min-w-0 relative">
                {selected && !customerDropdownOpen ? (
                  /* Selected chip */
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
                      onClick={(e) => { e.stopPropagation(); setIsDirty(true); setCustomerId(""); setCustomerSearch(""); setCustomerDropdownOpen(true); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setIsDirty(true); setCustomerId(""); setCustomerSearch(""); setCustomerDropdownOpen(true); } }}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-white rounded-lg shrink-0 cursor-pointer transition-colors"
                      aria-label="Clear selection"
                    >
                      <X className="w-4 h-4" />
                    </span>
                  </button>
                ) : (
                  <>
                    {/* Combobox input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        value={customerSearch}
                        onFocus={() => { setCustomerDropdownOpen(true); setCustomerHighlight(0); }}
                        onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); setCustomerHighlight(0); }}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown") { e.preventDefault(); setCustomerDropdownOpen(true); setCustomerHighlight(h => Math.min(totalRows - 1, h + 1)); }
                          else if (e.key === "ArrowUp") { e.preventDefault(); setCustomerHighlight(h => Math.max(0, h - 1)); }
                          else if (e.key === "Enter") {
                            e.preventDefault();
                            if (customerHighlight < filtered.length) {
                              const pick = filtered[customerHighlight];
                              if (pick) { setIsDirty(true); setCustomerId(pick.id); setCustomerDropdownOpen(false); setCustomerSearch(""); }
                            } else if (showCreateRow) {
                              setNewPartyName(customerSearch.trim()); setShowNewParty(true); setCustomerDropdownOpen(false);
                            }
                          } else if (e.key === "Escape") {
                            setCustomerDropdownOpen(false);
                          }
                        }}
                        placeholder={customersLoaded ? (customers.length === 0 ? "No parties yet — type to add new" : "Search or add new party...") : "Loading parties..."}
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

                    {/* Dropdown list */}
                    {customerDropdownOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-lg ring-1 ring-gray-200/40 max-h-72 overflow-y-auto">
                        {filtered.length === 0 && !showCreateRow && (
                          <div className="px-4 py-6 text-center">
                            <div className="w-10 h-10 rounded-xl bg-gray-50 ring-1 ring-gray-100 flex items-center justify-center mx-auto mb-2">
                              <Building2 className="w-5 h-5 text-gray-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-700">
                              {customersLoaded ? (customers.length === 0 ? "No parties yet" : "No matching parties") : "Loading..."}
                            </p>
                            {customersLoaded && customers.length > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5">Type to filter or create new</p>
                            )}
                          </div>
                        )}
                        {filtered.map((c, idx) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseEnter={() => setCustomerHighlight(idx)}
                            onClick={() => { setIsDirty(true); setCustomerId(c.id); setCustomerDropdownOpen(false); setCustomerSearch(""); }}
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
                </div>
                {/* Single "+" button on the side — opens the new-party modal.
                    Replaces the two below-the-box links that used to be there. */}
                <button
                  type="button"
                  onClick={() => setShowNewParty(true)}
                  title={t("newOrder.addNewParty")}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-xl transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("newOrder.addNewParty")}</span>
                </button>
              </div>
            );
          })() : null}
        </div>

        {/* New-party modal — used by the side button AND the in-dropdown
            "Add new: …" row. Keeps the party picker untouched while the user
            fills in details. */}
        {showNewParty && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => {
              setShowNewParty(false);
              setNewPartyName("");
              setNewPartyLocation("");
              setNewPartyContactName("");
              setNewPartyContactPhone("");
              setNewPartyContactPosition("");
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-brand-600" />
                  Add new party
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewParty(false);
                    setNewPartyName("");
                    setNewPartyLocation("");
                    setNewPartyContactName("");
                    setNewPartyContactPhone("");
                    setNewPartyContactPosition("");
                  }}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-2.5">
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={newPartyName}
                    onChange={(e) => setNewPartyName(e.target.value)}
                    placeholder={t("newOrder.enterPartyName")}
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
                    placeholder={t("newOrder.locationOptional")}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                  <input
                    type="text"
                    value={newPartyContactName}
                    onChange={(e) => setNewPartyContactName(e.target.value)}
                    placeholder="Contact person name (optional)"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
                  />
                  <input
                    type="tel"
                    value={newPartyContactPhone}
                    onChange={(e) => setNewPartyContactPhone(e.target.value)}
                    placeholder="Phone number (optional)"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
                  />
                  <input
                    type="text"
                    value={newPartyContactPosition}
                    onChange={(e) => setNewPartyContactPosition(e.target.value)}
                    placeholder="Position / role (optional)"
                    className="sm:col-span-2 w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white placeholder:text-gray-400 transition-all"
                  />
                </div>
              </div>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewParty(false);
                    setNewPartyName("");
                    setNewPartyLocation("");
                    setNewPartyContactName("");
                    setNewPartyContactPhone("");
                    setNewPartyContactPosition("");
                  }}
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustomer}
                  disabled={!newPartyName.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  {t("newOrder.add")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Order Items ────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
                <Plus className="w-4 h-4 text-brand-600" />
              </div>
              <label className="text-sm font-bold text-gray-900">
                {t("newOrder.orderItems")}
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
                      : t("newOrder.selectProduct")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors active:scale-[0.97]"
                      aria-label="Remove item"
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
                  {/* Unified category picker (built-ins + customs as one list) */}
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                      {t("newOrder.productCategory")}
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
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200/70">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                        {t("newOrder.rate")} <span className="text-gray-400 font-normal normal-case">{t("newOrder.optional")}</span>
                      </label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateItem(item.id, { rate: e.target.value })}
                          placeholder="0"
                          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                        GST % <span className="text-gray-400 font-normal normal-case">{t("newOrder.optional")}</span>
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
                          className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Image Upload */}
                  <div className="pt-2 border-t border-gray-200/70">
                    <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                      {t("newOrder.designImage")} <span className="text-gray-400 font-normal normal-case">{t("newOrder.optional")}</span>
                    </label>
                    {item.imagePreview ? (
                      <div className="relative inline-block">
                        <img
                          src={item.imagePreview}
                          alt="Preview"
                          className="w-32 h-32 object-cover rounded-xl ring-1 ring-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, { image: null, imagePreview: "" })}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600 transition-colors shadow-sm active:scale-95"
                          aria-label="Remove image"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700 cursor-pointer transition-all">
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
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-2xl text-sm font-semibold text-gray-500 hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700 transition-all active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            {t("newOrder.addAnother")}
          </button>
        </div>

        {/* ── Additional Info ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
              <Send className="w-4 h-4 text-gray-600" />
            </div>
            <label className="text-sm font-bold text-gray-900">
              Additional Info
            </label>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">Priority</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPriority("NORMAL")}
                className={`flex-1 px-3 py-2.5 text-sm rounded-xl border font-semibold transition-all active:scale-[0.97] ${
                  priority === "NORMAL"
                    ? "border-brand-300 bg-brand-50 text-brand-700 ring-1 ring-brand-200 shadow-sm"
                    : "border-gray-200 text-gray-600 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setPriority("URGENT")}
                className={`flex-1 px-3 py-2.5 text-sm rounded-xl border font-semibold transition-all active:scale-[0.97] ${
                  priority === "URGENT"
                    ? "border-rose-300 bg-rose-50 text-rose-700 ring-1 ring-rose-200 shadow-sm"
                    : "border-gray-200 text-gray-600 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                Urgent
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
              Delivery Deadline <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="date"
              value={deliveryDeadline}
              onChange={(e) => setDeliveryDeadline(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
              Remarks <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              value={remarks}
              onChange={(e) => { setIsDirty(true); setRemarks(e.target.value); }}
              rows={3}
              placeholder="Any special instructions..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 resize-none transition-all"
            />
          </div>
        </div>

        {/* ── Submit ─────────────────────────────────────────── */}
        <button
          type="submit"
          disabled={submitting || !customerId || !items[0]?.productCategory}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 bg-gradient-to-br from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 active:from-brand-700 active:to-brand-800 text-white font-bold rounded-2xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/20 hover:shadow-xl hover:shadow-brand-500/30 active:scale-[0.99]"
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

export default function NewOrderPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    }>
      <NewOrderPageContent />
    </Suspense>
  );
}
