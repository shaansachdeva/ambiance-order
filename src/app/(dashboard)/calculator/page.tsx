"use client";

import { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Calculator, RefreshCw } from "lucide-react";
import type { UserRole } from "@/types";

const WIDTH_OPTIONS: { label: string; key: string; constant: string; pcs: number }[] = [
  { key: "0.5",  label: '0.5"',  constant: "0.0144", pcs: 288 },
  { key: "0.75", label: '3/4"',  constant: "0.0144", pcs: 216 },
  { key: "1",    label: '1"',    constant: "0.0144", pcs: 144 },
  { key: "2",    label: '2"',    constant: "0.0144", pcs: 72  },
  { key: "2.5",  label: '2.5"',  constant: "0.015",  pcs: 60  },
  { key: "3",    label: '3"',    constant: "0.0144", pcs: 48  },
];

// Micron reference table: physical micron → formula value
const MICRON_TABLE = [
  { micron: 34, value: 8    },
  { micron: 36, value: 8.5  },
  { micron: 38, value: 9    },
  { micron: 40, value: 9.5  },
  { micron: 42, value: 10   },
  { micron: 44, value: 10.5 },
  { micron: 46, value: 11   },
  { micron: 48, value: 11.5 },
  { micron: 50, value: 12   },
];

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Numeric input that stores a raw string so backspace works properly
function NumInput({
  label, value, onChange, hint, readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          if (e.target.value === "" || e.target.value === "-") onChange("0");
        }}
        className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 ${
          readOnly ? "bg-gray-50 border-gray-200 text-gray-500 cursor-default" : "bg-white border-gray-300"
        }`}
      />
      {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function ResultRow({ label, value, highlight = false, sub = false }: {
  label: string; value: string; highlight?: boolean; sub?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-b-0 ${
      highlight ? "bg-brand-50 border-l-4 border-brand-400" : sub ? "bg-gray-50" : "bg-white"
    }`}>
      <span className={`text-sm ${highlight ? "font-bold text-brand-800" : sub ? "text-gray-500" : "text-gray-700"}`}>
        {label}
      </span>
      <span className={`font-semibold tabular-nums ${highlight ? "text-brand-700 text-base" : "text-sm text-gray-900"}`}>
        ₹{value}
      </span>
    </div>
  );
}

const D = {
  width: "2", constant: "0.0144", micron: "9.5",
  pricePerKg: "210", customization: "0",
  length: "100", productionCost: "400", freight: "0",
  gst: "18", cashPercent: "9", pcs: 72,
};

