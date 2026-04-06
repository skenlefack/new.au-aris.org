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
        "https://au-aris.org",
        "https://superset.au-aris.org",
        "https://test.au-aris.org",
        "https://superset-test.au-aris.org",
        "http://localhost:3100",
        "http://localhost:8088",
        "http://127.0.0.1:3100",
    ],
}

# ── Reverse proxy fix (Traefik terminates TLS, forwards HTTP internally) ──
# Without this, Flask thinks all requests are HTTP → Secure cookies won't set → redirect loop
ENABLE_PROXY_FIX = True
PROXY_FIX_CONFIG = {
    "x_for": 1,
    "x_proto": 1,
    "x_host": 1,
    "x_prefix": 1,
    "x_port": 1,
}

# ── Sub-path / Subdomain routing ──
# When using subdomain routing (superset.au-aris.org), FORCE_SCRIPT_NAME is not needed.
# When using sub-path routing (/bi-superset), FORCE_SCRIPT_NAME must be set.
# Set SUPERSET_SCRIPT_NAME="" in env to disable (subdomain mode).
_script_name = os.environ.get('SUPERSET_SCRIPT_NAME', '/bi-superset')
if _script_name:
    FORCE_SCRIPT_NAME = _script_name

# ── Disable Talisman CSP for iframe embedding ──
TALISMAN_ENABLED = False

# ── Session ──
# Same-origin iframe (same au-aris.org domain) → Lax is sufficient and more secure
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = True
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

# ── Cache (uses ARIS Redis on VM-CACHE) ──
_REDIS_HOST = os.environ.get("REDIS_HOST", "10.202.101.186")
_REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
_REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")

_redis_cache_base = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_HOST": _REDIS_HOST,
    "CACHE_REDIS_PORT": _REDIS_PORT,
}
if _REDIS_PASSWORD:
    _redis_cache_base["CACHE_REDIS_PASSWORD"] = _REDIS_PASSWORD

CACHE_CONFIG = {
    **_redis_cache_base,
    "CACHE_DEFAULT_TIMEOUT": 300,
    "CACHE_KEY_PREFIX": "superset_",
    "CACHE_REDIS_DB": 2,
}

DATA_CACHE_CONFIG = {
    **_redis_cache_base,
    "CACHE_DEFAULT_TIMEOUT": 600,
    "CACHE_KEY_PREFIX": "superset_data_",
    "CACHE_REDIS_DB": 3,
}

# ── Allow iframe embedding ──
# With TALISMAN_ENABLED = False, no X-Frame-Options header is sent,
# so browsers allow rendering inside iframes.
# Do NOT set X-Frame-Options here — "ALLOWALL" is not a valid value
# and Chrome treats unknown values as DENY, blocking the iframe.
HTTP_HEADERS = {}

# ── Disable CSRF for dev (cross-origin iframe login forms) ──
# In production with HTTPS + same domain, re-enable this.
WTF_CSRF_ENABLED = False

# ── Public role ──
PUBLIC_ROLE_LIKE = "Gamma"

# ── Row limits ──
ROW_LIMIT = 50000
SQL_MAX_ROW = 100000
