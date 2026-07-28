const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PatientInput {
  name: string;
  age: number;
  gender: string;
  symptoms: string[];
  bp_systolic: number;
  bp_diastolic: number;
  heart_rate: number;
  temperature: number;
  spo2: number;
  pre_existing_conditions: string[];
  insurance_provider: string;
  insurance_response_hours: number;
}

export interface ShapFactor {
  feature: string;
  impact: number;
  value: number;
  direction: "up" | "down";
}

export interface TriageResult {
  patient_id: string;
  patient_name: string;
  timestamp: string;
  risk_level: "Low" | "Medium" | "High";
  confidence: number;
  probabilities: Record<string, number>;
  override: boolean;
  override_reason: string | null;
  shap_factors: ShapFactor[];
  department: {
    recommended_department: string;
    confidence_score: number;
    reasons: string[];
    alternatives: { department: string; score: number }[];
  };
  deterioration: {
    deterioration_score: number;
    has_critical_alert: boolean;
    alert_count: number;
    alerts: {
      type: string;
      severity: string;
      score: number;
      triggers: string[];
      recommendation: string;
    }[];
  };
  symptom_issues: {
    has_issues: boolean;
    issue_count: number;
    issues: { severity: string; code: string; message: string }[];
  };
  insurance_risk: {
    insurance_response: {
      insurer: string;
      estimated_minutes: number;
      fast_track_available: boolean;
    };
    current_risk: string;
    risk_at_insurance_response: string;
    escalation_during_wait: boolean;
    urgency: string;
    advisory: string;
  } | null;
  resource_status: {
    department: string;
    status: string;
    occupancy_percent: number;
    beds_available: number;
    alternatives: { hospital: string; distance_km: number; beds_available: number }[];
    recommendation: string;
  } | null;
  digital_twin: {
    summary: string;
    starting_risk: string;
    projected_final_risk: string;
    escalation_point_min: number | null;
    profile: string;
    timeline: {
      time_minutes: number;
      vitals: Record<string, number>;
      risk_score: number;
      risk_level: string;
    }[];
  } | null;
  input_data: PatientInput;
}

export interface DashboardStats {
  total_patients: number;
  risk_distribution: Record<string, number>;
  department_distribution: Record<string, number>;
  avg_confidence: number;
  critical_alerts: number;
  recent_patients: {
    patient_id: string;
    patient_name: string;
    risk_level: string;
    department: string;
    confidence: number;
    timestamp: string;
    deterioration_score: number;
  }[];
  resource_summary: Record<string, unknown>;
}

export async function submitTriage(data: PatientInput): Promise<TriageResult> {
  // Convert Fahrenheit to Celsius for backend
  const payload = {
    ...data,
    temperature: Math.round(((data.temperature - 32) * 5) / 9 * 10) / 10,
  };
  const res = await fetch(`${API_BASE}/api/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (Array.isArray(err.detail)) {
      const msgs = err.detail.map((d: { msg?: string; loc?: string[] }) =>
        `${d.loc?.slice(-1)?.[0] || "field"}: ${d.msg || "invalid"}`
      );
      throw new Error(msgs.join("; "));
    }
    throw new Error(typeof err.detail === "string" ? err.detail : "Triage request failed");
  }
  return res.json();
}

export async function uploadEHR(file: File): Promise<{
  source_file: string;
  extracted_fields: Record<string, unknown>;
  message: string;
}> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload-ehr`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("EHR upload failed");
  return res.json();
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/api/dashboard/stats`);
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}

export async function getPatientList(): Promise<TriageResult[]> {
  const res = await fetch(`${API_BASE}/api/dashboard/patients`);
  if (!res.ok) throw new Error("Failed to fetch patients");
  return res.json();
}

export async function getPatientDetail(id: string): Promise<TriageResult> {
  const res = await fetch(`${API_BASE}/api/dashboard/patient/${id}`);
  if (!res.ok) throw new Error("Patient not found");
  return res.json();
}

export async function getMetaSymptoms(): Promise<{
  symptoms: string[];
  conditions: string[];
}> {
  const res = await fetch(`${API_BASE}/api/meta/symptoms`);
  if (!res.ok) throw new Error("Failed to fetch symptoms list");
  return res.json();
}

export async function getResources(): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/resources`);
  if (!res.ok) throw new Error("Failed to fetch resources");
  return res.json();
}

export interface ModelMetrics {
  accuracy: number;
  per_class: Record<
    string,
    { precision: number; recall: number; "f1-score": number; support: number }
  >;
  confusion_matrix: number[][];
  classes: string[];
  feature_count: number;
  train_size: number;
  test_size: number;
}

export async function getModelMetrics(): Promise<ModelMetrics> {
  const res = await fetch(`${API_BASE}/api/model/metrics`);
  if (!res.ok) throw new Error("Failed to fetch model metrics");
  return res.json();
}

export interface FairnessGroupMetric {
  group: string;
  count: number;
  accuracy: number;
  risk_distribution: Record<string, number>;
  high_risk_rate: number;
  per_class?: Record<string, { precision: number; recall: number; f1: number }>;
}

