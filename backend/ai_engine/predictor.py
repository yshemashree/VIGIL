"""
Triage Predictor — Runtime Inference
--------------------------------------
Loads the trained XGBoost model and runs predictions on new patients.
Also hooks into SHAP for per‑patient explanations.
"""

import os
import numpy as np
import pandas as pd
import joblib
import shap

BASE = os.path.dirname(__file__)
MODEL_DIR = os.path.join(BASE, "..", "models")

# Lazy‑loaded singletons so we don't reload on every request
_model = None
_feature_cols = None
_label_encoder = None
_explainer = None


def _load():
    global _model, _feature_cols, _label_encoder, _explainer
    if _model is not None:
        return
    _model = joblib.load(os.path.join(MODEL_DIR, "triage_model.joblib"))
    _feature_cols = joblib.load(os.path.join(MODEL_DIR, "feature_columns.joblib"))
    _label_encoder = joblib.load(os.path.join(MODEL_DIR, "label_encoder.joblib"))
    _explainer = shap.TreeExplainer(_model)


# -- Same feature prep used during training (kept in sync) ------------

SYMPTOM_COLS = [
    "chest_pain", "shortness_of_breath", "palpitations", "arm_pain",
    "jaw_pain", "headache", "dizziness", "vision_changes", "numbness",
    "confusion", "speech_difficulty", "fever", "cough", "wheezing",
    "breathlessness", "sore_throat", "nausea", "vomiting",
    "abdominal_pain", "diarrhea", "fatigue", "joint_pain",
    "back_pain", "swelling", "rash", "cold_sweats", "pale_skin",
    "frequent_urination", "weight_loss", "muscle_weakness",
]

CONDITION_COLS = [
    "diabetes", "hypertension", "heart_disease", "asthma", "copd",
    "chronic_kidney_disease", "obesity", "cancer", "stroke_history",
    "thyroid_disorder", "epilepsy",
]


def _build_feature_vector(patient: dict) -> pd.DataFrame:
    """
    Turn a single patient dict into the feature row the model expects.
    """
    row = {}

    # Demographics
    row["age"] = float(patient.get("age", 30))
    gender_map = {"Male": 0, "Female": 1, "Other": 2}
    row["gender_enc"] = float(gender_map.get(patient.get("gender", "Other"), 2))

    # Vitals
    row["bp_systolic"] = float(patient.get("bp_systolic", 120))
    row["bp_diastolic"] = float(patient.get("bp_diastolic", 80))
    row["heart_rate"] = float(patient.get("heart_rate", 75))
    row["temperature"] = float(patient.get("temperature", 36.8))
    row["spo2"] = float(patient.get("spo2", 98))

    # Derived
    row["pulse_pressure"] = row["bp_systolic"] - row["bp_diastolic"]
    row["map_pressure"] = row["bp_diastolic"] + row["pulse_pressure"] / 3
    row["shock_index"] = row["heart_rate"] / max(row["bp_systolic"], 1)

    # Symptoms — multi‑hot
    raw_sym = patient.get("symptoms", "")
    if isinstance(raw_sym, list):
        sym_set = set(raw_sym)
    else:
        sym_set = set(raw_sym.split("|")) if raw_sym else set()
    for s in SYMPTOM_COLS:
        row[f"sym_{s}"] = 1 if s in sym_set else 0

    # Conditions — multi‑hot
    raw_cond = patient.get("pre_existing_conditions", "none")
    if isinstance(raw_cond, list):
        cond_set = set(raw_cond)
    else:
        cond_set = set(raw_cond.split("|")) if raw_cond else set()
    for c in CONDITION_COLS:
        row[f"cond_{c}"] = 1 if c in cond_set else 0

    # Counts
    row["symptom_count"] = sum(1 for s in SYMPTOM_COLS if row[f"sym_{s}"])
    row["condition_count"] = sum(1 for c in CONDITION_COLS if row[f"cond_{c}"])

    # Insurance
    row["insurance_response_hours"] = float(
        patient.get("insurance_response_hours", 0)
    )

    df = pd.DataFrame([row])
    # Reorder to match training columns
    _load()
    for col in _feature_cols:
        if col not in df.columns:
            df[col] = 0
    return df[_feature_cols]


