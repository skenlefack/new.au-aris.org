#!/usr/bin/env python3
"""Add sections and widgets to AFADATA campaign dashboards."""
import paramiko, sys, uuid
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_PASS = "@u-1baR.0rg$U24"

def run(host, label, container):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username='arisadmin', password=SSH_PASS, timeout=15)
    print(f"\n=== {label} ===")

    # Get AFADATA dashboards without sections
    stdin, stdout, stderr = c.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker exec {container} psql -U aris -d aris -t -A -c "
        "\"SELECT id FROM dashboard_builder.dashboards WHERE campaign_id IS NOT NULL AND id NOT IN (SELECT DISTINCT dashboard_id FROM dashboard_builder.dashboard_sections);\"",
        timeout=30)
    raw = stdout.read().decode().strip()
    dash_ids = [l.strip() for l in raw.split('\n') if l.strip() and '[sudo]' not in l]
    print(f"  Dashboards needing sections: {len(dash_ids)}")

    for did in dash_ids:
        sec_id = str(uuid.uuid4())
        sql = f"""
INSERT INTO dashboard_builder.dashboard_sections (id, dashboard_id, title_en, title_fr, title_pt, title_ar, sort_order, columns, created_at, updated_at)
VALUES ('{sec_id}', '{did}', 'Key Indicators', 'Indicateurs clés', 'Indicadores-chave', 'المؤشرات الرئيسية', 0, 2, now(), now());

INSERT INTO dashboard_builder.dashboard_widgets (id, section_id, widget_type, title_en, title_fr, title_pt, title_ar, config, sort_order, col_span, row_span, created_at, updated_at) VALUES
(gen_random_uuid(), '{sec_id}', 'STAT_CARD', 'Total Submissions', 'Total soumissions', 'Total submissões', 'إجمالي التقديمات', '{{"dataSource":"campaign_submissions","metric":"count","icon":"FileText","color":"#1565C0"}}', 0, 1, 1, now(), now()),
(gen_random_uuid(), '{sec_id}', 'STAT_CARD', 'Countries Reporting', 'Pays déclarants', 'Países reportando', 'البلدان المبلغة', '{{"dataSource":"campaign_submissions","metric":"distinct_countries","icon":"Globe","color":"#2E7D32"}}', 1, 1, 1, now(), now()),
(gen_random_uuid(), '{sec_id}', 'BAR_CHART', 'Submissions by Country', 'Soumissions par pays', 'Submissões por país', 'التقديمات حسب البلد', '{{"dataSource":"campaign_submissions","groupBy":"country","metric":"count"}}', 2, 2, 2, now(), now()),
(gen_random_uuid(), '{sec_id}', 'LINE_CHART', 'Submission Timeline', 'Chronologie des soumissions', 'Cronologia das submissões', 'الجدول الزمني للتقديمات', '{{"dataSource":"campaign_submissions","groupBy":"month","metric":"count"}}', 3, 2, 2, now(), now());
"""
        sftp = c.open_sftp()
        with sftp.open('/tmp/w.sql', 'w') as f:
            f.write(sql)
        sftp.close()

        stdin2, stdout2, stderr2 = c.exec_command(
            f"echo '{SSH_PASS}' | sudo -S docker cp /tmp/w.sql {container}:/tmp/w.sql && "
            f"echo '{SSH_PASS}' | sudo -S docker exec {container} psql -U aris -d aris -f /tmp/w.sql 2>&1",
            timeout=30)
        out = stdout2.read().decode()
        if 'INSERT' in out:
            print(f"  + Dashboard {did[:8]}... → 1 section + 4 widgets")

    # Verify
    stdin, stdout, stderr = c.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker exec {container} psql -U aris -d aris -c "
        "\"SELECT d.title_en, d.title_fr, "
        "(SELECT count(*) FROM dashboard_builder.dashboard_sections ds WHERE ds.dashboard_id = d.id) as sections, "
        "(SELECT count(*) FROM dashboard_builder.dashboard_widgets w JOIN dashboard_builder.dashboard_sections ds2 ON w.section_id = ds2.id WHERE ds2.dashboard_id = d.id) as widgets "
        "FROM dashboard_builder.dashboards d WHERE d.title_en LIKE 'AFADATA%' ORDER BY d.title_en;\"",
        timeout=30)
    out = stdout.read().decode()
    for l in out.split('\n'):
        l = l.strip()
        if '|' in l or l.startswith('('):
            if '[sudo]' not in l:
                print(f"  {l}")

    c.close()

run('10.202.101.148', 'STAGING', 'aris-stg-postgres')
run('10.202.101.185', 'PRODUCTION', 'aris-postgres')
print("\nDone!")
