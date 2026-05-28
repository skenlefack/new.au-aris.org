"""
ARIS 4.0 - Generic ML Training Pipeline
Trains registered models and updates the ML registry in PostgreSQL.
"""

import os
import json
import logging
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor

from .data_loader import (
    get_connection,
    load_indicator_values,
    load_form_submissions,
    load_outbreak_events,
    load_geo_data,
)

logger = logging.getLogger("aris.ml.trainer")

MODELS_DIR = Path(os.getenv("MODELS_DIR", "/app/models"))
MODELS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Registry helpers
# ---------------------------------------------------------------------------

def get_registered_models(status_filter: Optional[list[str]] = None) -> list[dict]:
    """Fetch all models from the ml_models registry."""
    query = "SELECT * FROM ai.ml_models"
    params: list = []
    if status_filter:
        query += " WHERE status = ANY(%s)"
        params.append(status_filter)
    query += " ORDER BY created_at ASC"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()


def create_training_job(model_id: str, triggered_by: str = "SCHEDULE") -> str:
    """Insert a new training job row and return its id."""
    job_id = str(uuid.uuid4())
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ai.ml_training_jobs (id, model_id, status, triggered_by, started_at, created_at)
                VALUES (%s, %s, 'RUNNING', %s, NOW(), NOW())
                """,
                [job_id, model_id, triggered_by],
            )
        conn.commit()
    return job_id


def complete_training_job(
    job_id: str,
    status: str,
    duration_ms: int,
    input_row_count: int,
    metrics: dict,
    error_message: Optional[str] = None,
):
    """Update a training job with results."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE ai.ml_training_jobs
                SET status = %s,
                    completed_at = NOW(),
                    duration_ms = %s,
                    input_row_count = %s,
                    metrics = %s,
                    error_message = %s
                WHERE id = %s
                """,
                [status, duration_ms, input_row_count, json.dumps(metrics), error_message, job_id],
            )
        conn.commit()


def update_model_status(
    model_id: str,
    status: str,
    accuracy: Optional[float] = None,
    metrics: Optional[dict] = None,
    artifact_path: Optional[str] = None,
):
    """Update model registry after training."""
    sets = ["status = %s", "updated_at = NOW()"]
    params: list[Any] = [status]

    if status == "READY":
        sets.append("trained_at = NOW()")

    if accuracy is not None:
        sets.append("accuracy = %s")
        params.append(accuracy)

    if metrics is not None:
        sets.append("metrics = %s")
        params.append(json.dumps(metrics))

    if artifact_path is not None:
        sets.append("artifact_path = %s")
        params.append(artifact_path)

    params.append(model_id)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE ai.ml_models SET {', '.join(sets)} WHERE id = %s",
                params,
            )
        conn.commit()


# ---------------------------------------------------------------------------
# Training functions per model type
# ---------------------------------------------------------------------------

def train_xgboost_epidemic(model_record: dict) -> dict:
    """
    Train XGBoost for epidemic prediction.
    Uses outbreak event history + indicator time series to predict future outbreak risk.
    """
    from xgboost import XGBClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import f1_score, accuracy_score, precision_score, recall_score

    config = model_record.get("config", {})
    indicator_codes = config.get("indicator_codes", ["OBR-001", "OBR-002", "OBR-003"])
    since_days = config.get("since_days", 365 * 3)

    # Load data
    df_events = load_outbreak_events(since_days=since_days)
    df_indicators = load_indicator_values(indicator_codes, since_days=since_days)

    if df_events.empty:
        raise ValueError("No outbreak event data available for training")

    # Feature engineering: aggregate by month + admin1
    df_events["month"] = pd.to_datetime(df_events["start_date"]).dt.to_period("M")
    features = df_events.groupby(["admin1_code", "month"]).agg(
        cases=("cases_count", "sum"),
        deaths=("deaths_count", "sum"),
        event_count=("id", "count"),
    ).reset_index()

    # Target: will there be an outbreak next month? (binary)
    features["target"] = (features["cases"].shift(-1).fillna(0) > 0).astype(int)

    # Numeric features
    X = features[["cases", "deaths", "event_count"]].fillna(0)
    y = features["target"]

    input_row_count = len(X)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    xgb_params = config.get("xgb_params", {})
    clf = XGBClassifier(
        n_estimators=xgb_params.get("n_estimators", 100),
        max_depth=xgb_params.get("max_depth", 6),
        learning_rate=xgb_params.get("learning_rate", 0.1),
        random_state=42,
        use_label_encoder=False,
        eval_metric="logloss",
    )
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
    }

    # Save model artifact
    artifact_name = f"xgboost_epidemic_{model_record['code']}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.joblib"
    artifact_path = str(MODELS_DIR / artifact_name)
    joblib.dump(clf, artifact_path)

    return {
        "metrics": metrics,
        "accuracy": metrics["accuracy"],
        "artifact_path": artifact_path,
        "input_row_count": input_row_count,
    }


def train_isolation_forest_anomaly(model_record: dict) -> dict:
    """
    Train Isolation Forest for anomaly detection on form submissions.
    Detects outliers in numeric submission fields.
    """
    from sklearn.ensemble import IsolationForest
    from sklearn.metrics import silhouette_score

    config = model_record.get("config", {})
    form_template_ids = config.get("form_template_ids", [])
    since_days = config.get("since_days", 365)

    df = load_form_submissions(form_template_ids, since_days=since_days)

    if df.empty:
        raise ValueError("No form submission data available for training")

    # Extract numeric fields from JSON data
    numeric_data = []
    for _, row in df.iterrows():
        data = row["data"] if isinstance(row["data"], dict) else {}
        numeric_fields = {k: v for k, v in data.items() if isinstance(v, (int, float))}
        if numeric_fields:
            numeric_data.append(numeric_fields)

    if not numeric_data:
        raise ValueError("No numeric features found in submissions")

    features_df = pd.DataFrame(numeric_data).fillna(0)
    input_row_count = len(features_df)

    iso_params = config.get("isolation_forest_params", {})
    clf = IsolationForest(
        n_estimators=iso_params.get("n_estimators", 100),
        contamination=iso_params.get("contamination", 0.05),
        random_state=42,
    )
    clf.fit(features_df)

    predictions = clf.predict(features_df)
    anomaly_ratio = float((predictions == -1).sum() / len(predictions))

    metrics = {
        "anomaly_ratio": anomaly_ratio,
        "total_samples": int(len(predictions)),
        "anomalies_detected": int((predictions == -1).sum()),
        "features_count": len(features_df.columns),
    }

    artifact_name = f"iforest_anomaly_{model_record['code']}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.joblib"
    artifact_path = str(MODELS_DIR / artifact_name)
    joblib.dump(clf, artifact_path)

    return {
        "metrics": metrics,
        "accuracy": 1.0 - anomaly_ratio,  # proxy metric
        "artifact_path": artifact_path,
        "input_row_count": input_row_count,
    }


def train_hdbscan_spatial(model_record: dict) -> dict:
    """
    Train HDBSCAN for spatial clustering of outbreak hotspots.
    """
    import hdbscan

    config = model_record.get("config", {})
    since_days = config.get("since_days", 365 * 2)
    min_cluster_size = config.get("min_cluster_size", 5)

    df = load_outbreak_events(since_days=since_days)

    if df.empty:
        raise ValueError("No outbreak data with coordinates for spatial clustering")

    coords = df[["latitude", "longitude"]].dropna()
    input_row_count = len(coords)

    if input_row_count < min_cluster_size:
        raise ValueError(f"Not enough geo-located events ({input_row_count}) for clustering")

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=config.get("min_samples", 3),
        metric="haversine",
    )
    # Convert to radians for haversine
    coords_rad = np.radians(coords.values)
    labels = clusterer.fit_predict(coords_rad)

    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    noise_ratio = float((labels == -1).sum() / len(labels))

    metrics = {
        "n_clusters": n_clusters,
        "noise_ratio": noise_ratio,
        "total_points": int(len(labels)),
        "min_cluster_size": min_cluster_size,
    }

    artifact_name = f"hdbscan_spatial_{model_record['code']}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.joblib"
    artifact_path = str(MODELS_DIR / artifact_name)
    joblib.dump(clusterer, artifact_path)

    return {
        "metrics": metrics,
        "accuracy": 1.0 - noise_ratio,
        "artifact_path": artifact_path,
        "input_row_count": input_row_count,
    }


def train_chronos(model_record: dict) -> dict:
    """
    Validate Chronos zero-shot model.

    Since Chronos-T5 is a pre-trained foundation model that requires no fine-tuning,
    "training" means: download the model, load it, and validate on synthetic data
    to ensure inference works correctly on this hardware.
    """
    import time as _time

    config = model_record.get("config", {})
    model_name = config.get("model_name", "amazon/chronos-t5-small")

    # Step 1: Load the pipeline (this downloads the model if not cached)
    warmup_start = _time.time()

    from chronos import ChronosPipeline
    import torch

    pipeline = ChronosPipeline.from_pretrained(
        model_name,
        device_map="cpu",
    )
    warmup_time = round(_time.time() - warmup_start, 2)

    # Step 2: Validate on synthetic data — sine wave with noise
    synthetic_values = [
        100 + 30 * np.sin(2 * np.pi * i / 12) + np.random.normal(0, 5)
        for i in range(36)
    ]
    context = torch.tensor(synthetic_values, dtype=torch.float32)

    samples = pipeline.predict(context, prediction_length=6, num_samples=20)
    samples_np = samples.squeeze(0).numpy()

    # Validate outputs are finite and reasonable
    median = np.median(samples_np, axis=0)
    validation_passed = bool(
        np.all(np.isfinite(median))
        and len(median) == 6
        and np.all(np.abs(median) < 1e6)
    )

    if not validation_passed:
        raise ValueError("Chronos validation failed: predictions are not finite or reasonable")

    # Step 3: Estimate model size on disk
    import os
    cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
    model_size_mb = 0
    if os.path.exists(cache_dir):
        for dirpath, dirnames, filenames in os.walk(cache_dir):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if os.path.isfile(fp):
                    model_size_mb += os.path.getsize(fp)
        model_size_mb = round(model_size_mb / (1024 * 1024), 1)

    # Save a marker artifact (the real model lives in HuggingFace cache)
    artifact_name = f"chronos_validated_{model_record['code']}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.joblib"
    artifact_path = str(MODELS_DIR / artifact_name)
    joblib.dump({
        "model_name": model_name,
        "validation_passed": validation_passed,
        "warmup_time": warmup_time,
        "validated_at": datetime.utcnow().isoformat(),
    }, artifact_path)

    metrics = {
        "model_size_mb": model_size_mb,
        "validation_passed": validation_passed,
        "warmup_time": warmup_time,
        "model_name": model_name,
    }

    return {
        "metrics": metrics,
        "accuracy": 1.0 if validation_passed else 0.0,
        "artifact_path": artifact_path,
        "input_row_count": 36,  # synthetic validation data points
    }


def train_prophet(model_record: dict) -> dict:
    """
    Train a Prophet model on indicator time-series data.

    Loads historical indicator values, fits a Prophet model,
    evaluates on a held-out 20% test set, and saves the serialized model.
    """
    from prophet import Prophet
    from sklearn.metrics import mean_absolute_percentage_error, mean_squared_error

    config = model_record.get("config", {})
    indicator_codes = config.get("indicator_codes", ["OBR-001"])
    since_days = config.get("since_days", 365 * 3)

    # Load data
    df_raw = load_indicator_values(indicator_codes, since_days=since_days)

    if df_raw.empty:
        raise ValueError("No indicator data available for Prophet training")

    # Build Prophet DataFrame
    # Expect columns: date (or period_start), value (or numeric_value)
    date_col = "period_start" if "period_start" in df_raw.columns else "date"
    value_col = "numeric_value" if "numeric_value" in df_raw.columns else "value"

    df = pd.DataFrame({
        "ds": pd.to_datetime(df_raw[date_col]),
        "y": pd.to_numeric(df_raw[value_col], errors="coerce"),
    }).dropna().sort_values("ds").reset_index(drop=True)

    if len(df) < 10:
        raise ValueError(f"Not enough data points ({len(df)}) for Prophet training (minimum 10)")

    input_row_count = len(df)

    # Train/test split: 80/20
    split_idx = int(len(df) * 0.8)
    df_train = df.iloc[:split_idx]
    df_test = df.iloc[split_idx:]

    # Fit Prophet
    prophet_params = config.get("prophet_params", {})
    model = Prophet(
        interval_width=prophet_params.get("interval_width", 0.8),
        changepoint_prior_scale=prophet_params.get("changepoint_prior_scale", 0.05),
        seasonality_prior_scale=prophet_params.get("seasonality_prior_scale", 10.0),
    )
    model.fit(df_train)

    # Predict on test dates
    future_test = pd.DataFrame({"ds": df_test["ds"]})
    forecast = model.predict(future_test)

    y_true = df_test["y"].values
    y_pred = forecast["yhat"].values

    # Compute metrics
    mape = float(mean_absolute_percentage_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))

    metrics = {
        "mape": round(mape, 4),
        "rmse": round(rmse, 4),
        "training_points": int(len(df_train)),
        "test_points": int(len(df_test)),
    }

    # Save serialized model
    artifact_name = f"prophet_{model_record['code']}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.joblib"
    artifact_path = str(MODELS_DIR / artifact_name)
    joblib.dump(model, artifact_path)

    # Accuracy proxy: 1 - MAPE (clamped to [0, 1])
    accuracy = max(0.0, min(1.0, 1.0 - mape))

    return {
        "metrics": metrics,
        "accuracy": accuracy,
        "artifact_path": artifact_path,
        "input_row_count": input_row_count,
    }


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------

TRAINERS = {
    "XGBOOST": train_xgboost_epidemic,
    "ISOLATION_FOREST": train_isolation_forest_anomaly,
    "HDBSCAN": train_hdbscan_spatial,
    "CHRONOS": train_chronos,
    "PROPHET": train_prophet,
}


def train_model(model_record: dict, triggered_by: str = "SCHEDULE") -> dict:
    """
    Train a single model: create job, run trainer, update registry.

    Returns dict with job results.
    """
    model_id = model_record["id"]
    model_code = model_record["code"]
    model_type = model_record["type"]

    logger.info("Starting training: model=%s type=%s", model_code, model_type)

    trainer_fn = TRAINERS.get(model_type)
    if not trainer_fn:
        logger.warning("No trainer implemented for type=%s, skipping model=%s", model_type, model_code)
        return {"status": "SKIPPED", "reason": f"No trainer for {model_type}"}

    # Create job record
    job_id = create_training_job(model_id, triggered_by)
    update_model_status(model_id, "TRAINING")

    start_time = time.time()
    try:
        result = trainer_fn(model_record)
        duration_ms = int((time.time() - start_time) * 1000)

        # Update job
        complete_training_job(
            job_id=job_id,
            status="COMPLETED",
            duration_ms=duration_ms,
            input_row_count=result.get("input_row_count", 0),
            metrics=result.get("metrics", {}),
        )

        # Update model registry
        update_model_status(
            model_id=model_id,
            status="READY",
            accuracy=result.get("accuracy"),
            metrics=result.get("metrics"),
            artifact_path=result.get("artifact_path"),
        )

        logger.info(
            "Training completed: model=%s duration=%dms accuracy=%.3f",
            model_code,
            duration_ms,
            result.get("accuracy", 0),
        )
        return {"status": "COMPLETED", "job_id": job_id, **result}

    except Exception as exc:
        duration_ms = int((time.time() - start_time) * 1000)
        error_msg = str(exc)

        complete_training_job(
            job_id=job_id,
            status="FAILED",
            duration_ms=duration_ms,
            input_row_count=0,
            metrics={},
            error_message=error_msg,
        )
        update_model_status(model_id, "FAILED")

        logger.error("Training failed: model=%s error=%s", model_code, error_msg)
        return {"status": "FAILED", "job_id": job_id, "error": error_msg}


def train_all_models(triggered_by: str = "SCHEDULE") -> list[dict]:
    """
    Train all registered models that are READY or FAILED (retry).
    Returns list of results per model.
    """
    models = get_registered_models(status_filter=["READY", "FAILED", "TRAINING"])
    logger.info("Found %d models to train", len(models))

    results = []
    for model_record in models:
        result = train_model(model_record, triggered_by=triggered_by)
        result["model_code"] = model_record["code"]
        results.append(result)

    succeeded = sum(1 for r in results if r["status"] == "COMPLETED")
    failed = sum(1 for r in results if r["status"] == "FAILED")
    skipped = sum(1 for r in results if r["status"] == "SKIPPED")

    logger.info(
        "Training run complete: %d succeeded, %d failed, %d skipped",
        succeeded,
        failed,
        skipped,
    )
    return results
