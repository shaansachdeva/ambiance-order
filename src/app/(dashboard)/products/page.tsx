"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { Layers, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";

// Built-in categories with their field definitions
const BUILTIN_CATEGORIES = [
  {
    name: "BOPP Tape",
    key: "BOPP_TAPE",
    fields: ["Type", "Size (inches)", "Size (mm)", "Micron", "Length (m)", "Core", "Boxes", "Jumbo Code"],
  },
  {
    name: "BOPP Jumbo",
    key: "BOPP_JUMBO",
    fields: ["Type", "Size (mm)", "Micron", "Weight", "Meter/Roll", "Quantity"],
  },
  {
    name: "Thermal Paper Roll",
    key: "THERMAL_ROLL",
    fields: ["Type", "Size", "Meter", "GSM", "Boxes"],
  },
  {
    name: "Barcode Label",
    key: "BARCODE_LABEL",
    fields: ["Type", "Sticker", "Size", "Sticker/Roll", "Quantity"],
  },
  {
    name: "Computer Stationery",
    key: "COMPUTER_STATIONERY",
    fields: ["Type", "Size", "GSM", "Part", "No. of Packets"],
  },
];

import type { CustomField } from "@/lib/customFields";
import { parseField, QTY_UNIT_PRESETS } from "@/lib/customFields";

interface CustomCategory {
  id: string;
  name: string;
  fields: string; // JSON string of (string | CustomField)[]
  active: boolean;
  createdAt: string;
}

interface BuiltinOverride {
  key: string;
  hidden: boolean;
  label: string | null;
}

