"""
Anomaly detection — Isolation Forest wrapper.

Detects outliers in univariate time-series data for ARIS quality and surveillance.
"""

import logging

import numpy as np
from sklearn.ensemble import IsolationForest

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Isolation Forest based anomaly detector."""

    @staticmethod
    def is_ready() -> bool:
        """Return True when the detector is available."""
        return True

    def detect(self, data_points: list[dict], sensitivity: float = 0.1) -> list[dict]:
        """
        Detect anomalies in a list of { value, timestamp } dicts.

        Parameters
        ----------
        data_points : list[dict]
            Each dict must have "value" (float) and "timestamp" (str).
        sensitivity : float
            Contamination factor for Isolation Forest (0.01 to 0.5).

        Returns
        -------
        list[dict] of anomalous points with index, value, score, timestamp.
        """
        if len(data_points) < 10:
            raise ValueError("At least 10 data points are required for anomaly detection")

        values = np.array([dp["value"] for dp in data_points]).reshape(-1, 1)

        model = IsolationForest(
            contamination=sensitivity,
            random_state=42,
            n_estimators=200,
        )
        model.fit(values)

        predictions = model.predict(values)
        scores = model.decision_function(values)

        anomalies = []
        for i, (pred, score) in enumerate(zip(predictions, scores)):
            if pred == -1:  # -1 = anomaly in sklearn convention
                anomalies.append({
                    "index": i,
                    "value": data_points[i]["value"],
                    "score": round(float(score), 4),
                    "timestamp": data_points[i]["timestamp"],
                })

        logger.info(
            "Detected %d anomalies out of %d points (sensitivity=%.2f)",
            len(anomalies),
            len(data_points),
            sensitivity,
        )
        return anomalies
