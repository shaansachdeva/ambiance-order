"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default function OrderDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[OrderDetail ErrorBoundary] caught:", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/orders"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-lg font-bold text-gray-900">Order Error</h1>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700">
              Something broke while loading this order
            </p>
            <p className="text-xs text-red-600 mt-1 break-words">
              {error?.message || "Unknown error"}
            </p>
            {error?.digest && (
              <p className="text-[10px] text-red-500 mt-1 font-mono">
                digest: {error.digest}
              </p>
            )}
          </div>
        </div>

        {error?.stack && (
          <details className="text-[11px] text-red-600">
            <summary className="cursor-pointer font-medium">Stack trace</summary>
            <pre className="mt-2 whitespace-pre-wrap bg-white p-2 rounded border border-red-100 overflow-x-auto">
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex gap-2">
          <button
            onClick={reset}
            className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600"
          >
            Try again
          </button>
          <Link
            href="/orders"
            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50"
          >
            Back to orders
          </Link>
        </div>
      </div>
    </div>
  );
}