export default function ProductsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role;

  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [expandedBuiltin, setExpandedBuiltin] = useState<string | null>(null);
  const [expandedCustom, setExpandedCustom] = useState<string | null>(null);
  const [builtinOverrides, setBuiltinOverrides] = useState<Record<string, BuiltinOverride>>({});
  const [editingBuiltinLabel, setEditingBuiltinLabel] = useState<string | null>(null);
  const [builtinLabelDraft, setBuiltinLabelDraft] = useState("");

  // New category form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFields, setNewFields] = useState<CustomField[]>([
    { name: "", type: "text" }, { name: "", type: "text" }, { name: "", type: "text" }
  ]);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<CustomField[]>([]);

  useEffect(() => {
    if (sessionStatus === "authenticated" && userRole !== "ADMIN") {
      router.push("/");
    }
  }, [sessionStatus, userRole, router]);

  useEffect(() => {
    fetch("/api/product-categories")
      .then((r) => r.json())
      .then((d) => { setCategories(Array.isArray(d) ? d : []); setLoadingCats(false); })
      .catch(() => setLoadingCats(false));
    fetch("/api/builtin-categories")
      .then((r) => r.json())
      .then((d) => {
        if (!Array.isArray(d)) return;
        const map: Record<string, BuiltinOverride> = {};
        for (const o of d) map[o.key] = o;
        setBuiltinOverrides(map);
      })
      .catch(() => {});
  }, []);

  const patchBuiltin = async (key: string, patch: Partial<BuiltinOverride>) => {
    const res = await fetch("/api/builtin-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, ...patch }),
    });
    if (res.ok) {
      const saved: BuiltinOverride = await res.json();
      setBuiltinOverrides((prev) => ({ ...prev, [key]: saved }));
      return true;
    }
    toast.error("Failed to update");
    return false;
  };

  const toggleBuiltinHidden = async (key: string) => {
    const current = builtinOverrides[key];
    const next = !(current?.hidden ?? false);
    const ok = await patchBuiltin(key, { hidden: next });
    if (ok) toast.success(next ? "Hidden from order picker" : "Restored in order picker");
  };

  const saveBuiltinLabel = async (key: string) => {
    const label = builtinLabelDraft.trim();
    const ok = await patchBuiltin(key, { label: label || null });
    if (ok) {
      toast.success(label ? "Label updated" : "Label reset to default");
      setEditingBuiltinLabel(null);
    }
  };

  const parsedFields = (cat: CustomCategory): CustomField[] => {
    try {
      const raw = JSON.parse(cat.fields) || [];
      return raw.map(parseField);
    } catch { return []; }
  };

  const handleAdd = async () => {
    const name = newName.trim();
    const fields = newFields.filter((f) => f.name.trim()).map((f) => ({
      ...f,
      name: f.name.trim(),
      ...(f.type !== "formula" && { formula: undefined }),
      ...(f.type !== "quantity" && { unit: undefined }),
      ...(f.type === "quantity" && { unit: (f.unit || "").trim() || "Pcs" }),
    }));
    if (!name) { toast.error("Category name is required"); return; }
    if (fields.length === 0) { toast.error("Add at least one field"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/product-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, fields }),
      });
      const data = await res.json();
      if (res.ok) {
        setCategories((prev) => [...prev, data]);
        setNewName(""); setNewFields([{ name: "", type: "text" }, { name: "", type: "text" }, { name: "", type: "text" }]); setShowForm(false);
        toast.success(`"${name}" added`);
      } else {
        toast.error(data.error || "Failed to add");
      }
    } catch { toast.error("Something went wrong"); }
    finally { setSaving(false); }
  };

  const handleToggle = async (cat: CustomCategory) => {
    const res = await fetch("/api/product-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, active: !cat.active }),
    });
    if (res.ok) {
      setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, active: !c.active } : c));
      toast.success(cat.active ? "Category deactivated" : "Category activated");
    } else { toast.error("Failed to update"); }
  };

  const handleDelete = async (cat: CustomCategory) => {
    if (!confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/product-categories?id=${cat.id}`, { method: "DELETE" });
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      toast.success("Category deleted");
    } else { toast.error("Failed to delete"); }
  };

  const startEdit = (cat: CustomCategory) => {
    setEditingId(cat.id);
    setEditFields(parsedFields(cat));
  };

  const saveEdit = async (cat: CustomCategory) => {
    const fields = editFields.filter((f) => f.name.trim()).map((f) => ({
      ...f,
      name: f.name.trim(),
      ...(f.type !== "formula" && { formula: undefined }),
      ...(f.type !== "quantity" && { unit: undefined }),
      ...(f.type === "quantity" && { unit: (f.unit || "").trim() || "Pcs" }),
    }));
    if (fields.length === 0) { toast.error("Add at least one field"); return; }
    const res = await fetch("/api/product-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, fields }),
    });
    if (res.ok) {
      setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, fields: JSON.stringify(fields) } : c));
      setEditingId(null);
      toast.success("Fields updated");
    } else { toast.error("Failed to update"); }
  };

  if (sessionStatus === "loading") {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />)}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-500" />
            Product Categories
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all product types and their data fields</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Add Category Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-brand-200 p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">New Product Category</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Kraft Tape, Foam Tape"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Data Fields <span className="text-gray-400 font-normal">(fields users fill in for this product)</span>
            </label>
            <div className="bg-gray-50 rounded-lg p-2 mb-2">
              <p className="text-[11px] text-gray-500">
                <strong>Text</strong> · plain input &nbsp;|&nbsp; <strong>Number</strong> · numeric &nbsp;|&nbsp;
                <strong>Qty</strong> · number + unit (Box / Roll / Pcs…) &nbsp;|&nbsp;
                <strong>Formula</strong> · auto-calculated (<code className="bg-gray-200 px-1 rounded text-[10px]">{"{sizeInches}"} * 25.4</code>)
              </p>
            </div>
            <div className="space-y-2">
              {newFields.map((f, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={f.name}
                      onChange={(e) => setNewFields((prev) => prev.map((v, j) => j === i ? { ...v, name: e.target.value } : v))}
                      placeholder={`Field ${i + 1} name (e.g. Size, Color)`}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <select
                      value={f.type}
                      onChange={(e) => setNewFields((prev) => prev.map((v, j) => j === i ? { ...v, type: e.target.value as CustomField["type"] } : v))}
                      className="px-2 py-2 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="quantity">Qty</option>
                      <option value="formula">Formula</option>
                    </select>
                    <button type="button" onClick={() => setNewFields((prev) => prev.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {f.type === "formula" && (
                    <input
                      type="text"
                      value={f.formula || ""}
                      onChange={(e) => setNewFields((prev) => prev.map((v, j) => j === i ? { ...v, formula: e.target.value } : v))}
                      placeholder={`Formula, e.g. {sizeInches} * 25.4`}
                      className="w-full px-3 py-1.5 text-xs border border-brand-300 bg-brand-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  )}
                  {f.type === "quantity" && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        list={`qty-units-new-${i}`}
                        value={f.unit || ""}
                        onChange={(e) => setNewFields((prev) => prev.map((v, j) => j === i ? { ...v, unit: e.target.value } : v))}
                        placeholder="Unit (Box, Roll, Pcs, Kg…)"
                        className="flex-1 px-3 py-1.5 text-xs border border-brand-300 bg-brand-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <datalist id={`qty-units-new-${i}`}>
                        {QTY_UNIT_PRESETS.map((u) => <option key={u} value={u} />)}
                      </datalist>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setNewFields((prev) => [...prev, { name: "", type: "text" }])}
              className="mt-2 text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add another field
            </button>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg disabled:opacity-50">
              {saving ? "Saving…" : "Save Category"}
            </button>
            <button onClick={() => { setShowForm(false); setNewName(""); setNewFields([{ name: "", type: "text" }, { name: "", type: "text" }, { name: "", type: "text" }]); }} className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Built-in Categories */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Built-in Categories (5)</h2>
        <div className="space-y-2">
          {BUILTIN_CATEGORIES.map((cat) => {
            const override = builtinOverrides[cat.key];
            const hidden = !!override?.hidden;
            const displayLabel = override?.label?.trim() || cat.name;
            const isRenaming = editingBuiltinLabel === cat.key;
            return (
              <div key={cat.key} className={`bg-white rounded-xl border overflow-hidden ${hidden ? "border-gray-100 opacity-60" : "border-gray-200"}`}>
                <div className="flex items-center justify-between px-4 py-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedBuiltin(expandedBuiltin === cat.key ? null : cat.key)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${hidden ? "bg-gray-300" : "bg-green-400"}`} />
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500 uppercase tracking-wide shrink-0">built-in</span>
                    <span className="text-sm font-semibold text-gray-900 truncate">{displayLabel}</span>
                    {override?.label && (
                      <span className="text-[10px] text-gray-400 italic shrink-0">was: {cat.name}</span>
                    )}
                    <span className="text-xs text-gray-400 shrink-0">{cat.fields.length} fields</span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingBuiltinLabel(cat.key); setBuiltinLabelDraft(displayLabel); }}
                      className="p-1.5 text-gray-400 hover:text-brand-500 rounded-lg hover:bg-brand-50"
                      title="Rename"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => toggleBuiltinHidden(cat.key)}
                      className={`p-1.5 rounded-lg ${hidden ? "text-gray-400 hover:bg-gray-50" : "text-green-500 hover:bg-green-50"}`}
                      title={hidden ? "Show in order picker" : "Hide from order picker"}
                    >
                      {hidden ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
                    </button>
                    {expandedBuiltin === cat.key ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>
                {isRenaming && (
                  <div className="px-4 pb-3 border-t border-gray-100 pt-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={builtinLabelDraft}
                      onChange={(e) => setBuiltinLabelDraft(e.target.value)}
                      placeholder={cat.name}
                      autoFocus
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      onClick={() => saveBuiltinLabel(cat.key)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-brand-500 text-white text-xs font-medium rounded-lg hover:bg-brand-600"
                    >
                      <Check className="w-3.5 h-3.5" /> Save
                    </button>
                    {override?.label && (
                      <button
                        onClick={() => { setBuiltinLabelDraft(""); saveBuiltinLabel(cat.key); }}
                        className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={() => setEditingBuiltinLabel(null)}
                      className="p-1.5 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {expandedBuiltin === cat.key && !isRenaming && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <div className="flex flex-wrap gap-2">
                      {cat.fields.map((f) => (
                        <span key={f} className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs rounded-lg font-medium border border-brand-100">{f}</span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      Field structure is fixed for built-ins (they have specialized inputs in the order form). You can rename the display label or hide this category from the picker.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Categories */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Custom Categories ({categories.length})
        </h2>
        {loadingCats ? (
          <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-dashed border-gray-300">
            <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No custom categories yet.</p>
            <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium">
              + Add your first category
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => {
              const fields = parsedFields(cat);
              const isExpanded = expandedCustom === cat.id;
              const isEditing = editingId === cat.id;
              return (
                <div key={cat.id} className={`bg-white rounded-xl border overflow-hidden ${cat.active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandedCustom(isExpanded ? null : cat.id)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <span className={`inline-block w-2 h-2 rounded-full ${cat.active ? "bg-green-400" : "bg-gray-300"}`} />
                      <span className="text-sm font-semibold text-gray-900">{cat.name}</span>
                      <span className="text-xs text-gray-400">{fields.length} field{fields.length !== 1 ? "s" : ""}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(cat)} className="p-1.5 text-gray-400 hover:text-brand-500 rounded-lg hover:bg-brand-50" title="Edit fields">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleToggle(cat)} className={`p-1.5 rounded-lg ${cat.active ? "text-green-500 hover:bg-green-50" : "text-gray-400 hover:bg-gray-50"}`} title={cat.active ? "Deactivate" : "Activate"}>
                        {cat.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleDelete(cat)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {(isExpanded || isEditing) && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-600 mb-2">Edit fields:</p>
                          {editFields.map((f, i) => (
                            <div key={i} className="space-y-1">
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={f.name}
                                  onChange={(e) => setEditFields((prev) => prev.map((v, j) => j === i ? { ...v, name: e.target.value } : v))}
                                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                                <select
                                  value={f.type}
                                  onChange={(e) => setEditFields((prev) => prev.map((v, j) => j === i ? { ...v, type: e.target.value as CustomField["type"] } : v))}
                                  className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none"
                                >
                                  <option value="text">Text</option>
                                  <option value="number">Number</option>
                                  <option value="quantity">Qty</option>
                                  <option value="formula">Formula</option>
                                </select>
                                <button type="button" onClick={() => setEditFields((prev) => prev.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 hover:text-red-500">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              {f.type === "formula" && (
                                <input
                                  type="text"
                                  value={f.formula || ""}
                                  onChange={(e) => setEditFields((prev) => prev.map((v, j) => j === i ? { ...v, formula: e.target.value } : v))}
                                  placeholder={`Formula, e.g. {sizeInches} * 25.4`}
                                  className="w-full px-3 py-1 text-xs border border-brand-300 bg-brand-50 rounded-lg focus:outline-none"
                                />
                              )}
                              {f.type === "quantity" && (
                                <>
                                  <input
                                    type="text"
                                    list={`qty-units-edit-${cat.id}-${i}`}
                                    value={f.unit || ""}
                                    onChange={(e) => setEditFields((prev) => prev.map((v, j) => j === i ? { ...v, unit: e.target.value } : v))}
                                    placeholder="Unit (Box, Roll, Pcs, Kg…)"
                                    className="w-full px-3 py-1 text-xs border border-brand-300 bg-brand-50 rounded-lg focus:outline-none"
                                  />
                                  <datalist id={`qty-units-edit-${cat.id}-${i}`}>
                                    {QTY_UNIT_PRESETS.map((u) => <option key={u} value={u} />)}
                                  </datalist>
                                </>
                              )}
                            </div>
                          ))}
                          <button type="button" onClick={() => setEditFields((prev) => [...prev, { name: "", type: "text" }])} className="text-xs text-brand-600 font-medium flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Add field
                          </button>
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => saveEdit(cat)} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white text-xs font-medium rounded-lg hover:bg-brand-600">
                              <Check className="w-3.5 h-3.5" /> Save
                            </button>
                            <button onClick={() => setEditingId(null)} className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-gray-50">
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {fields.map((f) => (
                            <span key={f.name} className={`px-2.5 py-1 text-xs rounded-lg font-medium border ${
                              f.type === "formula"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : f.type === "number"
                                ? "bg-blue-50 text-blue-700 border-blue-100"
                                : f.type === "quantity"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-purple-50 text-purple-700 border-purple-100"
                            }`}>
                              {f.name}
                              {f.type === "formula" && <span className="ml-1 opacity-60 text-[10px]">= {f.formula}</span>}
                              {f.type === "number" && <span className="ml-1 opacity-50">#</span>}
                              {f.type === "quantity" && f.unit && <span className="ml-1 opacity-70 text-[10px]">({f.unit})</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
