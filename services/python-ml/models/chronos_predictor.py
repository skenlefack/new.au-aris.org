"""
Chronos time-series predictor — Amazon Chronos-T5 wrapper.

Uses the zero-shot Chronos-T5-Small foundation model for probabilistic
time-series forecasting. No fine-tuning required — the model generalizes
across domains out of the box.
"""

import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

_pipeline = None


class ChronosPredictor:
    """Chronos-T5 probabilistic time-series forecaster."""

    def __init__(self):
        self.pipeline = None

    @staticmethod
    def is_ready() -> bool:
        """Return True when torch + chronos are importable."""
        try:
            import torch  # noqa: F401
            from chronos import ChronosPipeline  # noqa: F401
            return True
        except ImportError:
            return False

    def _load_pipeline(self):
        """Lazy-load the Chronos pipeline on first prediction call."""
        if self.pipeline is not None:
            return

        from chronos import ChronosPipeline

        logger.info("Loading Chronos-T5-Small pipeline (CPU)...")
        self.pipeline = ChronosPipeline.from_pretrained(
            "amazon/chronos-t5-small",
            device_map="cpu",
        )
        logger.info("Chronos pipeline loaded successfully")

    def predict(
        self,
        indicator_code: str,
        country_code: str,
        horizon_months: int,
        historical_data: list[dict] | None = None,
    ) -> dict:
        """
        Forecast using Chronos-T5 probabilistic model.

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

        import torch
        import numpy as np

        self._load_pipeline()

        # Sort and extract values
        sorted_data = sorted(historical_data, key=lambda d: d["date"])
        values = [float(d["value"]) for d in sorted_data]
        context = torch.tensor(values, dtype=torch.float32)

        # Chronos returns samples: shape (num_series, num_samples, prediction_length)
        samples = self.pipeline.predict(
            context,
            prediction_length=horizon_months,
            num_samples=20,
        )

        # samples shape: (1, num_samples, horizon_months) — squeeze first dim
        samples_np = samples.squeeze(0).numpy()  # (num_samples, horizon_months)

        # Extract median and quantiles
        median = np.median(samples_np, axis=0)
        lower = np.quantile(samples_np, 0.1, axis=0)
        upper = np.quantile(samples_np, 0.9, axis=0)

        # Build prediction points
        last_date = datetime.strptime(sorted_data[-1]["date"], "%Y-%m-%d")
        predictions = []

        for i in range(horizon_months):
            future_date = last_date + timedelta(days=30 * (i + 1))
            value = float(median[i])
            lb = float(lower[i])
            ub = float(upper[i])

            # Confidence based on interval width relative to value
            interval_width = ub - lb
            if abs(value) > 1e-6:
                relative_width = interval_width / abs(value)
                confidence = max(0.1, min(1.0, 1.0 - relative_width * 0.5))
            else:
                confidence = 0.5

            predictions.append({
                "date": future_date.strftime("%Y-%m-%d"),
                "value": round(max(0, value), 2),
                "confidence": round(confidence, 2),
                "lower_bound": round(max(0, lb), 2),
                "upper_bound": round(max(0, ub), 2),
            })

        return {
            "predictions": predictions,
            "model_used": "chronos",
            "confidence_method": "chronos_probabilistic",
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
            "model_used": "chronos",
            "confidence_method": "chronos_probabilistic",
        }
