"""
ARIS 4.0 — Python ML Service
=============================
FastAPI service providing ML capabilities:
- Epidemic time-series predictions (XGBoost / Chronos-2)
- Anomaly detection (Isolation Forest)
- Spatial clustering (HDBSCAN)
- NLP classification & entity extraction (Ollama — Qwen / Phi-4)
"""

import time

from fastapi import FastAPI, Request
from prometheus_client import (
    Counter, Histogram, Gauge, Info, make_asgi_app,
)

from routes import predictions, anomalies, spatial, nlp, health

# ── Prometheus metrics ─────────────────────────────────────────
REQUEST_COUNT = Counter(
    "ml_requests_total",
    "Total ML API requests",
    ["method", "endpoint", "status"],
)
REQUEST_DURATION = Histogram(
    "ml_request_duration_seconds",
    "ML API request duration",
    ["method", "endpoint"],
    buckets=[0.1, 0.5, 1, 5, 10, 30, 60, 120, 300, 600],
)
PREDICTION_COUNT = Counter(
    "ml_prediction_total",
    "Total predictions made",
    ["model_type"],
)
PREDICTION_ERRORS = Counter(
    "ml_prediction_errors_total",
    "Total prediction errors",
    ["model_type"],
)
ACTIVE_REQUESTS = Gauge(
    "ml_active_requests",
    "Currently processing requests",
)
SERVICE_INFO = Info(
    "ml_service",
    "ML Service metadata",
)
SERVICE_INFO.info({"version": "1.0.0", "framework": "fastapi"})

# ── App ────────────────────────────────────────────────────────
app = FastAPI(
    title="ARIS ML Service",
    version="1.0.0",
    description="Machine Learning service for ARIS 4.0 — AU-IBAR",
)


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Track request count, duration, and active requests."""
    if request.url.path in ("/metrics", "/metrics/", "/health"):
        return await call_next(request)

    ACTIVE_REQUESTS.inc()
    start = time.time()
    try:
        response = await call_next(request)
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code,
        ).inc()
        return response
    except Exception:
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status=500,
        ).inc()
        raise
    finally:
        duration = time.time() - start
        REQUEST_DURATION.labels(
            method=request.method,
            endpoint=request.url.path,
        ).observe(duration)
        ACTIVE_REQUESTS.dec()


# ── Routers ────────────────────────────────────────────────────
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(predictions.router, prefix="/api/v1/ml/predictions", tags=["predictions"])
app.include_router(anomalies.router, prefix="/api/v1/ml/anomalies", tags=["anomalies"])
app.include_router(spatial.router, prefix="/api/v1/ml/spatial", tags=["spatial"])
app.include_router(nlp.router, prefix="/api/v1/ml/nlp", tags=["nlp"])

# ── Prometheus metrics endpoint ────────────────────────────────
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
