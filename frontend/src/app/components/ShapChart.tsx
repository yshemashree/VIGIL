"use client";

import { ShapFactor } from "@/lib/api";

interface ShapChartProps {
  factors: ShapFactor[];
}

export function ShapChart({ factors }: ShapChartProps) {
  const maxImpact = Math.max(...factors.map((f) => f.impact), 0.01);

  return (
    <div className="space-y-3">
      {factors.map((factor, i) => {
        const widthPct = (factor.impact / maxImpact) * 100;
        const isUp = factor.direction === "up";

        return (
          <div key={i} className="group">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium truncate max-w-[60%]">
                {factor.feature.replace(/_/g, " ")}
              </span>
              <span className="text-slate-400">
                Val: <span className="text-slate-400 font-mono">{factor.value}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/8 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 group-hover:brightness-110 ${
                    isUp
                      ? "bg-gradient-to-r from-[#ff2a6d] to-[#ff6ac1] shadow-inner"
                      : "bg-gradient-to-r from-[#05ffa1] to-[#00f0ff] shadow-inner"
                  }`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span
                className={`text-xs font-mono w-16 text-right font-medium ${
                  isUp ? "text-[#ff2a6d]" : "text-[#05ffa1]"
                }`}
              >
                {isUp ? "▲" : "▼"} {factor.impact.toFixed(3)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
