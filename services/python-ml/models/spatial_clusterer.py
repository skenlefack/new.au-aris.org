"""
Spatial clustering — HDBSCAN wrapper.

Clusters geographic points for outbreak hotspot analysis, wildlife sightings, etc.
"""

import logging

import numpy as np
import hdbscan

logger = logging.getLogger(__name__)


class SpatialClusterer:
    """HDBSCAN-based geographic point clusterer."""

    @staticmethod
    def is_ready() -> bool:
        """Return True when the clusterer is available."""
        return True

    def cluster(self, points: list[dict], min_cluster_size: int = 5) -> dict:
        """
        Cluster geographic points using HDBSCAN.

        Parameters
        ----------
        points : list[dict]
            Each dict has "lat", "lon", and optionally "value".
        min_cluster_size : int
            Minimum number of points to form a cluster.

        Returns
        -------
        dict with "clusters" list and "noise_points" count.
        """
        if len(points) < min_cluster_size:
            raise ValueError(
                f"Need at least {min_cluster_size} points (got {len(points)})"
            )

        coords = np.array([[p["lat"], p["lon"]] for p in points])

        # Convert to radians for haversine metric
        coords_rad = np.radians(coords)

        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            metric="haversine",
            cluster_selection_epsilon=0.0,
        )
        labels = clusterer.fit_predict(coords_rad)

        unique_labels = set(labels)
        unique_labels.discard(-1)  # Remove noise label

        clusters = []
        for label_id in sorted(unique_labels):
            mask = labels == label_id
            cluster_coords = coords[mask]
            center_lat = float(np.mean(cluster_coords[:, 0]))
            center_lon = float(np.mean(cluster_coords[:, 1]))

            clusters.append({
                "id": int(label_id),
                "center": {"lat": round(center_lat, 6), "lon": round(center_lon, 6)},
                "point_count": int(mask.sum()),
                "label": f"cluster_{label_id}",
            })

        noise_count = int((labels == -1).sum())

        logger.info(
            "Found %d clusters and %d noise points from %d input points",
            len(clusters),
            noise_count,
            len(points),
        )

        return {
            "clusters": clusters,
            "noise_points": noise_count,
        }
