"""
Wearable Vitals Simulator (WebSocket)
---------------------------------------
Simulates a smartwatch streaming heart rate, SpO2, and step data
in real time via WebSocket.

The simulation generates physiologically plausible vital streams:
  - Resting HR with natural sinus rhythm variation
  - SpO2 with occasional micro‑desaturation events
  - Gradual drift towards deterioration if the patient is high‑risk

Connect via:  ws://localhost:8000/ws/vitals/{patient_id}
"""

import asyncio
import json
import math
import random
from datetime import datetime


class VitalsStream:
    """
    Generates a realistic‑looking continuous vital signs stream
    for a single patient.
    """

    def __init__(
        self,
        base_hr: float = 75,
        base_spo2: float = 97,
        risk_level: str = "Low",
    ):
        self.base_hr = base_hr
        self.base_spo2 = base_spo2
        self.risk_level = risk_level
        self._tick = 0
        self._drift = 0.0

        # Risk‑based drift rate per tick
        self._drift_rate = {
            "Low": 0.0,
            "Medium": 0.02,
            "High": 0.06,
        }.get(risk_level, 0.0)

    def next_reading(self) -> dict:
        """Generate the next heartbeat‑level reading."""
        self._tick += 1

        # Sinus rhythm: slight sinusoidal variation (~respiratory sinus arrhythmia)
        resp_cycle = math.sin(self._tick * 0.15) * 3  # ~4 sec cycle
        random_jitter = random.gauss(0, 1.5)

        # Gradual deterioration drift for high‑risk patients
        self._drift += self._drift_rate

        hr = self.base_hr + resp_cycle + random_jitter + self._drift
        hr = max(30, min(200, hr))

        # SpO2: mostly stable with occasional dips
        spo2_noise = random.gauss(0, 0.3)
        # Occasional micro‑desaturation (more likely for high risk)
        desat_chance = 0.02 if self.risk_level == "Low" else 0.08
        if random.random() < desat_chance:
            spo2_noise -= random.uniform(1, 3)

        spo2 = self.base_spo2 + spo2_noise - (self._drift * 0.3)
        spo2 = max(70, min(100, spo2))

        # Step count (simulated — slow for hospital patients)
        steps = random.randint(0, 2) if random.random() < 0.1 else 0

        # Detect anomalies
        alerts = []
        if hr > 120:
            alerts.append({"type": "tachycardia", "value": round(hr, 1)})
        elif hr < 50:
            alerts.append({"type": "bradycardia", "value": round(hr, 1)})

        if spo2 < 92:
            alerts.append({"type": "hypoxia", "value": round(spo2, 1)})

        return {
            "timestamp": datetime.now().isoformat(timespec="milliseconds"),
            "heart_rate": round(hr, 1),
            "spo2": round(spo2, 1),
            "steps": steps,
            "tick": self._tick,
            "alerts": alerts,
        }


# Active streams keyed by patient_id
_active_streams: dict[str, VitalsStream] = {}


def get_or_create_stream(
    patient_id: str,
    base_hr: float = 75,
    base_spo2: float = 97,
    risk_level: str = "Low",
) -> VitalsStream:
    if patient_id not in _active_streams:
        _active_streams[patient_id] = VitalsStream(
            base_hr=base_hr, base_spo2=base_spo2, risk_level=risk_level
        )
    return _active_streams[patient_id]


def remove_stream(patient_id: str):
    _active_streams.pop(patient_id, None)
