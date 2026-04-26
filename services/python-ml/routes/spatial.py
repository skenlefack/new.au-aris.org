"""
Spatial clustering endpoints using HDBSCAN.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from models.spatial_clusterer import SpatialClusterer

router = APIRouter()


class GeoPoint(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    value: float | None = None


class ClusterRequest(BaseModel):
    points: list[GeoPoint] = Field(..., min_length=5, description="At least 5 geo-points")
    min_cluster_size: int = Field(default=5, ge=2, description="Minimum points per cluster")


class ClusterCenter(BaseModel):
    lat: float
    lon: float


class ClusterResult(BaseModel):
    id: int
    center: ClusterCenter
    point_count: int
    label: str


class ClusterResponse(BaseModel):
    clusters: list[ClusterResult]
    noise_points: int
    total_points: int


@router.post("/clusters", response_model=ClusterResponse)
async def compute_clusters(req: ClusterRequest):
    """
    Cluster geographic points using HDBSCAN.

    Returns cluster centroids and membership. Points not assigned to any
    cluster are counted as noise.
    """
    try:
        clusterer = SpatialClusterer()
        result = clusterer.cluster(
            points=[{"lat": p.lat, "lon": p.lon, "value": p.value} for p in req.points],
            min_cluster_size=req.min_cluster_size,
        )
        return ClusterResponse(
            clusters=result["clusters"],
            noise_points=result["noise_points"],
            total_points=len(req.points),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")
