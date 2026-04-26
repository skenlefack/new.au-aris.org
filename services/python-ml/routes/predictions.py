"""
Epidemic time-series prediction endpoints.
Uses XGBoost for tabular forecasting.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from models.epidemic_predictor import EpidemicPredictor

router = APIRouter()


class PredictionRequest(BaseModel):
    indicator_code: str = Field(..., description="ARIS indicator code (e.g. 'outbreak_count')")
    country_code: str = Field(..., description="ISO 3166-1 alpha-2 country code")
    horizon_months: int = Field(default=6, ge=1, le=24, description="Forecast horizon in months")
    historical_data: list[dict] | None = Field(
        default=None,
        description="Optional historical data points [{ date, value }]. If omitted, fetched from DB.",
    )


class PredictionPoint(BaseModel):
    date: str
    value: float
    confidence: float = Field(ge=0, le=1)


class PredictionResponse(BaseModel):
    predictions: list[PredictionPoint]
    model_used: str
    indicator_code: str
    country_code: str


@router.post("/epidemic", response_model=PredictionResponse)
async def predict_epidemic(req: PredictionRequest):
    """
    Forecast epidemic indicators using XGBoost time-series model.

    Accepts historical data inline or fetches from the ARIS database.
    Returns point forecasts with confidence intervals for the requested horizon.
    """
    try:
        predictor = EpidemicPredictor()
        result = predictor.predict(
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
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
