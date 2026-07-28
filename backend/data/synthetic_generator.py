"""
Synthetic Patient Data Generator
---------------------------------
Builds a medically‑coherent dataset of 2500 patients based on
clinical archetypes. Each archetype defines realistic distributions
for vitals, symptom pools and pre‑existing conditions so the
generated records actually *make sense* to a medical reviewer.

Run standalone:
    python -m backend.data.synthetic_generator
"""

import os
import csv
import uuid
import random
import math
from datetime import datetime, timedelta
from faker import Faker

fake = Faker()
Faker.seed(42)
random.seed(42)

# ── Symptom Universe ──────────────────────────────────────────────────
ALL_SYMPTOMS = [
    "chest_pain", "shortness_of_breath", "palpitations", "arm_pain",
    "jaw_pain", "headache", "dizziness", "vision_changes", "numbness",
    "confusion", "speech_difficulty", "fever", "cough", "wheezing",
    "breathlessness", "sore_throat", "nausea", "vomiting",
    "abdominal_pain", "diarrhea", "fatigue", "joint_pain",
    "back_pain", "swelling", "rash", "cold_sweats", "pale_skin",
    "frequent_urination", "weight_loss", "muscle_weakness",
]

ALL_CONDITIONS = [
    "diabetes", "hypertension", "heart_disease", "asthma", "copd",
    "chronic_kidney_disease", "obesity", "cancer", "stroke_history",
    "thyroid_disorder", "epilepsy", "none",
]

DEPARTMENTS = [
    "Emergency", "Cardiology", "Neurology", "Pulmonology",
    "Gastroenterology", "General Medicine", "Orthopedics", "Dermatology",
]

INSURERS = [
    "BlueCross", "Aetna", "UnitedHealth", "Cigna", "Medicare",
    "Medicaid", "HumanaCare", "Self-Pay",
]

# ── Patient Archetypes ────────────────────────────────────────────────
# Each archetype is a probabilistic template. We sample around these
# values with realistic variance so data feels organic, not robotic.

