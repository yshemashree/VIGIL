"""
Hospital Resource Tracker
---------------------------
Manages and queries hospital resource availability (beds, ventilators,
monitors, staff). Used by the triage engine to factor capacity into
prioritisation and to trigger multi‑hospital referral suggestions.

In production this would read from a live hospital management system;
here we keep an in‑memory store initialised with realistic defaults.
"""

import copy
from datetime import datetime

# ── Default hospital resource state ───────────────────────────────────
_DEFAULT_RESOURCES = {
    "hospitals": [
        {
            "hospital_id": "HOSP-001",
            "name": "City General Hospital",
            "is_primary": True,
            "distance_km": 0,
            "departments": {
                "Emergency":        {"beds_total": 20, "beds_available": 8, "ventilators": 5, "monitors": 15, "staff_on_duty": 12},
                "Cardiology":       {"beds_total": 15, "beds_available": 5, "ventilators": 3, "monitors": 12, "staff_on_duty": 8},
                "Neurology":        {"beds_total": 12, "beds_available": 4, "ventilators": 2, "monitors": 10, "staff_on_duty": 6},
                "Pulmonology":      {"beds_total": 10, "beds_available": 3, "ventilators": 6, "monitors": 8, "staff_on_duty": 5},
                "Gastroenterology": {"beds_total": 8,  "beds_available": 4, "ventilators": 0, "monitors": 6, "staff_on_duty": 4},
                "General Medicine": {"beds_total": 30, "beds_available": 14,"ventilators": 2, "monitors": 20, "staff_on_duty": 15},
                "Orthopedics":      {"beds_total": 10, "beds_available": 6, "ventilators": 0, "monitors": 5, "staff_on_duty": 5},
                "Dermatology":      {"beds_total": 5,  "beds_available": 4, "ventilators": 0, "monitors": 2, "staff_on_duty": 3},
            },
        },
        {
            "hospital_id": "HOSP-002",
            "name": "St. Mary's Medical Center",
            "is_primary": False,
            "distance_km": 3.2,
            "departments": {
                "Emergency":        {"beds_total": 15, "beds_available": 6, "ventilators": 4, "monitors": 12, "staff_on_duty": 10},
                "Cardiology":       {"beds_total": 12, "beds_available": 7, "ventilators": 3, "monitors": 10, "staff_on_duty": 7},
                "Neurology":        {"beds_total": 8,  "beds_available": 5, "ventilators": 2, "monitors": 6, "staff_on_duty": 4},
                "Pulmonology":      {"beds_total": 8,  "beds_available": 4, "ventilators": 5, "monitors": 6, "staff_on_duty": 4},
                "General Medicine": {"beds_total": 25, "beds_available": 12,"ventilators": 2, "monitors": 15, "staff_on_duty": 10},
            },
        },
        {
            "hospital_id": "HOSP-003",
            "name": "Regional Trauma Center",
            "is_primary": False,
            "distance_km": 7.5,
            "departments": {
                "Emergency":        {"beds_total": 30, "beds_available": 15, "ventilators": 10, "monitors": 25, "staff_on_duty": 20},
                "Cardiology":       {"beds_total": 10, "beds_available": 6, "ventilators": 2, "monitors": 8, "staff_on_duty": 5},
                "Neurology":        {"beds_total": 10, "beds_available": 7, "ventilators": 3, "monitors": 8, "staff_on_duty": 5},
                "Pulmonology":      {"beds_total": 12, "beds_available": 8, "ventilators": 8, "monitors": 10, "staff_on_duty": 6},
            },
        },
    ],
}

# Runtime state (mutable copy)
_state = None


def _init():
    global _state
    if _state is None:
        _state = copy.deepcopy(_DEFAULT_RESOURCES)


def get_all_resources() -> dict:
    _init()
    return copy.deepcopy(_state)


def get_primary_hospital() -> dict:
    _init()
    for h in _state["hospitals"]:
        if h["is_primary"]:
            return copy.deepcopy(h)
    return _state["hospitals"][0]


def get_department_resources(department: str, hospital_id: str = "HOSP-001") -> dict | None:
    _init()
    for h in _state["hospitals"]:
        if h["hospital_id"] == hospital_id:
            return h["departments"].get(department)
    return None


