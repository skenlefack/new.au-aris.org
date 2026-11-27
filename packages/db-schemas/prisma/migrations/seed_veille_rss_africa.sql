-- Veille: African RSS sources (institutions, African press, targeted Google News searches).
-- Every feed was checked from the prod network on 2026-11-27. Idempotent (matches on url).
-- Reliability uses the Admiralty scale: A = WOAH, B = AU bodies and RECs, C = press and aggregators.
--   docker exec -i <pg> psql -U aris -d aris < seed_veille_rss_africa.sql

INSERT INTO veille.watch_sources (id, name, type, url, language, reliability, interval_minutes, is_active, updated_at)
SELECT gen_random_uuid(), v.name, 'RSS', v.url, v.language, v.reliability, v.interval_minutes, true, now()
FROM (VALUES
  -- Institutions
  ('WOAH — news (EN)', 'https://www.woah.org/en/feed/', 'en', 'A', 360),
  ('WOAH — actualités (FR)', 'https://www.woah.org/fr/feed/', 'fr', 'A', 360),
  ('WOAH Africa regional representation', 'https://rr-africa.woah.org/en/feed/', 'en', 'A', 360),
  ('Africa CDC — news', 'https://africacdc.org/feed/', 'en', 'B', 360),
  ('IGAD — news', 'https://igad.int/feed/', 'en', 'B', 720),
  ('ECOWAS — news', 'https://www.ecowas.int/feed/', 'en', 'B', 720),
  ('EAC — press releases', 'https://www.eac.int/press-releases?format=feed&type=rss', 'en', 'B', 720),
  -- African press
  ('AllAfrica — agriculture', 'https://allafrica.com/tools/headlines/rdf/agriculture/headlines.rdf', 'en', 'C', 120),
  ('AllAfrica — environment', 'https://allafrica.com/tools/headlines/rdf/environment/headlines.rdf', 'en', 'C', 120),
  ('AllAfrica — wildlife', 'https://allafrica.com/tools/headlines/rdf/wildlife/headlines.rdf', 'en', 'C', 120),
  ('AllAfrica — health', 'https://allafrica.com/tools/headlines/rdf/health/headlines.rdf', 'en', 'C', 120),
  ('AllAfrica — agriculture (FR)', 'https://fr.allafrica.com/tools/headlines/rdf/agriculture/headlines.rdf', 'fr', 'C', 120),
  ('AllAfrica — environnement (FR)', 'https://fr.allafrica.com/tools/headlines/rdf/environment/headlines.rdf', 'fr', 'C', 120),
  ('The Conversation Africa', 'https://theconversation.com/africa/articles.atom', 'en', 'C', 240),
  ('Mongabay — environment news', 'https://news.mongabay.com/feed/', 'en', 'C', 240),
  ('Farmers Review Africa', 'https://farmersreviewafrica.com/feed/', 'en', 'C', 240),
  ('African Farming', 'https://www.africanfarming.com/feed/', 'en', 'C', 240),
  ('Food Business Africa', 'https://www.foodbusinessafrica.com/feed/', 'en', 'C', 240),
  -- Targeted Google News searches (last 7–14 days)
  ('Google News — animal diseases Africa (EN)', 'https://news.google.com/rss/search?q=%22peste+des+petits+ruminants%22+OR+%22african+swine+fever%22+OR+%22avian+influenza%22+OR+%22rift+valley+fever%22+OR+anthrax+Africa+when:7d&hl=en&gl=KE&ceid=KE:en', 'en', 'C', 180),
  ('Google News — livestock disease Africa (EN)', 'https://news.google.com/rss/search?q=livestock+disease+Africa+when:7d&hl=en&gl=KE&ceid=KE:en', 'en', 'C', 180),
  ('Google News — épizooties Afrique (FR)', 'https://news.google.com/rss/search?q=%C3%A9pizootie+OR+%22fi%C3%A8vre+aphteuse%22+OR+%22grippe+aviaire%22+Afrique+when:7d&hl=fr&gl=SN&ceid=SN:fr', 'fr', 'C', 180),
  ('Google News — fisheries Africa (EN)', 'https://news.google.com/rss/search?q=%22illegal+fishing%22+OR+%22IUU+fishing%22+OR+aquaculture+Africa+when:7d&hl=en&gl=NG&ceid=NG:en', 'en', 'C', 180),
  ('Google News — wildlife crime Africa (EN)', 'https://news.google.com/rss/search?q=poaching+OR+%22wildlife+trafficking%22+OR+%22human-wildlife+conflict%22+Africa+when:7d&hl=en&gl=ZA&ceid=ZA:en', 'en', 'C', 180),
  ('Google News — pastoralism and drought Africa (EN)', 'https://news.google.com/rss/search?q=drought+livestock+OR+pastoralists+Africa+when:7d&hl=en&gl=KE&ceid=KE:en', 'en', 'C', 180),
  ('Google News — livestock trade Africa (EN)', 'https://news.google.com/rss/search?q=%22livestock+export%22+OR+%22meat+export%22+OR+%22livestock+trade%22+Africa+when:7d&hl=en&gl=ET&ceid=ET:en', 'en', 'C', 180),
  ('Google News — apiculture Africa (EN)', 'https://news.google.com/rss/search?q=beekeeping+OR+honey+OR+apiculture+Africa+when:14d&hl=en&gl=KE&ceid=KE:en', 'en', 'C', 360),
  ('Google News — pêche, braconnage, transhumance (FR)', 'https://news.google.com/rss/search?q=%22p%C3%AAche+ill%C3%A9gale%22+OR+braconnage+OR+transhumance+Afrique+when:7d&hl=fr&gl=SN&ceid=SN:fr', 'fr', 'C', 180),
  ('Google News — pecuária Moçambique/Angola (PT)', 'https://news.google.com/rss/search?q=%22febre+aftosa%22+OR+%22gripe+avi%C3%A1ria%22+OR+pecu%C3%A1ria+Mo%C3%A7ambique+OR+Angola+when:14d&hl=pt-PT&gl=MZ&ceid=MZ:pt-150', 'pt', 'C', 360)
) AS v(name, url, language, reliability, interval_minutes)
WHERE NOT EXISTS (SELECT 1 FROM veille.watch_sources s WHERE s.url = v.url);

-- Portuguese terms so the PT feed can match (Lusophone Member States: AO, MZ, GW, CV, ST)
UPDATE veille.watch_lists w
SET any_terms = ARRAY(SELECT DISTINCT unnest(w.any_terms || v.terms)), updated_at = now()
FROM (VALUES
  ('Transboundary animal diseases', ARRAY['febre aftosa', 'gripe aviária', 'peste suína africana', 'peste dos pequenos ruminantes', 'febre do vale do rift', 'raiva animal', 'antraz', 'dermatose nodular', 'doença animal']),
  ('Fisheries and aquaculture', ARRAY['pesca ilegal', 'aquacultura']),
  ('Wildlife crime and conservation', ARRAY['caça furtiva', 'tráfico de animais selvagens']),
  ('Pastoral climate shocks', ARRAY['seca gado', 'pastores', 'transumância']),
  ('Apiculture and pollinators', ARRAY['apicultura', 'produção de mel'])
) AS v(name, terms)
WHERE w.name = v.name;