# ── Critical override rules ──────────────────────────────────────────
def _check_critical_override(patient: dict) -> str | None:
    """
    Hard‑coded safety rules. If any fires, skip the ML model entirely
    and flag the patient as HIGH risk heading for Emergency.
    """
    bp_sys = float(patient.get("bp_systolic", 120))
    hr = float(patient.get("heart_rate", 75))
    temp = float(patient.get("temperature", 36.8))
    spo2 = float(patient.get("spo2", 98))

    reasons = []
    if bp_sys >= 200:
        reasons.append(f"Critically high BP ({bp_sys})")
    if bp_sys <= 70:
        reasons.append(f"Dangerously low BP ({bp_sys})")
    if hr >= 150:
        reasons.append(f"Extreme tachycardia (HR {hr})")
    if hr <= 35:
        reasons.append(f"Severe bradycardia (HR {hr})")
    if temp >= 40.5:
        reasons.append(f"Hyperpyrexia (Temp {temp}°C)")
    if spo2 <= 85:
        reasons.append(f"Severe hypoxia (SpO2 {spo2}%)")

    if reasons:
        return "; ".join(reasons)
    return None


def predict(patient: dict) -> dict:
    """
    Main entry point.  Returns structured result with risk, confidence,
    probabilities, and SHAP explanations.
    """
    _load()

    # 1) Critical override check
    override_reason = _check_critical_override(patient)
    if override_reason:
        return {
            "risk_level": "High",
            "confidence": 0.99,
            "probabilities": {"High": 0.99, "Medium": 0.005, "Low": 0.005},
            "override": True,
            "override_reason": override_reason,
            "shap_factors": [
                {"feature": "CRITICAL_OVERRIDE", "impact": 1.0,
                 "value": override_reason, "direction": "up"}
            ],
        }

    # 2) Build features & predict
    X = _build_feature_vector(patient)
    proba = _model.predict_proba(X)[0]
    pred_idx = int(np.argmax(proba))
    risk_label = _label_encoder.inverse_transform([pred_idx])[0]
    confidence = round(float(proba[pred_idx]), 4)

    prob_dict = {
        _label_encoder.inverse_transform([i])[0]: round(float(p), 4)
        for i, p in enumerate(proba)
    }

    # 3) SHAP explanation
    shap_vals = _explainer.shap_values(X)
    # shap_vals shape depends on SHAP version:
    #   list of arrays (one per class) → each is (n_samples, n_features)
    #   single 3D array (n_samples, n_features, n_classes)
    if isinstance(shap_vals, list):
        sv = np.array(shap_vals[pred_idx][0]).flatten()
    elif shap_vals.ndim == 3:
        sv = np.array(shap_vals[0, :, pred_idx]).flatten()
    else:
        sv = np.array(shap_vals[0]).flatten()

    feature_names = list(X.columns)
    feat_values = X.iloc[0].values.flatten()
    impacts = [
        (fname, float(s), float(fv))
        for fname, s, fv in zip(feature_names, sv, feat_values)
    ]
    impacts.sort(key=lambda t: abs(t[1]), reverse=True)

    shap_factors = []
    for fname, impact_val, feat_val in impacts[:8]:
        readable = fname.replace("sym_", "Symptom: ").replace("cond_", "Condition: ")
        readable = readable.replace("_", " ").title()
        shap_factors.append({
            "feature": readable,
            "impact": round(abs(impact_val), 4),
            "value": round(feat_val, 2),
            "direction": "up" if impact_val > 0 else "down",
        })

    return {
        "risk_level": risk_label,
        "confidence": confidence,
        "probabilities": prob_dict,
        "override": False,
        "override_reason": None,
        "shap_factors": shap_factors,
    }
