#!/usr/bin/env python3
"""Compare AFAData form fields with ARIS fisheries form templates."""
import paramiko, json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_PASS = "@u-1baR.0rg$U24"

SCRIPT = r'''
import subprocess, json

r = subprocess.run(
    ["docker","exec","aris-postgres","psql","-U","aris","-d","aris","-t","-A","-c",
     "SELECT name || '|||' || schema::text FROM form_builder.form_templates WHERE domain='fisheries' AND status='PUBLISHED' ORDER BY name;"],
    capture_output=True, text=True, timeout=30
)

for line in r.stdout.strip().split('\n'):
    if '|||' not in line:
        continue
    name, raw = line.split('|||', 1)
    schema = json.loads(raw)
    print(f"FORM: {name.strip()}")
    for section in schema.get('sections', []):
        sn = section.get('name', {})
        sl = sn.get('en', '') if isinstance(sn, dict) else str(sn)
        print(f"  [{sl}]")
        for field in section.get('fields', []):
            label = field.get('label', {})
            fl = label.get('en', '') if isinstance(label, dict) else str(label)
            ftype = field.get('type', '')
            code = field.get('code', '')
            req = '*' if field.get('required') else ''
            props = field.get('properties', {})
            mdt = props.get('masterDataType', '')
            ref = f" ref={mdt}" if mdt else ''
            opts = field.get('options', [])
            opt_str = ''
            if opts and isinstance(opts, list) and len(opts) > 0:
                labels = []
                for o in opts[:6]:
                    if isinstance(o, dict):
                        ol = o.get('label', {})
                        labels.append(ol.get('en', ol) if isinstance(ol, dict) else str(ol))
                    else:
                        labels.append(str(o))
                opt_str = f' opts=[{", ".join(labels)}]'
                if len(opts) > 6:
                    opt_str += f' +{len(opts)-6} more'
            print(f"    {fl}{req} ({ftype}{ref}{opt_str})")
    print()
'''

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('10.202.101.185', username='arisadmin', password=SSH_PASS, timeout=15)

sftp = c.open_sftp()
with sftp.open('/tmp/check_forms.py', 'w') as f:
    f.write(SCRIPT)
sftp.close()

stdin, stdout, stderr = c.exec_command('python3 /tmp/check_forms.py', timeout=30)
out = stdout.read().decode()
err = stderr.read().decode()
if out:
    print(out)
if err:
    print(f"ERR: {err[:500]}")
c.close()
