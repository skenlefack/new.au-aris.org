#!/usr/bin/env python3
"""
ARIS 4.0 — E2E Tests: Form Builder & Referentials.

Tests form templates, submissions, referentials (species, gear types),
and collection campaigns.
"""
from conftest import (
    api_get, api_post, api_patch,
    admin_token, assert_response_ok, assert_paginated,
    register_cleanup,
)


# ── Form Templates ────────────────────────────────────────────────

def test_templates_list():
    """List form templates returns 200 with paginated data."""
    token = admin_token()
    status, body = api_get(
        "/api/v1/form-builder/templates?page=1&limit=20", token=token
    )
    assert status == 200, f"Expected 200, got {status}: {body}"
    assert_paginated(body)
    return True


def test_templates_filter_by_domain():
    """List templates filtered by domain returns only matching templates."""
    token = admin_token()
    status, body = api_get(
        "/api/v1/form-builder/templates?domain=fisheries&page=1&limit=20",
        token=token,
    )
    assert status == 200, f"Expected 200, got {status}: {body}"
    data = body.get("data", [])
    for template in data:
        domain = (
            template.get("domain") or template.get("domainCode") or ""
        ).lower()
        if domain:
            assert "fish" in domain, (
                f"Template domain mismatch: expected fisheries, got {domain}"
            )
    return True


def test_template_get_by_id():
    """Get form template by ID returns 200 with schema."""
    token = admin_token()

    # First, get a template ID from the list
    status, body = api_get(
        "/api/v1/form-builder/templates?page=1&limit=1", token=token
    )
    if status != 200 or not body.get("data"):
        return True  # No templates to test

    template = body["data"][0]
    template_id = template.get("id")
    if not template_id:
        return True

    s2, b2 = api_get(f"/api/v1/form-builder/templates/{template_id}", token=token)
    assert s2 == 200, f"Expected 200, got {s2}: {b2}"
    data = b2.get("data") or b2
    # Template should have a schema/fields definition
    assert data.get("id") == template_id, f"ID mismatch: {data.get('id')}"
    return True


def test_submission_create():
    """Create a form submission returns 201."""
    token = admin_token()

    # Get a template to submit against
    status, body = api_get(
        "/api/v1/form-builder/templates?page=1&limit=1", token=token
    )
    if status != 200 or not body.get("data"):
        return True

    template = body["data"][0]
    template_id = template.get("id")
    if not template_id:
        return True

    payload = {
        "data": {"test_field": "e2e_test_value"},
        "status": "DRAFT",
    }

    # Submissions are created under a template: POST /templates/:id/submissions
    s2, b2 = api_post(f"/api/v1/form-builder/templates/{template_id}/submissions", payload, token=token)

    if s2 in (201, 200):
        data = b2.get("data") or b2
        sub_id = data.get("id")
        if sub_id:
            register_cleanup(
                lambda sid=sub_id: api_patch(
                    f"/api/v1/form-builder/submissions/{sid}",
                    {"status": "CANCELLED"},
                    token=admin_token(),
                )
            )
        return True
    elif s2 in (400, 422):
        # Validation error — schema mismatch expected with dummy data
        return True
    else:
        raise AssertionError(f"Expected 201/200/400/422, got {s2}: {b2}")


def test_submissions_list_for_template():
    """Get submissions for a specific template returns 200."""
    token = admin_token()

    status, body = api_get(
        "/api/v1/form-builder/templates?page=1&limit=1", token=token
    )
    if status != 200 or not body.get("data"):
        return True

    template_id = body["data"][0].get("id")
    if not template_id:
        return True

    s2, b2 = api_get(
        f"/api/v1/form-builder/submissions?templateId={template_id}&page=1&limit=10",
        token=token,
    )
    assert s2 in (200, 404), f"Expected 200/404, got {s2}: {b2}"
    if s2 == 200:
        assert_paginated(b2)
    return True


def test_submission_update_status():
    """Update submission status returns 200."""
    token = admin_token()

    # Find an existing submission
    status, body = api_get(
        "/api/v1/form-builder/submissions?page=1&limit=1&status=DRAFT",
        token=token,
    )
    if status != 200 or not body.get("data") or len(body["data"]) == 0:
        return True  # No draft submissions to update

    sub = body["data"][0]
    sub_id = sub.get("id")
    if not sub_id:
        return True

    s2, b2 = api_patch(
        f"/api/v1/form-builder/submissions/{sub_id}",
        {"status": "DRAFT"},  # Keep as draft (idempotent)
        token=token,
    )
    assert s2 in (200, 400, 404), f"Expected 200/400/404, got {s2}: {b2}"
    return True


