"""
Anomaly detection endpoints — Isolation Forest + Categorical.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from models.anomaly_detector import AnomalyDetector
from models.categorical_detector import CategoricalAnomalyDetector

router = APIRouter()


class DataPoint(BaseModel):
    value: float
    timestamp: str


class AnomalyRequest(BaseModel):
    data_points: list[DataPoint] = Field(..., min_length=10, description="At least 10 data points")
    sensitivity: float = Field(default=0.1, ge=0.01, le=0.5)


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
    """Detect anomalies in a time series using Isolation Forest."""
    try:
        detector = AnomalyDetector()
        results = detector.detect(
            data_points=[{"value": dp.value, "timestamp": dp.timestamp} for dp in req.data_points],
            sensitivity=req.sensitivity,
        )
        return AnomalyResponse(anomalies=results, total_points=len(req.data_points), anomaly_count=len(results))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")


# ── Mixed (numeric + categorical) anomaly detection ──────────────


class MixedAnomalyRequest(BaseModel):
    data_points: list[dict] = Field(..., min_length=5, description="Data records with mixed fields")
    numeric_columns: list[str] = Field(default=[], description="Columns to analyze as numeric")
    categorical_columns: list[str] = Field(default=[], description="Columns to analyze as categorical")
    sensitivity: float = Field(default=0.1, ge=0.01, le=0.5)


class CategoricalAnomalyResult(BaseModel):
    index: int
    column: str
    value: str
    frequency: float | None = None
    reason: str
    method: str


class ChiSquaredResult(BaseModel):
    column_a: str
    column_b: str
    independent: bool
    p_value: float
    statistic: float
    unusual_pairs: list[dict] = []


class MixedAnomalyResponse(BaseModel):
    numeric_anomalies: list[AnomalyResult] = []
    categorical_anomalies: list[CategoricalAnomalyResult] = []
    chi_squared_tests: list[ChiSquaredResult] = []
    total_points: int
    numeric_anomaly_count: int = 0
    categorical_anomaly_count: int = 0


@router.post("/detect-mixed", response_model=MixedAnomalyResponse)
async def detect_mixed_anomalies(req: MixedAnomalyRequest):
    """Detect anomalies in mixed numeric + categorical data."""
    try:
        numeric_anomalies = []
        categorical_anomalies = []
        chi_tests = []

        # Numeric anomaly detection via IsolationForest
        if req.numeric_columns:
            numeric_points = []
            for i, dp in enumerate(req.data_points):
                for col in req.numeric_columns:
                    val = dp.get(col)
                    if val is not None and isinstance(val, (int, float)):
                        numeric_points.append({"value": float(val), "timestamp": str(i)})
            if len(numeric_points) >= 10:
                detector = AnomalyDetector()
                numeric_anomalies = detector.detect(numeric_points, sensitivity=req.sensitivity)

        # Categorical anomaly detection
        if req.categorical_columns:
            cat_detector = CategoricalAnomalyDetector()
            cat_result = cat_detector.detect(req.data_points, req.categorical_columns, sensitivity=req.sensitivity)
            categorical_anomalies = cat_result.get("anomalies", [])
            chi_tests = cat_result.get("chi_squared_tests", [])

        return MixedAnomalyResponse(
            numeric_anomalies=numeric_anomalies,
            categorical_anomalies=categorical_anomalies,
            chi_squared_tests=chi_tests,
            total_points=len(req.data_points),
            numeric_anomaly_count=len(numeric_anomalies),
            categorical_anomaly_count=len(categorical_anomalies),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mixed anomaly detection failed: {str(e)}")


# ── Submission anomaly analysis ──────────────────────────────


class SubmissionAnomalyRequest(BaseModel):
    submissions: list[dict] = Field(..., min_length=1, description="Submission objects with {id, data}")
    sensitivity: float = Field(default=0.1, ge=0.01, le=0.5)


class SubmissionAnomalyResult(BaseModel):
    submission_id: str
    is_anomaly: bool
    anomaly_score: float
    anomalous_fields: list[dict] = []


class SubmissionAnomalyResponse(BaseModel):
    results: list[SubmissionAnomalyResult]
    total_submissions: int
    anomaly_count: int


@router.post("/submissions", response_model=SubmissionAnomalyResponse)
async def analyze_submissions(req: SubmissionAnomalyRequest):
    """Analyze form submissions for anomalies by extracting numeric fields and running IsolationForest."""
    try:
        import numpy as np
        import pandas as pd
        from sklearn.ensemble import IsolationForest

        # Extract numeric fields from each submission's data
        all_numeric = {}
        submission_ids = []
        for sub in req.submissions:
            sid = sub.get("id", "unknown")
            data = sub.get("data", {})
            if not isinstance(data, dict):
                continue
            numeric_fields = {k: float(v) for k, v in data.items() if isinstance(v, (int, float))}
            if numeric_fields:
                submission_ids.append(sid)
                for k, v in numeric_fields.items():
                    all_numeric.setdefault(k, []).append(v)

        if len(submission_ids) < 5:
            return SubmissionAnomalyResponse(results=[], total_submissions=len(req.submissions), anomaly_count=0)

        # Build feature matrix
        df = pd.DataFrame({k: v for k, v in all_numeric.items() if len(v) == len(submission_ids)}).fillna(0)

        if df.empty or len(df) < 5:
            return SubmissionAnomalyResponse(results=[], total_submissions=len(req.submissions), anomaly_count=0)

        model = IsolationForest(contamination=req.sensitivity, random_state=42, n_estimators=200)
        model.fit(df)
        predictions = model.predict(df)
        scores = model.decision_function(df)

        results = []
        anomaly_count = 0
        for i, (sid, pred, score) in enumerate(zip(submission_ids, predictions, scores)):
            is_anomaly = pred == -1
            if is_anomaly:
                anomaly_count += 1
            # Find which fields contributed most (using per-feature analysis)
            anomalous_fields = []
            if is_anomaly:
                row = df.iloc[i]
                for col in df.columns:
                    col_vals = df[col].values
                    z = (row[col] - col_vals.mean()) / (col_vals.std() + 1e-10)
                    if abs(z) > 2.0:
                        anomalous_fields.append({"field": col, "value": round(float(row[col]), 4), "z_score": round(float(z), 3)})

            results.append(SubmissionAnomalyResult(
                submission_id=sid,
                is_anomaly=is_anomaly,
                anomaly_score=round(float(score), 4),
                anomalous_fields=anomalous_fields,
            ))

        return SubmissionAnomalyResponse(
            results=results,
            total_submissions=len(req.submissions),
            anomaly_count=anomaly_count,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Submission analysis failed: {str(e)}")
