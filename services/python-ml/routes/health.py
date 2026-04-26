"""
Health check endpoint for the ARIS ML Service.
"""

import time
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

_start_time = time.time()


class HealthResponse(BaseModel):
    status: str
    models_loaded: list[str]
    uptime_seconds: float


@router.get("", response_model=HealthResponse)
async def health_check():
    """Return service health, loaded models, and uptime."""
    from models.epidemic_predictor import EpidemicPredictor
    from models.anomaly_detector import AnomalyDetector
    from models.spatial_clusterer import SpatialClusterer
    from models.ollama_client import OllamaClient

    loaded: list[str] = []
    if EpidemicPredictor.is_ready():
        loaded.append("epidemic_predictor")
    if AnomalyDetector.is_ready():
        loaded.append("anomaly_detector")
    if SpatialClusterer.is_ready():
        loaded.append("spatial_clusterer")

    ollama = OllamaClient()
    if await ollama.is_available():
        loaded.append("ollama")

    return HealthResponse(
        status="ok",
        models_loaded=loaded,
        uptime_seconds=round(time.time() - _start_time, 2),
    )