ARCHETYPES = [
    # ── HIGH RISK archetypes ──────────────────────────────────────
    {
        "name": "elderly_cardiac_emergency",
        "age_range": (58, 92),
        "gender_weights": {"Male": 0.6, "Female": 0.38, "Other": 0.02},
        "symptoms": ["chest_pain", "shortness_of_breath", "arm_pain",
                      "cold_sweats", "jaw_pain", "palpitations"],
        "symptom_count": (3, 5),
        "conditions": ["heart_disease", "hypertension", "diabetes"],
        "cond_count": (1, 3),
        "bp_sys": (160, 210, 14), "bp_dia": (95, 125, 10),
        "hr": (100, 150, 12), "temp": (36.4, 37.6, 0.3),
        "spo2": (85, 94, 2),
        "risk": "High", "department": "Emergency",
        "weight": 8,
    },
    {
        "name": "acute_stroke_presentation",
        "age_range": (50, 88),
        "gender_weights": {"Male": 0.55, "Female": 0.43, "Other": 0.02},
        "symptoms": ["headache", "numbness", "vision_changes",
                      "confusion", "speech_difficulty", "dizziness"],
        "symptom_count": (3, 5),
        "conditions": ["hypertension", "stroke_history", "diabetes"],
        "cond_count": (1, 2),
        "bp_sys": (170, 230, 18), "bp_dia": (100, 130, 12),
        "hr": (80, 120, 10), "temp": (36.5, 37.4, 0.3),
        "spo2": (88, 96, 2),
        "risk": "High", "department": "Neurology",
        "weight": 6,
    },
    {
        "name": "severe_sepsis_risk",
        "age_range": (30, 80),
        "gender_weights": {"Male": 0.5, "Female": 0.48, "Other": 0.02},
        "symptoms": ["fever", "confusion", "fatigue", "cold_sweats",
                      "nausea", "shortness_of_breath", "muscle_weakness"],
        "symptom_count": (3, 6),
        "conditions": ["diabetes", "chronic_kidney_disease", "cancer"],
        "cond_count": (1, 3),
        "bp_sys": (75, 100, 8), "bp_dia": (40, 65, 7),
        "hr": (105, 145, 10), "temp": (38.5, 41.0, 0.6),
        "spo2": (86, 94, 3),
        "risk": "High", "department": "Emergency",
        "weight": 6,
    },
    {
        "name": "respiratory_crisis",
        "age_range": (40, 85),
        "gender_weights": {"Male": 0.52, "Female": 0.46, "Other": 0.02},
        "symptoms": ["breathlessness", "wheezing", "cough",
                      "chest_pain", "fever", "fatigue"],
        "symptom_count": (3, 5),
        "conditions": ["asthma", "copd", "obesity"],
        "cond_count": (1, 2),
        "bp_sys": (130, 170, 12), "bp_dia": (80, 110, 8),
        "hr": (95, 130, 10), "temp": (37.0, 39.5, 0.5),
        "spo2": (80, 91, 3),
        "risk": "High", "department": "Pulmonology",
        "weight": 5,
    },

    # ── MEDIUM RISK archetypes ────────────────────────────────────
    {
        "name": "hypertensive_middle_aged",
        "age_range": (40, 68),
        "gender_weights": {"Male": 0.55, "Female": 0.43, "Other": 0.02},
        "symptoms": ["headache", "dizziness", "fatigue",
                      "vision_changes", "nausea"],
        "symptom_count": (2, 4),
        "conditions": ["hypertension", "obesity", "diabetes"],
        "cond_count": (1, 2),
        "bp_sys": (140, 175, 10), "bp_dia": (85, 105, 8),
        "hr": (75, 100, 8), "temp": (36.5, 37.3, 0.2),
        "spo2": (93, 97, 1),
        "risk": "Medium", "department": "Cardiology",
        "weight": 8,
    },
    {
        "name": "moderate_respiratory",
        "age_range": (25, 65),
        "gender_weights": {"Male": 0.48, "Female": 0.50, "Other": 0.02},
        "symptoms": ["cough", "wheezing", "breathlessness",
                      "sore_throat", "fever", "fatigue"],
        "symptom_count": (2, 4),
        "conditions": ["asthma", "none"],
        "cond_count": (0, 1),
        "bp_sys": (115, 145, 8), "bp_dia": (70, 90, 6),
        "hr": (80, 105, 8), "temp": (37.2, 38.8, 0.4),
        "spo2": (91, 96, 1),
        "risk": "Medium", "department": "Pulmonology",
        "weight": 7,
    },
    {
        "name": "gastrointestinal_distress",
        "age_range": (20, 70),
        "gender_weights": {"Male": 0.47, "Female": 0.51, "Other": 0.02},
        "symptoms": ["abdominal_pain", "nausea", "vomiting",
                      "diarrhea", "fever", "fatigue"],
        "symptom_count": (2, 4),
        "conditions": ["none", "diabetes"],
        "cond_count": (0, 1),
        "bp_sys": (105, 140, 10), "bp_dia": (65, 90, 7),
        "hr": (75, 105, 8), "temp": (37.0, 39.0, 0.5),
        "spo2": (94, 98, 1),
        "risk": "Medium", "department": "Gastroenterology",
        "weight": 7,
    },
    {
        "name": "neurological_moderate",
        "age_range": (35, 75),
        "gender_weights": {"Male": 0.48, "Female": 0.50, "Other": 0.02},
        "symptoms": ["headache", "dizziness", "numbness",
                      "vision_changes", "fatigue", "nausea"],
        "symptom_count": (2, 3),
        "conditions": ["hypertension", "thyroid_disorder", "none"],
        "cond_count": (0, 1),
        "bp_sys": (125, 155, 10), "bp_dia": (75, 95, 7),
        "hr": (65, 95, 8), "temp": (36.4, 37.3, 0.2),
        "spo2": (94, 98, 1),
        "risk": "Medium", "department": "Neurology",
        "weight": 5,
    },
    {
        "name": "diabetic_complications",
        "age_range": (35, 78),
        "gender_weights": {"Male": 0.52, "Female": 0.46, "Other": 0.02},
        "symptoms": ["fatigue", "frequent_urination", "vision_changes",
                      "numbness", "weight_loss", "dizziness"],
        "symptom_count": (2, 4),
        "conditions": ["diabetes", "hypertension", "obesity"],
        "cond_count": (1, 2),
        "bp_sys": (130, 160, 10), "bp_dia": (80, 100, 7),
        "hr": (70, 100, 8), "temp": (36.3, 37.2, 0.2),
        "spo2": (93, 97, 1),
        "risk": "Medium", "department": "General Medicine",
        "weight": 6,
    },

    # ── LOW RISK archetypes ───────────────────────────────────────
    {
        "name": "healthy_young_checkup",
        "age_range": (18, 35),
        "gender_weights": {"Male": 0.48, "Female": 0.50, "Other": 0.02},
        "symptoms": ["headache", "fatigue", "sore_throat"],
        "symptom_count": (1, 2),
        "conditions": ["none"],
        "cond_count": (0, 0),
        "bp_sys": (105, 130, 6), "bp_dia": (60, 82, 5),
        "hr": (60, 85, 5), "temp": (36.2, 37.2, 0.2),
        "spo2": (96, 100, 1),
        "risk": "Low", "department": "General Medicine",
        "weight": 10,
    },
    {
        "name": "mild_cold_flu",
        "age_range": (10, 55),
        "gender_weights": {"Male": 0.48, "Female": 0.50, "Other": 0.02},
        "symptoms": ["cough", "sore_throat", "fever", "fatigue",
                      "headache"],
        "symptom_count": (2, 3),
        "conditions": ["none"],
        "cond_count": (0, 0),
        "bp_sys": (108, 132, 6), "bp_dia": (62, 84, 5),
        "hr": (65, 90, 6), "temp": (37.0, 38.2, 0.3),
        "spo2": (95, 99, 1),
        "risk": "Low", "department": "General Medicine",
        "weight": 9,
    },
    {
        "name": "minor_musculoskeletal",
        "age_range": (18, 65),
        "gender_weights": {"Male": 0.55, "Female": 0.43, "Other": 0.02},
        "symptoms": ["joint_pain", "back_pain", "swelling",
                      "muscle_weakness"],
        "symptom_count": (1, 3),
        "conditions": ["none", "obesity"],
        "cond_count": (0, 1),
        "bp_sys": (110, 135, 7), "bp_dia": (65, 85, 5),
        "hr": (60, 85, 6), "temp": (36.3, 37.1, 0.2),
        "spo2": (96, 99, 1),
        "risk": "Low", "department": "Orthopedics",
        "weight": 6,
    },
    {
        "name": "skin_issue",
        "age_range": (5, 70),
        "gender_weights": {"Male": 0.48, "Female": 0.50, "Other": 0.02},
        "symptoms": ["rash", "swelling", "fatigue"],
        "symptom_count": (1, 2),
        "conditions": ["none"],
        "cond_count": (0, 0),
        "bp_sys": (108, 130, 6), "bp_dia": (62, 82, 5),
        "hr": (60, 85, 5), "temp": (36.3, 37.3, 0.2),
        "spo2": (96, 99, 1),
        "risk": "Low", "department": "Dermatology",
        "weight": 4,
    },
    {
        "name": "pediatric_mild",
        "age_range": (2, 14),
        "gender_weights": {"Male": 0.50, "Female": 0.50, "Other": 0.0},
        "symptoms": ["fever", "cough", "sore_throat", "rash",
                      "nausea", "fatigue"],
        "symptom_count": (1, 3),
        "conditions": ["none", "asthma"],
        "cond_count": (0, 1),
        "bp_sys": (85, 115, 6), "bp_dia": (50, 75, 5),
        "hr": (75, 110, 8), "temp": (36.8, 38.5, 0.3),
        "spo2": (95, 99, 1),
        "risk": "Low", "department": "General Medicine",
        "weight": 5,
    },
]


