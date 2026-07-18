"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { ORDER_STATUSES } from "@/types";
import type { UserRole, ProductCategory, OrderStatus } from "@/types";
import { hasPermission } from "@/lib/utils";
import { useCategoryPicker, type PickerCategory } from "@/lib/useCategoryPicker";
import toast, { Toaster } from "react-hot-toast";
import { ArrowLeft, Save, Plus, Trash2, ChevronDown, ChevronUp, IndianRupee, Loader2, Search, X, Package, Check } from "lucide-react";

/**
 * Searchable product picker — identical UX to the one on /orders/new.
 * Lives inline to avoid coupling the two pages; if it grows further it should
 * be lifted into a shared component.
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
import Link from "next/link";
import { format } from "date-fns";

interface Customer {
  id: string;
  partyName: string;
  location?: string | null;
}

interface OrderItemData {
  id: string; // client-side key
  dbId?: string; // database item id
  productCategory: ProductCategory | "";
  productDetails: Record<string, string>;
  rate: string;
  gst: string;
  expanded: boolean;
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
  };
}

export default function EditOrderPage() {
  const { id } = useParams() as { id: string };
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyLocation, setNewPartyLocation] = useState("");
  const [newPartyContactName, setNewPartyContactName] = useState("");
  const [newPartyContactPhone, setNewPartyContactPhone] = useState("");
  const [newPartyContactPosition, setNewPartyContactPosition] = useState("");
  const [showNewParty, setShowNewParty] = useState(false);
  const [items, setItems] = useState<OrderItemData[]>([]);
  const [deliveryDeadline, setDeliveryDeadline] = useState("");
  const [remarks, setRemarks] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [status, setStatus] = useState<OrderStatus>("ORDER_PLACED");
  const [submitting, setSubmitting] = useState(false);
  // Merged list of built-in + custom + admin-renamed categories. Without this
  // the edit view fell back to the static PRODUCT_CATEGORIES constant, so any
  // category added via /products never appeared and saved orders that referenced
  // those custom names showed a blank "Select product..." header.
  const { categories: allCategories, loaded: categoriesLoaded } = useCategoryPicker();
  const [customCategories, setCustomCategories] = useState<{ id: string; name: string; fields: string }[]>([]);

  useEffect(() => {
    fetch("/api/product-categories")
      .then((r) => r.json())
      .then((d) => setCustomCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const canEdit = userRole === "ADMIN" || userRole === "ACCOUNTANT" || userRole === "SALES";

  useEffect(() => {
    if (sessionStatus === "authenticated" && !canEdit) {
      toast.error("You don't have permission to edit orders.");
      router.push(`/orders/${id}`);
    }
  }, [sessionStatus, canEdit, router, id]);

  useEffect(() => {
    Promise.all([
      fetch("/api/customers").then((res) => res.json()),
      fetch(`/api/orders/${id}`).then((res) => res.json())
    ]).then(([dCustomers, dOrder]) => {
      setCustomers(Array.isArray(dCustomers) ? dCustomers : []);
      
      if (!dOrder || dOrder.error) {
        toast.error("Order not found or access denied.");
        router.push("/orders");
        return;
      }

      setCustomerId(dOrder.customerId);
      setRemarks(dOrder.remarks || "");
      setPriority(dOrder.priority || "NORMAL");
      setStatus(dOrder.status || "ORDER_PLACED");
      if (dOrder.deliveryDeadline) {
        setDeliveryDeadline(format(new Date(dOrder.deliveryDeadline), "yyyy-MM-dd"));
      }
      
      if (dOrder.items && dOrder.items.length > 0) {
        setItems(dOrder.items.map((i: any) => {
          let details = {};
          try {
            details = typeof i.productDetails === "string" ? JSON.parse(i.productDetails) : i.productDetails;
          } catch(e){}
          
          return {
            id: `item-${++itemCounter}`,
            dbId: i.id,
            productCategory: i.productCategory,
            productDetails: details,
            rate: i.rate ? String(i.rate) : "",
            gst: i.gst ? String(i.gst) : "",
            expanded: false
          };
        }));
      } else {
        // legacy single-item order mapping
        let details = {};
        try {
          details = typeof dOrder.productDetails === "string" ? JSON.parse(dOrder.productDetails) : dOrder.productDetails;
        } catch(e){}
        setItems([{
          id: `item-${++itemCounter}`,
          productCategory: dOrder.productCategory,
          productDetails: details,
          rate: "",
          gst: "",
          expanded: false
        }]);
      }
      setLoading(false);
    }).catch(() => {
      toast.error("Failed to load data.");
      setLoading(false);
    });
  }, [id]);

  const updateItem = (id: string, updates: Partial<OrderItemData>) => {
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

    for (let i = 0; i < items.length; i++) {
      if (!items[i].productCategory) {
        toast.error(`Please select a product category for Item ${i + 1}`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          items: items.map((item) => ({
            dbId: item.dbId,
            productCategory: item.productCategory,
            productDetails: item.productDetails,
            rate: item.rate ? parseFloat(item.rate) : null,
            gst: item.gst ? parseFloat(item.gst) : null,
          })),
          deliveryDeadline: deliveryDeadline || null,
          remarks: remarks || null,
          priority,
          status,
          // Need to push at least the first item to root to satisfy backwards-compatibility
          productCategory: items[0].productCategory,
          productDetails: items[0].productDetails,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Order updated successfully!`);
        setTimeout(() => router.push(`/orders/${id}`), 500);
      } else {
        toast.error((data.detail ? `${data.error}: ${data.detail}` : data.error) || "Failed to update order");
      }
    } catch (err: any) {
      toast.error(`Something went wrong: ${err?.message || String(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (sessionStatus === "loading" || loading) {
    return <div className="flex justify-center items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {/* router.back() — Link would push and bounce between detail and edit. */}
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) router.back();
            else router.push(`/orders/${id}`);
          }}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Edit Order</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            1. Party Name
          </label>

          {/* Party picker + side "+" button. Previously clicking "Add new party"
              replaced the whole picker with an inline panel ("bar on top"),
              which hid the party list and confused users. Now the picker stays
              visible and the new-party form opens in a modal triggered by an
              icon button beside the dropdown. */}
          <div className="flex items-stretch gap-2">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">Select party...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.partyName}{c.location ? ` — ${c.location}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewParty(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg transition-colors"
              title="Add a new party"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New party</span>
            </button>
          </div>
        </div>

        {/* New-party modal — opens from the "+" side button. */}
        {showNewParty && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setShowNewParty(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Add new party</h3>
                <button
                  type="button"
                  onClick={() => setShowNewParty(false)}
                  className="p-1 text-gray-400 hover:text-gray-700 rounded"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                <input
                  type="text"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  placeholder="Party name (required)"
                  autoFocus
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  type="text"
                  value={newPartyLocation}
                  onChange={(e) => setNewPartyLocation(e.target.value)}
                  placeholder="Location (optional)"
                  className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                  <input
                    type="text"
                    value={newPartyContactName}
                    onChange={(e) => setNewPartyContactName(e.target.value)}
                    placeholder="Contact name"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <input
                    type="tel"
                    value={newPartyContactPhone}
                    onChange={(e) => setNewPartyContactPhone(e.target.value)}
                    placeholder="Phone number"
                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <input
                    type="text"
                    value={newPartyContactPosition}
                    onChange={(e) => setNewPartyContactPosition(e.target.value)}
                    placeholder="Position / role"
                    className="sm:col-span-2 w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewParty(false)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCustomer}
                  disabled={!newPartyName.trim()}
                  className="px-4 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add party
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-900">
              2. Order Items ({items.length})
            </label>
          </div>

          {items.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                      ? (allCategories.find((c) => c.value === item.productCategory)?.label || item.productCategory)
                      : "Select product..."}
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

              {item.expanded && (
                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">
                      Product Category
                    </label>
                    <CategoryPicker
                      value={item.productCategory}
                      categories={allCategories}
                      loaded={categoriesLoaded}
                      onChange={(value) => {
                        if (value !== item.productCategory) {
                          updateItem(item.id, { productCategory: value as ProductCategory, productDetails: {} });
                        }
                      }}
                    />
                  </div>

                  {item.productCategory && (() => {
                    // Custom categories carry their own field list (saved as JSON in /products);
                    // pass them through so the form renders the same inputs as on the New Order page.
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

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Rate <span className="text-gray-400 font-normal">(optional)</span>
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
                        GST % <span className="text-gray-400 font-normal">(optional)</span>
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
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Another Item
          </button>
        </div>

        {/* Priority & Delivery & Remarks */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <label className="block text-sm font-semibold text-gray-900">
            3. Additional Info
          </label>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as OrderStatus)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white mb-4"
            >
              {ORDER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

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
              onChange={(e) => setRemarks(e.target.value)}
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
              <Loader2 className="animate-spin h-4 w-4" />
              Saving Order...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </form>
    </div>
  );
}
