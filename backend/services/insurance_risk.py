"""
Insurance Time‑Risk Calculator
---------------------------------
Models how insurance pre‑authorisation delays affect patient risk.

The core idea: a patient may need a procedure NOW, but the hospital
is waiting for insurance approval.  That delay is a concrete,
measurable risk multiplier — the patient's condition may escalate
while the paperwork is pending.

This module takes the digital twin projection and overlays the
expected insurance response time to determine whether the delay
will push the patient into a higher risk bracket.
"""


# Average response times by insurer + procedure complexity tier
INSURER_RESPONSE_PROFILES = {
    "BlueCross":     {"base_hours": 2.0, "variance": 0.6, "fast_track_available": True},
    "Aetna":         {"base_hours": 3.0, "variance": 0.8, "fast_track_available": True},
    "UnitedHealth":  {"base_hours": 2.5, "variance": 0.7, "fast_track_available": True},
    "Cigna":         {"base_hours": 3.5, "variance": 1.0, "fast_track_available": False},
    "Medicare":      {"base_hours": 1.5, "variance": 0.4, "fast_track_available": True},
    "Medicaid":      {"base_hours": 1.0, "variance": 0.3, "fast_track_available": True},
    "HumanaCare":    {"base_hours": 4.0, "variance": 1.2, "fast_track_available": False},
    "Self-Pay":      {"base_hours": 0.0, "variance": 0.0, "fast_track_available": True},
}

# How procedure urgency affects wait time
URGENCY_MULTIPLIER = {
    "High": 1.8,    # complex procedures need more review
    "Medium": 1.2,
    "Low": 0.6,
}


def estimate_response_time(
    insurer: str,
    risk_level: str,
) -> dict:
    """
    Estimate the insurance response window in minutes.
    """
    profile = INSURER_RESPONSE_PROFILES.get(
        insurer, {"base_hours": 2.5, "variance": 0.8, "fast_track_available": False}
    )
    base_min = profile["base_hours"] * 60
    multiplier = URGENCY_MULTIPLIER.get(risk_level, 1.0)
    variance_min = profile["variance"] * 60

    estimated_min = base_min * multiplier
    range_low = max(0, estimated_min - variance_min)
    range_high = estimated_min + variance_min

    return {
        "insurer": insurer,
        "estimated_minutes": round(estimated_min),
        "range_low_minutes": round(range_low),
        "range_high_minutes": round(range_high),
        "fast_track_available": profile["fast_track_available"],
    }


def assess_insurance_risk(
    insurer: str,
    risk_level: str,
    digital_twin_timeline: list[dict],
) -> dict:
    """
    Cross‑reference the insurance response window with the digital twin
    projection. Determine if the wait escalates the patient's risk.

    Args:
        insurer: the patient's insurer name
        risk_level: current risk level
        digital_twin_timeline: list of timeline steps from digital_twin.simulate()

    Returns structured advisory.
    """
    response = estimate_response_time(insurer, risk_level)
    est_wait = response["estimated_minutes"]

    # Find risk level at the estimated insurance response time
    risk_at_wait = risk_level
    risk_at_worst = risk_level
    escalation_during_wait = False

    for step in digital_twin_timeline:
        t = step["time_minutes"]
        if t <= est_wait:
            risk_at_wait = step["risk_level"]
        risk_at_worst = step["risk_level"]

    risk_order = {"Low": 0, "Medium": 1, "High": 2}
    if risk_order.get(risk_at_wait, 0) > risk_order.get(risk_level, 0):
        escalation_during_wait = True

    # Build advisory
    if insurer == "Self-Pay":
        advisory = "No insurance delay — patient can proceed to treatment immediately."
        urgency = "none"
    elif escalation_during_wait:
        advisory = (
            f"ALERT: Insurance response from {insurer} is estimated at "
            f"~{est_wait} min. Patient risk is projected to escalate from "
            f"{risk_level} to {risk_at_wait} during this wait. "
        )
        if response["fast_track_available"]:
            advisory += "Fast‑track authorisation is available — RECOMMENDED."
            urgency = "fast_track_recommended"
        else:
            advisory += (
                "Fast-track is NOT available with this insurer. Consider "
                "initiating treatment pending authorisation."
            )
            urgency = "treat_pending_approval"
    else:
        advisory = (
            f"Insurance response from {insurer} is estimated at ~{est_wait} min. "
            f"Patient risk is projected to remain at {risk_level} during this window."
        )
        urgency = "manageable"

    return {
        "insurance_response": response,
        "current_risk": risk_level,
        "risk_at_insurance_response": risk_at_wait,
        "escalation_during_wait": escalation_during_wait,
        "urgency": urgency,
        "advisory": advisory,
    }
