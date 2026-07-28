"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getModelHealth,
  triggerRetrain,
  ModelHealthResponse,
} from "@/lib/api";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Brain,
  TrendingUp,
  BarChart3,
  Shield,
  Clock,
  Cpu,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

function getDriftTooltipStyle(isDark: boolean) {
  return {
    contentStyle: {
      backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
      border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
      borderRadius: "12px",
      color: isDark ? "#e2e8f0" : "#1e293b",
      fontSize: "12px",
      backdropFilter: "blur(12px)",
    },
  };
}

export default function DriftPage() {
  const { t } = useI18n();
  const { isDark } = useTheme();
  const tooltipStyle = getDriftTooltipStyle(isDark);
  const axisColor = isDark ? "#64748b" : "#475569";
  const axisLineColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const tickColor = isDark ? "#94a3b8" : "#64748b";
  const [health, setHealth] = useState<ModelHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [retrainResult, setRetrainResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getModelHealth();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch model health");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleRetrain = async () => {
    try {
      setRetraining(true);
      setRetrainResult(null);
      const result = await triggerRetrain();
      setRetrainResult(`${result.message} (Job ID: ${result.job_id})`);
      // Refresh health after a short delay
      setTimeout(fetchHealth, 2000);
    } catch (err) {
      setRetrainResult("Failed to trigger retraining. Please try again.");
    } finally {
      setRetraining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-cyan-400 mx-auto" />
          <p className="text-slate-400 text-sm">Analyzing model health...</p>
        </div>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="glass-card rounded-2xl p-8 text-center max-w-md space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Unable to Load Model Health</h2>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            onClick={fetchHealth}
            className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-xl hover:bg-cyan-500/30 transition-colors"
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { model_info, feature_drift, label_drift, overall_drift_score, needs_retrain } = health;

  // Prepare chart data
  const featureChartData = feature_drift.map((f) => ({
    feature: f.feature.replace(/_/g, " "),
    ks: f.ks_statistic,
    threshold: 0.15,
    fill: f.drift_detected ? "#ff2a6d" : "#00f0ff",
  }));

  const labelChartData = Object.entries(label_drift.training_distribution).map(([label, trainVal]) => ({
    label,
    training: Math.round(trainVal * 100),
    current: Math.round((label_drift.current_distribution[label] || 0) * 100),
  }));

  const radarData = feature_drift.map((f) => ({
    feature: f.feature.replace(/_/g, " "),
    drift: Math.min(f.ks_statistic * 100, 100),
    threshold: 15,
  }));

  const driftStatus = needs_retrain ? "warning" : "healthy";
  const driftColor = needs_retrain ? "text-amber-400" : "text-emerald-400";
  const driftBg = needs_retrain ? "bg-amber-500/10 border-amber-500/20" : "bg-emerald-500/10 border-emerald-500/20";

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Brain className="w-5 h-5 text-white" />
            </div>
            {t("drift.title")}
          </h1>
          <p className="text-slate-400 text-sm mt-1">{t("drift.subtitle")}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchHealth}
            className="px-4 py-2 glass-card rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            {t("drift.refresh")}
          </button>
          {needs_retrain && (
            <button
              onClick={handleRetrain}
              disabled={retraining}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-400 hover:to-blue-500 transition-all flex items-center gap-2 text-sm shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              {retraining ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              {t("drift.retrain")}
            </button>
          )}
        </div>
      </div>

      {/* Retrain result toast */}
      {retrainResult && (
        <div className="glass-card rounded-xl p-4 border border-cyan-500/20 bg-cyan-500/5 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
          <p className="text-sm text-cyan-300">{retrainResult}</p>
        </div>
      )}

      {/* Top Status Banner */}
      <div className={`glass-card rounded-2xl p-6 border ${driftBg}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${needs_retrain ? 'bg-amber-500/20' : 'bg-emerald-500/20'}`}>
              {needs_retrain ? (
                <AlertTriangle className="w-7 h-7 text-amber-400" />
              ) : (
                <Shield className="w-7 h-7 text-emerald-400" />
              )}
            </div>
            <div>
              <h2 className={`text-lg font-bold ${driftColor}`}>
                {needs_retrain ? t("drift.driftDetected") : t("drift.modelHealthy")}
              </h2>
              <p className="text-slate-400 text-sm mt-0.5">{health.recommendation}</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{(overall_drift_score * 100).toFixed(1)}%</p>
              <p className="text-xs text-slate-400">{t("drift.overallDrift")}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{health.drifted_feature_count}/{health.total_features}</p>
              <p className="text-xs text-slate-400">{t("drift.featuresDrifted")}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{health.total_patients_analyzed}</p>
              <p className="text-xs text-slate-400">{t("drift.patientsAnalyzed")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Model Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("drift.modelVersion"), value: model_info.model_version, icon: Cpu, color: "text-cyan-400" },
          { label: t("drift.accuracy"), value: `${(model_info.accuracy * 100).toFixed(1)}%`, icon: TrendingUp, color: "text-emerald-400" },
          { label: t("drift.f1Score"), value: `${(model_info.f1_score * 100).toFixed(1)}%`, icon: BarChart3, color: "text-blue-400" },
          { label: t("drift.aucRoc"), value: `${(model_info.auc_roc * 100).toFixed(1)}%`, icon: Activity, color: "text-purple-400" },
        ].map((card) => (
          <div key={card.label} className="glass-card card-hover rounded-2xl p-4 relative overflow-hidden">
            <div className="neon-line" />
            <div className="flex items-center gap-3 mb-2">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <span className="text-xs text-slate-400">{card.label}</span>
            </div>
            <p className="text-xl font-bold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Feature Drift KS-Statistics */}
        <div className="glass-card card-hover rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            {t("drift.featureDriftChart")}
          </h3>
          <p className="text-xs text-slate-400 mb-4">{t("drift.ksStatDesc")}</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureChartData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" domain={[0, 0.5]} tick={{ fill: tickColor, fontSize: 11 }} axisLine={{ stroke: axisLineColor }} />
                <YAxis type="category" dataKey="feature" tick={{ fill: tickColor, fontSize: 11 }} axisLine={{ stroke: axisLineColor }} width={90} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="ks" radius={[0, 6, 6, 0]} barSize={18}>
                  {featureChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-cyan-500 inline-block" /> No Drift</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block" /> Drift Detected</span>
            <span className="flex items-center gap-1 ml-auto">Threshold: 0.15</span>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="glass-card card-hover rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            {t("drift.driftRadar")}
          </h3>
          <p className="text-xs text-slate-400 mb-4">{t("drift.radarDesc")}</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke={axisLineColor} />
                <PolarAngleAxis dataKey="feature" tick={{ fill: tickColor, fontSize: 10 }} />
                <PolarRadiusAxis tick={{ fill: axisColor, fontSize: 10 }} domain={[0, 50]} />
                <Radar name="Drift %" dataKey="drift" stroke="#bf5af2" fill="#bf5af2" fillOpacity={0.2} />
                <Radar name="Threshold" dataKey="threshold" stroke="#ff2a6d" fill="none" strokeDasharray="5 5" />
                <Tooltip {...tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Label Distribution + Feature Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Label Distribution Shift */}
        <div className="glass-card card-hover rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            {t("drift.labelDistribution")}
          </h3>
          <p className="text-xs text-slate-400 mb-2">
            PSI Score: <span className={label_drift.drift_detected ? "text-rose-400 font-semibold" : "text-emerald-400 font-semibold"}>{label_drift.psi.toFixed(4)}</span>
            {label_drift.drift_detected ? " (Drift Detected)" : " (Stable)"}
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={labelChartData}>
                <XAxis dataKey="label" tick={{ fill: tickColor, fontSize: 11 }} axisLine={{ stroke: axisLineColor }} />
                <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={{ stroke: axisLineColor }} unit="%" />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="training" name="Training" fill="#bf5af2" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="current" name="Current" fill="#00f0ff" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> Training</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-cyan-400 inline-block" /> Current</span>
          </div>
        </div>

        {/* Feature Detail Table */}
        <div className="glass-card card-hover rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            {t("drift.featureDetails")}
          </h3>
          <div className="overflow-auto max-h-72">
            <table className="dark-table w-full">
              <thead>
                <tr>
                  <th>{t("drift.feature")}</th>
                  <th>{t("drift.ksStat")}</th>
                  <th>{t("drift.pValue")}</th>
                  <th>{t("drift.meanShift")}</th>
                  <th>{t("drift.status")}</th>
                </tr>
              </thead>
              <tbody>
                {feature_drift.map((f) => (
                  <tr key={f.feature}>
                    <td className="font-medium capitalize">{f.feature.replace(/_/g, " ")}</td>
                    <td className="font-mono">{f.ks_statistic.toFixed(4)}</td>
                    <td className="font-mono">{f.p_value.toFixed(4)}</td>
                    <td>
                      <span className="flex items-center gap-1">
                        {f.current_mean > f.training_mean ? (
                          <ArrowUpRight className="w-3 h-3 text-rose-400" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3 text-cyan-400" />
                        )}
                        <span className="font-mono text-xs">
                          {f.training_mean.toFixed(1)} → {f.current_mean.toFixed(1)}
                        </span>
                      </span>
                    </td>
                    <td>
                      {f.drift_detected ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 text-xs font-medium">
                          Drifted
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium">
                          Stable
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Model Training Info */}
      <div className="glass-card card-hover rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          {t("drift.modelTrainingInfo")}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-inner rounded-xl p-4">
            <p className="text-xs text-slate-400">{t("drift.modelName")}</p>
            <p className="text-sm font-semibold text-white mt-1">{model_info.model_name}</p>
          </div>
          <div className="glass-inner rounded-xl p-4">
            <p className="text-xs text-slate-400">{t("drift.trainingDate")}</p>
            <p className="text-sm font-semibold text-white mt-1">{model_info.training_date}</p>
          </div>
          <div className="glass-inner rounded-xl p-4">
            <p className="text-xs text-slate-400">{t("drift.trainingSamples")}</p>
            <p className="text-sm font-semibold text-white mt-1">{model_info.training_samples.toLocaleString()}</p>
          </div>
          <div className="glass-inner rounded-xl p-4">
            <p className="text-xs text-slate-400">{t("drift.lastRetrain")}</p>
            <p className="text-sm font-semibold text-white mt-1">{model_info.last_retrain}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
