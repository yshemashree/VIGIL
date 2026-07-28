"use client";

import { useEffect, useState, Fragment } from "react";
import { getPatientList, TriageResult } from "@/lib/api";
import { RiskBadge } from "../components/RiskBadge";
import { ShapChart } from "../components/ShapChart";
import { DigitalTwinChart } from "../components/DigitalTwinChart";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Users,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

type SortKey = "timestamp" | "risk_level" | "confidence" | "department";

const RISK_ORDER: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

export default function PatientsPage() {
  const { t } = useI18n();
  const [patients, setPatients] = useState<TriageResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<string | null>(null);

  useEffect(() => {
    getPatientList()
      .then(setPatients)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const filtered = patients
    .filter((p) => {
      if (riskFilter && p.risk_level !== riskFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.patient_name.toLowerCase().includes(q) ||
          p.patient_id.toLowerCase().includes(q) ||
          p.department.recommended_department.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "timestamp":
          cmp =
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case "risk_level":
          cmp =
            (RISK_ORDER[a.risk_level] || 0) - (RISK_ORDER[b.risk_level] || 0);
          break;
        case "confidence":
          cmp = a.confidence - b.confidence;
          break;
        case "department":
          cmp = a.department.recommended_department.localeCompare(
            b.department.recommended_department
          );
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full" />
          <Users className="w-5 h-5 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Users className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{t("patients.title")}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {patients.length} patient(s) triaged this session
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t("patients.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full glass-card rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all hover:border-white/20"
          />
        </div>
        <div className="flex gap-2">
          {["High", "Medium", "Low"].map((r) => (
            <button
              key={r}
              onClick={() => setRiskFilter(riskFilter === r ? null : r)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                riskFilter === r
                  ? r === "High"
                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                    : r === "Medium"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-white border-white/10 text-slate-500 hover:bg-white/5"
              }`}
            >
              {r}
            </button>
          ))}
          {riskFilter && (
            <button
              onClick={() => setRiskFilter(null)}
              className="text-xs text-slate-400 hover:text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center card-hover">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {patients.length === 0
              ? t("patients.noTriaged")
              : t("patients.noMatch")}
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-hidden card-hover ring-1 ring-white/10/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10/80 bg-white/5/50">
                {(
                  [
                    ["Patient", null],
                    ["Risk", "risk_level"],
                    ["Department", "department"],
                    ["Confidence", "confidence"],
                    ["Time", "timestamp"],
                  ] as [string, SortKey | null][]
                ).map(([label, key]) => (
                  <th
                    key={label}
                    className="text-left py-3 px-4 text-slate-500 font-medium text-xs uppercase tracking-wider"
                  >
                    {key ? (
                      <button
                        onClick={() => toggleSort(key)}
                        className="flex items-center gap-1 hover:text-slate-300 transition-colors"
                      >
                        {label}
                        {sortKey === key ? (
                          sortAsc ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <Fragment key={p.patient_id}>
                  <tr
                    onClick={() =>
                      setExpandedId(
                        expandedId === p.patient_id ? null : p.patient_id
                      )
                    }
                    className="border-b border-white/6 hover:bg-blue-500/10/30 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-4">
                      <p className="font-medium text-white">
                        {p.patient_name}
                      </p>
                      <p className="text-xs text-slate-500">{p.patient_id}</p>
                    </td>
                    <td className="py-2.5 px-4">
                      <RiskBadge level={p.risk_level} size="sm" />
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {p.department.recommended_department}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300 font-mono">
                      {(p.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      {new Date(p.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4">
                      {expandedId === p.patient_id ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </td>
                  </tr>
                  {expandedId === p.patient_id && (
                    <tr key={`${p.patient_id}-detail`}>
                      <td colSpan={6} className="bg-white/5/50 px-6 py-5">
                        <PatientDetail result={p} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PatientDetail({ result }: { result: TriageResult }) {
  return (
    <div className="space-y-5">
      {/* input data */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Age" value={result.input_data.age} />
        <MiniStat label="Gender" value={result.input_data.gender} />
        <MiniStat
          label="BP"
          value={`${result.input_data.bp_systolic}/${result.input_data.bp_diastolic}`}
        />
        <MiniStat label="HR" value={`${result.input_data.heart_rate} bpm`} />
        <MiniStat label="Temp" value={`${result.input_data.temperature}°F`} />
        <MiniStat label="SpO2" value={`${result.input_data.spo2}%`} />
        <MiniStat
          label="Insurance"
          value={result.input_data.insurance_provider}
        />
        <MiniStat
          label="Ins. Wait"
          value={`${result.input_data.insurance_response_hours}h`}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {result.input_data.symptoms.map((s) => (
          <span
            key={s}
            className="bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-2 py-0.5 text-xs"
          >
            {s}
          </span>
        ))}
        {result.input_data.pre_existing_conditions.map((c) => (
          <span
            key={c}
            className="bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5 text-xs"
          >
            {c}
          </span>
        ))}
      </div>

      {/* SHAP */}
      {result.shap_factors.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 mb-2">
            SHAP Explainability
          </h4>
          <ShapChart factors={result.shap_factors} />
        </div>
      )}

      {/* Digital Twin */}
      {result.digital_twin && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 mb-2">
            Digital Twin Projection
          </h4>
          <p className="text-xs text-slate-500 mb-2">
            {result.digital_twin.summary}
          </p>
          <DigitalTwinChart
            timeline={result.digital_twin.timeline}
            escalationPoint={result.digital_twin.escalation_point_min}
          />
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white/5 border border-white/10/60 rounded-xl px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-white font-medium">{String(value)}</p>
    </div>
  );
}
