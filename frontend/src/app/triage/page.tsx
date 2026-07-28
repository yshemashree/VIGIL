"use client";

import { useEffect, useState, useCallback, useRef, useMemo, FormEvent } from "react";
import {
  submitTriage,
  uploadEHR,
  getMetaSymptoms,
  PatientInput,
  TriageResult,
} from "@/lib/api";
import { RiskBadge } from "../components/RiskBadge";
import { ShapChart } from "../components/ShapChart";
import { DigitalTwinChart } from "../components/DigitalTwinChart";
import {
  Send,
  Upload,
  AlertCircle,
  CheckCircle2,
  Activity,
  ShieldAlert,
  Building2,
  Clock,
  X,
  FileText,
  Heart,
  Thermometer,
  Droplets,
  Printer,
  Download,
  Mic,
  MicOff,
  Zap,
  Skull,
  Timer,
} from "lucide-react";
import Script from "next/script";
import { useI18n } from "@/lib/i18n";

const INSURERS = [
  "United Health",
  "Aetna",
  "Cigna",
  "Blue Cross",
  "Medicare",
  "Medicaid",
  "Kaiser",
  "Humana",
];

const GENDERS = ["Male", "Female", "Other"];

/* ---------- Live clinical risk computation ---------- */
function computeClinicalMetrics(f: PatientInput) {
  const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

  // ── Sepsis Risk ──
  let sepsis = 0;
  if (f.temperature >= 100.4 || f.temperature <= 96.8) sepsis += 25;
  if (f.heart_rate > 90) sepsis += 15 + (f.heart_rate - 90) * 0.4;
  if (f.spo2 < 95) sepsis += 20 + (95 - f.spo2) * 2;
  if (f.bp_systolic < 100) sepsis += 15 + (100 - f.bp_systolic) * 0.3;
  if (f.age > 65) sepsis += 8;
  if (f.pre_existing_conditions.some(c => /diabet|immun|liver|kidney/i.test(c))) sepsis += 10;
  if (f.symptoms.some(s => /fever|chill|confus|lethargy|infect/i.test(s))) sepsis += 12;
  sepsis = clamp(Math.round(sepsis));

  // ── Shock Risk ──
  let shock = 0;
  if (f.bp_systolic < 90) shock += 35 + (90 - f.bp_systolic) * 0.6;
  else if (f.bp_systolic < 100) shock += 15;
  if (f.heart_rate > 100) shock += 20 + (f.heart_rate - 100) * 0.5;
  if (f.spo2 < 92) shock += 25 + (92 - f.spo2) * 2;
  if (f.temperature >= 103) shock += 10;
  if (f.symptoms.some(s => /faint|dizz|weak|pale|sweat|bleed|chest pain/i.test(s))) shock += 15;
  if (f.age > 70) shock += 5;
  shock = clamp(Math.round(shock));

  // ── Stroke Risk ──
  let stroke = 0;
  if (f.bp_systolic > 140) stroke += 20 + (f.bp_systolic - 140) * 0.5;
  if (f.bp_systolic > 180) stroke += 15;
  if (f.age > 55) stroke += 10 + (f.age - 55) * 0.4;
  if (f.pre_existing_conditions.some(c => /hypertens|diabet|atrial|heart|cholesterol/i.test(c))) stroke += 15;
  if (f.symptoms.some(s => /headache|numb|vision|speech|slur|face.*droop|paralysis/i.test(s))) stroke += 20;
  if (f.heart_rate > 110) stroke += 8;
  stroke = clamp(Math.round(stroke));

  // ── Overall Deterioration Rate (weighted composite) ──
  const deterioration = clamp(Math.round(sepsis * 0.4 + shock * 0.35 + stroke * 0.25));

  // ── Mortality Rate ──
  let mortality = 0;
  mortality += Math.max(0, (f.age - 40) * 0.3);
  if (f.spo2 < 90) mortality += 25;
  else if (f.spo2 < 94) mortality += 12;
  if (f.bp_systolic < 80) mortality += 20;
  else if (f.bp_systolic < 90) mortality += 10;
  if (f.bp_systolic > 180) mortality += 12;
  if (f.heart_rate > 120) mortality += 12;
  else if (f.heart_rate < 50) mortality += 15;
  if (f.temperature >= 104) mortality += 10;
  if (f.pre_existing_conditions.length >= 3) mortality += 10;
  else if (f.pre_existing_conditions.length >= 1) mortality += 5;
  mortality += (sepsis * 0.15) + (shock * 0.2) + (stroke * 0.1);
  mortality = clamp(Math.round(mortality));

  // ── Escalation Time (minutes until likely critical) ──
  const severity = (sepsis + shock + stroke + mortality) / 4;
  let escalationMin: number;
  if (severity >= 60) escalationMin = Math.max(10, Math.round(60 - severity * 0.6));
  else if (severity >= 30) escalationMin = Math.round(120 - severity * 1.5);
  else escalationMin = Math.round(360 - severity * 4);
  escalationMin = Math.max(5, Math.min(480, escalationMin));

  return { sepsis, shock, stroke, deterioration, mortality, escalationMin };
}

