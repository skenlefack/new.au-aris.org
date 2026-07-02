#!/usr/bin/env python3
"""Create dashboards for AFADATA campaigns + fix untranslated dashboards."""
import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_PASS = "@u-1baR.0rg$U24"

SQL = r"""
-- Fix untranslated dashboards
UPDATE dashboard_builder.dashboards SET title_fr='Tableau de Bord Production AFAData', title_pt='Painel de Produção AFAData', title_ar='لوحة إنتاج AFAData' WHERE title_en='AFAData Production Dashboard';
UPDATE dashboard_builder.dashboard_sections SET title_en='AFAData Overview', title_fr='Vue d''ensemble AFAData' WHERE dashboard_id='85e3bb09-0867-45da-b1e9-6568e627df91' AND title_en='Section 1';

-- Create dashboards for each AFADATA campaign
INSERT INTO dashboard_builder.dashboards (id,ownership,scope,campaign_id,title_en,title_fr,title_pt,title_ar,description,grid_columns,row_height,is_default,created_at,updated_at) VALUES
(gen_random_uuid(),'SYSTEM_TEMPLATE','CONTINENTAL','5f2c8bfe-9fe1-4949-e415-eadde4310f01','AFADATA - Capture Fisheries Dashboard','AFADATA - Tableau de bord Pêche de capture','AFADATA - Painel Pesca de captura','AFADATA - لوحة صيد الأسماك','',2,120,false,now(),now()),
(gen_random_uuid(),'SYSTEM_TEMPLATE','CONTINENTAL','5e8d2c32-2d37-ef4f-2705-fd1c8530b5f8','AFADATA - Fishing Vessels Dashboard','AFADATA - Tableau de bord Navires de pêche','AFADATA - Painel Embarcações de pesca','AFADATA - لوحة سفن الصيد','',2,120,false,now(),now()),
(gen_random_uuid(),'SYSTEM_TEMPLATE','CONTINENTAL','5f4c4da2-909a-1966-fd14-1176c5754118','AFADATA - Aquaculture Farms Dashboard','AFADATA - Tableau de bord Fermes aquacoles','AFADATA - Painel Fazendas aquícolas','AFADATA - لوحة مزارع الاستزراع المائي','',2,120,false,now(),now()),
(gen_random_uuid(),'SYSTEM_TEMPLATE','CONTINENTAL','e2059f9d-a8a2-ab22-0835-e3f556db345e','AFADATA - Aquaculture Production Dashboard','AFADATA - Tableau de bord Production aquacole','AFADATA - Painel Produção aquícola','AFADATA - لوحة الإنتاج المائي','',2,120,false,now(),now()),
(gen_random_uuid(),'SYSTEM_TEMPLATE','CONTINENTAL','0244ddf6-945e-5e56-294e-37981d6d9acb','AFADATA - Fishing Effort Dashboard','AFADATA - Tableau de bord Effort de pêche','AFADATA - Painel Esforço de pesca','AFADATA - لوحة جهد الصيد','',2,120,false,now(),now()),
(gen_random_uuid(),'SYSTEM_TEMPLATE','CONTINENTAL','596b57b9-361b-d1b3-832d-474b400ff7d4','AFADATA - Fish Trade Dashboard','AFADATA - Tableau de bord Commerce de poisson','AFADATA - Painel Comércio de peixe','AFADATA - لوحة تجارة الأسماك','',2,120,false,now(),now())
ON CONFLICT DO NOTHING;

-- Add default sections with KPI widgets
DO $$
DECLARE
  dash RECORD;
  sec_id UUID;
BEGIN
  FOR dash IN SELECT id, title_en FROM dashboard_builder.dashboards WHERE campaign_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dashboard_builder.dashboard_sections WHERE dashboard_id = dashboards.id) LOOP
    -- Section 1: Key Indicators
    sec_id := gen_random_uuid();
    INSERT INTO dashboard_builder.dashboard_sections (id, dashboard_id, title_en, title_fr, title_pt, title_ar, sort_order, columns, created_at, updated_at)
    VALUES (sec_id, dash.id, 'Key Indicators', 'Indicateurs clés', 'Indicadores-chave', 'المؤشرات الرئيسية', 0, 2, now(), now());

    -- Widget 1: Total Submissions
    INSERT INTO dashboard_builder.dashboard_widgets (id, section_id, widget_type, title_en, title_fr, title_pt, title_ar, config, sort_order, col_span, row_span, created_at, updated_at)
    VALUES (gen_random_uuid(), sec_id, 'STAT_CARD', 'Total Submissions', 'Total soumissions', 'Total submissões', 'إجمالي التقديمات', '{"dataSource":"campaign_submissions","metric":"count","icon":"FileText","color":"#1565C0"}', 0, 1, 1, now(), now());

    -- Widget 2: Countries Reporting
    INSERT INTO dashboard_builder.dashboard_widgets (id, section_id, widget_type, title_en, title_fr, title_pt, title_ar, config, sort_order, col_span, row_span, created_at, updated_at)
    VALUES (gen_random_uuid(), sec_id, 'STAT_CARD', 'Countries Reporting', 'Pays déclarants', 'Países reportando', 'البلدان المبلغة', '{"dataSource":"campaign_submissions","metric":"distinct_countries","icon":"Globe","color":"#2E7D32"}', 1, 1, 1, now(), now());

    -- Widget 3: Submissions Chart
    INSERT INTO dashboard_builder.dashboard_widgets (id, section_id, widget_type, title_en, title_fr, title_pt, title_ar, config, sort_order, col_span, row_span, created_at, updated_at)
    VALUES (gen_random_uuid(), sec_id, 'BAR_CHART', 'Submissions by Country', 'Soumissions par pays', 'Submissões por país', 'التقديمات حسب البلد', '{"dataSource":"campaign_submissions","groupBy":"country","metric":"count"}', 2, 2, 2, now(), now());

    -- Widget 4: Timeline
    INSERT INTO dashboard_builder.dashboard_widgets (id, section_id, widget_type, title_en, title_fr, title_pt, title_ar, config, sort_order, col_span, row_span, created_at, updated_at)
    VALUES (gen_random_uuid(), sec_id, 'LINE_CHART', 'Submission Timeline', 'Chronologie des soumissions', 'Cronologia das submissões', 'الجدول الزمني للتقديمات', '{"dataSource":"campaign_submissions","groupBy":"month","metric":"count"}', 3, 2, 2, now(), now());
  END LOOP;
END $$;

-- Verify
SELECT d.title_en, d.title_fr, d.campaign_id IS NOT NULL as campaign,
  (SELECT count(*) FROM dashboard_builder.dashboard_sections ds WHERE ds.dashboard_id = d.id) as sections,
  (SELECT count(*) FROM dashboard_builder.dashboard_widgets w JOIN dashboard_builder.dashboard_sections ds2 ON w.section_id = ds2.id WHERE ds2.dashboard_id = d.id) as widgets
FROM dashboard_builder.dashboards d
WHERE d.title_en LIKE 'AFADATA%'
ORDER BY d.title_en;
"""

def run(host, label, container):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username='arisadmin', password=SSH_PASS, timeout=15)
    print(f"\n=== {label} ===")
    sftp = c.open_sftp()
    with sftp.open('/tmp/dash.sql', 'w') as f:
        f.write(SQL)
    sftp.close()
    stdin, stdout, stderr = c.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker cp /tmp/dash.sql {container}:/tmp/dash.sql && "
        f"echo '{SSH_PASS}' | sudo -S docker exec {container} psql -U aris -d aris -f /tmp/dash.sql 2>&1",
        timeout=60)
    out = stdout.read().decode()
    for l in out.split('\n'):
        l = l.strip()
        if '|' in l or l.startswith('(') or 'UPDATE' in l or 'INSERT' in l or 'DO' in l:
            if '[sudo]' not in l:
                print(f"  {l}")
    c.close()

run('10.202.101.148', 'STAGING', 'aris-stg-postgres')
run('10.202.101.185', 'PRODUCTION', 'aris-postgres')
print("\nDone!")
