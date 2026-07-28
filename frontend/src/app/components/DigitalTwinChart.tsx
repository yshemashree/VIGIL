"use client";

import { useTheme } from "@/lib/theme";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface TimelineStep {
  time_minutes: number;
  vitals: Record<string, number>;
  risk_score: number;
  risk_level: string;
}

interface DigitalTwinChartProps {
  timeline: TimelineStep[];
  escalationPoint: number | null;
}

export function DigitalTwinChart({
  timeline,
  escalationPoint,
}: DigitalTwinChartProps) {
  const { isDark } = useTheme();
  const axisColor = isDark ? "#64748b" : "#475569";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";

  const data = timeline.map((step) => ({
    time: `${step.time_minutes}m`,
    minutes: step.time_minutes,
    "Heart Rate": Math.round(step.vitals.heart_rate),
    "BP Systolic": Math.round(step.vitals.bp_systolic),
    SpO2: Math.round(step.vitals.spo2 * 10) / 10,
    "Risk Score": Math.round(step.risk_score * 100),
  }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="time"
            stroke={axisColor}
            fontSize={11}
            tickLine={false}
          />
          <YAxis stroke={axisColor} fontSize={11} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(12px)",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
              borderRadius: "12px",
              fontSize: "12px",
              boxShadow: isDark ? "0 8px 32px -8px rgba(0,0,0,0.5)" : "0 8px 30px -8px rgba(0,0,0,0.1)",
              color: isDark ? "#e2e8f0" : "#1e293b",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: isDark ? "#94a3b8" : "#64748b" }}
          />
          {escalationPoint !== null && (
            <ReferenceLine
              x={`${escalationPoint}m`}
              stroke="#ff2a6d"
              strokeDasharray="4 4"
              label={{
                value: "Escalation",
                position: "top",
                fill: "#ff2a6d",
                fontSize: 11,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="Heart Rate"
            stroke="#ff6ac1"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="BP Systolic"
            stroke="#00f0ff"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="SpO2"
            stroke="#05ffa1"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="Risk Score"
            stroke="#ff2a6d"
            strokeWidth={2.5}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