const DEFAULT_FORM: PatientInput = {
  name: "",
  age: 45,
  gender: "Male",
  symptoms: [],
  bp_systolic: 120,
  bp_diastolic: 80,
  heart_rate: 75,
  temperature: 98.6,
  spo2: 97,
  pre_existing_conditions: [],
  insurance_provider: "United Health",
  insurance_response_hours: 2,
};

/* ---------- Clinical Metrics Panel Component ---------- */
function ClinicalMetricsPanel({ form }: { form: PatientInput }) {
  const m = useMemo(() => computeClinicalMetrics(form), [form]);

  const riskColor = (v: number) =>
    v >= 60 ? "text-red-400" : v >= 30 ? "text-amber-400" : "text-emerald-400";
  const riskBg = (v: number) =>
    v >= 60 ? "bg-red-500" : v >= 30 ? "bg-amber-500" : "bg-emerald-500";
  const riskGlow = (v: number) =>
    v >= 60 ? "shadow-red-500/40" : v >= 30 ? "shadow-amber-500/30" : "shadow-emerald-500/30";

  const formatTime = (min: number) => {
    if (min >= 60) {
      const h = Math.floor(min / 60);
      const r = min % 60;
      return r > 0 ? `${h}h ${r}m` : `${h}h`;
    }
    return `${min}m`;
  };

  const timeColor = m.escalationMin <= 30 ? "text-red-400" : m.escalationMin <= 90 ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="p-4 flex flex-col justify-center border-l border-white/5 relative z-10 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="w-4 h-4 text-cyan-400" />
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Live Risk Analysis</span>
      </div>

      {/* Overall Deterioration */}
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" /> Deterioration
          </span>
          <span className={`text-lg font-bold font-mono ${riskColor(m.deterioration)}`}>{m.deterioration}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className={`h-full rounded-full ${riskBg(m.deterioration)} transition-all duration-500 shadow-sm ${riskGlow(m.deterioration)}`} style={{ width: `${m.deterioration}%` }} />
        </div>
        {/* Sub-risks: Sepsis, Shock, Stroke */}
        <div className="space-y-1.5 pt-1">
          {[
            { label: "Sepsis", value: m.sepsis, icon: "🦠" },
            { label: "Shock", value: m.shock, icon: "⚡" },
            { label: "Stroke", value: m.stroke, icon: "🧠" },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <span className="text-xs w-4 text-center">{r.icon}</span>
              <span className="text-[10px] text-slate-400 w-12 font-medium">{r.label}</span>
              <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full ${riskBg(r.value)} transition-all duration-500`} style={{ width: `${r.value}%` }} />
              </div>
              <span className={`text-[10px] font-mono font-semibold w-8 text-right ${riskColor(r.value)}`}>{r.value}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mortality Rate */}
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Skull className="w-3 h-3 text-rose-400" /> Mortality Risk
          </span>
          <span className={`text-lg font-bold font-mono ${riskColor(m.mortality)}`}>{m.mortality}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
          <div className={`h-full rounded-full ${riskBg(m.mortality)} transition-all duration-500 shadow-sm ${riskGlow(m.mortality)}`} style={{ width: `${m.mortality}%` }} />
        </div>
        <p className="text-[9px] text-slate-500 mt-1.5">
          {m.mortality >= 50 ? "Critical — immediate intervention needed" : m.mortality >= 25 ? "Elevated — close monitoring required" : "Stable — standard observation"}
        </p>
      </div>

      {/* Escalation Time */}
      <div className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Timer className="w-3 h-3 text-cyan-400" /> Escalation Window
          </span>
          <span className={`text-lg font-bold font-mono ${timeColor}`}>{formatTime(m.escalationMin)}</span>
        </div>
        <p className="text-[9px] text-slate-500 mt-1.5">
          {m.escalationMin <= 30 ? "Rapid escalation likely — triage urgently" : m.escalationMin <= 90 ? "Moderate window — prioritize assessment" : "Extended window — standard workflow"}
        </p>
      </div>

      <p className="text-[8px] text-slate-600 text-center pt-1 leading-relaxed">
        Updates live from patient vitals & history
      </p>
    </div>
  );
}

export default function TriagePage() {
  const { t } = useI18n();
  const [form, setForm] = useState<PatientInput>({ ...DEFAULT_FORM });
  const [metaSymptoms, setMetaSymptoms] = useState<string[]>([]);
  const [metaConditions, setMetaConditions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // symptom search
  const [symptomQuery, setSymptomQuery] = useState("");
  const [conditionQuery, setConditionQuery] = useState("");

  // Voice recognition
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<ReturnType<typeof Object> | null>(null);

  // EHR upload
  const [ehrFile, setEhrFile] = useState<File | null>(null);
  const [ehrLoading, setEhrLoading] = useState(false);
  const [ehrMessage, setEhrMessage] = useState<string | null>(null);

  useEffect(() => {
    getMetaSymptoms()
      .then((data) => {
        setMetaSymptoms(data.symptoms);
        setMetaConditions(data.conditions);
      })
      .catch(console.error);

    // Check voice recognition support
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
    }
  }, []);

  const toggleVoice = useCallback(() => {
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening && recognitionRef.current) {
      (recognitionRef.current as { stop: () => void }).stop();
      setIsListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: { results: { transcript: string }[][] }) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      // Try to match spoken words to known symptoms
      const spoken = transcript.split(/[,;.]+|\band\b/).map((s: string) => s.trim()).filter(Boolean);
      let matched = 0;
      for (const phrase of spoken) {
        const match = metaSymptoms.find(
          (ms) =>
            ms.toLowerCase() === phrase ||
            ms.toLowerCase().includes(phrase) ||
            phrase.includes(ms.toLowerCase())
        );
        if (match && !form.symptoms.includes(match)) {
          setForm((prev) => ({ ...prev, symptoms: [...prev.symptoms, match] }));
          matched++;
        }
      }
      // If nothing matched, try each word individually
      if (matched === 0) {
        const words = transcript.split(/\s+/);
        for (const word of words) {
          if (word.length < 3) continue;
          const match = metaSymptoms.find(
            (ms) => ms.toLowerCase().includes(word) || word.includes(ms.toLowerCase())
          );
          if (match && !form.symptoms.includes(match)) {
            setForm((prev) => ({ ...prev, symptoms: [...prev.symptoms, match] }));
            matched++;
          }
        }
      }
      if (matched > 0) {
        setToast(`Added ${matched} symptom${matched > 1 ? "s" : ""} via voice`);
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast(`Voice: "${transcript}" — no matching symptoms found`);
        setTimeout(() => setToast(null), 4000);
      }
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  }, [isListening, metaSymptoms, form.symptoms]);

  const updateField = useCallback(
    <K extends keyof PatientInput>(key: K, val: PatientInput[K]) => {
      setForm((prev) => ({ ...prev, [key]: val }));
    },
    []
  );

  const toggleItem = useCallback(
    (key: "symptoms" | "pre_existing_conditions", item: string) => {
      setForm((prev) => {
        const list = prev[key] as string[];
        return {
          ...prev,
          [key]: list.includes(item)
            ? list.filter((s) => s !== item)
            : [...list, item],
        };
      });
    },
    []
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    setToast(null);
    try {
      const res = await submitTriage(form);
      setResult(res);
      setToast(`✅ Patient "${res.patient_name}" triaged as ${res.risk_level} risk`);
      setTimeout(() => setToast(null), 5000);
      setTimeout(() => {
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Triage failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEhrUpload = async () => {
    if (!ehrFile) return;
    setEhrLoading(true);
    setEhrMessage(null);
    try {
      const res = await uploadEHR(ehrFile);
      const fields = res.extracted_fields as Record<string, unknown>;
      // merge extracted fields into form
      setForm((prev) => ({
        ...prev,
        ...(fields.name && typeof fields.name === "string"
          ? { name: fields.name }
          : {}),
        ...(fields.age && typeof fields.age === "number"
          ? { age: fields.age }
          : {}),
        ...(fields.gender && typeof fields.gender === "string"
          ? { gender: fields.gender }
          : {}),
        ...(fields.bp_systolic && typeof fields.bp_systolic === "number"
          ? { bp_systolic: fields.bp_systolic }
          : {}),
        ...(fields.bp_diastolic && typeof fields.bp_diastolic === "number"
          ? { bp_diastolic: fields.bp_diastolic }
          : {}),
        ...(fields.heart_rate && typeof fields.heart_rate === "number"
          ? { heart_rate: fields.heart_rate }
          : {}),
        ...(fields.temperature && typeof fields.temperature === "number"
          ? { temperature: fields.temperature }
          : {}),
        ...(fields.spo2 && typeof fields.spo2 === "number"
          ? { spo2: fields.spo2 }
          : {}),
        ...(fields.symptoms && Array.isArray(fields.symptoms)
          ? { symptoms: fields.symptoms as string[] }
          : {}),
        ...(fields.pre_existing_conditions &&
        Array.isArray(fields.pre_existing_conditions)
          ? {
              pre_existing_conditions:
                fields.pre_existing_conditions as string[],
            }
          : {}),
      }));
      setEhrMessage(`Extracted ${Object.keys(fields).length} fields from ${res.source_file}`);
    } catch {
      setEhrMessage("Failed to parse EHR document.");
    } finally {
      setEhrLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hero header with 3D viewer */}
      <div className="glass-card rounded-3xl overflow-hidden animate-fade-up relative">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 pointer-events-none" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_280px] gap-0">
          {/* Left: Title + info */}
          <div className="p-8 flex flex-col justify-center relative z-10 space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 ring-1 ring-white/10">
                <Send className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">{t("triage.title")}</h1>
                <p className="text-sm text-slate-400 mt-1">{t("triage.subtitle")}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50 animate-pulse" />
                <span className="text-xs text-slate-400">AI-powered 8-step pipeline with SHAP explainability</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse" style={{ animationDelay: '0.5s' }} />
                <span className="text-xs text-slate-400">Digital twin simulation & deterioration detection</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50 animate-pulse" style={{ animationDelay: '1s' }} />
                <span className="text-xs text-slate-400">Real-time hospital resource matching</span>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              {["XGBoost", "SHAP", "Digital Twin"].map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium text-slate-400 tracking-wide uppercase">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          {/* Right: 3D Spline viewer */}
          <div className="relative overflow-hidden" style={{ minHeight: '380px' }}>
            <Script
              src="https://unpkg.com/@splinetool/viewer@1.12.57/build/spline-viewer.js"
              type="module"
              strategy="lazyOnload"
            />
            {/* @ts-expect-error - spline-viewer is a web component */}
            <spline-viewer
              url="https://prod.spline.design/FU5F2nVr56dYuXUY/scene.splinecode"
              style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
            />
            {/* Overlay covering the Spline watermark */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#070b14] via-[#070b14]/95 to-transparent z-20 flex items-end justify-center pb-2">
              <span className="text-[10px] text-slate-500 tracking-widest uppercase font-medium flex items-center gap-1.5">
                <Heart className="w-3 h-3 text-cyan-500/60" />
                Interactive Anatomical Model
              </span>
            </div>
            {/* Top fade for seamless blend */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[rgba(255,255,255,0.04)] to-transparent z-10 pointer-events-none" />
          </div>
          {/* Right: Live Clinical Metrics Panel */}
          <ClinicalMetricsPanel form={form} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input form — left two-thirds */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 space-y-5"
        >
          {/* Demographics */}
          <section className="glass-card card-hover rounded-2xl p-5 space-y-4 animate-fade-up">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-white" />
              </span>
              Patient Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  {t("triage.fullName")}
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all hover:border-white/20"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">{t("triage.age")}</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={120}
                  value={form.age}
                  onChange={(e) => updateField("age", +e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all hover:border-white/20"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  {t("triage.gender")}
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => updateField("gender", e.target.value)}
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm text-[var(--input-text)] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all hover:border-white/20"
                >
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Vitals */}
          <section className="glass-card card-hover rounded-2xl p-5 space-y-4 animate-fade-up" style={{ animationDelay: '70ms' }}>
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-white" />
              </span>
              Vital Signs
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <VitalInput
                icon={<Heart className="w-3.5 h-3.5 text-red-400" />}
                label="BP Systolic"
                unit="mmHg"
                value={form.bp_systolic}
                onChange={(v) => updateField("bp_systolic", v)}
                min={50}
                max={300}
              />
              <VitalInput
                icon={<Heart className="w-3.5 h-3.5 text-red-400" />}
                label="BP Diastolic"
                unit="mmHg"
                value={form.bp_diastolic}
                onChange={(v) => updateField("bp_diastolic", v)}
                min={30}
                max={200}
              />
              <VitalInput
                icon={<Activity className="w-3.5 h-3.5 text-pink-400" />}
                label="Heart Rate"
                unit="bpm"
                value={form.heart_rate}
                onChange={(v) => updateField("heart_rate", v)}
                min={20}
                max={250}
              />
              <VitalInput
                icon={<Thermometer className="w-3.5 h-3.5 text-amber-400" />}
                label="Temperature"
                unit="°F"
                value={form.temperature}
                onChange={(v) => updateField("temperature", v)}
                min={90}
                max={110}
                step={0.1}
              />
              <VitalInput
                icon={<Droplets className="w-3.5 h-3.5 text-blue-400" />}
                label="SpO2"
                unit="%"
                value={form.spo2}
                onChange={(v) => updateField("spo2", v)}
                min={50}
                max={100}
              />
            </div>
          </section>

          {/* Symptoms */}
          <section className="glass-card card-hover rounded-2xl p-5 space-y-3 animate-fade-up" style={{ animationDelay: '140ms' }}>
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <ShieldAlert className="w-3.5 h-3.5 text-white" />
              </span>
              Symptoms
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    isListening
                      ? "bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse"
                      : "bg-white/8 text-slate-400 hover:bg-blue-500/10 hover:text-cyan-400 border border-white/10"
                  }`}
                  title={isListening ? "Stop listening" : "Voice input — speak your symptoms"}
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {isListening ? "..." : t("triage.voice")}
                </button>
              )}
            </h2>
            {/* Search filter */}
            <input
              type="text"
              value={symptomQuery}
              onChange={(e) => setSymptomQuery(e.target.value)}
              placeholder={isListening ? "🎤 ..." : t("triage.searchSymptoms")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all hover:border-white/20"
            />
            {/* Checkbox grid */}
            <div className="max-h-52 overflow-y-auto pr-1 scrollbar-thin">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {metaSymptoms
                  .filter((s) => s.toLowerCase().includes(symptomQuery.toLowerCase()))
                  .map((s) => {
                    const checked = form.symptoms.includes(s);
                    return (
                      <label
                        key={s}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-all select-none ${
                          checked
                            ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30"
                            : "bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem("symptoms", s)}
                          className="sr-only"
                        />
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          checked ? "bg-blue-500 border-blue-400" : "border-slate-600 bg-white/5"
                        }`}>
                          {checked && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="truncate">{s}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          </section>

          {/* Conditions */}
          <section className="glass-card card-hover rounded-2xl p-5 space-y-3 animate-fade-up" style={{ animationDelay: '210ms' }}>
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center">
                <AlertCircle className="w-3.5 h-3.5 text-white" />
              </span>
              Pre-existing Conditions
            </h2>
            {/* Search filter */}
            <input
              type="text"
              value={conditionQuery}
              onChange={(e) => setConditionQuery(e.target.value)}
              placeholder={t("triage.searchConditions")}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all hover:border-white/20"
            />
            {/* Checkbox grid */}
            <div className="max-h-52 overflow-y-auto pr-1 scrollbar-thin">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {metaConditions
                  .filter((c) => c.toLowerCase().includes(conditionQuery.toLowerCase()))
                  .map((c) => {
                    const checked = form.pre_existing_conditions.includes(c);
                    return (
                      <label
                        key={c}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs cursor-pointer transition-all select-none ${
                          checked
                            ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
                            : "bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem("pre_existing_conditions", c)}
                          className="sr-only"
                        />
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          checked ? "bg-amber-500 border-amber-400" : "border-slate-600 bg-white/5"
                        }`}>
                          {checked && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="truncate">{c}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          </section>

          {/* Insurance */}
          <section className="glass-card card-hover rounded-2xl p-5 space-y-4 animate-fade-up" style={{ animationDelay: '280ms' }}>
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-white" />
              </span>
              Insurance
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  {t("triage.provider")}
                </label>
                <select
                  value={form.insurance_provider}
                  onChange={(e) =>
                    updateField("insurance_provider", e.target.value)
                  }
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm text-[var(--input-text)] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all hover:border-white/20"
                >
                  {INSURERS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  {t("triage.responseHours")}
                </label>
                <input
                  type="number"
                  min={0}
                  max={48}
                  step={0.5}
                  value={form.insurance_response_hours}
                  onChange={(e) =>
                    updateField("insurance_response_hours", +e.target.value)
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all hover:border-white/20"
                />
              </div>
            </div>
          </section>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !form.name}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-3.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5"
          >
            {submitting ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                {t("triage.running")}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> {t("triage.submit")}
              </>
            )}
          </button>
        </form>

        {/* EHR upload — right column */}
        <div className="space-y-4">
          <div className="glass-card card-hover rounded-2xl p-5 space-y-3 animate-fade-up">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <Upload className="w-3.5 h-3.5 text-white" />
              </span>
              Upload EHR
            </h3>
            <p className="text-xs text-slate-500">
              {t("triage.uploadDesc")}
            </p>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={(e) => setEhrFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-500/10 file:text-blue-400 file:text-xs hover:file:bg-blue-100 file:cursor-pointer cursor-pointer"
            />
            <button
              type="button"
              onClick={handleEhrUpload}
              disabled={!ehrFile || ehrLoading}
              className="w-full flex items-center justify-center gap-2 bg-white/8 hover:bg-white/10 text-slate-300 text-sm py-2 rounded-lg transition-colors disabled:opacity-40"
            >
              {ehrLoading ? (
                <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {t("triage.parseDoc")}
            </button>
            {ehrMessage && (
              <p className="text-xs text-cyan-400 mt-1">{ehrMessage}</p>
            )}
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-slide-in">
          <div className="bg-emerald-600/90 backdrop-blur-sm text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 border border-emerald-500/40">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{toast}</p>
            <button onClick={() => setToast(null)} className="ml-2 text-emerald-200 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results panel */}
      {result && (
        <div className="space-y-6" id="results">
          <hr className="border-white/10/50" />
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-4.5 h-4.5 text-white" />
              </span>
              Triage Result
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3.5 py-2 glass-card text-slate-400 rounded-xl text-xs hover:bg-white/90 transition-all shadow-sm border border-white/10/60"
              >
                <Printer className="w-3.5 h-3.5" /> {t("triage.print")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob(
                    [JSON.stringify(result, null, 2)],
                    { type: "application/json" }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `triage-${result.patient_id}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/20"
              >
                <Download className="w-3.5 h-3.5" /> {t("triage.export")}
              </button>
            </div>
          </div>

          {/* top summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card card-hover rounded-2xl p-5 flex flex-col items-center gap-2 animate-fade-up">
              <span className="text-xs text-slate-500">{t("triage.riskLevel")}</span>
              <RiskBadge level={result.risk_level} size="lg" />
              <span className="text-xs text-slate-400 mt-1">
                Confidence: {(result.confidence * 100).toFixed(1)}%
              </span>
              {result.override && (
                <span className="text-xs text-red-400 mt-1">
                  ⚠ Override: {result.override_reason}
                </span>
              )}
            </div>
            <div className="glass-card card-hover rounded-2xl p-5 animate-fade-up" style={{ animationDelay: '70ms' }}>
              <span className="text-xs text-slate-500">Department</span>
              <p className="text-lg font-bold text-white mt-1 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-cyan-400" />{" "}
                {result.department.recommended_department}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Score: {(result.department.confidence_score * 100).toFixed(0)}%
              </p>
              {result.department.reasons.length > 0 && (
                <ul className="mt-2 space-y-0.5">
                  {result.department.reasons.map((r, i) => (
                    <li key={i} className="text-xs text-slate-500">
                      • {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="glass-card card-hover rounded-2xl p-5 animate-fade-up" style={{ animationDelay: '140ms' }}>
              <span className="text-xs text-slate-500">
                Deterioration Score
              </span>
              <p
                className={`text-3xl font-bold mt-1 ${
                  result.deterioration.deterioration_score >= 60
                    ? "text-red-400"
                    : result.deterioration.deterioration_score >= 30
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}
              >
                {result.deterioration.deterioration_score}
              </p>
              {result.deterioration.has_critical_alert && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />{" "}
                  {result.deterioration.alert_count} critical alert(s)
                </p>
              )}
            </div>
          </div>

          {/* SHAP explanation */}
          {result.shap_factors.length > 0 && (
            <div className="glass-card card-hover rounded-2xl p-5 animate-fade-up">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-white" />
                </span>
                AI Explainability — SHAP Factor Analysis
              </h3>
              <ShapChart factors={result.shap_factors} />
            </div>
          )}

          {/* Digital Twin */}
          {result.digital_twin && (
            <div className="glass-card card-hover rounded-2xl p-5 animate-fade-up space-y-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-1 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-white" />
                </span>
                Digital Twin — Projected Trajectory
              </h3>
              <p className="text-xs text-slate-500 mb-3">
                {result.digital_twin.summary}
              </p>
              <DigitalTwinChart
                timeline={result.digital_twin.timeline}
                escalationPoint={result.digital_twin.escalation_point_min}
              />

              {/* ── Text-based Escalation Timeline ── */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
                    <Clock className="w-3 h-3 text-white" />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Health Escalation Timeline — If Left Untreated
                  </h4>
                </div>

                {/* Summary banner */}
                <div className={`rounded-xl p-3.5 mb-4 border ${
                  result.digital_twin.escalation_point_min !== null
                    ? "bg-red-500/8 border-red-500/20"
                    : result.digital_twin.starting_risk === "High"
                    ? "bg-amber-500/8 border-amber-500/20"
                    : "bg-emerald-500/8 border-emerald-500/20"
                }`}>
                  <div className="flex items-center gap-2">
                    {result.digital_twin.escalation_point_min !== null ? (
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    ) : result.digital_twin.starting_risk === "High" ? (
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span className={`text-xs font-medium ${
                      result.digital_twin.escalation_point_min !== null
                        ? "text-red-300"
                        : result.digital_twin.starting_risk === "High"
                        ? "text-amber-300"
                        : "text-emerald-300"
                    }`}>
                      {result.digital_twin.escalation_point_min !== null
                        ? `Risk escalates from ${result.digital_twin.starting_risk} → ${result.digital_twin.projected_final_risk} within ${result.digital_twin.escalation_point_min} minutes without intervention`
                        : result.digital_twin.starting_risk === "High"
                        ? `Already at High risk — condition projected to continue deteriorating`
                        : `Condition appears stable at ${result.digital_twin.starting_risk} risk over the projection window`
                      }
                    </span>
                  </div>
                </div>

                {/* Timeline steps */}
                <div className="relative">
                  {/* Vertical connecting line */}
                  <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gradient-to-b from-emerald-500/30 via-amber-500/30 to-red-500/30" />

                  <div className="space-y-0">
                    {result.digital_twin.timeline.map((step, idx) => {
                      const isEscalation = result.digital_twin!.escalation_point_min !== null &&
                        step.time_minutes === result.digital_twin!.escalation_point_min;
                      const riskColor = step.risk_level === "High"
                        ? { dot: "bg-red-500 shadow-red-500/50", text: "text-red-400", bg: "bg-red-500/10 border-red-500/20", badge: "bg-red-500/20 text-red-300" }
                        : step.risk_level === "Medium"
                        ? { dot: "bg-amber-500 shadow-amber-500/50", text: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", badge: "bg-amber-500/20 text-amber-300" }
                        : { dot: "bg-emerald-500 shadow-emerald-500/50", text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", badge: "bg-emerald-500/20 text-emerald-300" };
                      const prevStep = idx > 0 ? result.digital_twin!.timeline[idx - 1] : null;
                      const riskChanged = prevStep && prevStep.risk_level !== step.risk_level;

                      return (
                        <div key={step.time_minutes} className={`relative pl-10 py-3 ${isEscalation ? "scale-[1.01]" : ""}`}>
                          {/* Dot on timeline */}
                          <div className={`absolute left-[11px] top-[18px] w-[9px] h-[9px] rounded-full ${riskColor.dot} shadow-sm ring-2 ring-slate-900 z-10 ${isEscalation ? "ring-red-500/30 w-[11px] h-[11px] left-[10px]" : ""}`} />

                          <div className={`rounded-xl p-3.5 border transition-all ${isEscalation ? "border-red-500/30 bg-red-500/[0.06] ring-1 ring-red-500/10" : "border-white/[0.06] bg-white/[0.02]"}`}>
                            {/* Header row */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono font-semibold text-slate-300">
                                  T+{step.time_minutes === 0 ? "0" : step.time_minutes} min
                                </span>
                                {isEscalation && (
                                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[9px] font-bold text-red-300 uppercase tracking-wider animate-pulse">
                                    ⚠ Escalation Point
                                  </span>
                                )}
                                {riskChanged && !isEscalation && (
                                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-[9px] font-semibold text-amber-300 uppercase tracking-wider">
                                    Risk Changed
                                  </span>
                                )}
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${riskColor.badge}`}>
                                {step.risk_level} Risk
                              </span>
                            </div>

                            {/* Vitals grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                              {[
                                { label: "HR", value: Math.round(step.vitals.heart_rate), unit: "bpm", warn: step.vitals.heart_rate > 100 || step.vitals.heart_rate < 55 },
                                { label: "BP", value: Math.round(step.vitals.bp_systolic), unit: "mmHg", warn: step.vitals.bp_systolic > 160 || step.vitals.bp_systolic < 90 },
                                { label: "SpO2", value: Math.round(step.vitals.spo2 * 10) / 10, unit: "%", warn: step.vitals.spo2 < 93 },
                                { label: "Temp", value: Math.round(step.vitals.temperature * 10) / 10, unit: "°F", warn: step.vitals.temperature > 101 || step.vitals.temperature < 96 },
                                { label: "Risk", value: Math.round(step.risk_score * 100), unit: "%", warn: step.risk_score > 0.6 },
                              ].map((v) => (
                                <div key={v.label} className={`rounded-lg px-2.5 py-1.5 text-center ${v.warn ? "bg-red-500/10 border border-red-500/15" : "bg-white/[0.03]"}`}>
                                  <div className={`text-[10px] tracking-wide ${v.warn ? "text-red-400" : "text-slate-500"}`}>{v.label}</div>
                                  <div className={`text-sm font-semibold font-mono ${v.warn ? "text-red-300" : "text-slate-300"}`}>
                                    {v.value}<span className="text-[9px] text-slate-500 ml-0.5">{v.unit}</span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Contextual message */}
                            {step.time_minutes === 0 && (
                              <p className="mt-2 text-[10px] text-slate-500 italic">
                                Baseline vitals at time of triage assessment
                              </p>
                            )}
                            {isEscalation && (
                              <p className="mt-2 text-[10px] text-red-400/80 font-medium">
                                ⚠ Patient condition crosses into {step.risk_level} risk territory — immediate intervention recommended
                              </p>
                            )}
                            {step.time_minutes > 0 && step.risk_level === "High" && !isEscalation && (
                              <p className="mt-2 text-[10px] text-red-400/60">
                                Continued deterioration — delay in treatment increases adverse outcome probability
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom summary */}
                <div className="mt-4 rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Starting Risk</div>
                      <span className={`text-sm font-bold ${
                        result.digital_twin.starting_risk === "High" ? "text-red-400" : result.digital_twin.starting_risk === "Medium" ? "text-amber-400" : "text-emerald-400"
                      }`}>{result.digital_twin.starting_risk}</span>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Projected Risk</div>
                      <span className={`text-sm font-bold ${
                        result.digital_twin.projected_final_risk === "High" ? "text-red-400" : result.digital_twin.projected_final_risk === "Medium" ? "text-amber-400" : "text-emerald-400"
                      }`}>{result.digital_twin.projected_final_risk}</span>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Escalation At</div>
                      <span className="text-sm font-bold text-slate-300 font-mono">
                        {result.digital_twin.escalation_point_min !== null ? `${result.digital_twin.escalation_point_min} min` : "None"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Deterioration alerts */}
          {result.deterioration.alerts.length > 0 && (
            <div className="glass-card card-hover rounded-2xl p-5 animate-fade-up">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center">
                  <AlertCircle className="w-3.5 h-3.5 text-white" />
                </span>
                Deterioration Alerts
              </h3>
              <div className="space-y-3">
                {result.deterioration.alerts.map((a, i) => (
                  <div
                    key={i}
                    className={`rounded-lg p-3 border ${
                      a.severity === "critical"
                        ? "bg-red-500/10 border-red-500/20"
                        : a.severity === "warning"
                        ? "bg-amber-500/10 border-amber-500/20"
                        : "bg-blue-500/10 border-blue-500/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-semibold uppercase ${
                          a.severity === "critical"
                            ? "text-red-400"
                            : a.severity === "warning"
                            ? "text-amber-400"
                            : "text-blue-400"
                        }`}
                      >
                        {a.type} — {a.severity}
                      </span>
                      <span className="text-xs text-slate-500">
                        Score: {a.score}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      {a.recommendation}
                    </p>
                    {a.triggers.length > 0 && (
                      <p className="text-xs text-slate-500 mt-1">
                        Triggers: {a.triggers.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insurance risk */}
          {result.insurance_risk && (
            <div className="glass-card card-hover rounded-2xl p-5 animate-fade-up">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-white" />
                </span>
                Insurance Wait-Time Risk
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-3">
                <div>
                  <p className="text-xs text-slate-500">Insurer</p>
                  <p className="text-sm text-white font-medium">
                    {result.insurance_risk.insurance_response.insurer}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Est. Wait</p>
                  <p className="text-sm text-white font-medium">
                    {result.insurance_risk.insurance_response.estimated_minutes}{" "}
                    min
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Risk Now</p>
                  <p className="text-sm text-white font-medium">
                    {result.insurance_risk.current_risk}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Risk After Wait</p>
                  <p
                    className={`text-sm font-medium ${
                      result.insurance_risk.escalation_during_wait
                        ? "text-red-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {result.insurance_risk.risk_at_insurance_response}
                  </p>
                </div>
              </div>
              <div
                className={`rounded-lg p-3 text-xs ${
                  result.insurance_risk.urgency === "BYPASS_INSURANCE"
                    ? "bg-red-500/10 border border-red-500/20 text-red-400"
                    : result.insurance_risk.urgency === "EXPEDITE"
                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                    : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                }`}
              >
                {result.insurance_risk.advisory}
              </div>
            </div>
          )}

          {/* Resource status */}
          {result.resource_status && (
            <div className="glass-card card-hover rounded-2xl p-5 animate-fade-up">
              <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-white" />
                </span>
                Hospital Resource Status
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-3">
                <div>
                  <p className="text-xs text-slate-500">Department</p>
                  <p className="text-sm text-white font-medium">
                    {result.resource_status.department}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Occupancy</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-16 bg-white/8 rounded-full h-2">
                      <div
                        className={`h-full rounded-full ${
                          result.resource_status.occupancy_percent >= 90
                            ? "bg-red-500/100"
                            : result.resource_status.occupancy_percent >= 70
                            ? "bg-amber-500/100"
                            : "bg-emerald-500/100"
                        }`}
                        style={{
                          width: `${result.resource_status.occupancy_percent}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm text-white font-mono">
                      {result.resource_status.occupancy_percent}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Beds Available</p>
                  <p className="text-sm text-white font-medium">
                    {result.resource_status.beds_available}
                  </p>
                </div>
              </div>
              {result.resource_status.alternatives.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">
                    Alternative Hospitals
                  </p>
                  <div className="space-y-1">
                    {result.resource_status.alternatives.map((alt, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-xs bg-white/5 rounded-lg px-3 py-1.5"
                      >
                        <span className="text-slate-300">{alt.hospital}</span>
                        <span className="text-slate-500">
                          {alt.distance_km} km · {alt.beds_available} beds
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-cyan-400 mt-2">
                {result.resource_status.recommendation}
              </p>
            </div>
          )}

          {/* Symptom issues */}
          {result.symptom_issues.has_issues && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-400 mb-2">
                {t("triage.dataWarnings")}
              </h3>
              <ul className="space-y-1">
                {result.symptom_issues.issues.map((iss, i) => (
                  <li key={i} className="text-xs text-amber-400">
                    [{iss.severity}] {iss.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────── small presentational component ─────── */

function VitalInput({
  icon,
  label,
  unit,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  icon: React.ReactNode;
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs text-slate-500 mb-1">
        {icon} {label}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          min={min}
          max={max}
          step={step}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none pr-12 transition-all hover:border-white/20"
        />
        <span className="absolute right-3 top-2.5 text-xs text-slate-400">
          {unit}
        </span>
      </div>
    </div>
  );
}
