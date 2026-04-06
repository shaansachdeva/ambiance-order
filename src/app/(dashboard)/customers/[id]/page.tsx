"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import OrderCard from "@/components/OrderCard";
import { hasPermission, formatDate } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { UserRole } from "@/types";
import { ArrowLeft, MapPin, Package, Calendar } from "lucide-react";
import Link from "next/link";

export default function CustomerDetailPage() {
  const { id } = useParams();
  const { data: session } = useSession();
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { t, tProduct } = useLanguage();
  const userRole = ((session?.user as any)?.role || "SALES") as UserRole;
  const showParty = hasPermission(userRole, "view_party");

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

  if (loading) {
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/customers"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">{customer.partyName}</h1>
          {customer.location && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {customer.location}
            </p>
          )}
        </div>
      </div>

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
                      ? (typeof order.items[0].productDetails === "string"
                          ? JSON.parse(order.items[0].productDetails)
                          : order.items[0].productDetails)
                      : (typeof order.productDetails === "string"
                          ? JSON.parse(order.productDetails)
                          : order.productDetails),
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
    </div>
  );
}
