#!/usr/bin/env python3
"""Import AFAData reference data into ARIS fishery_referentials table."""
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_PASS = "@u-1baR.0rg$U24"

REF_SQL = r"""
INSERT INTO public.fishery_referentials (id, tenant_id, category, code, name, fao_code, sort_order, is_active, metadata, created_at, updated_at) VALUES
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'GEAR_TYPE', 'DRAG_NET', '{"en":"Drag net","fr":"Filet trainant"}', '03.1.0', 11, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'VESSEL_TYPE', 'CANOE', '{"en":"Canoe","fr":"Pirogue"}', NULL, 1, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'VESSEL_TYPE', 'DEMERSAL_TRAWLER', '{"en":"Demersal Trawler","fr":"Chalutier demersal"}', NULL, 5, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'VESSEL_TYPE', 'PELAGIC_TRAWLER', '{"en":"Pelagic Trawler","fr":"Chalutier pelagique"}', NULL, 6, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'VESSEL_TYPE', 'TUNA_FLEET', '{"en":"Tuna Fleet","fr":"Flottille thoniere"}', NULL, 11, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'VESSEL_TYPE', 'SHRIMPERS', '{"en":"Shrimpers","fr":"Crevettier"}', NULL, 12, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'VESSEL_TYPE', 'BOAT', '{"en":"Boat","fr":"Bateau"}', NULL, 13, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FARM_TYPE', 'RACKS', '{"en":"Racks","fr":"Casiers / Racks"}', NULL, 6, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FARM_TYPE', 'LONG_LINES', '{"en":"Long lines","fr":"Filieres"}', NULL, 7, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FARM_TYPE', 'TUBES_BASKET', '{"en":"Tubes / Basket","fr":"Tubes / Paniers"}', NULL, 8, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'PRODUCT_STATE', 'FISH_OIL', '{"en":"Fish Oil","fr":"Huile de poisson"}', NULL, 1, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'PRODUCT_STATE', 'FISH_MEAL', '{"en":"Fish Meal","fr":"Farine de poisson"}', NULL, 2, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISH_CATEGORY', 'SEAWEED', '{"en":"Seaweed","fr":"Algues"}', NULL, 1, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISH_CATEGORY', 'SHELLFISH', '{"en":"Shellfish","fr":"Coquillages / Crustaces"}', NULL, 3, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISHERY_TYPE', 'ARTISANAL_GLEANER', '{"en":"Artisanal / Gleaner","fr":"Artisanal / Glaneur"}', NULL, 1, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISHERY_TYPE', 'ARTISANAL', '{"en":"Artisanal","fr":"Artisanal"}', NULL, 2, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISHERY_TYPE', 'SEMI_INDUSTRIAL', '{"en":"Semi-industrial","fr":"Semi-industriel"}', NULL, 3, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISHERY_TYPE', 'INDUSTRIAL', '{"en":"Industrial","fr":"Industriel"}', NULL, 4, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISHERY_TYPE', 'RECREATIONAL', '{"en":"Recreational","fr":"Recreatif"}', NULL, 5, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISHERY_TYPE', 'GLEANING', '{"en":"Gleaning","fr":"Glanage"}', NULL, 6, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISHING_ENVIRONMENT', 'FRESHWATER', '{"en":"Freshwater","fr":"Eau douce"}', NULL, 1, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISHING_ENVIRONMENT', 'BRACKISH', '{"en":"Brackish","fr":"Eau saumatre"}', NULL, 2, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISHING_ENVIRONMENT', 'MARINE', '{"en":"Marine","fr":"Marine"}', NULL, 3, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISHING_SYSTEM', 'EXTENSIVE', '{"en":"Extensive","fr":"Extensif"}', NULL, 1, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISHING_SYSTEM', 'INTENSIVE', '{"en":"Intensive","fr":"Intensif"}', NULL, 2, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'FISHING_SYSTEM', 'SEMI_INTENSIVE', '{"en":"Semi-intensive","fr":"Semi-intensif"}', NULL, 3, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'EFFORT_TYPE', 'NUM_VESSELS', '{"en":"Number of Vessels","fr":"Nombre de navires"}', NULL, 1, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'EFFORT_TYPE', 'NUM_FISHING_DAYS', '{"en":"Number of Fishing days","fr":"Nombre de jours de peche"}', NULL, 2, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'EFFORT_TYPE', 'NUM_FISHING_TRIPS', '{"en":"Number of Fishing trips","fr":"Nombre de sorties"}', NULL, 3, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'EFFORT_TYPE', 'NUM_FISHERMEN', '{"en":"Number of Fishermen","fr":"Nombre de pecheurs"}', NULL, 4, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'OPERATIONAL_SIZE', 'SMALL', '{"en":"Small scale (below 5 mt/yr)","fr":"Petite echelle (moins de 5 t/an)"}', NULL, 1, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'OPERATIONAL_SIZE', 'MEDIUM', '{"en":"Medium (between 5 - 50 mt/yr)","fr":"Moyen (entre 5 - 50 t/an)"}', NULL, 2, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'OPERATIONAL_SIZE', 'LARGE', '{"en":"Large (above 50 mt/yr)","fr":"Grande echelle (plus de 50 t/an)"}', NULL, 3, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'PRODUCTION_NODE', 'HATCHERY', '{"en":"Hatchery","fr":"Ecloserie"}', NULL, 1, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'PRODUCTION_NODE', 'OUT_GROWER', '{"en":"Out-grower","fr":"Sous-traitant grossissement"}', NULL, 2, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'PRODUCTION_NODE', 'BROODSTOCK', '{"en":"Broodstock Production","fr":"Production de geniteurs"}', NULL, 3, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'PRODUCTION_NODE', 'OFFSHORE_CAGES', '{"en":"Marine aquaculture in offshore cages","fr":"Aquaculture marine en cages offshore"}', NULL, 4, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'PRODUCTION_TYPE', 'AQUACULTURE', '{"en":"Aquaculture","fr":"Aquaculture"}', NULL, 1, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'PRODUCTION_TYPE', 'CAPTURE', '{"en":"Capture fisheries","fr":"Peche de capture"}', NULL, 2, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'TRADE_TYPE', 'EXPORT', '{"en":"Export","fr":"Exportation"}', NULL, 1, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'TRADE_TYPE', 'IMPORT', '{"en":"Import","fr":"Importation"}', NULL, 2, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'GENDER', 'MALE', '{"en":"Male","fr":"Masculin"}', NULL, 1, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'GENDER', 'FEMALE', '{"en":"Female","fr":"Feminin"}', NULL, 2, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'GENDER', 'NOT_DISCLOSED', '{"en":"Prefer not to disclose","fr":"Prefere ne pas divulguer"}', NULL, 3, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'AGE_RANGE', '15_24', '{"en":"15 - 24","fr":"15 - 24"}', NULL, 1, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'AGE_RANGE', '25_34', '{"en":"25 - 34","fr":"25 - 34"}', NULL, 2, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'AGE_RANGE', '35_44', '{"en":"35 - 44","fr":"35 - 44"}', NULL, 3, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'AGE_RANGE', '45_54', '{"en":"45 - 54","fr":"45 - 54"}', NULL, 4, true, '{}', now(), now()),
(gen_random_uuid(), '00000000-0000-4000-a000-000000000001', 'AGE_RANGE', '55_PLUS', '{"en":">= 54","fr":">= 54"}', NULL, 5, true, '{}', now(), now())
ON CONFLICT DO NOTHING;
SELECT category, count(*) FROM public.fishery_referentials GROUP BY category ORDER BY category;
"""

def run(host, label, container):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username='arisadmin', password=SSH_PASS, timeout=15)
    sftp = c.open_sftp()
    with sftp.open('/tmp/refs.sql', 'w') as f:
        f.write(REF_SQL)
    sftp.close()
    stdin, stdout, stderr = c.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker cp /tmp/refs.sql {container}:/tmp/refs.sql && "
        f"echo '{SSH_PASS}' | sudo -S docker exec {container} psql -U aris -d aris -f /tmp/refs.sql 2>&1",
        timeout=30)
    out = stdout.read().decode()
    print(f"\n=== {label} ===")
    for l in out.split('\n'):
        if '|' in l or l.strip().startswith('('):
            print(f"  {l.strip()}")
    c.close()

run('10.202.101.148', 'STAGING', 'aris-stg-postgres')
run('10.202.101.185', 'PRODUCTION', 'aris-postgres')
print("\nReferentials import done!")
