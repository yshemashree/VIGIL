"use client";

import { useEffect, useState, FormEvent } from "react";
import {
  Building2,
  Stethoscope,
  UserCheck,
  Plus,
  Trash2,
  BedDouble,
  Wind,
  Monitor,
  Syringe,
  Ambulance,
  FlaskConical,
  Pill,
  Droplets,
  ScanLine,
  ChevronDown,
  CheckCircle2,
  X,
  AlertTriangle,
  MapPin,
  Phone,
  Mail,
  Award,
  Briefcase,
  Search,
  Users,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  Hospital,
  Doctor,
  Assignment,
  TriageResult,
  createHospital,
  listHospitals,
  deleteHospital,
  createDoctor,
  listDoctors,
  deleteDoctor,
  createAssignment,
  listAssignments,
  deleteAssignment,
  getPatientList,
} from "@/lib/api";

type Tab = "hospitals" | "doctors" | "assignments";

const TABS: { key: Tab; label: string; icon: typeof Building2; gradient: string }[] = [
  { key: "hospitals", label: "Hospital Infrastructure", icon: Building2, gradient: "from-blue-500 to-cyan-500" },
  { key: "doctors", label: "Doctors", icon: Stethoscope, gradient: "from-violet-500 to-purple-500" },
  { key: "assignments", label: "Patient Assignment", icon: UserCheck, gradient: "from-emerald-500 to-teal-500" },
];

const SPECIALIZATIONS = [
  "General Medicine", "Cardiology", "Neurology", "Pulmonology",
  "Gastroenterology", "Orthopedics", "Dermatology", "Emergency Medicine",
  "Pediatrics", "Oncology", "Nephrology", "Urology", "ENT", "Psychiatry",
];

const HOSPITAL_TYPES = ["General", "Specialty", "Teaching", "Trauma Center", "Children's", "Research"];

const DEPT_OPTIONS = [
  "Emergency", "Cardiology", "Neurology", "Pulmonology", "Gastroenterology",
  "General Medicine", "Orthopedics", "Dermatology", "Pediatrics",
  "Oncology", "ICU", "NICU", "Nephrology", "Urology",
];

/* ══════════════════════════════════════════════════════════════════════ */

