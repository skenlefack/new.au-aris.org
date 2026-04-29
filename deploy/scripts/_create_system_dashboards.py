#!/usr/bin/env python3
"""
ARIS 4.0 — Create two SYSTEM_TEMPLATE dashboards via the analytics API.

Creates:
  1. "Vue d'ensemble ARIS" (Overview) — isDefault: true
  2. "Analyse detaillee ARIS" (Detailed)

Both are SYSTEM_TEMPLATE, scope CONTINENTAL, reproducing the main ARIS dashboard.

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python -u _create_system_dashboards.py              # prod (default)
  python -u _create_system_dashboards.py --env staging
"""
import sys
import os
import json
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, ssh, VM_APP

# ── Environment configs ──────────────────────────────────────
ENVS = {
    "prod": {
        "vm_app": VM_APP,
        "credential_port": 3002,
        "analytics_port": 3030,
        "admin_email": "admin@au-aris.org",
        "admin_pass": "Aris2026@@4!0",
    },
    "staging": {
        "vm_app": "10.202.101.146",
        "credential_port": 3002,
        "analytics_port": 3030,
        "admin_email": "admin@au-aris.org",
        "admin_pass": "Aris2026@@4!0",
    },
}


# ── API helper ───────────────────────────────────────────────

def api_call(vm, method, port, path, token=None, body=None, timeout=15):
    """Make an HTTP call via curl on the remote VM.

    Uses base64-encoded body to avoid shell quoting issues with sudo bash -c.
    """
    import base64

    url = f"http://localhost:{port}{path}"
    parts = [f"curl -s --max-time {timeout} -X {method}"]
    parts.append('-H "Content-Type: application/json"')
    if token:
        parts.append(f'-H "Authorization: Bearer {token}"')

    if body:
        body_b64 = base64.b64encode(json.dumps(body).encode()).decode()
        parts.append(f'-d "$(echo {body_b64} | base64 -d)"')

    parts.append(f'"{url}"')
    cmd = " ".join(parts)

    code, out, err = ssh(vm, cmd, timeout=timeout + 10)

    # Filter sudo noise
    lines = []
    for line in (out or "").splitlines():
        if "[sudo]" not in line and "password for" not in line:
            lines.append(line)
    out = "\n".join(lines).strip()

    if not out:
        if code != 0:
            err_clean = "\n".join(
                l for l in (err or "").splitlines()
                if "[sudo]" not in l and "password for" not in l
            ).strip()
            return None, err_clean or f"exit code {code}"
        return {}, None

    try:
        return json.loads(out), None
    except json.JSONDecodeError:
        if code != 0:
            return None, f"HTTP error: {out[:500]}"
        return None, f"Invalid JSON: {out[:300]}"


def login(cfg):
    """Login and return (token, user_info, error)."""
    body = {"email": cfg["admin_email"], "password": cfg["admin_pass"]}
    data, err = api_call(
        cfg["vm_app"], "POST", cfg["credential_port"],
        "/api/v1/credential/auth/login", body=body
    )
    if err:
        return None, None, f"Login failed: {err}"
    if not data or "data" not in data:
        return None, None, f"Login failed: unexpected response: {json.dumps(data)[:300]}"

    token = data["data"].get("accessToken")
    user = data["data"].get("user", {})
    if not token:
        return None, None, "Login failed: no accessToken in response"

    return token, user, None


def list_existing_dashboards(cfg, token):
    """List existing SYSTEM_TEMPLATE dashboards."""
    data, err = api_call(
        cfg["vm_app"], "GET", cfg["analytics_port"],
        "/api/v1/analytics/dashboards?ownership=SYSTEM_TEMPLATE&limit=50",
        token=token
    )
    if err:
        return []

    dashboards = []
    if isinstance(data, dict):
        if isinstance(data.get("data"), list):
            dashboards = data["data"]
        elif isinstance(data.get("data"), dict):
            for key in ["items", "data", "dashboards"]:
                if key in data["data"]:
                    dashboards = data["data"][key]
                    break
    return dashboards


