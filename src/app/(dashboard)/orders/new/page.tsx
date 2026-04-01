"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ProductForm from "@/components/ProductForm";
import { PRODUCT_CATEGORIES } from "@/types";
import type { UserRole, ProductCategory } from "@/types";
import { hasPermission } from "@/lib/utils";
import toast, { Toaster } from "react-hot-toast";
import { ArrowLeft, Send, Plus, Trash2, ChevronDown, ChevronUp, IndianRupee } from "lucide-react";
import Link from "next/link";

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
  amount: string;
  expanded: boolean;
}

let itemCounter = 0;
function newItem(): OrderItemData {
  return {
    id: `item-${++itemCounter}`,
    productCategory: "",
    productDetails: {},
    rate: "",
    amount: "",
    expanded: true,
  };
}

export default function NewOrderPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyLocation, setNewPartyLocation] = useState("");
  const [showNewParty, setShowNewParty] = useState(false);
  const [items, setItems] = useState<OrderItemData[]>([newItem()]);
  const [deliveryDeadline, setDeliveryDeadline] = useState("");
  const [remarks, setRemarks] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [submitting, setSubmitting] = useState(false);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const canCreate = hasPermission(userRole, "create_order");

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (sessionStatus === "authenticated" && !canCreate) {
      router.push("/");
    }
  }, [sessionStatus, canCreate, router]);

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

  const orderTotal = items.reduce((sum, item) => {
    const amt = parseFloat(item.amount) || 0;
    return sum + amt;
  }, 0);

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
            amount: item.amount ? parseFloat(item.amount) : null,
          })),
          deliveryDeadline: deliveryDeadline || null,
          remarks: remarks || null,
          priority,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Order ${data.orderId} created successfully!`);
        setTimeout(() => router.push("/orders"), 500);
      } else {
        toast.error(data.error || "Failed to create order");
      }
    } catch {
      toast.error("Something went wrong");
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
        <Link
          href="/orders"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">New Order</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Party Name */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-sm font-semibold text-gray-900 mb-3">
            1. Party Name
          </label>

          {!showNewParty ? (
            <div className="space-y-2">
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
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
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                + Add new party
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={newPartyName}
                onChange={(e) => setNewPartyName(e.target.value)}
                placeholder="Enter party name..."
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPartyLocation}
                  onChange={(e) => setNewPartyLocation(e.target.value)}
                  placeholder="Location (optional)..."
                  className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={handleCreateCustomer}
                  className="px-4 py-2.5 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600 transition-colors"
                >
                  Add
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowNewParty(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Back to list
              </button>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-gray-900">
              2. Order Items ({items.length})
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
                      ? PRODUCT_CATEGORIES.find((c) => c.value === item.productCategory)?.label
                      : "Select product..."}
                  </span>
                  {item.amount && (
                    <span className="text-xs text-gray-500 ml-2">
                      Rs. {parseFloat(item.amount).toLocaleString("en-IN")}
                    </span>
                  )}
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
                      Product Category
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
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Product details form */}
                  {item.productCategory && (
                    <ProductForm
                      productCategory={item.productCategory as ProductCategory}
                      productDetails={item.productDetails}
                      onChange={(details) => updateItem(item.id, { productDetails: details })}
                    />
                  )}

                  {/* Rate & Amount */}
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
                        Amount <span className="text-gray-400 font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => updateItem(item.id, { amount: e.target.value })}
                          placeholder="0"
                          className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
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
            Add Another Item
          </button>

          {/* Order Total */}
          {orderTotal > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-brand-50 rounded-xl border border-brand-200">
              <span className="text-sm font-semibold text-brand-800">Order Total</span>
              <span className="text-lg font-bold text-brand-700">
                Rs. {orderTotal.toLocaleString("en-IN")}
              </span>
            </div>
          )}
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