def check_capacity(department: str) -> dict:
    """
    Check if the primary hospital has capacity for the given department.
    If not, find alternatives.
    """
    _init()
    primary = get_primary_hospital()
    dept_res = primary["departments"].get(department)

    if dept_res is None:
        # Department doesn't exist in primary
        available_here = False
        occupancy_pct = 100
    else:
        available_here = dept_res["beds_available"] > 0
        occupancy_pct = round(
            (1 - dept_res["beds_available"] / max(dept_res["beds_total"], 1)) * 100
        )

    alternatives = []
    if not available_here or occupancy_pct > 85:
        for h in _state["hospitals"]:
            if h["is_primary"]:
                continue
            alt_dept = h["departments"].get(department)
            if alt_dept and alt_dept["beds_available"] > 0:
                alternatives.append({
                    "hospital": h["name"],
                    "hospital_id": h["hospital_id"],
                    "distance_km": h["distance_km"],
                    "beds_available": alt_dept["beds_available"],
                    "ventilators": alt_dept.get("ventilators", 0),
                })

    status = "available"
    if not available_here:
        status = "full"
    elif occupancy_pct > 85:
        status = "near_capacity"

    return {
        "department": department,
        "status": status,
        "occupancy_percent": occupancy_pct,
        "beds_available": dept_res["beds_available"] if dept_res else 0,
        "alternatives": alternatives,
        "recommendation": (
            f"Capacity is adequate in {department}."
            if status == "available" else
            f"{department} is {'full' if status == 'full' else 'near capacity'}. "
            f"{len(alternatives)} alternative(s) found nearby."
        ),
    }


def admit_patient(department: str, hospital_id: str = "HOSP-001") -> bool:
    """Decrement available beds. Returns False if no beds left."""
    _init()
    for h in _state["hospitals"]:
        if h["hospital_id"] == hospital_id:
            dept = h["departments"].get(department)
            if dept and dept["beds_available"] > 0:
                dept["beds_available"] -= 1
                return True
    return False


def discharge_patient(department: str, hospital_id: str = "HOSP-001") -> bool:
    """Increment available beds on discharge."""
    _init()
    for h in _state["hospitals"]:
        if h["hospital_id"] == hospital_id:
            dept = h["departments"].get(department)
            if dept and dept["beds_available"] < dept["beds_total"]:
                dept["beds_available"] += 1
                return True
    return False


def reset():
    """Reset to default state (useful for testing/demo)."""
    global _state
    _state = None
    _init()


def register_hospital(hospital_id: str, name: str, departments: list[str],
                      total_beds: int = 0, ventilators: int = 0,
                      monitors: int = 0, icu_beds: int = 0,
                      distance_km: float = 5.0) -> None:
    """
    Register a hospital created via Hospital Management into the
    resource tracker so it appears on the Resources page.
    Distributes total infrastructure across the selected departments.
    """
    _init()
    # Don't add duplicates
    for h in _state["hospitals"]:
        if h["hospital_id"] == hospital_id:
            return

    dept_count = max(len(departments), 1)
    beds_per = total_beds // dept_count
    vents_per = ventilators // dept_count
    mons_per = monitors // dept_count
    icu_per = icu_beds // dept_count

    dept_map = {}
    for i, dept in enumerate(departments):
        # Give remainder to first department
        extra_beds = total_beds % dept_count if i == 0 else 0
        extra_vents = ventilators % dept_count if i == 0 else 0
        b = beds_per + extra_beds
        dept_map[dept] = {
            "beds_total": b,
            "beds_available": max(b - icu_per, 1),  # some beds occupied
            "ventilators": vents_per + extra_vents,
            "monitors": mons_per + (monitors % dept_count if i == 0 else 0),
            "staff_on_duty": max(b // 3, 2),  # rough staffing estimate
        }

    _state["hospitals"].append({
        "hospital_id": hospital_id,
        "name": name,
        "is_primary": False,
        "distance_km": distance_km,
        "departments": dept_map,
    })


def unregister_hospital(hospital_id: str) -> bool:
    """Remove a hospital from the resource tracker."""
    _init()
    before = len(_state["hospitals"])
    _state["hospitals"] = [
        h for h in _state["hospitals"] if h["hospital_id"] != hospital_id
    ]
    return len(_state["hospitals"]) < before
