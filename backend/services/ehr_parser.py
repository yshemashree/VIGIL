"""
EHR / EMR Document Parser
---------------------------
Accepts uploaded health documents (PDF or plain text) and extracts
structured patient fields using pattern matching.

Supports:
  - Age, gender, blood pressure, heart rate, temperature, SpO2
  - Symptom mentions
  - Pre‑existing condition mentions
  - Medication lists (informational)

This is intentionally regex‑based (no LLM dependency) so it works
offline and is fast.  In a production system you'd layer an NER
model on top.
"""

import re
import io
from typing import Any


# Try importing pdfplumber — graceful fallback if not available
try:
    import pdfplumber
    HAS_PDF = True
except ImportError:
    HAS_PDF = False


# ── Known symptom keywords → canonical names ─────────────────────────
SYMPTOM_KEYWORDS = {
    "chest pain": "chest_pain",
    "pain in chest": "chest_pain",
    "shortness of breath": "shortness_of_breath",
    "difficulty breathing": "shortness_of_breath",
    "dyspnea": "shortness_of_breath",
    "palpitation": "palpitations",
    "palpitations": "palpitations",
    "arm pain": "arm_pain",
    "left arm pain": "arm_pain",
    "jaw pain": "jaw_pain",
    "headache": "headache",
    "head ache": "headache",
    "migraine": "headache",
    "dizzy": "dizziness",
    "dizziness": "dizziness",
    "vertigo": "dizziness",
    "vision changes": "vision_changes",
    "blurred vision": "vision_changes",
    "blurry vision": "vision_changes",
    "numbness": "numbness",
    "tingling": "numbness",
    "confusion": "confusion",
    "disoriented": "confusion",
    "altered mental": "confusion",
    "speech difficulty": "speech_difficulty",
    "slurred speech": "speech_difficulty",
    "fever": "fever",
    "febrile": "fever",
    "cough": "cough",
    "persistent cough": "cough",
    "wheezing": "wheezing",
    "wheeze": "wheezing",
    "breathlessness": "breathlessness",
    "breathless": "breathlessness",
    "sore throat": "sore_throat",
    "throat pain": "sore_throat",
    "nausea": "nausea",
    "nauseous": "nausea",
    "vomiting": "vomiting",
    "emesis": "vomiting",
    "abdominal pain": "abdominal_pain",
    "stomach pain": "abdominal_pain",
    "belly pain": "abdominal_pain",
    "diarrhea": "diarrhea",
    "diarrhoea": "diarrhea",
    "fatigue": "fatigue",
    "tired": "fatigue",
    "exhaustion": "fatigue",
    "joint pain": "joint_pain",
    "arthralgia": "joint_pain",
    "back pain": "back_pain",
    "lower back": "back_pain",
    "swelling": "swelling",
    "edema": "swelling",
    "oedema": "swelling",
    "rash": "rash",
    "skin rash": "rash",
    "cold sweat": "cold_sweats",
    "diaphoresis": "cold_sweats",
    "pale": "pale_skin",
    "pallor": "pale_skin",
    "frequent urination": "frequent_urination",
    "polyuria": "frequent_urination",
    "weight loss": "weight_loss",
    "muscle weakness": "muscle_weakness",
    "weakness": "muscle_weakness",
}

