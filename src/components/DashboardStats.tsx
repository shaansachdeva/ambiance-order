"use client";

import {
  Package,
  Factory,
  Truck,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  label: string;
  key: keyof DashboardStatsProps["stats"];
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
}

const STAT_CARDS: StatCard[] = [
  {
    label: "Pending Orders",
    key: "pendingOrders",
    icon: Package,
    iconColor: "text-brand-600",
    bgColor: "bg-brand-50",
  },
  {
    label: "Today's Production",
    key: "todaysProduction",
    icon: Factory,
    iconColor: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    label: "Ready for Dispatch",
    key: "readyForDispatch",
    icon: CheckCircle2,
    iconColor: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    label: "Dispatched",
    key: "dispatched",
    icon: Truck,
    iconColor: "text-gray-600",
    bgColor: "bg-gray-100",
  },
  {
    label: "Raw Material N/A",
    key: "rawMaterialNA",
    icon: AlertTriangle,
    iconColor: "text-red-600",
    bgColor: "bg-red-50",
  },
];

export default function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
      {STAT_CARDS.map((card) => {
        const Icon = card.icon;
        const count = stats[card.key];

        return (
          <div
            key={card.key}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow"
          >
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
            <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}
