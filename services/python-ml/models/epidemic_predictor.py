"""
Epidemic time-series predictor — XGBoost wrapper.

Provides point forecasts with confidence estimates for ARIS health indicators.
Chronos-2 integration is planned for Phase 2 (requires torch + chronos-forecasting).
"""

import logging
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

logger = logging.getLogger(__name__)

_model_ready = False


class EpidemicPredictor:
    """XGBoost-based time-series forecaster for epidemic indicators."""

    def __init__(self):
        self.model = XGBRegressor(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.05,
            objective="reg:squarederror",
        )

    @staticmethod
    def is_ready() -> bool:
        """Return True when the predictor is available."""
        return True  # XGBoost is always available (no model download needed)

    def predict(
        self,
        indicator_code: str,
        country_code: str,
        horizon_months: int,
        historical_data: list[dict] | None = None,
    ) -> dict:
        """
        Train on historical data and forecast forward.

        Parameters
        ----------
        indicator_code : str
            ARIS indicator code.
        country_code : str
            ISO 3166-1 alpha-2 country code.
        horizon_months : int
            Number of months to forecast.
        historical_data : list[dict] | None
            List of { "date": "YYYY-MM-DD", "value": float }.
            If None, a stub response is returned (DB integration Phase 2).

        Returns
        -------
        dict with "predictions" list and "model_used" string.
        """
        if not historical_data or len(historical_data) < 6:
            # Stub: return flat forecast when no data provided
            logger.warning(
                "No historical data for %s/%s — returning stub forecast",
                indicator_code,
                country_code,
            )
            return self._stub_forecast(horizon_months)

        df = pd.DataFrame(historical_data)
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)

        # Feature engineering: month, trend index
        df["month"] = df["date"].dt.month
        df["trend"] = np.arange(len(df))

        X = df[["month", "trend"]].values
        y = df["value"].values

        self.model.fit(X, y)

        # Generate future features
        last_date = df["date"].iloc[-1]
        last_trend = df["trend"].iloc[-1]
        predictions = []

        for i in range(1, horizon_months + 1):
            future_date = last_date + timedelta(days=30 * i)
            future_month = future_date.month
            future_trend = last_trend + i

            pred_value = float(self.model.predict(np.array([[future_month, future_trend]]))[0])
            # Confidence decays with horizon
            confidence = max(0.3, 1.0 - (i * 0.05))

            predictions.append({
                "date": future_date.strftime("%Y-%m-%d"),
                "value": round(max(0, pred_value), 2),
                "confidence": round(confidence, 2),
            })

        return {
            "predictions": predictions,
            "model_used": "xgboost",
        }

    @staticmethod
    def _stub_forecast(horizon_months: int) -> dict:
        """Return a placeholder forecast when no training data is available."""
        now = datetime.utcnow()
        return {
            "predictions": [
                {
                    "date": (now + timedelta(days=30 * i)).strftime("%Y-%m-%d"),
                    "value": 0.0,
                    "confidence": 0.0,
                }
                for i in range(1, horizon_months + 1)
            ],
            "model_used": "stub",
        }
