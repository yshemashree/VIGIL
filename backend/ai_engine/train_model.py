"""
Triage Model — Training Pipeline
----------------------------------
Trains an XGBoost classifier on the synthetic patient dataset.
Produces:
  - triage_model.joblib          (serialised model)
  - feature_columns.joblib       (ordered feature names for inference)
  - label_encoder.joblib         (risk‑level encoder)
  - training_metrics.json        (accuracy / precision / recall / f1)

Run:
    python -m backend.ai_engine.train_model
"""

import os, json, warnings
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import (
    classification_report, confusion_matrix, accuracy_score
)
from xgboost import XGBClassifier
import joblib

warnings.filterwarnings("ignore", category=UserWarning)

BASE = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE, "..", "data")
MODEL_DIR = os.path.join(BASE, "..", "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# ── All possible symptom and condition tokens ─────────────────────────
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


def _multi_hot(series: pd.Series, tokens: list[str]) -> pd.DataFrame:
    """Expand a pipe‑separated string column into binary columns."""
    out = pd.DataFrame(0, index=series.index, columns=tokens)
    for idx, raw in series.items():
        if pd.isna(raw) or raw == "none":
            continue
        for tok in str(raw).split("|"):
            tok = tok.strip()
            if tok in tokens:
                out.at[idx, tok] = 1
    return out


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    """
    Turn the raw CSV into a numeric feature matrix that XGBoost can
    consume.  Returns (X_dataframe, ordered_column_list).
    """
    feat = pd.DataFrame(index=df.index)

    # Demographics
    feat["age"] = df["age"].astype(float)
    feat["gender_enc"] = df["gender"].map(
        {"Male": 0, "Female": 1, "Other": 2}
    ).fillna(2).astype(float)

    # Vitals (raw — no scaling needed for tree models, but we keep
    # them handy for SHAP readability)
    for col in ["bp_systolic", "bp_diastolic", "heart_rate",
                "temperature", "spo2"]:
        feat[col] = df[col].astype(float)

    # Derived vitals
    feat["pulse_pressure"] = feat["bp_systolic"] - feat["bp_diastolic"]
    feat["map_pressure"] = (
        feat["bp_diastolic"] + feat["pulse_pressure"] / 3
    )
    feat["shock_index"] = feat["heart_rate"] / feat["bp_systolic"]

    # Symptom binary flags
    sym_df = _multi_hot(df["symptoms"], SYMPTOM_COLS)
    sym_df.columns = [f"sym_{c}" for c in sym_df.columns]
    feat = pd.concat([feat, sym_df], axis=1)

    # Condition binary flags
    cond_df = _multi_hot(df["pre_existing_conditions"], CONDITION_COLS)
    cond_df.columns = [f"cond_{c}" for c in cond_df.columns]
    feat = pd.concat([feat, cond_df], axis=1)

    # Symptom count & condition count — simple but informative
    feat["symptom_count"] = sym_df.sum(axis=1)
    feat["condition_count"] = cond_df.sum(axis=1)

    # Insurance response time
    feat["insurance_response_hours"] = df["insurance_response_hours"].astype(float)

    return feat, list(feat.columns)


def train():
    csv_path = os.path.join(DATA_DIR, "synthetic_patients.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            "Run the synthetic generator first: "
            "python -m backend.data.synthetic_generator"
        )

    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} records from {csv_path}")

    # Prepare features
    X, feature_cols = prepare_features(df)
    le = LabelEncoder()
    y = le.fit_transform(df["risk_level"])          # High=0, Low=1, Medium=2

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )
    print(f"Train: {len(X_train)}  |  Test: {len(X_test)}")

    # Train XGBoost
    model = XGBClassifier(
        n_estimators=250,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.85,
        colsample_bytree=0.85,
        min_child_weight=3,
        reg_alpha=0.1,
        reg_lambda=1.0,
        objective="multi:softprob",
        num_class=3,
        eval_metric="mlogloss",
        random_state=42,
        use_label_encoder=False,
        verbosity=0,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    # Evaluate
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    report = classification_report(
        y_test, y_pred, target_names=le.classes_, output_dict=True
    )
    cm = confusion_matrix(y_test, y_pred).tolist()

    print(f"\nAccuracy: {acc:.4f}")
    print(classification_report(y_test, y_pred, target_names=le.classes_))

    # Save everything
    model_path = os.path.join(MODEL_DIR, "triage_model.joblib")
    cols_path = os.path.join(MODEL_DIR, "feature_columns.joblib")
    le_path = os.path.join(MODEL_DIR, "label_encoder.joblib")
    metrics_path = os.path.join(MODEL_DIR, "training_metrics.json")

    joblib.dump(model, model_path)
    joblib.dump(feature_cols, cols_path)
    joblib.dump(le, le_path)

    metrics = {
        "accuracy": round(acc, 4),
        "per_class": {
            k: {m: round(v, 4) for m, v in vals.items()}
            for k, vals in report.items() if k in le.classes_
        },
        "confusion_matrix": cm,
        "classes": list(le.classes_),
        "feature_count": len(feature_cols),
        "train_size": len(X_train),
        "test_size": len(X_test),
    }
    with open(metrics_path, "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nModel saved   → {model_path}")
    print(f"Features      → {cols_path}")
    print(f"Label encoder → {le_path}")
    print(f"Metrics       → {metrics_path}")

    return model, le, feature_cols


if __name__ == "__main__":
    train()
