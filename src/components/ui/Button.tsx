"use client";

import Link from "next/link";
import { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md" | "lg";

const VARIANT_CLS: Record<Variant, string> = {
  primary:
    "bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-sm hover:shadow",
  secondary:
    "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300",
  ghost: "text-gray-600 hover:bg-gray-100/70 hover:text-gray-900",
  danger:
    "bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white shadow-sm hover:shadow",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100 ring-1 ring-brand-100",
};

const SIZE_CLS: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2 gap-2",
  lg: "text-sm px-5 py-2.5 gap-2",
};

const BASE =
  "inline-flex items-center justify-center font-semibold rounded-xl transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
}

type ButtonAsButton = CommonProps &
  Omit<ComponentProps<"button">, keyof CommonProps> & { href?: never };

type ButtonAsLink = CommonProps &
  Omit<ComponentProps<typeof Link>, keyof CommonProps | "href"> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export default function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    fullWidth,
    loading,
    className,
    children,
    ...rest
  } = props as CommonProps & Record<string, any>;
  const cls = cn(
    BASE,
    VARIANT_CLS[variant],
    SIZE_CLS[size],
    fullWidth && "w-full",
    className
  );

  const inner = (
    <>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </>
  );

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={cls} {...(rest as any)}>
        {inner}
      </Link>
    );
  }
  return (
    <button className={cls} disabled={loading || (rest as any).disabled} {...(rest as any)}>
      {inner}
    </button>
  );
}