def find_dashboard_by_title(dashboards, title_fr):
    """Find a dashboard by its French title."""
    for d in dashboards:
        if d.get("titleFr") == title_fr:
            return d
    return None


# ── Dashboard definitions ────────────────────────────────────

def make_overview_dashboard():
    """Dashboard 1: Vue d'ensemble ARIS (Overview)."""
    return {
        "dashboard": {
            "titleFr": "Vue d'ensemble ARIS",
            "titleEn": "ARIS Overview",
            "ownership": "SYSTEM_TEMPLATE",
            "scope": "CONTINENTAL",
            "isDefault": True,
            "description": "Tableau de bord principal ARIS — vue continentale des indicateurs cles, carte des foyers, alertes et tendances.",
            "gridColumns": 12,
        },
        "sections": [
            {
                "titleFr": "Indicateurs cles",
                "titleEn": "Key Indicators",
                "columnCount": 3,
                "sortOrder": 0,
            },
            {
                "titleFr": "Carte & Alertes",
                "titleEn": "Map & Alerts",
                "columnCount": 2,
                "sortOrder": 1,
            },
            {
                "titleFr": "Tendances",
                "titleEn": "Trends",
                "columnCount": 2,
                "sortOrder": 2,
            },
            {
                "titleFr": "Distribution & Classement",
                "titleEn": "Distribution & Ranking",
                "columnCount": 2,
                "sortOrder": 3,
            },
        ],
        # Widgets grouped by section index
        "widgets_by_section": [
            # Section 0: Indicateurs cles (3 columns)
            [
                {
                    "type": "KPI_CARD",
                    "titleFr": "Pays declarants",
                    "titleEn": "Reporting Countries",
                    "columnIndex": 0,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {"value": None, "label": "Pays declarants", "suffix": "/55"},
                },
                {
                    "type": "KPI_CARD",
                    "titleFr": "Rapports",
                    "titleEn": "Reports",
                    "columnIndex": 1,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {"value": None, "label": "Rapports"},
                },
                {
                    "type": "KPI_CARD",
                    "titleFr": "Vaccinations",
                    "titleEn": "Vaccinations",
                    "columnIndex": 2,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {"value": None, "label": "Vaccinations"},
                },
            ],
            # Section 1: Carte & Alertes (2 columns)
            [
                {
                    "type": "MAP_AFRICA",
                    "titleFr": "Carte des foyers",
                    "titleEn": "Outbreak Map",
                    "columnIndex": 0,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {},
                },
                {
                    "type": "ALERT_FEED",
                    "titleFr": "Alertes actives",
                    "titleEn": "Active Alerts",
                    "columnIndex": 1,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {"alerts": [], "maxItems": 10},
                },
            ],
            # Section 2: Tendances (2 columns)
            [
                {
                    "type": "LINE_CHART",
                    "titleFr": "Evolution des foyers",
                    "titleEn": "Outbreak Trends",
                    "columnIndex": 0,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {
                        "data": [],
                        "chartConfig": {
                            "xKey": "month",
                            "yKeys": ["outbreaks", "submissions"],
                            "colors": ["#ef4444", "#3b82f6"],
                        },
                    },
                },
                {
                    "type": "BAR_CHART",
                    "titleFr": "Cas par maladie",
                    "titleEn": "Cases by Disease",
                    "columnIndex": 1,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {
                        "data": [],
                        "chartConfig": {
                            "xKey": "disease",
                            "yKeys": ["cases"],
                            "colors": ["#1F4E79"],
                        },
                    },
                },
            ],
            # Section 3: Distribution & Classement (2 columns)
            [
                {
                    "type": "PIE_CHART",
                    "titleFr": "Distribution des maladies",
                    "titleEn": "Disease Distribution",
                    "columnIndex": 0,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {
                        "data": [],
                        "chartConfig": {
                            "nameKey": "name",
                            "valueKey": "value",
                        },
                    },
                },
                {
                    "type": "TABLE",
                    "titleFr": "Top pays par soumissions",
                    "titleEn": "Top Countries by Submissions",
                    "columnIndex": 1,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {
                        "columns": [
                            {"key": "rank", "label": "#", "align": "center"},
                            {"key": "country", "label": "Pays"},
                            {"key": "submissions", "label": "Soumissions", "align": "right"},
                        ],
                        "rows": [],
                    },
                },
            ],
        ],
    }