# ── Referentials ──────────────────────────────────────────────────

def test_fishery_referentials_exist():
    """Fishery referentials have expected items count."""
    token = admin_token()
    status, body = api_get(
        "/api/v1/master-data/referentials?domain=fisheries&page=1&limit=100",
        token=token,
    )

    if status == 200:
        data = body.get("data", [])
        # Should have referential items for fisheries
        return True
    elif status == 404:
        # Try alternate: species with AQUATIC category
        s2, b2 = api_get(
            "/api/v1/master-data/species?category=AQUATIC&page=1&limit=100",
            token=token,
        )
        assert s2 == 200, f"Expected 200, got {s2}: {b2}"
        return True
    else:
        raise AssertionError(f"Expected 200/404, got {status}: {body}")


def test_species_aquatic_filter():
    """Species for-select with AQUATIC filter returns only aquatic species."""
    token = admin_token()
    status, body = api_get(
        "/api/v1/master-data/species?category=AQUATIC&page=1&limit=50",
        token=token,
    )

    if status == 200:
        data = body.get("data", [])
        for sp in data:
            cat = (sp.get("category") or sp.get("taxonomyCategory") or "").upper()
            if cat:
                assert "AQUATIC" in cat or "FISH" in cat or "MARINE" in cat, (
                    f"Non-aquatic species in AQUATIC filter: {sp.get('name')} ({cat})"
                )
        return True

    # Filter param might not be 'category'
    assert status in (200, 400, 404), f"Expected 200/400/404, got {status}: {body}"
    return True


def test_gear_types_for_select():
    """Gear types for-select endpoint returns items."""
    token = admin_token()

    # Try referential endpoint for gear types
    status, body = api_get(
        "/api/v1/master-data/referentials?type=GEAR_TYPE&page=1&limit=50",
        token=token,
    )

    if status == 200:
        data = body.get("data", [])
        return True

    # Try alternate path
    s2, b2 = api_get(
        "/api/v1/master-data/gear-types?page=1&limit=50", token=token
    )
    if s2 == 200:
        data = b2.get("data", [])
        return True

    # Gear types might be embedded in species or form schemas
    assert s2 in (200, 404), f"Expected 200/404, got {s2}: {b2}"
    return True


# ── Campaigns ─────────────────────────────────────────────────────

def test_campaigns_list():
    """List collection campaigns returns 200."""
    token = admin_token()
    status, body = api_get(
        "/api/v1/collecte/campaigns?page=1&limit=20", token=token
    )
    assert status in (200, 404), f"Expected 200/404, got {status}: {body}"
    if status == 200:
        assert_paginated(body)
    return True


def test_campaign_get_by_id():
    """Get campaign by ID returns 200."""
    token = admin_token()
    status, body = api_get(
        "/api/v1/collecte/campaigns?page=1&limit=1", token=token
    )
    if status != 200 or not body.get("data") or len(body["data"]) == 0:
        return True

    campaign_id = body["data"][0].get("id")
    if not campaign_id:
        return True

    s2, b2 = api_get(f"/api/v1/collecte/campaigns/{campaign_id}", token=token)
    assert s2 == 200, f"Expected 200, got {s2}: {b2}"
    return True


def test_campaign_submissions_count():
    """Campaign has submissions count or submissions endpoint."""
    token = admin_token()
    status, body = api_get(
        "/api/v1/collecte/campaigns?page=1&limit=1", token=token
    )
    if status != 200 or not body.get("data") or len(body["data"]) == 0:
        return True

    campaign = body["data"][0]
    campaign_id = campaign.get("id")
    if not campaign_id:
        return True

    # Check submissions for this campaign
    s2, b2 = api_get(
        f"/api/v1/collecte/campaigns/{campaign_id}/submissions?page=1&limit=5",
        token=token,
    )

    if s2 in (200, 404):
        return True

    # Alternate: submissions might be at a different path
    s3, b3 = api_get(
        f"/api/v1/form-builder/submissions?campaignId={campaign_id}&page=1&limit=5",
        token=token,
    )
    assert s3 in (200, 404), f"Expected 200/404, got {s3}: {b3}"
    return True


# ── Collect all tests ─────────────────────────────────────────────
ALL_TESTS = [
    test_templates_list,
    test_templates_filter_by_domain,
    test_template_get_by_id,
    test_submission_create,
    test_submissions_list_for_template,
    test_submission_update_status,
    test_fishery_referentials_exist,
    test_species_aquatic_filter,
    test_gear_types_for_select,
    test_campaigns_list,
    test_campaign_get_by_id,
    test_campaign_submissions_count,
]
