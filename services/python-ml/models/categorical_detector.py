"""
Categorical anomaly detection for ARIS form submissions.
Detects rare categories, unusual combinations, and statistical outliers in categorical data.
"""
import logging
from collections import Counter

import numpy as np
import pandas as pd
from scipy.stats import chi2_contingency

logger = logging.getLogger(__name__)


class CategoricalAnomalyDetector:
    """Detects anomalies in categorical data fields."""

    @staticmethod
    def is_ready() -> bool:
        return True

    def detect_rare_categories(self, values: list, threshold: float = 0.01) -> list[dict]:
        """Flag values appearing less than threshold proportion."""
        counter = Counter(values)
        total = len(values)
        anomalies = []
        for i, val in enumerate(values):
            freq = counter[val] / total
            if freq < threshold:
                anomalies.append({
                    "index": i,
                    "value": str(val),
                    "frequency": round(freq, 6),
                    "reason": f"Rare category (freq={freq:.4f} < {threshold})",
                    "method": "rare_category",
                })
        return anomalies

    def detect_chi_squared(self, col_a: list, col_b: list, alpha: float = 0.05) -> dict:
        """Chi-squared test of independence between two categorical columns."""
        df = pd.DataFrame({"a": col_a, "b": col_b})
        contingency = pd.crosstab(df["a"], df["b"])
        if contingency.shape[0] < 2 or contingency.shape[1] < 2:
            return {"independent": True, "p_value": 1.0, "statistic": 0.0}
        chi2, p_value, dof, expected = chi2_contingency(contingency)
        # Find cells with large residuals (unusual combinations)
        residuals = (contingency.values - expected) / np.sqrt(expected + 1e-10)
        unusual_pairs = []
        for i in range(residuals.shape[0]):
            for j in range(residuals.shape[1]):
                if abs(residuals[i, j]) > 2.0:  # >2 std devs
                    unusual_pairs.append({
                        "category_a": str(contingency.index[i]),
                        "category_b": str(contingency.columns[j]),
                        "residual": round(float(residuals[i, j]), 3),
                        "observed": int(contingency.values[i, j]),
                        "expected": round(float(expected[i, j]), 1),
                    })
        return {
            "independent": p_value > alpha,
            "p_value": round(float(p_value), 6),
            "statistic": round(float(chi2), 3),
            "dof": int(dof),
            "unusual_pairs": unusual_pairs,
        }

    def detect(self, data_points: list[dict], categorical_columns: list[str], sensitivity: float = 0.01) -> dict:
        """Unified entry point for categorical anomaly detection."""
        if not data_points or not categorical_columns:
            return {"anomalies": [], "total_points": 0, "anomaly_count": 0}

        all_anomalies = []
        chi_squared_results = []

        # Per-column rare category detection
        for col in categorical_columns:
            values = [dp.get(col) for dp in data_points if dp.get(col) is not None]
            if not values:
                continue
            rare = self.detect_rare_categories(values, threshold=sensitivity)
            for a in rare:
                a["column"] = col
            all_anomalies.extend(rare)

        # Pairwise chi-squared (for first 5 categorical columns to limit compute)
        cols_to_test = categorical_columns[:5]
        for i in range(len(cols_to_test)):
            for j in range(i + 1, len(cols_to_test)):
                col_a_vals = [dp.get(cols_to_test[i], "") for dp in data_points]
                col_b_vals = [dp.get(cols_to_test[j], "") for dp in data_points]
                result = self.detect_chi_squared(col_a_vals, col_b_vals)
                result["column_a"] = cols_to_test[i]
                result["column_b"] = cols_to_test[j]
                chi_squared_results.append(result)

        # Deduplicate anomalies by index
        seen = set()
        unique = []
        for a in all_anomalies:
            key = (a.get("index"), a.get("column"))
            if key not in seen:
                seen.add(key)
                unique.append(a)

        return {
            "anomalies": unique,
            "total_points": len(data_points),
            "anomaly_count": len(unique),
            "chi_squared_tests": chi_squared_results,
        }
