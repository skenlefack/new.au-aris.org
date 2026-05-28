"""
Epidemic time-series prediction endpoints.
Supports XGBoost, Chronos (zero-shot), and Prophet models.
"""

from enum import Enum
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from models.epidemic_predictor import EpidemicPredictor
from models.chronos_predictor import ChronosPredictor
from models.prophet_predictor import ProphetPredictor

router = APIRouter()


class ModelType(str, Enum):
    xgboost = "xgboost"
    chronos = "chronos"
    prophet = "prophet"


class PredictionRequest(BaseModel):
    indicator_code: str = Field(..., description="ARIS indicator code (e.g. 'outbreak_count')")
    country_code: str = Field(..., description="ISO 3166-1 alpha-2 country code")
    horizon_months: int = Field(default=6, ge=1, le=24, description="Forecast horizon in months")
    historical_data: list[dict] | None = Field(
        default=None,
        description="Optional historical data points [{ date, value }]. If omitted, fetched from DB.",
    )
    model: ModelType = Field(
        default=ModelType.xgboost,
        description="Model to use for prediction: xgboost, chronos, or prophet",
    )


class PredictionPoint(BaseModel):
    date: str
    value: float
    confidence: float = Field(ge=0, le=1)
    lower_bound: Optional[float] = Field(default=None, description="Lower bound of prediction interval")
    upper_bound: Optional[float] = Field(default=None, description="Upper bound of prediction interval")


class PredictionResponse(BaseModel):
    predictions: list[PredictionPoint]
    model_used: str
    indicator_code: str
    country_code: str
    confidence_method: Optional[str] = Field(
        default=None,
        description="Method used for confidence estimation (e.g. chronos_probabilistic, prophet_native)",
    )


# Singleton predictor instances
_xgboost_predictor = EpidemicPredictor()
_chronos_predictor = ChronosPredictor()
_prophet_predictor = ProphetPredictor()


@router.post("/epidemic", response_model=PredictionResponse)
async def predict_epidemic(req: PredictionRequest):
    """
    Forecast epidemic indicators using the selected model.

    - **xgboost** (default): XGBoost regression with trend features. Fast, no GPU needed.
    - **chronos**: Amazon Chronos-T5-Small zero-shot probabilistic forecaster. Provides native uncertainty intervals.
    - **prophet**: Meta Prophet with trend + seasonality decomposition. Best for data with seasonal patterns.

    All models accept historical data inline or will fetch from the ARIS database.
    Returns point forecasts with confidence intervals for the requested horizon.
    """
    try:
        if req.model == ModelType.chronos:
            if not _chronos_predictor.is_ready():
                raise HTTPException(
                    status_code=503,
                    detail="Chronos model not available: torch or chronos-forecasting not installed",
                )
            result = _chronos_predictor.predict(
                indicator_code=req.indicator_code,
                country_code=req.country_code,
                horizon_months=req.horizon_months,
                historical_data=req.historical_data,
            )
        elif req.model == ModelType.prophet:
            if not _prophet_predictor.is_ready():
                raise HTTPException(
                    status_code=503,
                    detail="Prophet model not available: prophet not installed",
                )
            result = _prophet_predictor.predict(
                indicator_code=req.indicator_code,
                country_code=req.country_code,
                horizon_months=req.horizon_months,
                historical_data=req.historical_data,
            )
        else:
            result = _xgboost_predictor.predict(
                indicator_code=req.indicator_code,
                country_code=req.country_code,
                horizon_months=req.horizon_months,
                historical_data=req.historical_data,
            )

        return PredictionResponse(
            predictions=result["predictions"],
            model_used=result["model_used"],
            indicator_code=req.indicator_code,
            country_code=req.country_code,
            confidence_method=result.get("confidence_method"),
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
