"use client";

interface RiskBadgeProps {
  level: string;
  size?: "sm" | "md" | "lg";
}

const config: Record<string, { bg: string; text: string; ring: string; dot: string; glow: string }> = {
  High: {
    bg: "bg-gradient-to-r from-red-50 to-rose-50",
    text: "text-red-700",
    ring: "ring-red-200",
    dot: "bg-red-500",
    glow: "animate-glow-pulse",
  },
  Medium: {
    bg: "bg-gradient-to-r from-amber-50 to-orange-50",
    text: "text-amber-700",
    ring: "ring-amber-200",
    dot: "bg-amber-500",
    glow: "",
  },
  Low: {
    bg: "bg-gradient-to-r from-emerald-50 to-green-50",
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    dot: "bg-emerald-500",
    glow: "",
  },
};

const sizes = {
  sm: "px-2.5 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-4 py-1.5 text-base",
};

export function RiskBadge({ level, size = "md" }: RiskBadgeProps) {
  const c = config[level] || config.Low;
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full ring-1 ${c.bg} ${c.text} ${c.ring} ${sizes[size]} ${c.glow} transition-all`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${c.dot} ${
          level === "High" ? "animate-pulse" : ""
        }`}
      />
      {level} Risk
    </span>
  );
}
