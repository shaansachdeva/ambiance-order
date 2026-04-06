"use client";

import {
  Package,
  Factory,
  Truck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import type { TranslationKey } from "@/lib/translations";

interface DashboardStatsProps {
  stats: {
    pendingOrders: number;
    todaysProduction: number;
    readyForDispatch: number;
    dispatched: number;
    rawMaterialNA: number;
  };
}

interface StatCard {
  labelKey: TranslationKey;
  key: keyof DashboardStatsProps["stats"];
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  href?: string;
}

const STAT_CARDS: StatCard[] = [
  {
    labelKey: "dashboard.pendingOrders",
    key: "pendingOrders",
    icon: Package,
    iconColor: "text-brand-600",
    bgColor: "bg-brand-50",
  },
  {
    labelKey: "dashboard.todaysProduction",
    key: "todaysProduction",
    icon: Factory,
    iconColor: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    labelKey: "dashboard.readyForDispatch",
    key: "readyForDispatch",
    icon: CheckCircle2,
    iconColor: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    labelKey: "dashboard.dispatched",
    key: "dispatched",
    icon: Truck,
    iconColor: "text-gray-600",
    bgColor: "bg-gray-100",
  },
  {
    labelKey: "dashboard.rawMaterialNA",
    key: "rawMaterialNA",
    icon: AlertTriangle,
    iconColor: "text-red-600",
    bgColor: "bg-red-50",
    href: "/orders?status=RAW_MATERIAL_NA",
  },
];

export default function DashboardStats({ stats }: DashboardStatsProps) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
      {STAT_CARDS.map((card) => {
        const Icon = card.icon;
        const count = stats[card.key];

        const CardContent = (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-lg",
                  card.bgColor
                )}
              >
                <Icon className={cn("w-5 h-5", card.iconColor)} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{count}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t(card.labelKey)}</p>
          </>
        );

        if (card.href) {
          return (
            <Link
              href={card.href}
              key={card.key}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm hover:border-brand-300 transition-all cursor-pointer block"
            >
              {CardContent}
            </Link>
          );
        }

        return (
          <div
            key={card.key}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
            {CardContent}
          </div>
        );
      })}
    </div>
  );
}
