"""
Symptom Inconsistency Detector
---------------------------------
Flags medically impossible, contradictory, or suspicious symptom
combinations before they reach the ML model. This serves two goals:
  1. Data quality — catch typos or confused patients
  2. Fraud / manipulation detection

Each rule returns a severity ("conflict" | "warning" | "info") and
a plain‑English explanation suitable for display to triage staff.
"""


def _get_symptoms(patient: dict) -> set[str]:
    raw = patient.get("symptoms", "")
    if isinstance(raw, list):
        return set(raw)
    return set(raw.split("|")) if raw else set()


def _get_conditions(patient: dict) -> set[str]:
    raw = patient.get("pre_existing_conditions", "none")
    if isinstance(raw, list):
        return set(raw)
    return set(raw.split("|")) if raw else set()


# ── Rule definitions ──────────────────────────────────────────────────

def _check_conflicts(patient: dict) -> list[dict]:
    """Hard contradictions that make no medical sense."""
    issues = []
    symptoms = _get_symptoms(patient)
    conditions = _get_conditions(patient)
    age = int(patient.get("age", 30))
    gender = patient.get("gender", "Unknown")
    temp = float(patient.get("temperature", 36.8))
    hr = float(patient.get("heart_rate", 75))
    bp_sys = float(patient.get("bp_systolic", 120))

    # Fever reported but temperature is normal/low
    if "fever" in symptoms and temp < 37.3:
        issues.append({
            "severity": "conflict",
            "code": "FEVER_TEMP_MISMATCH",
            "message": (
                f"Patient reports fever but measured temperature is "
                f"{temp}°C (normal range). Verify thermometer reading."
            ),
        })

    # Unconscious patient reporting subjective symptoms
    consciousness_exclusive = {"dizziness", "headache", "nausea",
                                "abdominal_pain", "joint_pain", "back_pain"}
    if "confusion" in symptoms and len(symptoms & consciousness_exclusive) >= 3:
        issues.append({
            "severity": "warning",
            "code": "CONFUSION_SELF_REPORT",
            "message": (
                "Patient marked as confused but reporting multiple "
                "subjective symptoms. Verify who provided the symptom list."
            ),
        })

    # Age‑inappropriate conditions
    if age < 12 and conditions & {"hypertension", "heart_disease", "copd"}:
        issues.append({
            "severity": "conflict",
            "code": "PEDIATRIC_ADULT_CONDITION",
            "message": (
                f"Patient is {age} years old but has adult conditions: "
                f"{', '.join(conditions & {'hypertension', 'heart_disease', 'copd'})}. "
                f"Please verify medical history."
            ),
        })

    # Vitals vs symptoms mismatch
    if "palpitations" in symptoms and hr < 65:
        issues.append({
            "severity": "warning",
            "code": "PALPITATION_LOW_HR",
            "message": (
                f"Patient reports palpitations but HR is {hr} bpm (normal/low). "
                f"Intermittent arrhythmia possible — consider ECG."
            ),
        })

    # Shortness of breath with perfect SpO2
    spo2 = float(patient.get("spo2", 98))
    if "shortness_of_breath" in symptoms and spo2 >= 98:
        issues.append({
            "severity": "info",
            "code": "DYSPNEA_NORMAL_SPO2",
            "message": (
                f"Shortness of breath reported but SpO2 is {spo2}%. "
                f"Possible anxiety-related dyspnea or early presentation."
            ),
        })

    # Chest pain + very low BP + no tachycardia — unusual combo
    if "chest_pain" in symptoms and bp_sys < 85 and hr < 70:
        issues.append({
            "severity": "warning",
            "code": "CHEST_PAIN_BRADYCARDIA",
            "message": (
                "Chest pain with low BP and no compensatory tachycardia. "
                "Consider cardiac tamponade or severe vagal event."
            ),
        })

    # Too many symptoms — possible exaggeration or anxiety
    if len(symptoms) >= 6:
        issues.append({
            "severity": "info",
            "code": "MANY_SYMPTOMS",
            "message": (
                f"Patient reports {len(symptoms)} symptoms simultaneously. "
                f"Consider if anxiety or somatization is a factor."
            ),
        })

    return issues


def check(patient: dict) -> dict:
    """
    Run all inconsistency checks.

    Returns:
        {
            "has_issues": True/False,
            "issue_count": 2,
            "issues": [ ... ]
        }
    """
    issues = _check_conflicts(patient)

    return {
        "has_issues": len(issues) > 0,
        "issue_count": len(issues),
        "issues": issues,
    }
