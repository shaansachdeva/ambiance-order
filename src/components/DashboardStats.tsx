"use client";

import {
  Package,
  Factory,
  Truck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Cog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import type { TranslationKey } from "@/lib/translations";

interface DashboardStatsProps {
  stats: {
    pendingOrders: number;
    inProduction: number;
    todaysProduction: number;
    readyForDispatch: number;
    dispatched: number;
    rawMaterialNA: number;
  };
}

type Tone = "sky" | "amber" | "brand" | "slate" | "rose" | "violet";

interface StatCard {
  labelKey: TranslationKey;
  key: keyof DashboardStatsProps["stats"];
  icon: React.ElementType;
  tone: Tone;
  href?: string;
  pulseWhenNonZero?: boolean;
}

const TONE: Record<Tone, {
  iconBg: string;
  iconRing: string;
  iconColor: string;
  cornerBg: string;
  cornerHover: string;
  arrow: string;
  borderHover: string;
}> = {
  sky: {
    iconBg: "bg-sky-50",
    iconRing: "ring-sky-100",
    iconColor: "text-sky-600",
    cornerBg: "bg-sky-50/70",
    cornerHover: "group-hover:bg-sky-100",
    arrow: "text-sky-500",
    borderHover: "group-hover:border-sky-200",
  },
  amber: {
    iconBg: "bg-amber-50",
    iconRing: "ring-amber-100",
    iconColor: "text-amber-600",
    cornerBg: "bg-amber-50/70",
    cornerHover: "group-hover:bg-amber-100",
    arrow: "text-amber-500",
    borderHover: "group-hover:border-amber-200",
  },
  brand: {
    iconBg: "bg-brand-50",
    iconRing: "ring-brand-100",
    iconColor: "text-brand-600",
    cornerBg: "bg-brand-50/70",
    cornerHover: "group-hover:bg-brand-100",
    arrow: "text-brand-500",
    borderHover: "group-hover:border-brand-200",
  },
  slate: {
    iconBg: "bg-slate-100",
    iconRing: "ring-slate-200",
    iconColor: "text-slate-600",
    cornerBg: "bg-slate-50",
    cornerHover: "group-hover:bg-slate-100",
    arrow: "text-slate-500",
    borderHover: "group-hover:border-slate-300",
  },
  rose: {
    iconBg: "bg-rose-50",
    iconRing: "ring-rose-100",
    iconColor: "text-rose-600",
    cornerBg: "bg-rose-50/70",
    cornerHover: "group-hover:bg-rose-100",
    arrow: "text-rose-500",
    borderHover: "group-hover:border-rose-200",
  },
  violet: {
    iconBg: "bg-violet-50",
    iconRing: "ring-violet-100",
    iconColor: "text-violet-600",
    cornerBg: "bg-violet-50/70",
    cornerHover: "group-hover:bg-violet-100",
    arrow: "text-violet-500",
    borderHover: "group-hover:border-violet-200",
  },
};

const STAT_CARDS: StatCard[] = [
  {
    labelKey: "dashboard.pendingOrders",
    key: "pendingOrders",
    icon: Package,
    tone: "sky",
    href: "/orders?status=not_dispatched",
  },
  {
    labelKey: "dashboard.inProduction",
    key: "inProduction",
    icon: Cog,
    tone: "violet",
    href: "/orders?status=IN_PRODUCTION",
  },
  {
    labelKey: "dashboard.todaysProduction",
    key: "todaysProduction",
    icon: Factory,
    tone: "amber",
    href: "/production-report",
  },
  {
    labelKey: "dashboard.readyForDispatch",
    key: "readyForDispatch",
    icon: CheckCircle2,
    tone: "brand",
    href: "/orders?status=READY_FOR_DISPATCH",
  },
  {
    labelKey: "dashboard.dispatched",
    key: "dispatched",
    icon: Truck,
    tone: "slate",
    href: "/orders?status=DISPATCHED",
  },
  {
    labelKey: "dashboard.rawMaterialNA",
    key: "rawMaterialNA",
    icon: AlertTriangle,
    tone: "rose",
    href: "/orders?status=RAW_MATERIAL_NA",
    pulseWhenNonZero: true,
  },
];

export default function DashboardStats({ stats }: DashboardStatsProps) {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
      {STAT_CARDS.map((card) => {
        const Icon = card.icon;
        const count = stats[card.key];
        const tone = TONE[card.tone];
        const showPulse = card.pulseWhenNonZero && count > 0;

        const CardContent = (
          <>
            {/* decorative corner blur */}
            <div
              className={cn(
                "pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full blur-xl transition-colors",
                tone.cornerBg,
                tone.cornerHover
              )}
            />

            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div
                  className={cn(
                    "relative w-10 h-10 rounded-xl ring-1 flex items-center justify-center",
                    tone.iconBg,
                    tone.iconRing
                  )}
                >
                  <Icon className={cn("w-5 h-5", tone.iconColor)} />
                  {showPulse && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                    </span>
                  )}
                </div>
                {card.href && (
                  <ArrowUpRight
                    className={cn(
                      "w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all",
                      tone.arrow
                    )}
                  />
                )}
              </div>

              <p className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight leading-none">
                {count.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-2 font-medium">
                {t(card.labelKey)}
              </p>
            </div>
          </>
        );

        const baseCls = cn(
          "group relative overflow-hidden bg-white rounded-2xl border border-gray-200/80 p-4 md:p-5 transition-all duration-200",
          card.href
            ? cn(
                "cursor-pointer hover:shadow-md hover:-translate-y-0.5",
                tone.borderHover
              )
            : ""
        );

        if (card.href) {
          return (
            <Link href={card.href} key={card.key} className={baseCls}>
              {CardContent}
            </Link>
          );
        }

        return (
          <div key={card.key} className={baseCls}>
            {CardContent}
          </div>
        );
      })}
    </div>
  );
}