def _pick_gender(weights: dict) -> str:
    return random.choices(
        list(weights.keys()), weights=list(weights.values()), k=1
    )[0]


def _clamp(val, lo, hi):
    return max(lo, min(hi, val))


def _sample_vital(low, high, std):
    """Gaussian centered between low/high, with given std‑dev."""
    mid = (low + high) / 2
    return round(_clamp(random.gauss(mid, std), low * 0.85, high * 1.15), 1)


def _pick_subset(pool, count_range):
    lo, hi = count_range
    n = random.randint(lo, hi)
    n = min(n, len(pool))
    return random.sample(pool, n)


def _insurance_response_hours(insurer: str, risk: str) -> float:
    """
    Simulates how long an insurance company is likely to take to
    approve a procedure. Higher risk procedures need faster approval
    but some insurers are slower than others.
    """
    base_hours = {
        "BlueCross": 2.0, "Aetna": 3.0, "UnitedHealth": 2.5,
        "Cigna": 3.5, "Medicare": 1.5, "Medicaid": 1.0,
        "HumanaCare": 4.0, "Self-Pay": 0.0,
    }
    risk_multiplier = {"Low": 0.5, "Medium": 1.0, "High": 1.8}
    base = base_hours.get(insurer, 2.5)
    mult = risk_multiplier.get(risk, 1.0)
    noise = random.uniform(0.7, 1.4)
    return round(base * mult * noise, 1)


