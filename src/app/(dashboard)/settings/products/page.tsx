"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { UserRole } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import { Tag, X, Plus, Trash2, ArrowLeft, Layers, Shield } from "lucide-react";

export default function SettingsProductsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const isAdmin = userRole === "ADMIN";

  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatFields, setNewCatFields] = useState<string[]>(["Type", "Size", "Quantity"]);
  const [showCatForm, setShowCatForm] = useState(false);
  const [addingCat, setAddingCat] = useState(false);
  const [newFieldInput, setNewFieldInput] = useState("");

  useEffect(() => {
    fetch("/api/product-categories")
      .then((r) => r.json())
      .then((d) => setCustomCategories(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) { toast.error("Enter a category name"); return; }
    setAddingCat(true);
    try {
      // The DB schema stores fields as objects { name, type, unit? } so they
      // interoperate with the richer Products admin page and ProductForm.
      const fieldsPayload = newCatFields.map((name) => ({ name, type: "text" }));
      const res = await fetch("/api/product-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim(), fields: fieldsPayload }),
      });
      const data = await res.json();
      if (res.ok) {
        setCustomCategories((prev) => [...prev, data]);
        setNewCatName("");
        setNewCatFields(["Type", "Size", "Quantity"]);
        setShowCatForm(false);
        toast.success(`Category "${data.name}" added`);
      } else {
        toast.error(data.error || "Failed to add category");
      }
    } catch { toast.error("Something went wrong"); }
    finally { setAddingCat(false); }
  };

  const handleToggleCat = async (cat: any) => {
    const res = await fetch("/api/product-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, active: !cat.active }),
    });
    if (res.ok) {
      setCustomCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, active: !c.active } : c));
    }
  };

  const handleDeleteCat = async (cat: any) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    const res = await fetch(`/api/product-categories?id=${cat.id}`, { method: "DELETE" });
    if (res.ok) {
      setCustomCategories((prev) => prev.filter((c) => c.id !== cat.id));
      toast.success("Category deleted");
    }
  };

  if (sessionStatus === "loading") {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-20 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
        <div className="h-64 bg-white rounded-2xl border border-gray-200/80 animate-pulse" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col items-center justify-center text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-base font-semibold text-gray-900">Admin access required</p>
          <p className="text-xs text-gray-500 mt-1">Product management is restricted to administrators.</p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 text-sm font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 ring-1 ring-brand-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24 md:pb-6">
      <Toaster position="top-right" />

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="p-2 -ml-1 hover:bg-gray-100 rounded-xl transition-colors active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-brand-500 flex-shrink-0" />
              Product Categories
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {customCategories.length} custom categor{customCategories.length !== 1 ? "ies" : "y"} · Built-ins always available
            </p>
          </div>
          <button
            onClick={() => setShowCatForm(!showCatForm)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow active:scale-[0.97]"
          >
            {showCatForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Add</>}
          </button>
        </div>
      </div>

      {/* Built-in categories notice */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-8 h-8 rounded-xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center">
            <Tag className="w-4 h-4 text-gray-600" />
          </div>
          <h2 className="text-sm font-bold text-gray-900">Built-in categories</h2>
        </div>
        <p className="text-[11px] text-gray-500 mb-2">Always available — manage their visibility from the Products page.</p>
        <div className="flex flex-wrap gap-1.5">
          {["BOPP Tape", "BOPP Jumbo", "Thermal Paper Roll", "Barcode Label", "Computer Stationery"].map((name) => (
            <span key={name} className="inline-flex items-center gap-1 text-xs bg-gray-50 ring-1 ring-gray-200 text-gray-700 px-2.5 py-1 rounded-lg font-medium">
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Add new category form */}
      {showCatForm && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 ring-1 ring-brand-100 flex items-center justify-center">
              <Plus className="w-4 h-4 text-brand-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">New Custom Category</h2>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">Category Name</label>
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g. Kraft Tape, Foam Tape, Stretch Film"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide font-semibold text-gray-500 mb-1.5">Data Entry Fields</label>
            {newCatFields.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {newCatFields.map((field, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 text-xs bg-brand-50 ring-1 ring-brand-200 text-brand-700 px-2.5 py-1 rounded-lg font-semibold">
                    {field}
                    <button type="button" onClick={() => setNewCatFields((prev) => prev.filter((_, i) => i !== idx))} className="ml-0.5 text-brand-500 hover:text-rose-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newFieldInput}
                onChange={(e) => setNewFieldInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFieldInput.trim()) {
                    e.preventDefault();
                    setNewCatFields((prev) => [...prev, newFieldInput.trim()]);
                    setNewFieldInput("");
                  }
                }}
                placeholder="Add a field (press Enter)"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 placeholder:text-gray-400 transition-all"
              />
              <button
                type="button"
                onClick={() => { if (newFieldInput.trim()) { setNewCatFields((prev) => [...prev, newFieldInput.trim()]); setNewFieldInput(""); } }}
                className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 active:scale-[0.97] transition-all"
              >
                Add
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">These fields appear when adding an order/quotation item of this type.</p>
          </div>
          <button
            onClick={handleAddCategory}
            disabled={addingCat}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow active:scale-[0.97] disabled:opacity-50 transition-all"
          >
            {addingCat ? "Adding..." : <><Plus className="w-4 h-4" /> Add Category</>}
          </button>
        </div>
      )}

      {/* Custom categories list */}
      <div>
        <h2 className="text-[11px] uppercase tracking-wide font-bold text-gray-500 px-1 mb-2">Custom Categories</h2>
        {customCategories.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 ring-1 ring-gray-200 flex items-center justify-center mx-auto mb-3">
              <Tag className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-700">No custom categories yet</p>
            <p className="text-xs text-gray-500 mt-1">Add one above to expand product options.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {customCategories.map((cat) => {
              // `cat.fields` may be an array of strings (legacy) or of objects
              // `{ name, type, unit? }` (current). Normalise to display names.
              let fieldNames: string[] = [];
              try {
                const parsed = JSON.parse(cat.fields);
                if (Array.isArray(parsed)) {
                  fieldNames = parsed.map((f: any) =>
                    typeof f === "string" ? f : (f?.name || "")
                  ).filter(Boolean);
                }
              } catch {}
              return (
                <div key={cat.id} className={`bg-white rounded-2xl border border-gray-200/80 p-4 ${!cat.active ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900">{cat.name}</p>
                        {!cat.active && <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 ring-1 ring-gray-200 text-[10px] font-bold rounded-md">INACTIVE</span>}
                      </div>
                      {fieldNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {fieldNames.map((f, i) => (
                            <span key={i} className="inline-flex items-center text-[10px] bg-gray-50 ring-1 ring-gray-200 text-gray-600 px-1.5 py-0.5 rounded-md font-medium">{f}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1">No fields defined</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleToggleCat(cat)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold ring-1 transition-colors ${
                          cat.active ? "bg-rose-50 text-rose-700 ring-rose-100 hover:bg-rose-100"
                                     : "bg-emerald-50 text-emerald-700 ring-emerald-100 hover:bg-emerald-100"
                        }`}
                      >
                        {cat.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDeleteCat(cat)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