def make_detailed_dashboard():
    """Dashboard 2: Analyse detaillee ARIS (Detailed)."""
    return {
        "dashboard": {
            "titleFr": "Analyse detaillee ARIS",
            "titleEn": "ARIS Detailed Analysis",
            "ownership": "SYSTEM_TEMPLATE",
            "scope": "CONTINENTAL",
            "isDefault": False,
            "description": "Tableau de bord detaille ARIS — indicateurs etendus, carte continentale, tendances mensuelles, distribution et activite.",
            "gridColumns": 12,
        },
        "sections": [
            {
                "titleFr": "Indicateurs",
                "titleEn": "Indicators",
                "columnCount": 4,
                "sortOrder": 0,
            },
            {
                "titleFr": "Carte & Alertes",
                "titleEn": "Map & Alerts",
                "columnCount": 2,
                "sortOrder": 1,
            },
            {
                "titleFr": "Tendances mensuelles",
                "titleEn": "Monthly Trends",
                "columnCount": 2,
                "sortOrder": 2,
            },
            {
                "titleFr": "Distribution",
                "titleEn": "Distribution",
                "columnCount": 2,
                "sortOrder": 3,
            },
            {
                "titleFr": "Activite & Courbes",
                "titleEn": "Activity & Curves",
                "columnCount": 2,
                "sortOrder": 4,
            },
        ],
        "widgets_by_section": [
            # Section 0: Indicateurs (4 columns)
            [
                {
                    "type": "KPI_CARD",
                    "titleFr": "Pays",
                    "titleEn": "Countries",
                    "columnIndex": 0,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {"value": None, "label": "Pays", "suffix": "/55"},
                },
                {
                    "type": "KPI_CARD",
                    "titleFr": "Rapports",
                    "titleEn": "Reports",
                    "columnIndex": 1,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {"value": None, "label": "Rapports"},
                },
                {
                    "type": "KPI_CARD",
                    "titleFr": "Vaccinations",
                    "titleEn": "Vaccinations",
                    "columnIndex": 2,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {"value": None, "label": "Vaccinations"},
                },
                {
                    "type": "KPI_CARD",
                    "titleFr": "Taux de validation",
                    "titleEn": "Validation Rate",
                    "columnIndex": 3,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {"value": None, "label": "Taux de validation", "suffix": "%"},
                },
            ],
            # Section 1: Carte & Alertes (2 columns)
            [
                {
                    "type": "MAP_AFRICA",
                    "titleFr": "Carte continentale des foyers",
                    "titleEn": "Continental Outbreak Map",
                    "columnIndex": 0,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {},
                },
                {
                    "type": "ALERT_FEED",
                    "titleFr": "Alertes actives",
                    "titleEn": "Active Alerts",
                    "columnIndex": 1,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {"alerts": [], "maxItems": 10},
                },
            ],
            # Section 2: Tendances mensuelles (2 columns)
            [
                {
                    "type": "LINE_CHART",
                    "titleFr": "Tendance des foyers",
                    "titleEn": "Outbreak Trend",
                    "columnIndex": 0,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {
                        "data": [],
                        "chartConfig": {
                            "xKey": "month",
                            "yKeys": ["outbreaks", "cases", "deaths"],
                            "colors": ["#ef4444", "#f59e0b", "#6b7280"],
                        },
                    },
                },
                {
                    "type": "BAR_CHART",
                    "titleFr": "Cas par maladie (Top 10)",
                    "titleEn": "Cases by Disease (Top 10)",
                    "columnIndex": 1,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {
                        "data": [],
                        "chartConfig": {
                            "xKey": "disease",
                            "yKeys": ["cases"],
                            "colors": ["#1F4E79"],
                        },
                    },
                },
            ],
            # Section 3: Distribution (2 columns)
            [
                {
                    "type": "PIE_CHART",
                    "titleFr": "Distribution des maladies",
                    "titleEn": "Disease Distribution",
                    "columnIndex": 0,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {
                        "data": [],
                        "chartConfig": {
                            "nameKey": "name",
                            "valueKey": "value",
                        },
                    },
                },
                {
                    "type": "TABLE",
                    "titleFr": "Classement des pays",
                    "titleEn": "Country Ranking",
                    "columnIndex": 1,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {
                        "columns": [
                            {"key": "rank", "label": "#", "align": "center"},
                            {"key": "country", "label": "Pays"},
                            {"key": "submissions", "label": "Soumissions", "align": "right"},
                            {"key": "validationRate", "label": "Taux (%)", "align": "right"},
                        ],
                        "rows": [],
                    },
                },
            ],
            # Section 4: Activite & Courbes (2 columns)
            [
                {
                    "type": "TEXT_BLOCK",
                    "titleFr": "Activite recente",
                    "titleEn": "Recent Activity",
                    "columnIndex": 0,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {
                        "content": "Espace reserve pour le fil d'activite recente (soumissions, validations, alertes).",
                    },
                },
                {
                    "type": "TEXT_BLOCK",
                    "titleFr": "Courbe epidemiologique",
                    "titleEn": "Epidemiological Curve",
                    "columnIndex": 1,
                    "sortOrder": 0,
                    "dataSource": "MANUAL_VALUE",
                    "config": {
                        "content": "Espace reserve pour la courbe epidemiologique (epi curve par semaine/mois).",
                    },
                },
            ],
        ],
    }


