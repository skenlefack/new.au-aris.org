-- Veille starter configuration: the GDELT world-press source and one watchlist per main ARIS domain.
-- Idempotent (matches on name). Apply after add_veille_module.sql:
--   docker exec -i <pg> psql -U aris -d aris < seed_veille_starter.sql

INSERT INTO veille.watch_sources (id, name, type, url, reliability, interval_minutes, is_active, updated_at)
SELECT gen_random_uuid(), 'GDELT — world press (100+ languages)', 'GDELT', 'https://api.gdeltproject.org/api/v2/doc/doc', 'C', 240, true, now()
WHERE NOT EXISTS (SELECT 1 FROM veille.watch_sources WHERE type = 'GDELT');

INSERT INTO veille.watch_lists (id, name, description, domain, any_terms, all_terms, exclude_terms, countries, is_active, updated_at)
SELECT gen_random_uuid(), v.name, v.description, v.domain, v.any_terms, '{}', v.exclude_terms, '{}', true, now()
FROM (VALUES
  ('Transboundary animal diseases', 'WOAH-listed priority diseases in Africa', 'animal-health',
   ARRAY['peste des petits ruminants', 'PPR outbreak', 'foot and mouth disease', 'fièvre aphteuse', 'african swine fever', 'peste porcine africaine',
         'avian influenza', 'grippe aviaire', 'bird flu', 'H5N1', 'rift valley fever', 'fièvre de la vallée du rift', 'anthrax', 'charbon bactéridien',
         'lumpy skin disease', 'dermatose nodulaire', 'contagious bovine pleuropneumonia', 'péripneumonie contagieuse bovine', 'newcastle disease',
         'maladie de newcastle', 'rabies', 'rage animale', 'brucellosis', 'brucellose', 'sheep pox', 'clavelée', 'camel MERS', 'livestock disease', 'épizootie'],
   ARRAY['football', 'film', 'movie']),
  ('Livestock trade and SPS measures', 'Bans, certification and border measures on animals and animal products', 'trade-sps',
   ARRAY['livestock export ban', 'meat export ban', 'interdiction d''importation de viande', 'livestock trade', 'commerce du bétail', 'sanitary certificate',
         'certificat sanitaire', 'AfCFTA livestock', 'animal products export', 'export de bétail', 'border closure livestock'],
   ARRAY[]::text[]),
  ('Fisheries and aquaculture', 'Catches, illegal fishing, aquatic animal health', 'fisheries',
   ARRAY['illegal fishing', 'pêche illégale', 'IUU fishing', 'fish kill', 'mortalité de poissons', 'aquaculture', 'fishing ban', 'fish stock',
         'tilapia lake virus', 'fisheries ministry'],
   ARRAY[]::text[]),
  ('Wildlife crime and conservation', 'Poaching, trafficking, human-wildlife conflict', 'wildlife',
   ARRAY['poaching', 'braconnage', 'ivory seizure', 'saisie d''ivoire', 'pangolin', 'wildlife trafficking', 'trafic d''espèces sauvages',
         'human-wildlife conflict', 'conflit homme-faune', 'rhino horn'],
   ARRAY[]::text[]),
  ('Pastoral climate shocks', 'Drought, floods and fodder crises affecting herds', 'climate-env',
   ARRAY['drought livestock', 'sécheresse bétail', 'livestock deaths drought', 'pasture shortage', 'transhumance', 'pastoralists', 'pasteurs',
         'floods livestock', 'inondations bétail', 'desert locust'],
   ARRAY[]::text[]),
  ('Apiculture and pollinators', 'Bee health and honey production', 'apiculture',
   ARRAY['beekeeping', 'apiculture', 'honey production', 'production de miel', 'bee colony', 'varroa', 'colony collapse', 'beekeepers'],
   ARRAY[]::text[])
) AS v(name, description, domain, any_terms, exclude_terms)
WHERE NOT EXISTS (SELECT 1 FROM veille.watch_lists w WHERE w.name = v.name);