def generate_patient(archetype: dict) -> dict:
    """Create one patient record from the given archetype template."""
    age = random.randint(*archetype["age_range"])
    gender = _pick_gender(archetype["gender_weights"])

    # Vitals — sampled around archetype distributions
    bp_sys = _sample_vital(*archetype["bp_sys"])
    bp_dia = _sample_vital(*archetype["bp_dia"])
    heart_rate = _sample_vital(*archetype["hr"])
    temperature = _sample_vital(*archetype["temp"])
    spo2 = _sample_vital(*archetype["spo2"])

    # Symptoms and conditions
    symptoms = _pick_subset(archetype["symptoms"], archetype["symptom_count"])
    conditions = _pick_subset(archetype["conditions"], archetype["cond_count"])
    if not conditions or conditions == ["none"]:
        conditions = ["none"]

    insurer = random.choice(INSURERS)
    ins_response = _insurance_response_hours(insurer, archetype["risk"])

    arrival = datetime.now() - timedelta(
        hours=random.randint(0, 72), minutes=random.randint(0, 59)
    )

    return {
        "patient_id": f"PT-{uuid.uuid4().hex[:8].upper()}",
        "name": fake.name(),
        "age": age,
        "gender": gender,
        "arrival_time": arrival.isoformat(timespec="seconds"),
        "symptoms": "|".join(sorted(symptoms)),
        "bp_systolic": bp_sys,
        "bp_diastolic": bp_dia,
        "heart_rate": heart_rate,
        "temperature": temperature,
        "spo2": spo2,
        "pre_existing_conditions": "|".join(sorted(conditions)),
        "insurance_provider": insurer,
        "insurance_response_hours": ins_response,
        "risk_level": archetype["risk"],
        "department": archetype["department"],
    }


def generate_dataset(n: int = 2500) -> list[dict]:
    """
    Generate *n* patient records. Archetype selection is weighted so the
    dataset has a realistic distribution (more low/medium than high).
    """
    weights = [a["weight"] for a in ARCHETYPES]
    records = []
    for _ in range(n):
        arch = random.choices(ARCHETYPES, weights=weights, k=1)[0]
        records.append(generate_patient(arch))
    return records


def save_csv(records: list[dict], path: str = None):
    if path is None:
        path = os.path.join(os.path.dirname(__file__), "synthetic_patients.csv")
    keys = records[0].keys()
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(records)
    return path


# ── CLI entry point ───────────────────────────────────────────────────
if __name__ == "__main__":
    print("Generating 2500 synthetic patient records ...")
    data = generate_dataset(2500)

    file_path = save_csv(data)
    print(f"Saved → {file_path}")

    # Quick stats
    from collections import Counter
    risk_dist = Counter(r["risk_level"] for r in data)
    dept_dist = Counter(r["department"] for r in data)
    print(f"\nRisk distribution:  {dict(risk_dist)}")
    print(f"Dept distribution:  {dict(dept_dist)}")
    print(f"Age range:          {min(r['age'] for r in data)}–{max(r['age'] for r in data)}")
    print(f"Sample record:\n  {data[0]}")
