import os

# ═══════════════════════════════════════════
# ARIS Superset Configuration
# ═══════════════════════════════════════════

SECRET_KEY = os.environ.get('SUPERSET_SECRET_KEY', 'aris-superset-secret-2024')

SQLALCHEMY_DATABASE_URI = os.environ.get(
    'SQLALCHEMY_DATABASE_URI', 'sqlite:///superset.db'
)

# ── Embedding ──
FEATURE_FLAGS = {
    "EMBEDDED_SUPERSET": True,
    "ENABLE_TEMPLATE_PROCESSING": True,
    "DASHBOARD_NATIVE_FILTERS": True,
    "DASHBOARD_CROSS_FILTERS": True,
    "DASHBOARD_NATIVE_FILTERS_SET": True,
    "ALERT_REPORTS": False,
}

# ── CORS ──
ENABLE_CORS = True
CORS_OPTIONS = {
    "supports_credentials": True,
    "allow_headers": ["*"],
    "resources": ["*"],
    "origins": [
        "http://localhost:3100",
        "http://localhost:8088",
        "http://127.0.0.1:3100",
    ],
}

# ── Disable Talisman CSP for iframe embedding ──
TALISMAN_ENABLED = False

# ── Session ──
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_HTTPONLY = True

# ── Guest Token for secure embedding ──
GUEST_ROLE_NAME = "Gamma"
GUEST_TOKEN_JWT_SECRET = SECRET_KEY
GUEST_TOKEN_JWT_ALGO = "HS256"
GUEST_TOKEN_HEADER_NAME = "X-GuestToken"
GUEST_TOKEN_JWT_EXP_SECONDS = 3600

# ── Languages ──
LANGUAGES = {
    "en": {"flag": "us", "name": "English"},
    "fr": {"flag": "fr", "name": "French"},
    "pt": {"flag": "pt", "name": "Portuguese"},
}

# ── Cache (uses ARIS Redis) ──
CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_HOST": "redis",
    "CACHE_REDIS_PORT": 6379,
    "CACHE_REDIS_DB": 2,
}

DATA_CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 600,
    "CACHE_KEY_PREFIX": "superset_data_",
    "CACHE_REDIS_HOST": "redis",
    "CACHE_REDIS_PORT": 6379,
    "CACHE_REDIS_DB": 3,
}

# ── Allow iframe embedding ──
HTTP_HEADERS = {
    "X-Frame-Options": "ALLOWALL",
}

# ── Public role ──
PUBLIC_ROLE_LIKE = "Gamma"

# ── Row limits ──
ROW_LIMIT = 50000
SQL_MAX_ROW = 100000