# ── Creation logic ───────────────────────────────────────────

def create_dashboard_with_widgets(cfg, token, definition):
    """Create a dashboard, then add widgets and save layout.

    Steps:
      1. POST /dashboards → create dashboard
      2. POST /dashboards/:id/widgets → add each widget (no sectionId yet)
      3. POST /dashboards/:id/layout → save sections + assign widgets to sections
    """
    dash_def = definition["dashboard"]
    sections_def = definition["sections"]
    widgets_by_section = definition["widgets_by_section"]

    # Step A: Create dashboard
    print(f"  Creating dashboard: {dash_def['titleFr']}...")
    data, err = api_call(
        cfg["vm_app"], "POST", cfg["analytics_port"],
        "/api/v1/analytics/dashboards",
        token=token, body=dash_def, timeout=15
    )
    if err:
        print(f"  ERROR creating dashboard: {err}")
        return None
    dashboard = data.get("data", data)
    dashboard_id = dashboard.get("id")
    if not dashboard_id:
        print(f"  ERROR: No dashboard ID in response: {json.dumps(data)[:300]}")
        return None
    print(f"  Dashboard created: {dashboard_id}")

    # Step B: Add all widgets (flat, without sectionId — we assign via layout later)
    widget_ids = []  # list of (section_index, column_index, sort_order, widget_id)
    for section_idx, section_widgets in enumerate(widgets_by_section):
        for widget_def in section_widgets:
            widget_body = {
                "type": widget_def["type"],
                "titleFr": widget_def["titleFr"],
                "titleEn": widget_def["titleEn"],
                "columnIndex": widget_def.get("columnIndex", 0),
                "sortOrder": widget_def.get("sortOrder", 0),
                "dataSource": widget_def.get("dataSource", "MANUAL_VALUE"),
                "config": widget_def.get("config", {}),
            }
            print(f"    Adding widget: {widget_def['type']} — {widget_def['titleFr']}...")
            w_data, w_err = api_call(
                cfg["vm_app"], "POST", cfg["analytics_port"],
                f"/api/v1/analytics/dashboards/{dashboard_id}/widgets",
                token=token, body=widget_body, timeout=15
            )
            if w_err:
                print(f"    WARNING: Could not add widget: {w_err}")
                continue
            w = w_data.get("data", w_data)
            w_id = w.get("id")
            if w_id:
                widget_ids.append((section_idx, widget_def.get("columnIndex", 0), widget_def.get("sortOrder", 0), w_id))
                print(f"    Widget added: {w_id}")
            else:
                print(f"    WARNING: No widget ID in response: {json.dumps(w_data)[:200]}")

    # Step C: Save layout (sections + widget assignments)
    # Build sections payload (without IDs — server creates them)
    layout_sections = []
    for s_def in sections_def:
        layout_sections.append({
            "id": None,
            "titleFr": s_def.get("titleFr", ""),
            "titleEn": s_def.get("titleEn", ""),
            "columnCount": s_def.get("columnCount", 2),
            "sortOrder": s_def["sortOrder"],
            "isCollapsed": False,
        })

    # We need section IDs for widget assignment. Save layout with sections first,
    # then re-save with widget assignments.
    print(f"  Saving layout (sections)...")
    layout_body = {
        "sections": layout_sections,
        "widgets": [],  # no widget assignments yet
    }
    l_data, l_err = api_call(
        cfg["vm_app"], "POST", cfg["analytics_port"],
        f"/api/v1/analytics/dashboards/{dashboard_id}/layout",
        token=token, body=layout_body, timeout=15
    )
    if l_err:
        print(f"  WARNING: Could not save layout: {l_err}")
        print(f"  Dashboard created but sections/layout may be missing.")
        return dashboard_id

    # Extract created section IDs
    layout_result = l_data.get("data", l_data)
    created_sections = layout_result.get("sections", [])

    # Sort by sortOrder to match our definition order
    created_sections_sorted = sorted(created_sections, key=lambda s: s.get("sortOrder", 0))

    if len(created_sections_sorted) < len(sections_def):
        print(f"  WARNING: Expected {len(sections_def)} sections, got {len(created_sections_sorted)}")

    # Build section index → section ID mapping
    section_id_map = {}
    for i, sec in enumerate(created_sections_sorted):
        section_id_map[i] = sec.get("id")
        print(f"    Section {i}: {sec.get('titleFr', '?')} → {sec.get('id')}")

    # Re-save layout with widget assignments
    print(f"  Saving layout (widget assignments)...")
    layout_widgets = []
    for section_idx, col_idx, sort_order, w_id in widget_ids:
        s_id = section_id_map.get(section_idx)
        if s_id:
            layout_widgets.append({
                "id": w_id,
                "sectionId": s_id,
                "columnIndex": col_idx,
                "sortOrder": sort_order,
            })

    if layout_widgets:
        layout_body_2 = {
            "sections": layout_sections,  # keep same sections
            "widgets": layout_widgets,
        }
        # Use section IDs from first save
        for i, sec in enumerate(layout_body_2["sections"]):
            if i in section_id_map:
                sec["id"] = section_id_map[i]

        l2_data, l2_err = api_call(
            cfg["vm_app"], "POST", cfg["analytics_port"],
            f"/api/v1/analytics/dashboards/{dashboard_id}/layout",
            token=token, body=layout_body_2, timeout=15
        )
        if l2_err:
            print(f"  WARNING: Could not save widget assignments: {l2_err}")
        else:
            print(f"  Layout saved with {len(layout_widgets)} widgets assigned to sections.")

    return dashboard_id


