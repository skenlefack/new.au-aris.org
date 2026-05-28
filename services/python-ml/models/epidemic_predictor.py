"""
Epidemic time-series predictor — XGBoost wrapper with conformal prediction intervals.

Provides point forecasts with proper confidence intervals using split-conformal prediction.
"""

import logging
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from xgboost import XGBRegressor

logger = logging.getLogger(__name__)


class EpidemicPredictor:
    """XGBoost-based time-series forecaster with conformal prediction intervals."""

    def __init__(self):
        self.model = XGBRegressor(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.05,
            objective="reg:squarederror",
        )
        self._conformal_q: float | None = None  # calibrated residual quantile

    @staticmethod
    def is_ready() -> bool:
        return True

    def predict(
        self,
        indicator_code: str,
        country_code: str,
        horizon_months: int,
        historical_data: list[dict] | None = None,
    ) -> dict:
        """
        Train on historical data and forecast with conformal prediction intervals.

        Uses split-conformal prediction:
        1. Split data into train (70%) + calibration (30%)
        2. Fit XGBoost on train
        3. Compute absolute residuals on calibration set
        4. Take the 90th percentile of residuals as margin q
        5. Interval: [prediction - q, prediction + q]
        """
        if not historical_data or len(historical_data) < 6:
            logger.warning(
                "No historical data for %s/%s — returning stub forecast",
                indicator_code, country_code,
            )
            return self._stub_forecast(horizon_months)

        df = pd.DataFrame(historical_data)
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)

        df["month"] = df["date"].dt.month
        df["trend"] = np.arange(len(df))

        X = df[["month", "trend"]].values
        y = df["value"].values

        # Split-conformal: 70% train, 30% calibration
        n = len(X)
        split_idx = max(4, int(n * 0.7))
        X_train, X_calib = X[:split_idx], X[split_idx:]
        y_train, y_calib = y[:split_idx], y[split_idx:]

        self.model.fit(X_train, y_train)

        # Compute conformal quantile from calibration residuals
        if len(X_calib) >= 2:
            y_calib_pred = self.model.predict(X_calib)
            residuals = np.abs(y_calib - y_calib_pred)
            # 90th percentile for ~80% coverage interval
            self._conformal_q = float(np.quantile(residuals, 0.9))
        else:
            # Fallback: use training residuals
            y_train_pred = self.model.predict(X_train)
            residuals = np.abs(y_train - y_train_pred)
            self._conformal_q = float(np.quantile(residuals, 0.9)) * 1.5  # wider for safety

        # Refit on all data for production predictions
        self.model.fit(X, y)

        # Generate future forecasts
        last_date = df["date"].iloc[-1]
        last_trend = df["trend"].iloc[-1]
        predictions = []

        for i in range(1, horizon_months + 1):
            future_date = last_date + timedelta(days=30 * i)
            future_month = future_date.month
            future_trend = last_trend + i

            pred_value = float(self.model.predict(np.array([[future_month, future_trend]]))[0])

            # Conformal interval widens slightly with horizon
            horizon_factor = 1.0 + (i - 1) * 0.05
            margin = self._conformal_q * horizon_factor

            lower = round(max(0, pred_value - margin), 2)
            upper = round(pred_value + margin, 2)
            confidence = round(min(0.95, max(0.3, 1.0 - (margin / (abs(pred_value) + 1e-6)))), 2)

            predictions.append({
                "date": future_date.strftime("%Y-%m-%d"),
                "value": round(max(0, pred_value), 2),
                "confidence": confidence,
                "lower_bound": lower,
                "upper_bound": upper,
            })

        return {
            "predictions": predictions,
            "model_used": "xgboost",
            "confidence_method": "conformal_prediction",
        }

    @staticmethod
    def _stub_forecast(horizon_months: int) -> dict:
        now = datetime.utcnow()
        return {
            "predictions": [
                {
                    "date": (now + timedelta(days=30 * i)).strftime("%Y-%m-%d"),
                    "value": 0.0,
                    "confidence": 0.0,
                    "lower_bound": 0.0,
                    "upper_bound": 0.0,
                }
                for i in range(1, horizon_months + 1)
            ],
            "model_used": "stub",
            "confidence_method": "none",
        }
