"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getDashboardStats, DashboardStats, getModelMetrics, ModelMetrics } from "@/lib/api";
import { RiskBadge } from "./components/RiskBadge";
import {
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, AlertTriangle, TrendingUp, Building2, RefreshCw, Activity,
  BrainCircuit, CheckCircle2, HeartPulse, Clock, ArrowUpRight, Shield,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

/* ---------- Simulated chart data generators ---------- */

function generateActivityData() {
  const hours: { hour: string; arrivals: number; discharges: number; waiting: number }[] = [];
  const baseCurve = [3,2,2,1,1,2,4,8,14,18,20,17,15,14,13,12,14,16,19,16,12,9,6,4];
  let waitingAcc = Math.floor(Math.random() * 5) + 3;
  for (let h = 0; h < 24; h++) {
    const arrivals = Math.max(0, Math.round(baseCurve[h] + (Math.random() - 0.5) * 6));
    const discharges = Math.max(0, Math.round(baseCurve[h] * 0.85 + (Math.random() - 0.5) * 4));
    waitingAcc = Math.max(0, waitingAcc + arrivals - discharges);
    const ampm = h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
    hours.push({ hour: ampm, arrivals, discharges, waiting: waitingAcc });
  }
  return hours;
}

function generateVitalsTrend() {
  const points: { t: string; HR: number; SpO2: number; BPSys: number; RiskIdx: number }[] = [];
  let hr = 72 + Math.random() * 10, spo2 = 96 + Math.random() * 2, bp = 118 + Math.random() * 8, risk = 15 + Math.random() * 10;
  for (let i = 0; i < 30; i++) {
    const spike = Math.random() < 0.12;
    hr += (Math.random() - 0.48) * (spike ? 12 : 4); spo2 += (Math.random() - 0.52) * (spike ? 2.5 : 0.8);
    bp += (Math.random() - 0.48) * (spike ? 10 : 4); risk += (Math.random() - 0.5) * (spike ? 15 : 5);
    hr += (76 - hr) * 0.08; spo2 += (97 - spo2) * 0.1; bp += (122 - bp) * 0.06; risk += (25 - risk) * 0.07;
    hr = Math.max(55, Math.min(120, hr)); spo2 = Math.max(88, Math.min(100, spo2));
    bp = Math.max(90, Math.min(165, bp)); risk = Math.max(0, Math.min(80, risk));
    points.push({ t: `${i * 5}m`, HR: Math.round(hr), SpO2: Math.round(spo2 * 10) / 10, BPSys: Math.round(bp), RiskIdx: Math.round(risk) });
  }
  return points;
}

const RISK_COLORS: Record<string, string> = { High: "#ff2a6d", Medium: "#ffd60a", Low: "#05ffa1" };
const RISK_GRADIENTS: Record<string, string> = { High: "from-red-500 to-rose-600", Medium: "from-amber-400 to-orange-500", Low: "from-emerald-400 to-green-500" };

function getTooltipStyle(isDark: boolean) {
  return {
    backgroundColor: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(12px)",
    border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
    borderRadius: "12px", fontSize: "12px",
    boxShadow: isDark ? "0 8px 32px -8px rgba(0,0,0,0.5)" : "0 8px 32px -8px rgba(0,0,0,0.12)",
    padding: "8px 12px", color: isDark ? "#e2e8f0" : "#1e293b",
  };
}

function StatCard({ icon, label, value, accent, trend }: {
  icon: React.ReactNode; label: string; value: number | string; accent: string; trend?: string;
}) {
  const m: Record<string, { iconBg: string; glow: string }> = {
    blue:    { iconBg: "from-blue-500 to-blue-600",     glow: "shadow-blue-500/20" },
    red:     { iconBg: "from-red-500 to-rose-600",      glow: "shadow-red-500/20" },
    emerald: { iconBg: "from-emerald-500 to-green-600", glow: "shadow-emerald-500/20" },
    amber:   { iconBg: "from-amber-400 to-orange-500",  glow: "shadow-amber-500/20" },
  };
  const a = m[accent] || m.blue;
  return (
    <div className="glass-card card-hover rounded-2xl p-5 animate-fade-up relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-16 h-[1px] bg-gradient-to-r from-cyan-400/40 to-transparent" />
      <div className="relative z-10">
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${a.iconBg} shadow-lg ${a.glow} mb-3`}>
          <div className="text-white">{icon}</div>
        </div>
        <div className="flex items-end gap-2">
          <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
          {trend && <span className="text-xs text-emerald-400 font-medium flex items-center gap-0.5 mb-1"><ArrowUpRight className="w-3 h-3" />{trend}</span>}
        </div>
        <p className="text-xs text-slate-400 mt-1 font-medium">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useI18n();
  const { isDark } = useTheme();
  const tooltipStyle = getTooltipStyle(isDark);
  const axisColor = isDark ? "#64748b" : "#475569";
  const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const legendColor = isDark ? "#94a3b8" : "#64748b";
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [data, m] = await Promise.all([getDashboardStats(), getModelMetrics()]);
      setStats(data); setMetrics(m);
    } catch (err) { console.error("Failed to load dashboard:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); const interval = setInterval(load, 15000); return () => clearInterval(interval); }, []);
  const activityData = useMemo(() => generateActivityData(), []);
  const vitalsData = useMemo(() => generateVitalsTrend(), []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="w-14 h-14 border-[3px] border-cyan-900/30 border-t-cyan-400 rounded-full animate-spin" />
          <Activity className="w-5 h-5 text-cyan-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>
    );
  }
  if (!stats) return <p className="text-slate-500">No data available.</p>;

  const riskPieData = Object.entries(stats.risk_distribution).map(([name, value]) => ({ name, value }));
  const deptBarData = Object.entries(stats.department_distribution).map(([name, value]) => ({ name, patients: value }));

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{t("dash.title")}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{t("dash.subtitle")}</p>
          </div>
        </div>
        <button onClick={load} className="group flex items-center gap-2 px-4 py-2.5 glass-card hover:bg-white/10 rounded-xl text-sm transition-all">
          <RefreshCw className={`w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors ${loading ? "animate-spin" : ""}`} />
          <span className="text-slate-300 font-medium">{t("dash.refresh")}</span>
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 stagger">
        <StatCard icon={<Users className="w-5 h-5" />} label={t("dash.totalPatients")} value={stats.total_patients} accent="blue" />
        <StatCard icon={<AlertTriangle className="w-5 h-5" />} label={t("dash.criticalAlerts")} value={stats.critical_alerts} accent="red" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label={t("dash.avgConfidence")} value={`${(stats.avg_confidence * 100).toFixed(1)}%`} accent="emerald" />
        <StatCard icon={<Building2 className="w-5 h-5" />} label={t("dash.deptsActive")} value={Object.keys(stats.department_distribution).length} accent="amber" />
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6 card-hover animate-fade-up">
          <h3 className="text-sm font-semibold text-slate-200 mb-5 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" /> {t("dash.riskDist")}
          </h3>
          {stats.total_patients > 0 ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={riskPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" stroke="none" paddingAngle={3} cornerRadius={6}>
                    {riskPieData.map((entry) => <Cell key={entry.name} fill={RISK_COLORS[entry.name] || "#94a3b8"} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px", color: legendColor }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-60 flex items-center justify-center"><p className="text-slate-500 text-sm">No patients triaged yet.</p></div>}
        </div>

        <div className="glass-card rounded-2xl p-6 card-hover animate-fade-up">
          <h3 className="text-sm font-semibold text-slate-200 mb-5 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-400" /> {t("dash.deptChart")}
          </h3>
          {deptBarData.length > 0 ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptBarData} layout="vertical">
                  <defs><linearGradient id="blueGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#00f0ff" /><stop offset="100%" stopColor="#bf5af2" /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                  <XAxis type="number" stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke={axisColor} fontSize={11} width={110} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="patients" fill="url(#blueGrad)" radius={[0, 8, 8, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="h-60 flex items-center justify-center"><p className="text-slate-500 text-sm">No department data yet.</p></div>}
        </div>
      </div>

      {/* Activity & Vitals Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6 card-hover animate-fade-up">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-indigo-400" /></div>
            <h3 className="text-sm font-semibold text-slate-200">{t("dash.activity")}</h3>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="gradArr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3} /><stop offset="95%" stopColor="#00f0ff" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gradWait" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ffd60a" stopOpacity={0.3} /><stop offset="95%" stopColor="#ffd60a" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="hour" stroke={axisColor} fontSize={10} tickLine={false} axisLine={false} interval={2} />
                <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: legendColor }} />
                <Area type="monotone" dataKey="arrivals" stroke="#00f0ff" fill="url(#gradArr)" strokeWidth={2.5} name="Arrivals" />
                <Area type="monotone" dataKey="discharges" stroke="#05ffa1" fill="none" strokeWidth={2.5} strokeDasharray="4 2" name="Discharges" />
                <Area type="monotone" dataKey="waiting" stroke="#ffd60a" fill="url(#gradWait)" strokeWidth={2.5} name="Waiting" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 card-hover animate-fade-up">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center"><HeartPulse className="w-3.5 h-3.5 text-rose-400" /></div>
            <h3 className="text-sm font-semibold text-slate-200">{t("dash.vitals")}</h3>
            <span className="ml-auto text-[10px] text-cyan-400 font-mono bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">live</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vitalsData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="t" stroke={axisColor} fontSize={10} tickLine={false} axisLine={false} interval={4} />
                <YAxis stroke={axisColor} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px", color: legendColor }} />
                <Line type="monotone" dataKey="HR" stroke="#ff6ac1" strokeWidth={2.5} dot={false} name="Heart Rate" />
                <Line type="monotone" dataKey="SpO2" stroke="#05ffa1" strokeWidth={2.5} dot={false} name="SpO2" />
                <Line type="monotone" dataKey="BPSys" stroke="#00f0ff" strokeWidth={2.5} dot={false} name="BP Systolic" />
                <Line type="monotone" dataKey="RiskIdx" stroke="#ff2a6d" strokeWidth={2} strokeDasharray="5 3" dot={false} name="Risk Index" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* AI Model Performance */}
      {metrics && (
        <div className="glass-card rounded-2xl p-6 card-hover animate-fade-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">{t("dash.aiModel")}</h3>
              <p className="text-[11px] text-slate-500">{t("dash.xgb")}</p>
            </div>
            <span className="ml-auto bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 ring-1 ring-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t("dash.prodReady")}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 stagger">
            <div className="glass-inner rounded-xl p-4 text-center animate-fade-up">
              <p className="text-2xl font-bold text-purple-400 tracking-tight">{(metrics.accuracy * 100).toFixed(1)}%</p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">{t("dash.accuracy")}</p>
            </div>
            <div className="glass-inner rounded-xl p-4 text-center animate-fade-up">
              <p className="text-2xl font-bold text-blue-400 tracking-tight">{metrics.feature_count}</p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">{t("dash.features")}</p>
            </div>
            <div className="glass-inner rounded-xl p-4 text-center animate-fade-up">
              <p className="text-2xl font-bold text-emerald-400 tracking-tight">{metrics.train_size.toLocaleString()}</p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">{t("dash.trainSamples")}</p>
            </div>
            <div className="glass-inner rounded-xl p-4 text-center animate-fade-up">
              <p className="text-2xl font-bold text-amber-400 tracking-tight">{metrics.test_size}</p>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">{t("dash.testSamples")}</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-sm dark-table">
              <thead><tr>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold">Class</th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold">Precision</th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold">Recall</th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold">F1-Score</th>
                <th className="text-center py-3 px-4 text-xs uppercase tracking-wider font-semibold">Support</th>
              </tr></thead>
              <tbody>
                {Object.entries(metrics.per_class).map(([cls, mc]) => (
                  <tr key={cls}>
                    <td className="py-3 px-4 font-semibold text-slate-200 flex items-center gap-2.5">
                      <span className={`w-3 h-3 rounded-full bg-gradient-to-br ${RISK_GRADIENTS[cls] || "from-slate-400 to-slate-500"} shadow-sm`} />
                      {cls} Risk
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-300 font-medium">{(mc.precision * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-center font-mono text-slate-300 font-medium">{(mc.recall * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-center font-mono text-slate-300 font-medium">{(mc["f1-score"] * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4 text-center text-slate-400">{mc.support}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5">
            <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">{t("dash.confMatrix")}</p>
            <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `auto repeat(${metrics.classes.length}, 1fr)` }}>
              <div />
              {metrics.classes.map((c) => <div key={`h-${c}`} className="text-[10px] font-semibold text-slate-500 text-center px-2">{c}</div>)}
              {metrics.confusion_matrix.map((row, ri) => (
                <React.Fragment key={`r-${ri}`}>
                  <div className="text-[10px] font-semibold text-slate-500 flex items-center pr-2">{metrics.classes[ri]}</div>
                  {row.map((val, ci) => {
                    const max = Math.max(...metrics.confusion_matrix.flat());
                    const intensity = max > 0 ? val / max : 0;
                    const isDiag = ri === ci;
                    return (
                      <div key={`${ri}-${ci}`} className="w-14 h-11 flex items-center justify-center rounded-lg text-xs font-mono font-bold transition-transform hover:scale-110"
                        style={{
                          backgroundColor: isDiag ? `rgba(16,185,129,${0.1 + intensity * 0.4})` : val > 0 ? `rgba(239,68,68,${0.08 + intensity * 0.3})` : "rgba(255,255,255,0.03)",
                          color: isDiag ? "#34d399" : val > 0 ? "#f87171" : "#475569",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}>
                        {val}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Patients */}
      <div className="glass-card rounded-2xl p-6 card-hover animate-fade-up">
        <h3 className="text-sm font-semibold text-slate-200 mb-5 flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" /> {t("dash.recentTriage")}
        </h3>
        {stats.recent_patients.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-sm dark-table">
              <thead><tr>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold">Patient</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold">Risk</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold">Department</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold">Confidence</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold">Deterioration</th>
                <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-semibold">Time</th>
              </tr></thead>
              <tbody>
                {stats.recent_patients.map((p) => (
                  <tr key={p.patient_id}>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-200">{p.patient_name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{p.patient_id}</p>
                    </td>
                    <td className="py-3 px-4"><RiskBadge level={p.risk_level} size="sm" /></td>
                    <td className="py-3 px-4 text-slate-300 font-medium">{p.department}</td>
                    <td className="py-3 px-4 text-slate-300 font-mono font-semibold">{(p.confidence * 100).toFixed(1)}%</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-20 dark-progress-track h-2 overflow-hidden">
                          <div className={`h-full rounded-full ${p.deterioration_score >= 60 ? "bg-gradient-to-r from-red-400 to-red-500" : p.deterioration_score >= 30 ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-emerald-400 to-green-500"}`}
                            style={{ width: `${Math.min(p.deterioration_score, 100)}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 font-mono w-6">{p.deterioration_score}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 font-mono">{new Date(p.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">{t("dash.noPatients")} <a href="/triage" className="text-cyan-400 hover:underline font-medium">{t("dash.goTriage")}</a></p>
          </div>
        )}
      </div>
    </div>
  );
}
