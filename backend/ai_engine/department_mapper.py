"""
Department Recommendation Engine
----------------------------------
Maps (risk_level + symptoms + conditions) → recommended department
using weighted symptom‑cluster scoring with risk‑level adjustments.
"""

# Each department has a set of associated symptoms with relevance weights
DEPARTMENT_SYMPTOM_MAP = {
    "Emergency": {
        "symptoms": {
            "chest_pain": 3.0, "shortness_of_breath": 2.5, "confusion": 3.0,
            "cold_sweats": 2.5, "pale_skin": 2.0, "speech_difficulty": 2.5,
        },
        "conditions": {"heart_disease": 2.0, "stroke_history": 2.0},
        "risk_bonus": {"High": 4.0, "Medium": 0.5, "Low": -2.0},
    },
    "Cardiology": {
        "symptoms": {
            "chest_pain": 3.0, "palpitations": 3.0, "arm_pain": 2.5,
            "jaw_pain": 2.0, "shortness_of_breath": 2.0, "cold_sweats": 1.5,
            "dizziness": 1.0,
        },
        "conditions": {"heart_disease": 3.0, "hypertension": 2.0, "obesity": 1.0},
        "risk_bonus": {"High": 2.0, "Medium": 1.0, "Low": 0.0},
    },
    "Neurology": {
        "symptoms": {
            "headache": 2.5, "dizziness": 2.0, "vision_changes": 2.5,
            "numbness": 3.0, "confusion": 2.5, "speech_difficulty": 3.0,
            "muscle_weakness": 2.0,
        },
        "conditions": {"stroke_history": 3.0, "epilepsy": 2.5, "hypertension": 1.0},
        "risk_bonus": {"High": 2.0, "Medium": 0.5, "Low": 0.0},
    },
    "Pulmonology": {
        "symptoms": {
            "cough": 2.5, "wheezing": 3.0, "breathlessness": 3.0,
            "shortness_of_breath": 2.5, "fever": 1.0, "chest_pain": 1.0,
        },
        "conditions": {"asthma": 3.0, "copd": 3.0},
        "risk_bonus": {"High": 1.5, "Medium": 0.5, "Low": 0.0},
    },
    "Gastroenterology": {
        "symptoms": {
            "abdominal_pain": 3.0, "nausea": 2.5, "vomiting": 2.5,
            "diarrhea": 2.0, "weight_loss": 1.5, "fatigue": 0.5,
        },
        "conditions": {"none": 0},
        "risk_bonus": {"High": 1.0, "Medium": 0.5, "Low": 0.0},
    },
    "Orthopedics": {
        "symptoms": {
            "joint_pain": 3.0, "back_pain": 3.0, "swelling": 2.5,
            "muscle_weakness": 2.0,
        },
        "conditions": {"obesity": 1.0},
        "risk_bonus": {"High": 0.5, "Medium": 0.0, "Low": 0.0},
    },
    "General Medicine": {
        "symptoms": {
            "fever": 2.0, "fatigue": 2.0, "sore_throat": 2.5,
            "cough": 1.5, "headache": 1.0, "rash": 1.0,
            "frequent_urination": 2.0, "weight_loss": 1.5,
        },
        "conditions": {"diabetes": 2.0, "thyroid_disorder": 2.0},
        "risk_bonus": {"High": -1.0, "Medium": 0.0, "Low": 1.0},
    },
    "Dermatology": {
        "symptoms": {
            "rash": 3.0, "swelling": 1.5,
        },
        "conditions": {},
        "risk_bonus": {"High": -1.0, "Medium": -0.5, "Low": 1.0},
    },
}


def recommend_department(
    symptoms: list[str],
    conditions: list[str],
    risk_level: str,
) -> list[dict]:
    """
    Score every department and return a ranked list.

    Returns:
        [{"department": "Cardiology", "score": 12.5, "match_reasons": [...]}, ...]
    """
    results = []

    for dept, mapping in DEPARTMENT_SYMPTOM_MAP.items():
        score = 0.0
        reasons = []

        # Symptom matching
        for sym in symptoms:
            weight = mapping["symptoms"].get(sym, 0)
            if weight > 0:
                score += weight
                reasons.append(f"Symptom '{sym.replace('_', ' ')}' (+{weight})")

        # Condition matching
        for cond in conditions:
            weight = mapping["conditions"].get(cond, 0)
            if weight > 0:
                score += weight
                reasons.append(f"Condition '{cond.replace('_', ' ')}' (+{weight})")

        # Risk‑level adjustment
        bonus = mapping["risk_bonus"].get(risk_level, 0)
        score += bonus
        if bonus != 0:
            reasons.append(
                f"Risk level '{risk_level}' ({'+' if bonus > 0 else ''}{bonus})"
            )

        results.append({
            "department": dept,
            "score": round(score, 2),
            "match_reasons": reasons,
        })

    results.sort(key=lambda r: r["score"], reverse=True)
    return results


def get_top_department(
    symptoms: list[str],
    conditions: list[str],
    risk_level: str,
) -> dict:
    """Convenience — just the single best recommendation."""
    ranked = recommend_department(symptoms, conditions, risk_level)
    top = ranked[0]
    return {
        "recommended_department": top["department"],
        "confidence_score": round(
            top["score"] / max(sum(r["score"] for r in ranked if r["score"] > 0), 1),
            3
        ),
        "reasons": top["match_reasons"],
        "alternatives": [
            {"department": r["department"], "score": r["score"]}
            for r in ranked[1:4] if r["score"] > 0
        ],
    }