# ── Main ─────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="ARIS 4.0 — Create system template dashboards via API"
    )
    parser.add_argument(
        "--env", choices=["prod", "staging"], default="prod",
        help="Target environment (default: prod)",
    )
    args = parser.parse_args()
    cfg = ENVS[args.env]

    print("=" * 60)
    print(f"  ARIS 4.0 — System Template Dashboards")
    print(f"  Environment: {args.env}")
    print(f"  VM-APP:      {cfg['vm_app']}")
    print("=" * 60)

    # ── Step 1: Login ──
    step("Step 1: Login as super admin")
    token, user, err = login(cfg)
    if err:
        print(f"  ERROR: {err}")
        sys.exit(1)
    print(f"  Logged in as: {user.get('email')} (role: {user.get('role')})")
    print(f"  Tenant: {user.get('tenantId')}")

    # ── Step 2: Check existing dashboards (idempotent) ──
    step("Step 2: Check existing SYSTEM_TEMPLATE dashboards")
    existing = list_existing_dashboards(cfg, token)
    print(f"  Found {len(existing)} existing SYSTEM_TEMPLATE dashboard(s)")

    overview_exists = find_dashboard_by_title(existing, "Vue d'ensemble ARIS")
    detailed_exists = find_dashboard_by_title(existing, "Analyse detaillee ARIS")

    if overview_exists:
        print(f"  [SKIP] 'Vue d'ensemble ARIS' already exists: {overview_exists.get('id')}")
    if detailed_exists:
        print(f"  [SKIP] 'Analyse detaillee ARIS' already exists: {detailed_exists.get('id')}")

    if overview_exists and detailed_exists:
        print("\n  Both dashboards already exist. Nothing to do (idempotent).")
        print("=" * 60)
        return

    # ── Step 3: Create Dashboard 1 — Overview ──
    overview_id = None
    if not overview_exists:
        step("Step 3: Create Dashboard 1 — Vue d'ensemble ARIS")
        overview_def = make_overview_dashboard()
        overview_id = create_dashboard_with_widgets(cfg, token, overview_def)
        if overview_id:
            print(f"  Dashboard 1 created: {overview_id}")
        else:
            print(f"  ERROR: Failed to create Dashboard 1")
    else:
        overview_id = overview_exists.get("id")
        step("Step 3: Dashboard 1 already exists — skipping")

    # ── Step 4: Create Dashboard 2 — Detailed ──
    detailed_id = None
    if not detailed_exists:
        step("Step 4: Create Dashboard 2 — Analyse detaillee ARIS")
        detailed_def = make_detailed_dashboard()
        detailed_id = create_dashboard_with_widgets(cfg, token, detailed_def)
        if detailed_id:
            print(f"  Dashboard 2 created: {detailed_id}")
        else:
            print(f"  ERROR: Failed to create Dashboard 2")
    else:
        detailed_id = detailed_exists.get("id")
        step("Step 4: Dashboard 2 already exists — skipping")

    # ── Summary ──
    print("\n" + "=" * 60)
    print("  DONE — System Template Dashboards")
    print(f"  Dashboard 1 (Overview):  {overview_id or 'FAILED'}")
    print(f"  Dashboard 2 (Detailed):  {detailed_id or 'FAILED'}")
    print()
    print("  Dashboard 1: 4 sections, 9 widgets")
    print("    - Indicateurs cles: 3x KPI_CARD")
    print("    - Carte & Alertes: MAP_AFRICA + ALERT_FEED")
    print("    - Tendances: LINE_CHART + BAR_CHART")
    print("    - Distribution & Classement: PIE_CHART + TABLE")
    print()
    print("  Dashboard 2: 5 sections, 11 widgets")
    print("    - Indicateurs: 4x KPI_CARD")
    print("    - Carte & Alertes: MAP_AFRICA + ALERT_FEED")
    print("    - Tendances mensuelles: LINE_CHART + BAR_CHART")
    print("    - Distribution: PIE_CHART + TABLE")
    print("    - Activite & Courbes: 2x TEXT_BLOCK")
    print("=" * 60)


if __name__ == "__main__":
    main()
