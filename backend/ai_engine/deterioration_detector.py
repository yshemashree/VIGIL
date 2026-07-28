"""
Early Deterioration Detector
-------------------------------
Rule‑driven detection of patients heading towards critical states:
  • Pre‑shock   — falling BP + rising HR + perfusion signs
  • Pre‑stroke  — sudden neuro symptoms + extreme hypertension
  • Pre‑sepsis  — infection markers + SIRS criteria

Returns a deterioration score (0‑100) and typed alerts.
"""

from dataclasses import dataclass, field


@dataclass
class DeteriorationAlert:
    alert_type: str            # "pre_shock" | "pre_stroke" | "pre_sepsis"
    severity: str              # "watch" | "warning" | "critical"
    score: int                 # 0‑100
    triggers: list[str] = field(default_factory=list)
    recommendation: str = ""


def _check_pre_shock(patient: dict) -> DeteriorationAlert | None:
    """
    Shock index (HR / SBP) > 0.9 is concerning, > 1.0 is bad,
    > 1.4 is often fatal if untreated.
    """
    hr = float(patient.get("heart_rate", 75))
    bp_sys = float(patient.get("bp_systolic", 120))
    spo2 = float(patient.get("spo2", 98))

    if bp_sys == 0:
        bp_sys = 1  # avoid division by zero

    shock_idx = hr / bp_sys
    triggers = []
    score = 0

    if shock_idx > 0.9:
        triggers.append(f"Elevated shock index ({shock_idx:.2f})")
        score += 25

    if bp_sys < 90:
        triggers.append(f"Hypotension (SBP {bp_sys})")
        score += 25

    if hr > 110:
        triggers.append(f"Tachycardia (HR {hr})")
        score += 15

    symptoms = _get_symptoms(patient)
    perfusion_signs = {"cold_sweats", "pale_skin", "confusion", "dizziness"}
    matched = symptoms & perfusion_signs
    if matched:
        triggers.append(f"Perfusion warning signs: {', '.join(matched)}")
        score += 10 * len(matched)

    if spo2 < 92:
        triggers.append(f"Low oxygen (SpO2 {spo2}%)")
        score += 15

    if score < 20:
        return None

    score = min(score, 100)
    severity = "critical" if score >= 65 else ("warning" if score >= 40 else "watch")

    return DeteriorationAlert(
        alert_type="pre_shock",
        severity=severity,
        score=score,
        triggers=triggers,
        recommendation=(
            "Initiate IV fluids, continuous monitoring, prepare vasopressors"
            if severity == "critical"
            else "Close monitoring — recheck vitals in 10 minutes"
        ),
    )


def _check_pre_stroke(patient: dict) -> DeteriorationAlert | None:
    bp_sys = float(patient.get("bp_systolic", 120))
    age = int(patient.get("age", 30))

    neuro_symptoms = {"headache", "numbness", "vision_changes",
                      "confusion", "speech_difficulty", "dizziness",
                      "muscle_weakness"}
    symptoms = _get_symptoms(patient)
    matched = symptoms & neuro_symptoms
    triggers = []
    score = 0

    if len(matched) >= 2:
        triggers.append(f"Multiple neuro symptoms: {', '.join(matched)}")
        score += 15 * len(matched)

    if bp_sys > 180:
        triggers.append(f"Severe hypertension (SBP {bp_sys})")
        score += 25

    if age > 55:
        triggers.append(f"Age risk factor ({age})")
        score += 10

    conditions = _get_conditions(patient)
    stroke_risks = {"stroke_history", "hypertension", "heart_disease"}
    risk_conds = conditions & stroke_risks
    if risk_conds:
        triggers.append(f"Risk conditions: {', '.join(risk_conds)}")
        score += 10 * len(risk_conds)

    if score < 25:
        return None

    score = min(score, 100)
    severity = "critical" if score >= 65 else ("warning" if score >= 40 else "watch")

    return DeteriorationAlert(
        alert_type="pre_stroke",
        severity=severity,
        score=score,
        triggers=triggers,
        recommendation=(
            "FAST protocol — activate stroke team, prepare CT/MRI"
            if severity == "critical"
            else "Neurological assessment recommended within 30 minutes"
        ),
    )


def _check_pre_sepsis(patient: dict) -> DeteriorationAlert | None:
    """
    Simplified qSOFA + SIRS criteria:
    - Temp > 38.3 or < 36
    - HR > 90
    - Altered mental status
    - SBP < 100
    """
    hr = float(patient.get("heart_rate", 75))
    temp = float(patient.get("temperature", 36.8))
    bp_sys = float(patient.get("bp_systolic", 120))

    triggers = []
    score = 0

    # Temperature criteria
    if temp > 38.3:
        triggers.append(f"Fever ({temp}°C)")
        score += 20
    elif temp < 36.0:
        triggers.append(f"Hypothermia ({temp}°C) — possible late sepsis")
        score += 25

    if hr > 90:
        triggers.append(f"Tachycardia (HR {hr})")
        score += 15

    if bp_sys < 100:
        triggers.append(f"Hypotension (SBP {bp_sys})")
        score += 20

    symptoms = _get_symptoms(patient)
    if "confusion" in symptoms:
        triggers.append("Altered mental status")
        score += 20

    infection_markers = {"fever", "cough", "diarrhea", "vomiting",
                         "abdominal_pain", "rash"}
    if symptoms & infection_markers:
        triggers.append(f"Infection markers: {', '.join(symptoms & infection_markers)}")
        score += 10

    conditions = _get_conditions(patient)
    immuno_risk = {"diabetes", "cancer", "chronic_kidney_disease"}
    if conditions & immuno_risk:
        triggers.append(f"Immunocompromised risk: {', '.join(conditions & immuno_risk)}")
        score += 15

    if score < 25:
        return None

    score = min(score, 100)
    severity = "critical" if score >= 65 else ("warning" if score >= 40 else "watch")

    return DeteriorationAlert(
        alert_type="pre_sepsis",
        severity=severity,
        score=score,
        triggers=triggers,
        recommendation=(
            "Blood cultures STAT, broad-spectrum antibiotics, fluid resuscitation"
            if severity == "critical"
            else "Monitor for sepsis progression — repeat vitals in 15 minutes"
        ),
    )


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


def detect(patient: dict) -> dict:
    """
    Run all three deterioration checks and return combined result.
    """
    alerts = []
    for checker in [_check_pre_shock, _check_pre_stroke, _check_pre_sepsis]:
        result = checker(patient)
        if result:
            alerts.append({
                "type": result.alert_type,
                "severity": result.severity,
                "score": result.score,
                "triggers": result.triggers,
                "recommendation": result.recommendation,
            })

    # Overall deterioration score = max of individual scores
    overall_score = max((a["score"] for a in alerts), default=0)
    has_critical = any(a["severity"] == "critical" for a in alerts)

    return {
        "deterioration_score": overall_score,
        "has_critical_alert": has_critical,
        "alert_count": len(alerts),
        "alerts": alerts,
    }