export default function CalculatorPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const userRole = ((session?.user as any)?.role || "") as UserRole;

  const [width,          setWidth]          = useState(D.width);
  const [constant,       setConstant]       = useState(D.constant);
  const [micron,         setMicron]         = useState(D.micron);
  const [pricePerKg,     setPricePerKg]     = useState(D.pricePerKg);
  const [customization,  setCustomization]  = useState(D.customization);
  const [length,         setLength]         = useState(D.length);
  const [productionCost, setProductionCost] = useState(D.productionCost);
  const [freight,        setFreight]        = useState(D.freight);
  const [gst,            setGst]            = useState(D.gst);
  const [cashPercent,    setCashPercent]    = useState(D.cashPercent);
  const [pcs,            setPcs]            = useState(D.pcs);

  const handleWidthChange = (key: string) => {
    const cfg = WIDTH_OPTIONS.find((w) => w.key === key);
    if (!cfg) return;
    setWidth(key);
    setConstant(cfg.constant);
    setPcs(cfg.pcs);
  };

  const n = (s: string) => parseFloat(s) || 0;

  const results = useMemo(() => {
    const c   = n(constant);
    const m   = n(micron);
    const pkg = n(pricePerKg);
    const cus = n(customization);
    const len = n(length);
    const pro = n(productionCost);
    const fr  = n(freight);
    const g   = n(gst);
    const cp  = n(cashPercent);

    const priceExcl = c * m * (pkg + cus) * len + pro + fr;
    const priceIncl = priceExcl * (1 + g / 100);
    const rollExcl  = pcs > 0 ? priceExcl / pcs : 0;
    const rollIncl  = rollExcl * (1 + g / 100);
    const halfExcl  = priceExcl / 2;
    const halfIncl  = halfExcl * (1 + g / 100);
    const cashFull  = priceExcl * (1 + cp / 100);
    const cashHalf  = halfExcl  * (1 + cp / 100);
    return { priceExcl, priceIncl, rollExcl, rollIncl, halfExcl, halfIncl, cashFull, cashHalf };
  }, [constant, micron, pricePerKg, customization, length, productionCost, freight, gst, cashPercent, pcs]);

  const reset = () => {
    setWidth(D.width); setConstant(D.constant); setMicron(D.micron);
    setPricePerKg(D.pricePerKg); setCustomization(D.customization);
    setLength(D.length); setProductionCost(D.productionCost); setFreight(D.freight);
    setGst(D.gst); setCashPercent(D.cashPercent); setPcs(D.pcs);
  };

  if (session && userRole !== "ADMIN") {
    router.replace("/");
    return null;
  }

  return (
    <div className="calc-page max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-brand-500" />
          BOPP Tape Box Price Calculator
        </h1>
        <button onClick={reset}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── INPUTS ── */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Inputs</p>

          {/* Width — auto-sets constant & pcs */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Width</label>
            <select value={width} onChange={(e) => handleWidthChange(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
              {WIDTH_OPTIONS.map((w) => (
                <option key={w.key} value={w.key}>{w.label} — {w.pcs} pcs/box</option>
              ))}
            </select>
          </div>

          {/* Constant — editable, auto-filled by width */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Constant
              <span className="ml-1 text-[10px] text-gray-400 font-normal">(auto from width, editable)</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={constant}
              onChange={(e) => setConstant(e.target.value)}
              onBlur={(e) => { if (!e.target.value) setConstant("0"); }}
              className="w-full px-3 py-2.5 text-sm border border-brand-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-brand-50"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">0.0144 for most sizes · 0.015 for 2.5&quot;</p>
          </div>

          {/* Micron — free text */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Micron Value
              <span className="ml-1 text-[10px] text-gray-400 font-normal">(see reference table →)</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={micron}
              onChange={(e) => setMicron(e.target.value)}
              onBlur={(e) => { if (e.target.value === "" || e.target.value === "-") setMicron("0"); }}
              className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            />
          </div>

          <NumInput label="Price per Kg (₹)"    value={pricePerKg}     onChange={setPricePerKg}     hint="Base raw material price"    />
          <NumInput label="Customization (₹/kg)" value={customization}  onChange={setCustomization}  hint="Extra cost added to base"   />
          <NumInput label="Length (m)"            value={length}         onChange={setLength}         hint="Tape length per roll"       />
          <NumInput label="Production Cost (₹)"  value={productionCost} onChange={setProductionCost} hint="Overheads + profit per box" />
          <NumInput label="Freight (₹)"           value={freight}        onChange={setFreight}        hint="Freight per box"            />
          <NumInput label="GST %"                 value={gst}            onChange={setGst}            />
          <NumInput label="Cash Discount %"       value={cashPercent}    onChange={setCashPercent}    hint="On top of excl. GST price"  />

          {/* Pcs (read-only, driven by width) */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Pcs per Box</label>
            <input readOnly value={pcs}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-default" />
            <p className="text-[10px] text-gray-400 mt-0.5">Set automatically by width</p>
          </div>
        </div>

        {/* ── RESULTS ── */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Constant</span><span className="font-semibold text-gray-700">{constant}</span>
            </div>
            <div className="flex justify-between">
              <span>Micron value</span><span className="font-semibold text-gray-700">{micron}</span>
            </div>
            <div className="flex justify-between">
              <span>Pcs / Box</span><span className="font-semibold text-gray-700">{pcs}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 bg-brand-500 text-white text-xs font-bold uppercase tracking-wide">
              Full Box ({pcs} rolls)
            </div>
            <ResultRow label="Price (Excl. GST)"           value={fmt(results.priceExcl)} highlight />
            <ResultRow label={`Price (Incl. ${gst}% GST)`} value={fmt(results.priceIncl)} highlight />
            <ResultRow label={`Cash Price (+${cashPercent}%)`} value={fmt(results.cashFull)} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 bg-gray-700 text-white text-xs font-bold uppercase tracking-wide">
              Half Box ({Math.floor(pcs / 2)} rolls)
            </div>
            <ResultRow label="Price (Excl. GST)"           value={fmt(results.halfExcl)} highlight />
            <ResultRow label={`Price (Incl. ${gst}% GST)`} value={fmt(results.halfIncl)} highlight />
            <ResultRow label={`Cash Price (+${cashPercent}%)`} value={fmt(results.cashHalf)} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold uppercase tracking-wide">
              Per Roll
            </div>
            <ResultRow label="Price/Roll (Excl. GST)" value={fmt(results.rollExcl)} sub />
            <ResultRow label="Price/Roll (Incl. GST)" value={fmt(results.rollIncl)} sub />
          </div>
        </div>

        {/* ── MICRON REFERENCE TABLE ── */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 overflow-hidden self-start">
          <div className="px-4 py-2.5 bg-gray-800 text-white text-xs font-bold uppercase tracking-wide">
            Micron Reference Table
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Physical (μm)</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Formula Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MICRON_TABLE.map((row) => {
                const active = parseFloat(micron) === row.value;
                return (
                  <tr
                    key={row.value}
                    onClick={() => setMicron(String(row.value))}
                    className={`cursor-pointer transition-colors ${active ? "bg-brand-50" : "hover:bg-gray-50"}`}
                  >
                    <td className={`px-4 py-2.5 font-medium ${active ? "text-brand-700" : "text-gray-700"}`}>
                      {row.micron} μm
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${active ? "text-brand-600" : "text-gray-900"}`}>
                      {row.value}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-2 text-[10px] text-gray-400 border-t border-gray-100">
            Click any row to fill the micron value, or type directly in the input.
          </p>
        </div>

      </div>
    </div>
  );
}
