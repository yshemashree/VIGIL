"use client";

import { useEffect, useState } from "react";
import { getModelFairness, FairnessResult } from "@/lib/api";
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Users,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

/* ── Neon palette ── */
const NEON = {
  magenta: "#f72585",
  deepPurple: "#7209b7",
  electricBlue: "#4361ee",
  skyBlue: "#4cc9f0",
  mint: "#06d6a0",
  gold: "#ffd166",
  coral: "#ef476f",
  aqua: "#00f5d4",
  lime: "#b5e48c",
  lavender: "#c77dff",
};

function getTooltipStyle(isDark: boolean) {
  return {
    backgroundColor: isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.95)",
    backdropFilter: "blur(12px)",
    border: `1px solid ${isDark ? "rgba(99,102,241,0.25)" : "#e2e8f0"}`,
    borderRadius: "12px",
    fontSize: "12px",
    boxShadow: isDark
      ? "0 8px 32px -8px rgba(0,0,0,0.5)"
      : "0 8px 32px -8px rgba(0,0,0,0.12)",
    padding: "8px 12px",
    color: isDark ? "#e2e8f0" : "#1e293b",
  };
}

export default function FairnessPage() {
  const { t } = useI18n();
  const { isDark } = useTheme();
  const [data, setData] = useState<FairnessResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const axisColor = isDark ? "#64748b" : "#94a3b8";
  const gridColor = isDark ? "rgba(148,163,184,0.12)" : "#e2e8f0";
  const legendColor = isDark ? "#94a3b8" : "#64748b";

  const load = () => {
    setLoading(true);
    setError(null);
    getModelFairness()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full" />
          <Scale className="w-5 h-5 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto mt-10 glass-card rounded-2xl p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-slate-300 font-medium">{error}</p>
        <button onClick={load} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  /* ── Chart data ── */
  const genderAccData = data.gender_analysis.map((g) => ({
    group: g.group,
    Accuracy: +(g.accuracy * 100).toFixed(1),
    "High Risk Rate": +(g.high_risk_rate * 100).toFixed(1),
  }));

  const ageAccData = data.age_analysis.map((g) => {
    const total = (g.risk_distribution.Low || 0) + (g.risk_distribution.Medium || 0) + (g.risk_distribution.High || 0);
    return {
      group: g.group,
      Accuracy: +(g.accuracy * 100).toFixed(1),
      "High Risk %": +(g.high_risk_rate * 100).toFixed(1),
      "Low %": total > 0 ? +((g.risk_distribution.Low || 0) / total * 100).toFixed(1) : 0,
      "Med %": total > 0 ? +((g.risk_distribution.Medium || 0) / total * 100).toFixed(1) : 0,
      Samples: total,
    };
  });

  // Gender risk distribution for radar view
  const genderRadarData = ["Low", "Medium", "High"].map((level) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry: any = { risk: level };
    data.gender_analysis.forEach((g) => {
      const total = (g.risk_distribution.Low || 0) + (g.risk_distribution.Medium || 0) + (g.risk_distribution.High || 0);
      entry[g.group] = total > 0 ? +((g.risk_distribution[level] || 0) / total * 100).toFixed(1) : 0;
    });
    return entry;
  });

  // Age group risk profile (percentage-based)
  const ageRiskProfile = data.age_analysis.map((g) => {
    const total = (g.risk_distribution.Low || 0) + (g.risk_distribution.Medium || 0) + (g.risk_distribution.High || 0);
    return {
      group: g.group,
      "Low %": total > 0 ? +((g.risk_distribution.Low || 0) / total * 100).toFixed(1) : 0,
      "Medium %": total > 0 ? +((g.risk_distribution.Medium || 0) / total * 100).toFixed(1) : 0,
      "High %": total > 0 ? +((g.risk_distribution.High || 0) / total * 100).toFixed(1) : 0,
      samples: total,
    };
  });

  // Radar chart data for fairness metrics
  const genderDI = data.disparate_impact?.gender;
  const genderDP = data.demographic_parity?.gender;
  const genderEO = data.equalized_odds?.gender;

  const overallFair =
    (genderDI?.fair ?? true) &&
    (genderDP?.fair ?? true) &&
    (genderEO?.fair ?? true);

  const tooltipStyle = getTooltipStyle(isDark);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {t("fairness.title")}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {t("fairness.subtitle")}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="group flex items-center gap-2 px-4 py-2.5 glass-card hover:bg-white/10 rounded-xl text-sm transition-all shadow-sm hover:shadow-md"
        >
          <RefreshCw
            className={`w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors ${loading ? "animate-spin" : ""}`}
          />
          <span className="text-slate-400 font-medium">Refresh</span>
        </button>
      </div>

      {/* Overall Verdict */}
      <div
        className={`glass-card card-hover rounded-2xl p-5 animate-fade-up flex items-center gap-4 ${
          overallFair ? "ring-1 ring-emerald-200" : "ring-1 ring-amber-200"
        }`}
      >
        {overallFair ? (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-200">
            {overallFair ? t("fairness.pass") : t("fairness.fail")}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{data.fairness_summary}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{(data.overall_accuracy * 100).toFixed(1)}%</p>
          <p className="text-[11px] text-slate-500">Test-Set Accuracy</p>
        </div>
      </div>



      {/* Fairness Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 stagger">
        <FairnessMetricCard
          title="Disparate Impact"
          description="Ratio of positive outcome rates across groups (0.8-1.25 = fair)"
          fair={genderDI?.fair ?? true}
          detail={
            genderDI
              ? Object.entries(genderDI.ratios)
                  .map(([g, r]) => `${g}: ${r}`)
                  .join(", ")
              : "N/A"
          }
        />
        <FairnessMetricCard
          title="Demographic Parity"
          description="Max difference in high-risk classification rate across groups"
          fair={genderDP?.fair ?? true}
          detail={genderDP ? `Max diff: ${(genderDP.max_difference * 100).toFixed(1)}%` : "N/A"}
        />
        <FairnessMetricCard
          title="Equalized Odds"
          description="Difference in TPR and FPR across demographic groups"
          fair={genderEO?.fair ?? true}
          detail={
            genderEO
              ? `TPR diff: ${(genderEO.tpr_difference * 100).toFixed(1)}%, FPR diff: ${(genderEO.fpr_difference * 100).toFixed(1)}%`
              : "N/A"
          }
        />
      </div>

      {/* Gender Analysis Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card card-hover rounded-2xl p-6 animate-fade-up">
          <h3 className="text-sm font-semibold text-slate-200 mb-5 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-500" /> Accuracy by Gender
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={genderAccData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="group" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 3']} unit="%" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: legendColor }} />
                <Bar dataKey="Accuracy" fill={NEON.electricBlue} radius={[6, 6, 0, 0]} barSize={32} />
                <Bar dataKey="High Risk Rate" fill={NEON.coral} radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card card-hover rounded-2xl p-6 animate-fade-up">
          <h3 className="text-sm font-semibold text-slate-200 mb-5 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-violet-500" /> Risk Distribution by Gender
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={genderRadarData}>
                <PolarGrid stroke={gridColor} />
                <PolarAngleAxis dataKey="risk" fontSize={12} stroke={axisColor} />
                <PolarRadiusAxis fontSize={10} stroke={axisColor} domain={[0, 'auto']} />
                {data.gender_analysis.map((g, i) => {
                  const colors = [NEON.skyBlue, NEON.magenta, NEON.mint, NEON.gold];
                  return (
                    <Radar
                      key={g.group}
                      name={g.group}
                      dataKey={g.group}
                      stroke={colors[i % colors.length]}
                      fill={colors[i % colors.length]}
                      fillOpacity={0.2}
                      strokeWidth={2}
                    />
                  );
                })}
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px", color: legendColor }} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Age Group Analysis — Full Width with more metrics */}
      <div className="glass-card card-hover rounded-2xl p-6 animate-fade-up">
        <h3 className="text-sm font-semibold text-slate-200 mb-5 flex items-center gap-2">
          <Users className="w-4 h-4 text-violet-500" /> Age Group — Accuracy, Risk Rates &amp; Distribution
        </h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ageAccData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="group" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: legendColor }} />
              <Bar dataKey="Accuracy" fill={NEON.electricBlue} radius={[4, 4, 0, 0]} barSize={16} />
              <Bar dataKey="High Risk %" fill={NEON.magenta} radius={[4, 4, 0, 0]} barSize={16} />
              <Bar dataKey="Low %" fill={NEON.mint} radius={[4, 4, 0, 0]} barSize={16} />
              <Bar dataKey="Med %" fill={NEON.gold} radius={[4, 4, 0, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Age Risk Profile — separate view */}
      <div className="glass-card card-hover rounded-2xl p-6 animate-fade-up">
        <h3 className="text-sm font-semibold text-slate-200 mb-5 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-violet-500" /> Age Group Risk Profile (%)
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={ageRiskProfile}>
              <PolarGrid stroke={gridColor} />
              <PolarAngleAxis dataKey="group" fontSize={12} stroke={axisColor} />
              <PolarRadiusAxis fontSize={10} stroke={axisColor} domain={[0, 'auto']} />
              <Radar name="Low %" dataKey="Low %" stroke={NEON.mint} fill={NEON.mint} fillOpacity={0.2} strokeWidth={2} />
              <Radar name="Medium %" dataKey="Medium %" stroke={NEON.gold} fill={NEON.gold} fillOpacity={0.2} strokeWidth={2} />
              <Radar name="High %" dataKey="High %" stroke={NEON.coral} fill={NEON.coral} fillOpacity={0.15} strokeWidth={2} />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px", color: legendColor }} />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Equalized Odds Detail */}
      {genderEO && (
        <div className="glass-card card-hover rounded-2xl p-6 animate-fade-up">
          <h3 className="text-sm font-semibold text-slate-200 mb-5 flex items-center gap-2">
            <Scale className="w-4 h-4 text-violet-500" /> Equalized Odds — True/False Positive Rates
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={Object.entries(genderEO.groups).map(([g, m]) => ({
                  group: g,
                  TPR: +(m.tpr * 100).toFixed(1),
                  FPR: +(m.fpr * 100).toFixed(1),
                }))}
              >
                <PolarGrid stroke={gridColor} />
                <PolarAngleAxis dataKey="group" fontSize={12} stroke={axisColor} />
                <PolarRadiusAxis fontSize={10} stroke={axisColor} domain={[0, 100]} />
                <Radar name="True Positive Rate" dataKey="TPR" stroke={NEON.aqua} fill={NEON.aqua} fillOpacity={0.25} strokeWidth={2} />
                <Radar name="False Positive Rate" dataKey="FPR" stroke={NEON.magenta} fill={NEON.magenta} fillOpacity={0.15} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "12px", color: legendColor }} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detailed Table */}
      <div className="glass-card card-hover rounded-2xl p-6 animate-fade-up">
        <h3 className="text-sm font-semibold text-slate-200 mb-5 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-violet-500" /> Per-Group Performance Breakdown
        </h3>
        <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/3">
                <th className="text-left py-3 px-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Group</th>
                <th className="text-center py-3 px-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Samples</th>
                <th className="text-center py-3 px-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Accuracy</th>
                <th className="text-center py-3 px-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">High Risk %</th>
                <th className="text-center py-3 px-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Low</th>
                <th className="text-center py-3 px-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">Medium</th>
                <th className="text-center py-3 px-4 text-slate-500 font-semibold text-xs uppercase tracking-wider">High</th>
              </tr>
            </thead>
            <tbody>
              {[...data.gender_analysis, ...data.age_analysis].map((g, i) => (
                <tr key={i} className="border-t border-white/6 hover:bg-blue-500/10/30 transition-colors">
                  <td className="py-3 px-4 font-semibold text-white">{g.group}</td>
                  <td className="py-3 px-4 text-center text-slate-400">{g.count.toLocaleString()}</td>
                  <td className="py-3 px-4 text-center font-mono font-semibold text-slate-300">
                    {(g.accuracy * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-slate-300">
                    {(g.high_risk_rate * 100).toFixed(1)}%
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-400 font-mono">{g.risk_distribution.Low || 0}</td>
                  <td className="py-3 px-4 text-center text-amber-400 font-mono">{g.risk_distribution.Medium || 0}</td>
                  <td className="py-3 px-4 text-center text-red-400 font-mono">{g.risk_distribution.High || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Small presentational components ── */

function FairnessMetricCard({
  title,
  description,
  fair,
  detail,
}: {
  title: string;
  description: string;
  fair: boolean;
  detail: string;
}) {
  return (
    <div className="glass-card card-hover rounded-2xl p-5 animate-fade-up">
      <div className="flex items-center gap-2 mb-2">
        {fair ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        )}
        <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
      </div>
      <p className="text-xs text-slate-500 mb-3">{description}</p>
      <div
        className={`text-xs font-mono px-3 py-2 rounded-lg ${
          fair
            ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-200"
            : "bg-amber-500/10 text-amber-400 ring-1 ring-amber-200"
        }`}
      >
        {detail}
      </div>
      <p
        className={`text-[10px] font-semibold uppercase tracking-wider mt-2 ${
          fair ? "text-emerald-400" : "text-amber-400"
        }`}
      >
        {fair ? "PASS" : "REVIEW NEEDED"}
      </p>
    </div>
  );
}
