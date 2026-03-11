"""
ARIS — Auto-bootstrap Superset datasource
Runs at container startup to ensure the ARIS PostgreSQL database
is registered as a datasource without manual intervention.
"""
import os
import logging
from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aris-bootstrap")

SUPERSET_META_URI = os.environ.get(
    "SQLALCHEMY_DATABASE_URI",
    "sqlite:///superset.db",
)

ARIS_DB_NAME = "ARIS"
ARIS_DB_URI = "postgresql://aris_bi_reader:BiReader2024!@postgres:5432/aris"


def bootstrap():
    """Insert the ARIS datasource into Superset's metadata DB if missing."""
    engine = create_engine(SUPERSET_META_URI)
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT id FROM dbs WHERE database_name = :name"),
            {"name": ARIS_DB_NAME},
        ).fetchone()

        if row:
            logger.info("ARIS datasource already exists (id=%s), skipping.", row[0])
            return

        conn.execute(
            text(
                """
                INSERT INTO dbs (
                    database_name, sqlalchemy_uri, expose_in_sqllab,
                    allow_run_async, allow_dml, cache_timeout,
                    extra, uuid
                ) VALUES (
                    :name, :uri, true,
                    true, false, 300,
                    '{"allows_virtual_table_explore": true}',
                    gen_random_uuid()
                )
                """
            ),
            {"name": ARIS_DB_NAME, "uri": ARIS_DB_URI},
        )
        conn.commit()
        logger.info("ARIS datasource created successfully.")


if __name__ == "__main__":
    try:
        bootstrap()
    except Exception as e:
        # Non-fatal: Superset will still start, admin can add DB manually
        logger.warning("Bootstrap datasource failed (non-fatal): %s", e)
