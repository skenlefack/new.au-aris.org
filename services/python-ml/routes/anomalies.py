"""
Anomaly detection endpoints using Isolation Forest.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from models.anomaly_detector import AnomalyDetector

router = APIRouter()


class DataPoint(BaseModel):
    value: float
    timestamp: str


class AnomalyRequest(BaseModel):
    data_points: list[DataPoint] = Field(..., min_length=10, description="At least 10 data points")
    sensitivity: float = Field(
        default=0.1,
        ge=0.01,
        le=0.5,
        description="Contamination factor (proportion of expected anomalies)",
    )


class AnomalyResult(BaseModel):
    index: int
    value: float
    score: float = Field(description="Anomaly score (lower = more anomalous)")
    timestamp: str


class AnomalyResponse(BaseModel):
    anomalies: list[AnomalyResult]
    total_points: int
    anomaly_count: int


@router.post("/detect", response_model=AnomalyResponse)
async def detect_anomalies(req: AnomalyRequest):
    """
    Detect anomalies in a time series using Isolation Forest.

    Sensitivity controls the contamination parameter: higher values flag more points
    as anomalous. Requires at least 10 data points.
    """
    try:
        detector = AnomalyDetector()
        results = detector.detect(
            data_points=[{"value": dp.value, "timestamp": dp.timestamp} for dp in req.data_points],
            sensitivity=req.sensitivity,
        )
        return AnomalyResponse(
            anomalies=results,
            total_points=len(req.data_points),
            anomaly_count=len(results),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")
