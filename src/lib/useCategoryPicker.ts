"use client";

import { useEffect, useState } from "react";
import { PRODUCT_CATEGORIES } from "@/types";
import type { ProductCategory } from "@/types";

export interface PickerCategory {
  value: string;        // either a ProductCategory key or a custom category name
  label: string;        // display label (respects admin overrides)
  builtin: boolean;
  fields?: string[];    // for custom categories
}

interface BuiltinOverride {
  key: string;
  hidden: boolean;
  label: string | null;
}

interface CustomCategoryRow {
  id: string;
  name: string;
  fields: string;
  active: boolean;
}

/**
 * Merges built-in PRODUCT_CATEGORIES with admin overrides (hidden/renamed) and
 * the active custom categories. Anywhere that currently imports PRODUCT_CATEGORIES
 * for a picker can call this hook instead.
 */
export function useCategoryPicker() {
  const [categories, setCategories] = useState<PickerCategory[]>(() =>
    PRODUCT_CATEGORIES.map((c) => ({ value: c.value, label: c.label, builtin: true }))
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/builtin-categories").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/product-categories").then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([overrides, customs]) => {
      if (cancelled) return;
      const overrideMap: Record<string, BuiltinOverride> = {};
      if (Array.isArray(overrides)) for (const o of overrides) overrideMap[o.key] = o;

      const builtins: PickerCategory[] = PRODUCT_CATEGORIES
        .filter((c) => !overrideMap[c.value]?.hidden)
        .map((c) => ({
          value: c.value,
          label: overrideMap[c.value]?.label?.trim() || c.label,
          builtin: true,
        }));

      const customList: PickerCategory[] = Array.isArray(customs)
        ? (customs as CustomCategoryRow[])
            .filter((c) => c.active)
            .map((c) => ({ value: c.name, label: c.name, builtin: false }))
        : [];

      setCategories([...builtins, ...customList]);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  return { categories, loaded };
}

/** Synchronously translate a stored category key/name to a display label using current overrides */
export function categoryLabel(
  value: string,
  overrides: Record<string, BuiltinOverride> | null | undefined,
): string {
  const builtin = PRODUCT_CATEGORIES.find((c) => c.value === (value as ProductCategory));
  if (builtin) return overrides?.[builtin.value]?.label?.trim() || builtin.label;
  return value;
}
