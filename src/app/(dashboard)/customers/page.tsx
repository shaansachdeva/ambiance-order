"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/utils";
import type { UserRole } from "@/types";
import toast, { Toaster } from "react-hot-toast";
import { Plus, Users, MapPin, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Customer {
  id: string;
  partyName: string;
  location?: string | null;
  createdAt: string;
}

export default function CustomersPage() {
  const { data: session } = useSession();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [adding, setAdding] = useState(false);

  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const canAdd = hasPermission(userRole, "create_order");

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        setCustomers(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partyName: newName.trim(), location: newLocation.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setCustomers((prev) => [...prev, data].sort((a, b) => a.partyName.localeCompare(b.partyName)));
        setNewName("");
        setNewLocation("");
        toast.success(`"${data.partyName}" added`);
      } else {
        toast.error(data.error || "Failed to add");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Toaster position="top-right" />

      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <Users className="w-5 h-5 text-brand-500" />
        Parties / Customers
      </h1>

      {/* Add Customer */}
      {canAdd && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Party name..."
              className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <input
            type="text"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            placeholder="Location (optional)..."
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}

      {/* Customer List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-sm">No parties added yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {customers.map((c, i) => (
            <Link key={c.id} href={`/customers/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-50 text-brand-600 text-xs font-bold flex-shrink-0">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{c.partyName}</p>
                {c.location && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {c.location}
                  </p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Total: {customers.length} parties
      </p>
    </div>
  );
}
