"use client";

import { useEffect, useState } from "react";
import { getResources } from "@/lib/api";
import {
  Building2,
  BedDouble,
  Wind,
  Monitor,
  UserCog,
  RefreshCw,
  MapPin,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface DeptInfo {
  beds_total: number;
  beds_occupied: number;
  ventilators_total: number;
  ventilators_in_use: number;
  monitors_total: number;
  monitors_in_use: number;
  staff_on_duty: number;
}

interface HospitalData {
  name: string;
  distance_km: number;
  departments: Record<string, DeptInfo>;
}

export default function ResourcesPage() {
  const { t } = useI18n();
  const [hospitals, setHospitals] = useState<HospitalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHospital, setSelectedHospital] = useState(0);

  const load = () => {
    setLoading(true);
    getResources()
      .then((data) => {
        const parsed = (data as { hospitals: HospitalData[] }).hospitals || [];
        setHospitals(parsed);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && hospitals.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="relative">
          <div className="animate-spin w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full" />
          <Building2 className="w-5 h-5 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>
    );
  }

  const hospital = hospitals[selectedHospital];
  if (!hospital) return <p className="text-slate-500">No resource data.</p>;

  const deptEntries = Object.entries(hospital.departments);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {t("resources.title")}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {t("resources.subtitle")}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2.5 glass-card card-hover text-slate-300 rounded-xl text-sm transition-all hover:bg-white/90"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {t("dash.refresh")}
        </button>
      </div>

      {/* Hospital tabs */}
      <div className="flex gap-3">
        {hospitals.map((h, i) => (
          <button
            key={h.name}
            onClick={() => setSelectedHospital(i)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all border ${
              i === selectedHospital
                ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-500/20 text-blue-400 shadow-md shadow-blue-500/10 ring-1 ring-blue-200/50"
                : "glass-card text-slate-500 hover:bg-white/90 card-hover"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <div className="text-left">
              <p className="font-medium">{h.name}</p>
              <p className="text-xs opacity-60 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {h.distance_km} km
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Department cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {deptEntries.map(([name, dept]) => {
          const bedPct =
            dept.beds_total > 0
              ? Math.round((dept.beds_occupied / dept.beds_total) * 100)
              : 0;
          const ventPct =
            dept.ventilators_total > 0
              ? Math.round(
                  (dept.ventilators_in_use / dept.ventilators_total) * 100
                )
              : 0;

          return (
            <div
              key={name}
              className="glass-card card-hover rounded-2xl p-4 space-y-3 animate-fade-up"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{name}</h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    bedPct >= 90
                      ? "bg-red-500/10 text-red-400"
                      : bedPct >= 70
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-emerald-500/10 text-emerald-400"
                  }`}
                >
                  {bedPct}% full
                </span>
              </div>

              {/* Beds */}
              <ResourceRow
                icon={<BedDouble className="w-3.5 h-3.5 text-blue-400" />}
                label="Beds"
                used={dept.beds_occupied}
                total={dept.beds_total}
                pct={bedPct}
              />

              {/* Ventilators */}
              <ResourceRow
                icon={<Wind className="w-3.5 h-3.5 text-teal-400" />}
                label="Ventilators"
                used={dept.ventilators_in_use}
                total={dept.ventilators_total}
                pct={ventPct}
              />

              {/* Monitors */}
              <ResourceRow
                icon={<Monitor className="w-3.5 h-3.5 text-purple-400" />}
                label="Monitors"
                used={dept.monitors_in_use}
                total={dept.monitors_total}
                pct={
                  dept.monitors_total > 0
                    ? Math.round(
                        (dept.monitors_in_use / dept.monitors_total) * 100
                      )
                    : 0
                }
              />

              {/* Staff */}
              <div className="flex items-center gap-2 text-xs">
                <UserCog className="w-3.5 h-3.5 text-orange-500" />
                <span className="text-slate-500">Staff on duty:</span>
                <span className="text-white font-medium">
                  {dept.staff_on_duty}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResourceRow({
  icon,
  label,
  used,
  total,
  pct,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  total: number;
  pct: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-slate-500">
          {icon} {label}
        </span>
        <span className="text-slate-300 font-mono">
          {used}/{total}
        </span>
      </div>
      <div className="w-full bg-white/8 rounded-full h-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            pct >= 90
              ? "bg-gradient-to-r from-red-400 to-red-500"
              : pct >= 70
              ? "bg-gradient-to-r from-amber-400 to-amber-500"
              : "bg-gradient-to-r from-emerald-400 to-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
