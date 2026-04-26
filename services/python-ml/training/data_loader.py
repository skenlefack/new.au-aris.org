"""
ARIS 4.0 - ML Training Data Loader
Loads data from PostgreSQL for model training.
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger("aris.ml.data_loader")

DB_URL = os.getenv("DB_URL", "postgresql://aris:password@localhost:5432/aris")


def get_connection():
    """Create a PostgreSQL connection from DB_URL."""
    return psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)


def load_indicator_values(
    indicator_codes: list[str],
    since_days: int = 365 * 3,
    tenant_id: Optional[str] = None,
) -> pd.DataFrame:
    """
    Load indicator_values for time-series training (epidemic prediction, CHRONOS, PROPHET).

    Args:
        indicator_codes: List of indicator codes to load (e.g. ['OBR-001', 'OBR-002']).
        since_days: How far back to look (default 3 years).
        tenant_id: Optional tenant filter (UUID). If None, loads all tenants.

    Returns:
        DataFrame with columns: indicator_code, tenant_id, period_start, period_end,
                                numeric_value, geo_admin1, geo_admin2, created_at.
    """
    query = """
        SELECT
            iv.indicator_code,
            iv.tenant_id,
            iv.period_start,
            iv.period_end,
            iv.numeric_value,
            iv.text_value,
            iv.geo_admin1,
            iv.geo_admin2,
            iv.created_at
        FROM analytics.indicator_values iv
        WHERE iv.indicator_code = ANY(%s)
          AND iv.period_start >= %s
    """
    params: list = [indicator_codes, datetime.utcnow() - timedelta(days=since_days)]

    if tenant_id:
        query += " AND iv.tenant_id = %s"
        params.append(tenant_id)

    query += " ORDER BY iv.period_start ASC"

    logger.info(
        "Loading indicator_values: codes=%s, since_days=%d, tenant=%s",
        indicator_codes,
        since_days,
        tenant_id or "ALL",
    )

    with get_connection() as conn:
        df = pd.read_sql(query, conn, params=params)

    logger.info("Loaded %d indicator rows", len(df))
    return df


def load_form_submissions(
    form_template_ids: list[str],
    since_days: int = 365,
    tenant_id: Optional[str] = None,
) -> pd.DataFrame:
    """
    Load form submissions for anomaly detection (Isolation Forest).

    Args:
        form_template_ids: List of form template UUIDs.
        since_days: How far back to look.
        tenant_id: Optional tenant filter.

    Returns:
        DataFrame with columns: id, form_template_id, tenant_id, data (JSON),
                                submitted_at, status.
    """
    query = """
        SELECT
            s.id,
            s.form_template_id,
            s.tenant_id,
            s.data,
            s.submitted_at,
            s.status,
            s.created_at
        FROM public.submissions s
        WHERE s.form_template_id = ANY(%s)
          AND s.created_at >= %s
    """
    params: list = [form_template_ids, datetime.utcnow() - timedelta(days=since_days)]

    if tenant_id:
        query += " AND s.tenant_id = %s"
        params.append(tenant_id)

    query += " ORDER BY s.created_at ASC"

    logger.info(
        "Loading form submissions: templates=%d, since_days=%d",
        len(form_template_ids),
        since_days,
    )

    with get_connection() as conn:
        df = pd.read_sql(query, conn, params=params)

    logger.info("Loaded %d submission rows", len(df))
    return df


def load_geo_data(
    admin_level: int = 1,
    country_codes: Optional[list[str]] = None,
) -> pd.DataFrame:
    """
    Load geographic data for spatial clustering (HDBSCAN).

    Args:
        admin_level: Administrative level (1=region, 2=district).
        country_codes: Optional ISO-3166 country code filter.

    Returns:
        DataFrame with columns: code, name, country_code, admin_level,
                                latitude, longitude, geometry_geojson.
    """
    query = """
        SELECT
            g.code,
            g.name,
            g.country_code,
            g.admin_level,
            ST_Y(ST_Centroid(g.geom)) AS latitude,
            ST_X(ST_Centroid(g.geom)) AS longitude,
            ST_AsGeoJSON(g.geom) AS geometry_geojson
        FROM master_data.geo_entities g
        WHERE g.admin_level = %s
    """
    params: list = [admin_level]

    if country_codes:
        query += " AND g.country_code = ANY(%s)"
        params.append(country_codes)

    query += " ORDER BY g.country_code, g.code"

    logger.info("Loading geo data: level=%d, countries=%s", admin_level, country_codes or "ALL")

    with get_connection() as conn:
        df = pd.read_sql(query, conn, params=params)

    logger.info("Loaded %d geo entities", len(df))
    return df


def load_outbreak_events(
    since_days: int = 365 * 5,
    tenant_id: Optional[str] = None,
) -> pd.DataFrame:
    """
    Load outbreak events for epidemic prediction and spatial analysis.

    Args:
        since_days: How far back to look (default 5 years for seasonality).
        tenant_id: Optional tenant filter.

    Returns:
        DataFrame with outbreak event data including geo coordinates.
    """
    query = """
        SELECT
            e.id,
            e.tenant_id,
            e.disease_code,
            e.species_code,
            e.admin1_code,
            e.admin2_code,
            e.latitude,
            e.longitude,
            e.cases_count,
            e.deaths_count,
            e.severity,
            e.status,
            e.start_date,
            e.end_date,
            e.confirmed_at,
            e.created_at
        FROM animal_health.outbreak_events e
        WHERE e.start_date >= %s
    """
    params: list = [datetime.utcnow() - timedelta(days=since_days)]

    if tenant_id:
        query += " AND e.tenant_id = %s"
        params.append(tenant_id)

    query += " ORDER BY e.start_date ASC"

    logger.info("Loading outbreak events: since_days=%d, tenant=%s", since_days, tenant_id or "ALL")

    with get_connection() as conn:
        df = pd.read_sql(query, conn, params=params)

    logger.info("Loaded %d outbreak events", len(df))
    return df