export interface FairnessResult {
  overall_accuracy: number;
  total_samples: number;
  gender_analysis: FairnessGroupMetric[];
  age_analysis: FairnessGroupMetric[];
  disparate_impact: Record<string, { rates: Record<string, number>; ratios: Record<string, number>; fair: boolean }>;
  demographic_parity: Record<string, { group_rates: Record<string, number>; max_difference: number; fair: boolean }>;
  equalized_odds: Record<string, { groups: Record<string, { tpr: number; fpr: number }>; tpr_difference: number; fpr_difference: number; fair: boolean }>;
  fairness_summary: string;
}

export async function getModelFairness(): Promise<FairnessResult> {
  const res = await fetch(`${API_BASE}/api/model/fairness`);
  if (!res.ok) throw new Error("Failed to fetch fairness analysis");
  return res.json();
}

/* ═══════════════════════════════════════════════════════════════
   Hospital / Doctor / Assignment Management
   ═══════════════════════════════════════════════════════════════ */

export interface HospitalInfra {
  total_beds: number;
  icu_beds: number;
  ventilators: number;
  monitors: number;
  operation_theatres: number;
  ambulances: number;
  xray_machines: number;
  mri_scanners: number;
  ct_scanners: number;
  blood_bank: boolean;
  pharmacy: boolean;
  lab: boolean;
}

export interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string;
  type: string;
  departments: string[];
  infrastructure: HospitalInfra;
  created_at: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualification: string;
  experience_years: number;
  phone: string;
  email: string;
  hospital_id: string;
  available: boolean;
  max_patients: number;
  current_patients: number;
  created_at: string;
}

export interface Assignment {
  id: string;
  patient_id: string;
  patient_name: string;
  risk_level: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialization: string;
  hospital_id: string;
  hospital_name: string;
  department: string;
  priority: string;
  notes: string;
  status: string;
  assigned_at: string;
}

// ── Hospitals ──

export async function createHospital(data: Record<string, unknown>): Promise<Hospital> {
  const res = await fetch(`${API_BASE}/api/hospitals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create hospital");
  return res.json();
}

export async function listHospitals(): Promise<Hospital[]> {
  const res = await fetch(`${API_BASE}/api/hospitals`);
  if (!res.ok) throw new Error("Failed to fetch hospitals");
  return res.json();
}

export async function deleteHospital(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/hospitals/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete hospital");
}

// ── Doctors ──

export async function createDoctor(data: Record<string, unknown>): Promise<Doctor> {
  const res = await fetch(`${API_BASE}/api/doctors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create doctor");
  return res.json();
}

export async function listDoctors(): Promise<Doctor[]> {
  const res = await fetch(`${API_BASE}/api/doctors`);
  if (!res.ok) throw new Error("Failed to fetch doctors");
  return res.json();
}

export async function deleteDoctor(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/doctors/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete doctor");
}

// ── Assignments ──

export async function createAssignment(data: Record<string, unknown>): Promise<Assignment> {
  const res = await fetch(`${API_BASE}/api/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Failed to create assignment");
  }
  return res.json();
}

export async function listAssignments(): Promise<Assignment[]> {
  const res = await fetch(`${API_BASE}/api/assignments`);
  if (!res.ok) throw new Error("Failed to fetch assignments");
  return res.json();
}

export async function deleteAssignment(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/assignments/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete assignment");
}

/* ------------------------------------------------------------------ */
/*  Model Health / Data Drift                                         */
/* ------------------------------------------------------------------ */

export interface FeatureDrift {
  feature: string;
  ks_statistic: number;
  p_value: number;
  drift_detected: boolean;
  training_mean: number;
  training_std: number;
  current_mean: number;
  current_std: number;
}

export interface LabelDrift {
  psi: number;
  training_distribution: Record<string, number>;
  current_distribution: Record<string, number>;
  drift_detected: boolean;
}

export interface ModelInfo {
  model_name: string;
  model_version: string;
  training_date: string;
  training_samples: number;
  features_count: number;
  last_retrain: string;
  accuracy: number;
  f1_score: number;
  auc_roc: number;
}

export interface ModelHealthResponse {
  model_info: ModelInfo;
  feature_drift: FeatureDrift[];
  label_drift: LabelDrift;
  overall_drift_score: number;
  drifted_feature_count: number;
  total_features: number;
  total_patients_analyzed: number;
  needs_retrain: boolean;
  recommendation: string;
}

export async function getModelHealth(): Promise<ModelHealthResponse> {
  const res = await fetch(`${API_BASE}/api/model-health`);
  if (!res.ok) throw new Error("Failed to fetch model health");
  return res.json();
}

export async function triggerRetrain(): Promise<{ status: string; message: string; job_id: string; initiated_at: string }> {
  const res = await fetch(`${API_BASE}/api/model-health/retrain`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to trigger retrain");
  return res.json();
}
