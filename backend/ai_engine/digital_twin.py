"""
Digital Twin Simulator
------------------------
Creates a virtual projection of a patient's vital trajectory over time.
Given current vitals, risk level, and deterioration score, the twin
simulates how the patient's condition evolves if they keep waiting.

This is NOT a full physiological model — it's a clinically‑informed
decay/escalation curve good enough to demonstrate the concept and
give actionable insights for triage decisions.
"""

import math
import random


# Deterioration rate profiles — how fast vitals shift per 30‑min block
# keyed by overall risk profile.  "stable" means little change,
# "declining" means gradual worsening, "critical_trajectory" is steep.
_RATE_PROFILES = {
    "stable": {
        "bp_systolic_delta": (-1, 1),    # barely moves
        "heart_rate_delta": (-1, 1),
        "spo2_delta": (-0.1, 0.1),
        "temperature_delta": (-0.05, 0.05),
        "risk_score_growth": 0.005,      # per 30 min
    },
    "declining": {
        "bp_systolic_delta": (-4, 0),
        "heart_rate_delta": (1, 5),
        "spo2_delta": (-0.5, -0.1),
        "temperature_delta": (0.0, 0.15),
        "risk_score_growth": 0.04,
    },
    "critical_trajectory": {
        "bp_systolic_delta": (-8, -2),
        "heart_rate_delta": (3, 10),
        "spo2_delta": (-1.2, -0.3),
        "temperature_delta": (0.1, 0.3),
        "risk_score_growth": 0.09,
    },
}


def _choose_profile(risk_level: str, deterioration_score: int) -> str:
    if deterioration_score >= 60 or risk_level == "High":
        return "critical_trajectory"
    if deterioration_score >= 30 or risk_level == "Medium":
        return "declining"
    return "stable"


def _project_step(vitals: dict, profile: dict) -> dict:
    """Advance vitals by one 30‑minute step according to the profile."""
    new = {}
    for key in ["bp_systolic", "bp_diastolic", "heart_rate", "temperature", "spo2"]:
        current = vitals[key]

        if key == "bp_diastolic":
            # keep roughly 40% of systolic delta for diastolic
            delta_range = profile.get("bp_systolic_delta", (-1, 1))
            delta = random.uniform(delta_range[0] * 0.4, delta_range[1] * 0.4)
        else:
            delta_key = f"{key}_delta"
            delta_range = profile.get(delta_key, (-0.5, 0.5))
            delta = random.uniform(*delta_range)

        new[key] = round(current + delta, 1)

    # Clamp to physiologically possible ranges
    new["bp_systolic"] = max(40, min(260, new["bp_systolic"]))
    new["bp_diastolic"] = max(20, min(160, new["bp_diastolic"]))
    new["heart_rate"] = max(25, min(220, new["heart_rate"]))
    new["temperature"] = max(34.0, min(42.5, new["temperature"]))
    new["spo2"] = max(60, min(100, new["spo2"]))

    return new


def _compute_risk_score(vitals: dict, base_score: float) -> float:
    """
    Simple composite risk score (0‑1) from vitals.
    Uses sigmoid‑ish curves for each vital to penalise extremes.
    """
    penalties = 0.0

    bp = vitals["bp_systolic"]
    if bp < 90:
        penalties += (90 - bp) / 50
    elif bp > 180:
        penalties += (bp - 180) / 60

    hr = vitals["heart_rate"]
    if hr > 120:
        penalties += (hr - 120) / 80
    elif hr < 50:
        penalties += (50 - hr) / 30

    spo2 = vitals["spo2"]
    if spo2 < 94:
        penalties += (94 - spo2) / 15

    temp = vitals["temperature"]
    if temp > 38.5:
        penalties += (temp - 38.5) / 4
    elif temp < 35.5:
        penalties += (35.5 - temp) / 3

    score = base_score + penalties * 0.15
    return round(min(1.0, max(0.0, score)), 3)


def _score_to_risk(score: float) -> str:
    if score >= 0.65:
        return "High"
    if score >= 0.35:
        return "Medium"
    return "Low"


def simulate(
    patient: dict,
    risk_level: str,
    deterioration_score: int,
    time_horizon_minutes: int = 180,
    step_minutes: int = 30,
) -> dict:
    """
    Project the patient's vitals forward in time.

    Returns:
        {
            "timeline": [ {t_min, vitals, risk_score, risk_level}, ... ],
            "escalation_point_min": 60 | None,
            "summary": "Patient risk escalates from Medium to High at ~60 min"
        }
    """
    profile_name = _choose_profile(risk_level, deterioration_score)
    profile = _RATE_PROFILES[profile_name]

    current_vitals = {
        "bp_systolic": float(patient.get("bp_systolic", 120)),
        "bp_diastolic": float(patient.get("bp_diastolic", 80)),
        "heart_rate": float(patient.get("heart_rate", 75)),
        "temperature": float(patient.get("temperature", 36.8)),
        "spo2": float(patient.get("spo2", 98)),
    }

    base_risk_score = {"Low": 0.15, "Medium": 0.45, "High": 0.75}.get(
        risk_level, 0.3
    )

    timeline = []
    starting_risk = risk_level
    escalation_point = None

    steps = time_horizon_minutes // step_minutes

    for i in range(steps + 1):
        t = i * step_minutes
        risk_score = _compute_risk_score(current_vitals, base_risk_score)
        current_risk = _score_to_risk(risk_score)

        timeline.append({
            "time_minutes": t,
            "vitals": dict(current_vitals),
            "risk_score": risk_score,
            "risk_level": current_risk,
        })

        # Track when risk first escalates
        if escalation_point is None and current_risk != starting_risk:
            risk_order = {"Low": 0, "Medium": 1, "High": 2}
            if risk_order.get(current_risk, 0) > risk_order.get(starting_risk, 0):
                escalation_point = t

        # Step forward
        if i < steps:
            current_vitals = _project_step(current_vitals, profile)
            base_risk_score += profile["risk_score_growth"]

    # Build human‑readable summary
    final_risk = timeline[-1]["risk_level"]
    if escalation_point is not None:
        summary = (
            f"Patient risk is projected to escalate from {starting_risk} "
            f"to {final_risk} — first escalation around {escalation_point} min"
        )
    elif starting_risk == "High":
        summary = (
            f"Patient is already High risk and condition may continue "
            f"deteriorating over the next {time_horizon_minutes} min"
        )
    else:
        summary = (
            f"Patient condition appears stable at {starting_risk} risk "
            f"over {time_horizon_minutes}‑minute projection"
        )

    return {
        "profile": profile_name,
        "starting_risk": starting_risk,
        "projected_final_risk": final_risk,
        "escalation_point_min": escalation_point,
        "timeline": timeline,
        "summary": summary,
    }
