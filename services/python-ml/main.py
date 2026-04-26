"""
ARIS 4.0 — Python ML Service
=============================
FastAPI service providing ML capabilities:
- Epidemic time-series predictions (XGBoost / Chronos-2)
- Anomaly detection (Isolation Forest)
- Spatial clustering (HDBSCAN)
- NLP classification & entity extraction (Ollama — Qwen / Phi-4)
"""

from fastapi import FastAPI
from prometheus_client import make_asgi_app

from routes import predictions, anomalies, spatial, nlp, health

app = FastAPI(
    title="ARIS ML Service",
    version="1.0.0",
    description="Machine Learning service for ARIS 4.0 — AU-IBAR",
)

# ── Routers ────────────────────────────────────────────────────
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(predictions.router, prefix="/api/v1/ml/predictions", tags=["predictions"])
app.include_router(anomalies.router, prefix="/api/v1/ml/anomalies", tags=["anomalies"])
app.include_router(spatial.router, prefix="/api/v1/ml/spatial", tags=["spatial"])
app.include_router(nlp.router, prefix="/api/v1/ml/nlp", tags=["nlp"])

# ── Prometheus metrics endpoint ────────────────────────────────
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
