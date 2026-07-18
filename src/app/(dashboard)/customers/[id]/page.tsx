"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import OrderCard from "@/components/OrderCard";
import { hasPermission, formatDate, safeParseJSON } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UserRole } from "@/types";
import { ArrowLeft, MapPin, Package, Calendar, Pencil, User, Phone, Briefcase, X } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { data: session, status: sessionStatus } = useSession();
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { t, tProduct } = useLanguage();
  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const customPermissions = (session?.user as any)?.customPermissions ?? null;
  const showParty = hasPermission(userRole, "view_party", customPermissions);
  // Editing party details is limited to the same roles the API allows (ADMIN/ACCOUNTANT).
  const canEdit = ["ADMIN", "ACCOUNTANT"].includes(userRole);

  // Edit-party modal
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    partyName: "", location: "", contactName: "", contactPhone: "", contactPosition: "",
  });

  const openEdit = () => {
    setForm({
      partyName: customer.partyName || "",
      location: customer.location || "",
      contactName: customer.contactName || "",
      contactPhone: customer.contactPhone || "",
      contactPosition: customer.contactPosition || "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!form.partyName.trim()) { toast.error(t("customers.nameRequired")); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const updated = await res.json();
        setCustomer((prev: any) => ({ ...prev, ...updated }));
        setEditing(false);
        toast.success(t("customers.partyUpdated"));
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t("common.error"));
      }
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    Promise.all([
      fetch(`/api/customers/${id}`).then((r) => r.json()),
      fetch(`/api/orders?customerId=${id}`).then((r) => r.json()),
    ])
      .then(([cust, ords]) => {
        setCustomer(cust);
        setOrders(Array.isArray(ords) ? ords : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading || sessionStatus === "loading") {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-32 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!customer || customer.error) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t("customers.notFound")}</p>
        <Link href="/customers" className="text-brand-500 text-sm mt-2 inline-block">
          {t("customers.backToParties")}
        </Link>
      </div>
    );
  }

  // Compute stats
  const totalOrders = orders.length;
  const productCategories = Array.from(new Set(orders.flatMap((o: any) =>
    (o.items || []).map((i: any) => i.productCategory).concat([o.productCategory])
  )));

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Toaster position="top-right" />
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/customers"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-gray-900 truncate">{customer.partyName}</h1>
          {customer.location && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {customer.location}
            </p>
          )}
        </div>
        {canEdit && (
          <button
            onClick={openEdit}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-lg ring-1 ring-gray-200 transition-colors flex-shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t("customers.editParty")}
          </button>
        )}
      </div>

      {/* Contact details */}
      {(customer.contactName || customer.contactPhone || customer.contactPosition) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-500" />
            {t("customers.contactDetails")}
          </h2>
          {customer.contactName && (
            <p className="text-sm text-gray-700 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-gray-400" />
              {customer.contactName}
              {customer.contactPosition && (
                <span className="text-xs text-gray-400">· {customer.contactPosition}</span>
              )}
            </p>
          )}
          {customer.contactPhone && (
            <a href={`tel:${customer.contactPhone}`} className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              {customer.contactPhone}
            </a>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t("customers.totalOrders")}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-gray-900">{productCategories.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t("customers.products")}</p>
        </div>
      </div>

      {/* Frequently ordered products */}
      {productCategories.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-500" />
            {t("customers.productsOrdered")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {productCategories.map((cat) => (
              <span
                key={cat}
                className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-full text-xs font-medium text-gray-700"
              >
                {tProduct(cat)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Order History */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-500" />
          {t("customers.orderHistory")}
        </h2>
        {orders.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
            <p className="text-sm text-gray-500">{t("customers.noOrdersYet")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order: any) => (
              <OrderCard
                key={order.id}
                order={{
                  id: order.id,
                  orderId: order.orderId,
                  productCategory: order.items?.length > 0
                    ? order.items[0].productCategory
                    : order.productCategory,
                  status: order.status,
                  productDetails:
                    order.items?.length > 0
                      ? safeParseJSON(order.items[0].productDetails)
                      : safeParseJSON(order.productDetails),
                  partyName: customer.partyName,
                  createdAt: order.createdAt,
                  deliveryDeadline: order.deliveryDeadline,
                  priority: order.priority,
                  itemCount: order.items?.length || 0,
                }}
                showParty={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit-party modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setEditing(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">{t("customers.editParty")}</h2>
              <button onClick={() => !saving && setEditing(false)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-gray-600">{t("customers.partyNameLabel")}</span>
                <input
                  type="text" value={form.partyName}
                  onChange={(e) => setForm((f) => ({ ...f, partyName: e.target.value }))}
                  className="mt-1 w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 flex items-center gap-1"><MapPin className="w-3 h-3" />{t("customers.location")}</span>
                <input
                  type="text" value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="mt-1 w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-gray-600 flex items-center gap-1"><User className="w-3 h-3" />{t("customers.contactName")}</span>
                <input
                  type="text" value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  className="mt-1 w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600 flex items-center gap-1"><Phone className="w-3 h-3" />{t("customers.contactPhone")}</span>
                  <input
                    type="tel" value={form.contactPhone}
                    onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                    className="mt-1 w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600 flex items-center gap-1"><Briefcase className="w-3 h-3" />{t("customers.contactPosition")}</span>
                  <input
                    type="text" value={form.contactPosition}
                    onChange={(e) => setForm((f) => ({ ...f, contactPosition: e.target.value }))}
                    className="mt-1 w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
              <button onClick={() => setEditing(false)} disabled={saving} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50">
                {t("common.cancel")}
              </button>
              <button onClick={saveEdit} disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-xl transition-colors disabled:opacity-50">
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