CONDITION_KEYWORDS = {
    "diabetes": "diabetes",
    "diabetic": "diabetes",
    "type 2 diabetes": "diabetes",
    "type 1 diabetes": "diabetes",
    "dm2": "diabetes",
    "hypertension": "hypertension",
    "high blood pressure": "hypertension",
    "htn": "hypertension",
    "heart disease": "heart_disease",
    "coronary artery disease": "heart_disease",
    "cad": "heart_disease",
    "chf": "heart_disease",
    "heart failure": "heart_disease",
    "asthma": "asthma",
    "bronchial asthma": "asthma",
    "copd": "copd",
    "chronic obstructive": "copd",
    "emphysema": "copd",
    "chronic kidney": "chronic_kidney_disease",
    "ckd": "chronic_kidney_disease",
    "renal failure": "chronic_kidney_disease",
    "obesity": "obesity",
    "obese": "obesity",
    "bmi > 30": "obesity",
    "cancer": "cancer",
    "malignancy": "cancer",
    "carcinoma": "cancer",
    "stroke history": "stroke_history",
    "previous stroke": "stroke_history",
    "cva": "stroke_history",
    "thyroid": "thyroid_disorder",
    "hypothyroid": "thyroid_disorder",
    "hyperthyroid": "thyroid_disorder",
    "epilepsy": "epilepsy",
    "seizure disorder": "epilepsy",
    "seizures": "epilepsy",
}


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract all text from uploaded PDF bytes."""
    if not HAS_PDF:
        raise RuntimeError("pdfplumber not installed — cannot parse PDFs")
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text_parts.append(t)
    return "\n".join(text_parts)


def _find_number(text: str, patterns: list[str]) -> float | None:
    """Search text for a numeric value following any of the given patterns."""
    for pat in patterns:
        match = re.search(pat, text, re.IGNORECASE)
        if match:
            try:
                return float(match.group(1))
            except (ValueError, IndexError):
                continue
    return None


def _find_bp(text: str) -> tuple[float | None, float | None]:
    """Extract systolic/diastolic blood pressure from common formats."""
    # "BP: 140/90" or "Blood Pressure 140/90 mmHg"
    match = re.search(
        r"(?:bp|blood\s*pressure)\s*[:\-]?\s*(\d{2,3})\s*/\s*(\d{2,3})",
        text, re.IGNORECASE,
    )
    if match:
        return float(match.group(1)), float(match.group(2))
    return None, None


def parse_document(text: str) -> dict[str, Any]:
    """
    Parse free‑text clinical document and extract structured fields.

    Returns a dict with extracted fields (any could be None if not found).
    """
    text_lower = text.lower()

    # ── Demographics ──────────────────────────────────────────────
    age = _find_number(text, [
        r"age\s*[:\-]?\s*(\d{1,3})",
        r"(\d{1,3})\s*(?:year|yr)[\s\-]*old",
        r"(\d{1,3})\s*y/?o\b",
    ])

    gender = None
    gender_match = re.search(
        r"(?:sex|gender)\s*[:\-]?\s*(male|female|other|m|f)",
        text, re.IGNORECASE,
    )
    if gender_match:
        g = gender_match.group(1).strip().lower()
        gender = {"m": "Male", "f": "Female", "male": "Male",
                  "female": "Female", "other": "Other"}.get(g, "Other")

    # ── Vitals ────────────────────────────────────────────────────
    bp_sys, bp_dia = _find_bp(text)

    heart_rate = _find_number(text, [
        r"(?:heart\s*rate|hr|pulse)\s*[:\-]?\s*(\d{2,3})",
        r"(\d{2,3})\s*bpm",
    ])

    temperature = _find_number(text, [
        r"(?:temp|temperature)\s*[:\-]?\s*(\d{2,3}\.?\d?)\s*[°]?[CcFf]?",
    ])
    # Convert Fahrenheit if it looks like F
    if temperature and temperature > 50:
        temperature = round((temperature - 32) * 5 / 9, 1)

    spo2 = _find_number(text, [
        r"(?:spo2|sp02|oxygen\s*sat|o2\s*sat)\s*[:\-]?\s*(\d{2,3})",
    ])

    # ── Symptoms ──────────────────────────────────────────────────
    found_symptoms = set()
    for keyword, canonical in SYMPTOM_KEYWORDS.items():
        if keyword in text_lower:
            found_symptoms.add(canonical)

    # ── Conditions ────────────────────────────────────────────────
    found_conditions = set()
    for keyword, canonical in CONDITION_KEYWORDS.items():
        if keyword in text_lower:
            found_conditions.add(canonical)

    return {
        "age": int(age) if age else None,
        "gender": gender,
        "bp_systolic": bp_sys,
        "bp_diastolic": bp_dia,
        "heart_rate": heart_rate,
        "temperature": temperature,
        "spo2": spo2,
        "symptoms": sorted(found_symptoms) if found_symptoms else [],
        "pre_existing_conditions": sorted(found_conditions) if found_conditions else [],
        "raw_text_length": len(text),
        "extraction_confidence": _calc_confidence(
            age, gender, bp_sys, heart_rate, temperature, found_symptoms
        ),
    }


def _calc_confidence(age, gender, bp, hr, temp, symptoms) -> str:
    """Rough confidence estimate based on how many fields we extracted."""
    found = sum(1 for v in [age, gender, bp, hr, temp] if v is not None)
    found += min(len(symptoms), 3)  # cap symptom contribution
    total = 8
    ratio = found / total
    if ratio >= 0.75:
        return "high"
    if ratio >= 0.5:
        return "medium"
    return "low"
