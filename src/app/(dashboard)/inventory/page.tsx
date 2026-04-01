"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { UserRole } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import {
  Package,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const MATERIAL_CATEGORIES = [
  { value: "BOPP_FILM", label: "BOPP Film" },
  { value: "ADHESIVE", label: "Adhesive" },
  { value: "CORE", label: "Core" },
  { value: "THERMAL_PAPER", label: "Thermal Paper" },
  { value: "LABEL_STOCK", label: "Label Stock" },
  { value: "INK", label: "Ink" },
  { value: "OTHER", label: "Other" },
];

const UNITS = ["kg", "rolls", "pieces", "meters", "liters", "boxes"];

export default function InventoryPage() {
  const { data: session } = useSession();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add material form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newMinStock, setNewMinStock] = useState("");
  const [adding, setAdding] = useState(false);

  // Stock update
  const [stockUpdateId, setStockUpdateId] = useState<string | null>(null);
  const [stockType, setStockType] = useState<"IN" | "OUT">("IN");
  const [stockQty, setStockQty] = useState("");
  const [stockNotes, setStockNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  // Expand material for logs
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const canManage = ["ADMIN", "PRODUCTION"].includes(userRole);

  const fetchMaterials = () => {
    fetch("/api/inventory")
      .then((r) => r.json())
      .then((data) => {
        setMaterials(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleAddMaterial = async () => {
    if (!newName.trim() || !newCategory || !newUnit) {
      toast.error("Name, category, and unit are required");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          category: newCategory,
          unit: newUnit,
          currentStock: parseFloat(newStock) || 0,
          minStock: parseFloat(newMinStock) || 0,
        }),
      });
      if (res.ok) {
        toast.success("Material added");
        setNewName("");
        setNewCategory("");
        setNewUnit("");
        setNewStock("");
        setNewMinStock("");
        setShowAddForm(false);
        fetchMaterials();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAdding(false);
    }
  };

  const handleStockUpdate = async () => {
    if (!stockUpdateId || !stockQty) return;
    setUpdating(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: stockUpdateId,
          type: stockType,
          quantity: parseFloat(stockQty),
          notes: stockNotes || null,
        }),
      });
      if (res.ok) {
        toast.success(`Stock ${stockType === "IN" ? "added" : "removed"}`);
        setStockUpdateId(null);
        setStockQty("");
        setStockNotes("");
        fetchMaterials();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setUpdating(false);
    }
  };

  const lowStockMaterials = materials.filter(
    (m) => m.minStock > 0 && m.currentStock <= m.minStock
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Toaster position="top-right" />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Package className="w-5 h-5 text-brand-500" />
          Inventory
        </h1>
        {canManage && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Material
          </button>
        )}
      </div>

      {/* Low stock alerts */}
      {lowStockMaterials.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" />
            Low Stock Alert ({lowStockMaterials.length})
          </h2>
          <div className="space-y-1">
            {lowStockMaterials.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-red-700 font-medium">{m.name}</span>
                <span className="text-red-600">
                  {m.currentStock} {m.unit} (min: {m.minStock})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Material Form */}
      {showAddForm && canManage && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">New Material</h2>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Material name..."
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Category...</option>
              {MATERIAL_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <select
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Unit...</option>
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              placeholder="Current stock"
              className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="number"
              value={newMinStock}
              onChange={(e) => setNewMinStock(e.target.value)}
              placeholder="Min stock (alert)"
              className="px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddMaterial}
              disabled={adding}
              className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add"}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Materials List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-sm">No materials added yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map((mat) => {
            const isLow = mat.minStock > 0 && mat.currentStock <= mat.minStock;
            const isExpanded = expandedId === mat.id;
            const catLabel = MATERIAL_CATEGORIES.find((c) => c.value === mat.category)?.label || mat.category;

            return (
              <div key={mat.id} className={`bg-white rounded-xl border ${isLow ? "border-red-300 bg-red-50/30" : "border-gray-200"}`}>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{mat.name}</p>
                        {isLow && (
                          <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                            LOW
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{catLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${isLow ? "text-red-600" : "text-gray-900"}`}>
                        {mat.currentStock}
                      </p>
                      <p className="text-xs text-gray-500">{mat.unit}</p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {canManage && (
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => {
                          setStockUpdateId(mat.id);
                          setStockType("IN");
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100"
                      >
                        <ArrowUpCircle className="w-3.5 h-3.5" />
                        Stock In
                      </button>
                      <button
                        onClick={() => {
                          setStockUpdateId(mat.id);
                          setStockType("OUT");
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 text-orange-700 text-xs font-medium rounded-lg hover:bg-orange-100"
                      >
                        <ArrowDownCircle className="w-3.5 h-3.5" />
                        Stock Out
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : mat.id)}
                        className="ml-auto p-1.5 text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  )}

                  {/* Stock update form (inline) */}
                  {stockUpdateId === mat.id && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
                      <p className="text-xs font-semibold text-gray-700">
                        {stockType === "IN" ? "Add Stock" : "Remove Stock"}
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={stockQty}
                          onChange={(e) => setStockQty(e.target.value)}
                          placeholder={`Quantity (${mat.unit})`}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <input
                          type="text"
                          value={stockNotes}
                          onChange={(e) => setStockNotes(e.target.value)}
                          placeholder="Notes (optional)"
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleStockUpdate}
                          disabled={updating || !stockQty}
                          className={`px-3 py-1.5 text-white text-xs font-medium rounded-lg disabled:opacity-50 ${
                            stockType === "IN" ? "bg-green-500 hover:bg-green-600" : "bg-orange-500 hover:bg-orange-600"
                          }`}
                        >
                          {updating ? "Updating..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => { setStockUpdateId(null); setStockQty(""); setStockNotes(""); }}
                          className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded-lg hover:bg-white"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Recent logs */}
                {isExpanded && mat.logs?.length > 0 && (
                  <div className="border-t border-gray-100 px-4 py-3">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Recent Activity</p>
                    <div className="space-y-1.5">
                      {mat.logs.map((log: any) => (
                        <div key={log.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {log.type === "IN" ? (
                              <ArrowUpCircle className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <ArrowDownCircle className="w-3.5 h-3.5 text-orange-500" />
                            )}
                            <span className={log.type === "IN" ? "text-green-700" : "text-orange-700"}>
                              {log.type === "IN" ? "+" : "-"}{log.quantity} {mat.unit}
                            </span>
                            {log.notes && <span className="text-gray-400">— {log.notes}</span>}
                          </div>
                          <span className="text-gray-400">
                            {log.user?.name} · {new Date(log.createdAt).toLocaleDateString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
