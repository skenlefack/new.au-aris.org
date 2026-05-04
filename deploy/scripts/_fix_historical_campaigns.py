#!/usr/bin/env python3
"""
ARIS 4.0 — Fix historical campaign metadata.

Links CollectionCampaign entries to their corresponding Campaign entries
by setting metadata.linkedCampaignId, so the backend can count real
submissions from the submissions table.

Also verifies actual row counts in the database.

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python -u _fix_historical_campaigns.py [--env prod|stg]
"""
import sys, os, json, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import ssh, step

# Known Campaign IDs (from _submit_historical.py — old Campaign model)
LINKED_CAMPAIGNS = {
    'animal-health': '805e4141-dc1c-4f82-b7e0-686c1efacee9',
    'livestock-prod': '35ddef54-7df3-4c2d-ae52-cf84febcd8c4',
}

ENVS = {
    'prod': {
        'vm_db': '10.202.101.185',
        'container': 'aris-postgres',
        'db_user': 'aris',
        'db_pass': 'Ar1s_Pr0d_2024!xK9mZ',
        'db_name': 'aris',
    },
    'stg': {
        'vm_db': '10.202.101.148',
        'container': 'aris-stg-postgres',
        'db_user': 'aris',
        'db_pass': 'Ar1s_Stg_2024!xK9mZ',
        'db_name': 'aris',
    },
}


def psql(env, query, timeout=30):
    """Run a psql query on the DB VM."""
    cfg = ENVS[env]
    cmd = (
        f"docker exec {cfg['container']} "
        f"psql -U {cfg['db_user']} -d {cfg['db_name']} -t -A -c \"{query}\""
    )
    code, out, err = ssh(cfg['vm_db'], cmd, timeout=timeout)
    clean = "\n".join(
        l for l in out.splitlines()
        if "[sudo]" not in l and "password for" not in l
    ).strip()
    return clean


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--env', default='prod', choices=['prod', 'stg'])
    args = parser.parse_args()
    env = args.env

    # ── Step 1: Verify actual submission counts ──
    step("Verify submission counts in DB")

    # Count total submissions
    total = psql(env, "SELECT count(*) FROM public.submissions")
    print(f"  Total submissions: {total}")

    # Count by campaign
    by_campaign = psql(env,
        "SELECT c.name, c.domain, count(s.id) AS cnt "
        "FROM public.submissions s "
        "JOIN public.campaigns c ON s.campaign_id = c.id "
        "GROUP BY c.name, c.domain ORDER BY cnt DESC"
    )
    print(f"  By campaign:")
    for line in by_campaign.splitlines():
        print(f"    {line}")

    # Count distinct countries
    countries = psql(env,
        "SELECT c.domain, count(DISTINCT s.data->>'country') AS cnt "
        "FROM public.submissions s "
        "JOIN public.campaigns c ON s.campaign_id = c.id "
        "GROUP BY c.domain"
    )
    print(f"  Distinct countries by domain:")
    for line in countries.splitlines():
        print(f"    {line}")

    # Count by status
    by_status = psql(env,
        "SELECT status, count(*) FROM public.submissions GROUP BY status ORDER BY status"
    )
    print(f"  By status:")
    for line in by_status.splitlines():
        print(f"    {line}")

    # ── Step 2: Find CollectionCampaign entries for historical data ──
    step("Find historical CollectionCampaigns")

    cc_list = psql(env,
        "SELECT id, name::text, domain, metadata::text, target_submissions "
        "FROM public.collection_campaigns "
        "WHERE name::text ILIKE '%historique%' OR name::text ILIKE '%historical%' "
        "ORDER BY domain"
    )
    print(f"  Found:")
    for line in cc_list.splitlines():
        print(f"    {line}")

    # ── Step 3: Link CollectionCampaign to Campaign via metadata ──
    step("Update metadata with linkedCampaignId")

    for domain, campaign_id in LINKED_CAMPAIGNS.items():
        # Verify Campaign exists
        exists = psql(env, f"SELECT id FROM public.campaigns WHERE id = '{campaign_id}'")
        if not exists:
            print(f"  WARNING: Campaign {campaign_id} ({domain}) not found in campaigns table!")
            continue

        # Count submissions for this campaign
        cnt = psql(env, f"SELECT count(*) FROM public.submissions WHERE campaign_id = '{campaign_id}'")
        print(f"  {domain}: Campaign {campaign_id} has {cnt} submissions")

        # Update CollectionCampaign metadata
        result = psql(env,
            f"UPDATE public.collection_campaigns "
            f"SET metadata = COALESCE(metadata, '{{}}'::jsonb) || "
            f"jsonb_build_object('linkedCampaignId', '{campaign_id}', 'importedRows', {cnt}), "
            f"target_submissions = {cnt} "
            f"WHERE domain = '{domain}' "
            f"AND (name::text ILIKE '%historique%' OR name::text ILIKE '%historical%') "
            f"RETURNING id, name::text, target_submissions"
        )
        if result:
            print(f"  Updated: {result}")
        else:
            print(f"  No matching CollectionCampaign found for domain={domain}")

    # ── Step 4: Verify historical_dataset counts ──
    step("Verify historical_dataset table")

    hist = psql(env,
        "SELECT name, domain, row_count, status "
        "FROM public.historical_dataset ORDER BY domain, name"
    )
    if hist:
        print(f"  Historical datasets:")
        for line in hist.splitlines():
            print(f"    {line}")
    else:
        print("  No historical_dataset entries found")

    # ── Step 5: Final verification ──
    step("Final verification")

    final = psql(env,
        "SELECT cc.name::text, cc.domain, cc.target_submissions, "
        "cc.metadata->>'linkedCampaignId' AS linked, "
        "cc.metadata->>'importedRows' AS rows "
        "FROM public.collection_campaigns cc "
        "WHERE cc.name::text ILIKE '%historique%' OR cc.name::text ILIKE '%historical%'"
    )
    print(f"  Final state:")
    for line in final.splitlines():
        print(f"    {line}")

    print("\n  Done! Deploy web + collecte to see updated stats.")


if __name__ == '__main__':
    main()
