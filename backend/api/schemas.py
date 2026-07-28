"""
Pydantic schemas for API request / response validation.
"""

from pydantic import BaseModel, Field
from typing import Optional


class PatientInput(BaseModel):
    name: str = Field(default="Unknown", description="Patient full name")
    age: int = Field(..., ge=0, le=120, description="Patient age in years")
    gender: str = Field(..., description="Male / Female / Other")
    symptoms: list[str] = Field(default_factory=list, description="List of symptom codes")
    bp_systolic: float = Field(..., ge=0, le=300)
    bp_diastolic: float = Field(..., ge=0, le=200)
    heart_rate: float = Field(..., ge=0, le=250)
    temperature: float = Field(..., ge=30, le=45)
    spo2: float = Field(..., ge=50, le=100)
    pre_existing_conditions: list[str] = Field(default_factory=lambda: ["none"])
    insurance_provider: str = Field(default="Self-Pay")
    insurance_response_hours: float = Field(default=0.0, ge=0)


class TriageResult(BaseModel):
    patient_id: str
    risk_level: str
    confidence: float
    probabilities: dict[str, float]
    override: bool
    override_reason: Optional[str]
    shap_factors: list[dict]
    department: dict
    deterioration: dict
    symptom_issues: dict
    insurance_risk: Optional[dict] = None
    resource_status: Optional[dict] = None
    digital_twin: Optional[dict] = None


class DashboardStats(BaseModel):
    total_patients: int
    risk_distribution: dict[str, int]
    department_distribution: dict[str, int]
    avg_confidence: float
    critical_alerts: int
    resource_summary: dict
