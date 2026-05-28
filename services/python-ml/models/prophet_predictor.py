"""
Prophet time-series predictor — Meta Prophet wrapper.

Uses Facebook/Meta Prophet for decomposable time-series forecasting with
trend, seasonality, and holiday effects. Provides native uncertainty intervals.
"""

import logging
from datetime import datetime, timedelta

import pandas as pd

logger = logging.getLogger(__name__)


class ProphetPredictor:
    """Prophet-based time-series forecaster with native uncertainty intervals."""

    @staticmethod
    def is_ready() -> bool:
        """Return True when prophet is importable."""
        try:
            from prophet import Prophet  # noqa: F401
            return True
        except ImportError:
            return False

    def predict(
        self,
        indicator_code: str,
        country_code: str,
        horizon_months: int,
        historical_data: list[dict] | None = None,
    ) -> dict:
        """
        Forecast using Meta Prophet with trend + seasonality decomposition.

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

        Returns
        -------
        dict with "predictions" list, "model_used", and "confidence_method".
        """
        if not historical_data or len(historical_data) < 6:
            logger.warning(
                "Insufficient data for %s/%s — returning stub forecast",
                indicator_code,
                country_code,
            )
            return self._stub_forecast(horizon_months)

        from prophet import Prophet

        # Build Prophet DataFrame
        sorted_data = sorted(historical_data, key=lambda d: d["date"])
        df = pd.DataFrame({
            "ds": pd.to_datetime([d["date"] for d in sorted_data]),
            "y": [float(d["value"]) for d in sorted_data],
        })

        # Fit model with 80% prediction interval
        model = Prophet(interval_width=0.8)
        model.fit(df)

        # Generate future dates
        future = model.make_future_dataframe(periods=horizon_months, freq="MS")
        forecast = model.predict(future)

        # Extract only the forecasted periods (beyond historical data)
        forecast_future = forecast.tail(horizon_months)

        predictions = []
        for _, row in forecast_future.iterrows():
            value = float(row["yhat"])
            lb = float(row["yhat_lower"])
            ub = float(row["yhat_upper"])

            # Confidence based on interval width relative to predicted value
            interval_width = ub - lb
            if abs(value) > 1e-6:
                relative_width = interval_width / abs(value)
                confidence = max(0.1, min(1.0, 1.0 - relative_width * 0.5))
            else:
                confidence = 0.5

            predictions.append({
                "date": row["ds"].strftime("%Y-%m-%d"),
                "value": round(max(0, value), 2),
                "confidence": round(confidence, 2),
                "lower_bound": round(max(0, lb), 2),
                "upper_bound": round(max(0, ub), 2),
            })

        return {
            "predictions": predictions,
            "model_used": "prophet",
            "confidence_method": "prophet_native",
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
                    "lower_bound": 0.0,
                    "upper_bound": 0.0,
                }
                for i in range(1, horizon_months + 1)
            ],
            "model_used": "prophet",
            "confidence_method": "prophet_native",
        }