export default function ManagePage() {
  const [tab, setTab] = useState<Tab>("hospitals");

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Hospital & Staff Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage hospitals, doctors, and patient assignments</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 p-1.5 glass-card rounded-2xl">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
              tab === t.key
                ? `bg-gradient-to-r ${t.gradient} text-white shadow-lg shadow-blue-500/20 scale-[1.02]`
                : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-up">
        {tab === "hospitals" && <HospitalTab />}
        {tab === "doctors" && <DoctorTab />}
        {tab === "assignments" && <AssignmentTab />}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   HOSPITAL TAB
   ══════════════════════════════════════════════════════════════════════ */
function HospitalTab() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [hType, setHType] = useState("General");
  const [depts, setDepts] = useState<string[]>([]);
  const [totalBeds, setTotalBeds] = useState(50);
  const [icuBeds, setIcuBeds] = useState(10);
  const [ventilators, setVentilators] = useState(8);
  const [monitors, setMonitors] = useState(20);
  const [ots, setOts] = useState(4);
  const [ambulances, setAmbulances] = useState(3);
  const [xray, setXray] = useState(2);
  const [mri, setMri] = useState(1);
  const [ct, setCt] = useState(1);
  const [bloodBank, setBloodBank] = useState(true);
  const [pharmacy, setPharmacy] = useState(true);
  const [lab, setLab] = useState(true);

  const load = () => {
    setLoading(true);
    listHospitals().then(setHospitals).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setName(""); setAddress(""); setPhone(""); setHType("General"); setDepts([]);
    setTotalBeds(50); setIcuBeds(10); setVentilators(8); setMonitors(20);
    setOts(4); setAmbulances(3); setXray(2); setMri(1); setCt(1);
    setBloodBank(true); setPharmacy(true); setLab(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createHospital({
        name, address, phone, type: hType, departments: depts,
        total_beds: totalBeds, icu_beds: icuBeds, ventilators, monitors,
        operation_theatres: ots, ambulances, xray_machines: xray,
        mri_scanners: mri, ct_scanners: ct,
        blood_bank: bloodBank, pharmacy, lab,
      });
      setToast(`✅ ${name} registered successfully!`);
      setTimeout(() => setToast(null), 4000);
      resetForm(); setShowForm(false); load();
    } catch { setToast("❌ Failed to register hospital"); setTimeout(() => setToast(null), 4000); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteHospital(id); load(); } catch { /* ignore */ }
  };

  const toggleDept = (d: string) => setDepts(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  if (loading && hospitals.length === 0) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Add Button */}
      <button onClick={() => setShowForm(!showForm)}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
          showForm
            ? "bg-white/8 text-slate-400 hover:bg-white/10"
            : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:-translate-y-0.5 hover:shadow-blue-500/40"
        }`}>
        {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {showForm ? "Cancel" : "Register Hospital"}
      </button>

      {/* Registration Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-5 animate-scale-in ring-1 ring-blue-500/15">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            New Hospital Registration
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput label="Hospital Name" value={name} onChange={setName} required placeholder="City General Hospital" />
            <FormInput label="Address" value={address} onChange={setAddress} placeholder="123 Main St, City" />
            <FormInput label="Phone" value={phone} onChange={setPhone} placeholder="+1 555-0100" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Hospital Type</label>
              <select value={hType} onChange={e => setHType(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm text-[var(--input-text)] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all hover:border-white/20">
                {HOSPITAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Departments</label>
              <div className="flex flex-wrap gap-1.5">
                {DEPT_OPTIONS.map(d => (
                  <button key={d} type="button" onClick={() => toggleDept(d)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                      depts.includes(d) ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-white border-white/10 text-slate-500 hover:border-blue-500/20"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Infrastructure Grid */}
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Infrastructure & Equipment</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <InfraInput icon={<BedDouble className="w-3.5 h-3.5 text-blue-400" />} label="Total Beds" value={totalBeds} onChange={setTotalBeds} />
              <InfraInput icon={<BedDouble className="w-3.5 h-3.5 text-red-400" />} label="ICU Beds" value={icuBeds} onChange={setIcuBeds} />
              <InfraInput icon={<Wind className="w-3.5 h-3.5 text-teal-400" />} label="Ventilators" value={ventilators} onChange={setVentilators} />
              <InfraInput icon={<Monitor className="w-3.5 h-3.5 text-purple-400" />} label="Monitors" value={monitors} onChange={setMonitors} />
              <InfraInput icon={<Syringe className="w-3.5 h-3.5 text-pink-400" />} label="OT Rooms" value={ots} onChange={setOts} />
              <InfraInput icon={<Ambulance className="w-3.5 h-3.5 text-orange-400" />} label="Ambulances" value={ambulances} onChange={setAmbulances} />
              <InfraInput icon={<ScanLine className="w-3.5 h-3.5 text-indigo-400" />} label="X-Ray" value={xray} onChange={setXray} />
              <InfraInput icon={<ScanLine className="w-3.5 h-3.5 text-cyan-400" />} label="MRI Scanners" value={mri} onChange={setMri} />
              <InfraInput icon={<ScanLine className="w-3.5 h-3.5 text-amber-400" />} label="CT Scanners" value={ct} onChange={setCt} />
            </div>
          </div>

          {/* Facility Toggles */}
          <div className="flex flex-wrap gap-3">
            <FacilityToggle icon={<Droplets className="w-3.5 h-3.5" />} label="Blood Bank" on={bloodBank} onToggle={setBloodBank} />
            <FacilityToggle icon={<Pill className="w-3.5 h-3.5" />} label="Pharmacy" on={pharmacy} onToggle={setPharmacy} />
            <FacilityToggle icon={<FlaskConical className="w-3.5 h-3.5" />} label="Laboratory" on={lab} onToggle={setLab} />
          </div>

          <button type="submit" disabled={submitting || !name}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-40 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5">
            {submitting ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Plus className="w-4 h-4" />}
            {submitting ? "Registering..." : "Register Hospital"}
          </button>
        </form>
      )}

      {/* Hospital Cards */}
      {hospitals.length === 0 ? (
        <EmptyState icon={<Building2 className="w-10 h-10" />} message="No hospitals registered yet. Add your first hospital above." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 stagger">
          {hospitals.map(h => (
            <div key={h.id} className="glass-card card-hover rounded-2xl overflow-hidden animate-fade-up group">
              {/* Header stripe */}
              <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">{h.name}</h3>
                    <p className="text-blue-100 text-xs flex items-center gap-1">{h.type} · <span className="font-mono">{h.id}</span></p>
                  </div>
                </div>
                <button onClick={() => handleDelete(h.id)} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-red-500/100/80 flex items-center justify-center transition-colors text-white/70 hover:text-white">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Contact */}
                {(h.address || h.phone) && (
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    {h.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{h.address}</span>}
                    {h.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{h.phone}</span>}
                  </div>
                )}

                {/* Departments */}
                {h.departments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {h.departments.map(d => (
                      <span key={d} className="bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full px-2 py-0.5 text-[10px] font-medium">{d}</span>
                    ))}
                  </div>
                )}

                {/* Infrastructure Stats */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  <InfraStat icon={<BedDouble className="w-3.5 h-3.5 text-blue-500" />} label="Beds" value={h.infrastructure.total_beds} />
                  <InfraStat icon={<BedDouble className="w-3.5 h-3.5 text-red-500" />} label="ICU" value={h.infrastructure.icu_beds} />
                  <InfraStat icon={<Wind className="w-3.5 h-3.5 text-teal-500" />} label="Vents" value={h.infrastructure.ventilators} />
                  <InfraStat icon={<Monitor className="w-3.5 h-3.5 text-purple-500" />} label="Monitors" value={h.infrastructure.monitors} />
                  <InfraStat icon={<Ambulance className="w-3.5 h-3.5 text-orange-500" />} label="Ambul." value={h.infrastructure.ambulances} />
                </div>

                {/* Facilities */}
                <div className="flex gap-2">
                  {h.infrastructure.blood_bank && <FacilityBadge label="Blood Bank" />}
                  {h.infrastructure.pharmacy && <FacilityBadge label="Pharmacy" />}
                  {h.infrastructure.lab && <FacilityBadge label="Lab" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   DOCTOR TAB
   ══════════════════════════════════════════════════════════════════════ */
function DoctorTab() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Form
  const [dName, setDName] = useState("");
  const [spec, setSpec] = useState("General Medicine");
  const [qual, setQual] = useState("MBBS");
  const [exp, setExp] = useState(5);
  const [dPhone, setDPhone] = useState("");
  const [dEmail, setDEmail] = useState("");
  const [hospId, setHospId] = useState("");
  const [maxPat, setMaxPat] = useState(10);

  const load = () => {
    setLoading(true);
    Promise.all([listDoctors(), listHospitals()])
      .then(([d, h]) => { setDoctors(d); setHospitals(h); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setDName(""); setSpec("General Medicine"); setQual("MBBS"); setExp(5);
    setDPhone(""); setDEmail(""); setHospId(""); setMaxPat(10);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createDoctor({
        name: dName, specialization: spec, qualification: qual,
        experience_years: exp, phone: dPhone, email: dEmail,
        hospital_id: hospId, max_patients: maxPat,
      });
      setToast(`✅ Dr. ${dName} registered!`);
      setTimeout(() => setToast(null), 4000);
      resetForm(); setShowForm(false); load();
    } catch { setToast("❌ Failed to register doctor"); setTimeout(() => setToast(null), 4000); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteDoctor(id); load(); } catch { /* ignore */ }
  };

  const getHospitalName = (hid: string) => hospitals.find(h => h.id === hid)?.name || hid || "Unassigned";

  if (loading && doctors.length === 0) return <LoadingSpinner />;

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <button onClick={() => setShowForm(!showForm)}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
          showForm
            ? "bg-white/8 text-slate-400 hover:bg-white/10"
            : "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:-translate-y-0.5"
        }`}>
        {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {showForm ? "Cancel" : "Add Doctor"}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-5 animate-scale-in ring-1 ring-violet-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
              <Stethoscope className="w-3.5 h-3.5 text-white" />
            </div>
            New Doctor Registration
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput label="Full Name" value={dName} onChange={setDName} required placeholder="Dr. Rajesh Kumar" />
            <div>
              <label className="block text-xs text-slate-500 mb-1">Specialization</label>
              <select value={spec} onChange={e => setSpec(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm text-[var(--input-text)] focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 outline-none transition-all hover:border-white/20">
                {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <FormInput label="Qualification" value={qual} onChange={setQual} placeholder="MBBS, MD" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="flex items-center gap-1 text-xs text-slate-500 mb-1"><Briefcase className="w-3 h-3" /> Experience (yrs)</label>
              <input type="number" min={0} max={60} value={exp} onChange={e => setExp(+e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 outline-none transition-all hover:border-white/20" />
            </div>
            <FormInput label="Phone" value={dPhone} onChange={setDPhone} placeholder="+1 555-0100" />
            <FormInput label="Email" value={dEmail} onChange={setDEmail} placeholder="doctor@hospital.com" />
            <div>
              <label className="flex items-center gap-1 text-xs text-slate-500 mb-1"><Users className="w-3 h-3" /> Max Patients</label>
              <input type="number" min={1} max={50} value={maxPat} onChange={e => setMaxPat(+e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 outline-none transition-all hover:border-white/20" />
            </div>
          </div>

          {/* Hospital Assignment */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Assign to Hospital</label>
            {hospitals.length === 0 ? (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">Register a hospital first in the Hospital Infrastructure tab.</p>
            ) : (
              <select value={hospId} onChange={e => setHospId(e.target.value)}
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm text-[var(--input-text)] focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 outline-none transition-all hover:border-white/20">
                <option value="">— Select Hospital —</option>
                {hospitals.map(h => <option key={h.id} value={h.id}>{h.name} ({h.id})</option>)}
              </select>
            )}
          </div>

          <button type="submit" disabled={submitting || !dName}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-40 shadow-lg shadow-violet-500/25 hover:-translate-y-0.5">
            {submitting ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Plus className="w-4 h-4" />}
            {submitting ? "Registering..." : "Register Doctor"}
          </button>
        </form>
      )}

      {/* Doctor Cards */}
      {doctors.length === 0 ? (
        <EmptyState icon={<Stethoscope className="w-10 h-10" />} message="No doctors registered yet. Add your first doctor above." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {doctors.map(d => {
            const load_pct = d.max_patients > 0 ? Math.round((d.current_patients / d.max_patients) * 100) : 0;
            return (
              <div key={d.id} className="glass-card card-hover rounded-2xl p-5 animate-fade-up group relative overflow-hidden">
                {/* Decorative accent */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-bl-full" />

                <div className="flex items-start justify-between mb-3 relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                      <Stethoscope className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{d.name}</h4>
                      <p className="text-xs text-violet-600 font-medium">{d.specialization}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(d.id)} className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2 text-xs text-slate-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><Award className="w-3 h-3" />{d.qualification}</span>
                    <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{d.experience_years} yrs</span>
                  </div>
                  {d.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{d.phone}</span>}
                  {d.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{d.email}</span>}
                  <div className="flex items-center gap-1 text-cyan-400">
                    <Building2 className="w-3 h-3" />
                    <span className="font-medium">{getHospitalName(d.hospital_id)}</span>
                  </div>
                </div>

                {/* Patient load bar */}
                <div className="mt-3 pt-3 border-t border-white/6">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Patient Load</span>
                    <span className="font-mono">{d.current_patients}/{d.max_patients}</span>
                  </div>
                  <div className="w-full bg-white/8 rounded-full h-2">
                    <div className={`h-full rounded-full transition-all duration-500 ${load_pct >= 90 ? "bg-gradient-to-r from-red-400 to-red-500" : load_pct >= 60 ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-emerald-400 to-emerald-500"}`}
                      style={{ width: `${load_pct}%` }} />
                  </div>
                </div>

                <span className="font-mono text-[10px] text-slate-400 mt-2 block">{d.id}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ASSIGNMENT TAB
   ══════════════════════════════════════════════════════════════════════ */
function AssignmentTab() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [patients, setPatients] = useState<TriageResult[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // form
  const [selPatient, setSelPatient] = useState("");
  const [selDoctor, setSelDoctor] = useState("");
  const [selHospital, setSelHospital] = useState("");
  const [selDept, setSelDept] = useState("");
  const [priority, setPriority] = useState("Normal");
  const [notes, setNotes] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([listAssignments(), getPatientList(), listDoctors(), listHospitals()])
      .then(([a, p, d, h]) => { setAssignments(a); setPatients(p); setDoctors(d); setHospitals(h); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createAssignment({
        patient_id: selPatient, doctor_id: selDoctor,
        hospital_id: selHospital, department: selDept,
        priority, notes,
      });
      const pt = patients.find(p => p.patient_id === selPatient);
      setToast(`✅ ${pt?.patient_name || "Patient"} assigned successfully!`);
      setTimeout(() => setToast(null), 4000);
      setSelPatient(""); setSelDoctor(""); setSelHospital(""); setSelDept(""); setPriority("Normal"); setNotes("");
      setShowForm(false); load();
    } catch (err) {
      setToast(`❌ ${err instanceof Error ? err.message : "Assignment failed"}`);
      setTimeout(() => setToast(null), 4000);
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteAssignment(id); load(); } catch { /* ignore */ }
  };

  // Auto-fill department from patient's recommendation
  useEffect(() => {
    if (selPatient) {
      const pt = patients.find(p => p.patient_id === selPatient);
      if (pt) setSelDept(pt.department.recommended_department);
    }
  }, [selPatient, patients]);

  // Filter doctors by selected hospital
  const filteredDoctors = selHospital ? doctors.filter(d => d.hospital_id === selHospital) : doctors;

  // Filter assignments by search
  const filtered = assignments.filter(a => {
    if (!searchQ) return true;
    const q = searchQ.toLowerCase();
    return a.patient_name.toLowerCase().includes(q) || a.doctor_name.toLowerCase().includes(q) || a.hospital_name.toLowerCase().includes(q);
  });

  // Assigned patient IDs
  const assignedPatientIds = new Set(assignments.map(a => a.patient_id));
  const unassignedPatients = patients.filter(p => !assignedPatientIds.has(p.patient_id));

  if (loading && assignments.length === 0 && patients.length === 0) return <LoadingSpinner />;

  const noData = patients.length === 0 && doctors.length === 0;

  return (
    <div className="space-y-5">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {noData ? (
        <EmptyState icon={<UserCheck className="w-10 h-10" />}
          message="Register hospitals, doctors, and triage patients first before creating assignments." />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => setShowForm(!showForm)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                showForm
                  ? "bg-white/8 text-slate-400 hover:bg-white/10"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5"
              }`}>
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? "Cancel" : "New Assignment"}
            </button>
            {!showForm && assignments.length > 0 && (
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search assignments..."
                  className="w-full glass-card rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none transition-all hover:border-white/20" />
              </div>
            )}
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-5 animate-scale-in ring-1 ring-emerald-500/15">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <UserCheck className="w-3.5 h-3.5 text-white" />
                </div>
                Assign Patient to Doctor
              </div>

              {/* Visual Flow: Patient → Doctor → Hospital */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Patient */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">1. Select Patient</label>
                  {unassignedPatients.length === 0 ? (
                    <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">All patients are assigned. Triage new patients first.</p>
                  ) : (
                    <select value={selPatient} onChange={e => setSelPatient(e.target.value)} required
                      className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--input-text)] focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all hover:border-white/20">
                      <option value="">— Select Patient —</option>
                      {unassignedPatients.map(p => (
                        <option key={p.patient_id} value={p.patient_id}>
                          {p.patient_name} ({p.risk_level}) — {p.department.recommended_department}
                        </option>
                      ))}
                    </select>
                  )}
                  {selPatient && (() => {
                    const pt = patients.find(p => p.patient_id === selPatient);
                    if (!pt) return null;
                    return (
                      <div className={`rounded-xl p-3 border ${pt.risk_level === "High" ? "bg-red-500/10 border-red-500/20" : pt.risk_level === "Medium" ? "bg-amber-500/10 border-amber-500/20" : "bg-emerald-500/10 border-emerald-500/20"}`}>
                        <p className="text-xs font-medium text-slate-300">{pt.patient_name}</p>
                        <p className="text-[11px] text-slate-500">Risk: <span className="font-semibold">{pt.risk_level}</span> · Dept: {pt.department.recommended_department}</p>
                      </div>
                    );
                  })()}
                </div>

                {/* Arrow */}
                <div className="hidden lg:flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <ArrowRight className="w-6 h-6 text-slate-300" />
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">Assign to</span>
                  </div>
                </div>

                {/* Doctor & Hospital */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">2. Select Hospital</label>
                    <select value={selHospital} onChange={e => { setSelHospital(e.target.value); setSelDoctor(""); }} required
                      className="w-full mt-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--input-text)] focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all hover:border-white/20">
                      <option value="">— Select Hospital —</option>
                      {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">3. Select Doctor</label>
                    <select value={selDoctor} onChange={e => setSelDoctor(e.target.value)} required
                      className="w-full mt-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2.5 text-sm text-[var(--input-text)] focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all hover:border-white/20">
                      <option value="">— Select Doctor —</option>
                      {filteredDoctors.map(d => (
                        <option key={d.id} value={d.id} disabled={d.current_patients >= d.max_patients}>
                          Dr. {d.name} — {d.specialization} ({d.current_patients}/{d.max_patients})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Department</label>
                  <select value={selDept} onChange={e => setSelDept(e.target.value)}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm text-[var(--input-text)] focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all hover:border-white/20">
                    {DEPT_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Priority</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)}
                    className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-sm text-[var(--input-text)] focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all hover:border-white/20">
                    <option value="Urgent">🔴 Urgent</option>
                    <option value="High">🟠 High</option>
                    <option value="Normal">🟢 Normal</option>
                    <option value="Low">⚪ Low</option>
                  </select>
                </div>
                <FormInput label="Notes" value={notes} onChange={setNotes} placeholder="Optional notes..." />
              </div>

              <button type="submit" disabled={submitting || !selPatient || !selDoctor || !selHospital}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium py-3 rounded-xl transition-all disabled:opacity-40 shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5">
                {submitting ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <UserCheck className="w-4 h-4" />}
                {submitting ? "Assigning..." : "Create Assignment"}
              </button>
            </form>
          )}

          {/* Assignments List */}
          {filtered.length === 0 ? (
            <EmptyState icon={<UserCheck className="w-10 h-10" />}
              message={assignments.length === 0 ? "No assignments created yet." : "No assignments match your search."} />
          ) : (
            <div className="space-y-3 stagger">
              {filtered.map(a => (
                <div key={a.id} className="glass-card card-hover rounded-2xl p-5 animate-fade-up group">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Patient */}
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                        a.risk_level === "High" ? "bg-gradient-to-br from-red-500 to-rose-500 shadow-red-500/20" :
                        a.risk_level === "Medium" ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/20" :
                        "bg-gradient-to-br from-emerald-400 to-green-500 shadow-emerald-500/20"
                      }`}>
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{a.patient_name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{a.patient_id}</p>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="w-5 h-5 text-slate-300 hidden sm:block shrink-0" />

                    {/* Doctor */}
                    <div className="flex items-center gap-3 min-w-[180px]">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-md shadow-violet-500/20">
                        <Stethoscope className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">Dr. {a.doctor_name}</p>
                        <p className="text-[11px] text-violet-600">{a.doctor_specialization}</p>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="w-5 h-5 text-slate-300 hidden sm:block shrink-0" />

                    {/* Hospital */}
                    <div className="flex items-center gap-3 flex-1 min-w-[150px]">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{a.hospital_name}</p>
                        <p className="text-[11px] text-cyan-400">{a.department}</p>
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-2 ml-auto">
                      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        a.priority === "Urgent" ? "bg-red-500/10 text-red-400 ring-1 ring-red-200" :
                        a.priority === "High" ? "bg-orange-500/10 text-orange-400 ring-1 ring-orange-200" :
                        a.priority === "Normal" ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-200" :
                        "bg-white/5 text-slate-400 ring-1 ring-white/10"
                      }`}>{a.priority}</span>
                      <button onClick={() => handleDelete(a.id)}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {a.notes && <p className="text-xs text-slate-400 mt-2 pl-[52px]">{a.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ══════════════════════════════════════════════════════════════════════ */

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-60">
      <div className="relative">
        <div className="animate-spin w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full" />
        <Sparkles className="w-5 h-5 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="glass-card card-hover rounded-2xl p-12 text-center animate-fade-up">
      <div className="text-slate-300 mx-auto mb-3 flex justify-center">{icon}</div>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-in">
      <div className="bg-slate-800/90 backdrop-blur-sm text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 border border-slate-700/40">
        <p className="text-sm font-medium">{message}</p>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, required, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} required={required} placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all hover:border-white/20" />
    </div>
  );
}

function InfraInput({ icon, label, value, onChange }: {
  icon: React.ReactNode; label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-1 text-xs text-slate-500 mb-1">{icon} {label}</label>
      <input type="number" min={0} value={value} onChange={e => onChange(+e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none transition-all hover:border-white/20" />
    </div>
  );
}

function FacilityToggle({ icon, label, on, onToggle }: {
  icon: React.ReactNode; label: string; on: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <button type="button" onClick={() => onToggle(!on)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
        on ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/10 text-slate-400"
      }`}>
      <div className={`${on ? "text-emerald-500" : "text-slate-400"}`}>{icon}</div>
      {label}
      <div className={`w-3.5 h-3.5 rounded-full border-2 ml-1 transition-all ${on ? "bg-emerald-500/100 border-emerald-500" : "border-slate-300"}`}>
        {on && <CheckCircle2 className="w-full h-full text-white" />}
      </div>
    </button>
  );
}

function InfraStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white/3 rounded-xl p-2.5 text-center ring-1 ring-white/8">
      <div className="flex justify-center mb-1">{icon}</div>
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}

function FacilityBadge({ label }: { label: string }) {
  return (
    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-2 py-0.5 text-[10px] font-medium flex items-center gap-1">
      <CheckCircle2 className="w-2.5 h-2.5" /> {label}
    </span>
  );
}
