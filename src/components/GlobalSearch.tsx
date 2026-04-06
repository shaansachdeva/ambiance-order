"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Package, Users, Loader2 } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { useLanguage } from "@/contexts/LanguageContext";

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ orders: any[]; customers: any[] }>({
    orders: [],
    customers: [],
  });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout>();
  const { t, tProduct } = useLanguage();

  // Keyboard shortcut: Ctrl/Cmd + K
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const doSearch = useCallback((q: string) => {
    if (q.length < 2) {
      setResults({ orders: [], customers: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((res) => res.json())
      .then((data) => {
        setResults({
          orders: data.orders || [],
          customers: data.customers || [],
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const navigate = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const hasResults = results.orders.length > 0 || results.customers.length > 0;

  return (
    <>
      {/* Search trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors w-full"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">{t("search.placeholder")}</span>
        <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-gray-200 text-gray-500 rounded">
          ⌘K
        </kbd>
      </button>

      {/* Search modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[100] bg-gray-900/40 flex items-start justify-center pt-[15vh]">
          <div
            ref={containerRef}
            className="w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={t("search.modalPlaceholder")}
                className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none"
              />
              {loading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
              <button
                onClick={() => { setOpen(false); setQuery(""); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto">
              {query.length < 2 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  {t("search.minChars")}
                </div>
              ) : !loading && !hasResults ? (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  {t("search.noResults")} &quot;{query}&quot;
                </div>
              ) : (
                <>
                  {/* Orders */}
                  {results.orders.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Package className="w-3 h-3" />
                          {t("search.orders")} ({results.orders.length})
                        </span>
                      </div>
                      {results.orders.map((order: any) => (
                        <button
                          key={order.id}
                          onClick={() => navigate(`/orders/${order.id}`)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-semibold text-gray-900">
                                  {order.orderId}
                                </span>
                                <StatusBadge status={order.status} />
                              </div>
                              <p className="text-xs text-gray-500 truncate">
                                {order.customer?.partyName && `${order.customer.partyName} · `}
                                {tProduct(
                                  order.items?.length > 0
                                    ? order.items[0].productCategory
                                    : order.productCategory
                                )}
                                {(order.items?.length || 0) > 1 &&
                                  ` +${order.items.length - 1} ${t("orderCard.more")}`}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Customers */}
                  {results.customers.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3 h-3" />
                          {t("search.parties")} ({results.customers.length})
                        </span>
                      </div>
                      {results.customers.map((customer: any) => (
                        <button
                          key={customer.id}
                          onClick={() => navigate(`/customers/${customer.id}`)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors"
                        >
                          <p className="text-sm font-medium text-gray-900">
                            {customer.partyName}
                          </p>
                          {customer.location && (
                            <p className="text-xs text-gray-400">{customer.location}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">
                {t("search.close")}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
