#!/usr/bin/env python3
"""
Create country tenants + workshop accounts for ARIS Central Africa workshop.
Staging only (test.au-aris.org).
"""

import sys, io, json, paramiko, uuid
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SSH_PASS = '@u-1baR.0rg$U24'
PASSWORD = 'Aris2026@@.'
CONTINENTAL = '00000000-0000-4000-a000-000000000001'
ECCAS_REC = '00000000-0000-4000-a000-000000000050'
CM_TENANT = '00000000-0000-4000-a000-000000000503'
STG_APP = '10.202.101.146'
STG_DB = '10.202.101.148'

# Countries that need tenants (all except CM which already has one)
# Tenant IDs from DB (already seeded)
TENANT_IDS = {
    'CM': '00000000-0000-4000-a000-000000000503',
    'CG': '00000000-0000-4000-a000-000000000506',
    'GA': '00000000-0000-4000-a000-000000000509',
    'GQ': '00000000-0000-4000-a000-000000000508',
    'CF': '00000000-0000-4000-a000-000000000504',
    'CD': '00000000-0000-4000-a000-000000000507',
    'ST': '00000000-0000-4000-a000-00000000050b',
    'TD': '00000000-0000-4000-a000-000000000505',
    'ECCAS': ECCAS_REC,
}

# Workshop participants
USERS = [
    # Cameroun
    {'fn': 'Bourdanne', 'ln': 'Dr Aboudi', 'email': 'aoudibourdanne@yahoo.com', 'title': 'Coordo/Point focal PPR', 'cc': 'CM'},
    {'fn': 'Boris', 'ln': 'Okiwah', 'email': 'borisokiwah@gmail.com', 'title': 'Point Focal RESEPI', 'cc': 'CM'},
    {'fn': 'Isaac', 'ln': 'Dah', 'email': 'dah_isaac@yahoo.fr', 'title': 'Point Focal RESOLAB', 'cc': 'CM'},
    {'fn': 'Jonas', 'ln': 'Temwa', 'email': 'jonastemwa@yahoo.fr', 'title': 'DSV', 'cc': 'CM'},
    # Congo
    {'fn': 'Franck Durand', 'ln': 'Matembili', 'email': 'matembili@gmail.com', 'title': 'Coordo/Point focal PPR', 'cc': 'CG'},
    {'fn': 'Rita Armelle', 'ln': 'Bouya Gatse', 'email': 'ritagatse23@gmail.com', 'title': 'Point Focal RESEPI', 'cc': 'CG'},
    {'fn': 'Anatole', 'ln': "N'Telo", 'email': 'anatolentelo@gmail.com', 'title': 'Point Focal RESOLAB', 'cc': 'CG'},
    {'fn': "N'Kaya", 'ln': 'Tobi', 'email': 'nkayatobi2012@gmail.com', 'title': 'D(G)SV', 'cc': 'CG'},
    # Gabon
    {'fn': 'Freddy Eliphaz', 'ln': 'Ngouoni', 'email': 'freddyeliphazngouoni@yahoo.fr', 'title': 'Coordo/Point focal PPR', 'cc': 'GA'},
    {'fn': 'Loudy Moukende', 'ln': 'Williams Arnaud', 'email': 'titep002@gmail.com', 'title': 'Point Focal RESEPI', 'cc': 'GA'},
    {'fn': 'Zilia Gerlynda', 'ln': 'Angue Obiang', 'email': 'happyzilia@yahoo.fr', 'title': 'Point Focal RESOLAB', 'cc': 'GA'},
    {'fn': 'Daniel', 'ln': 'Ekoga Mve', 'email': 'danielekogamve@gmail.com', 'title': 'D(G)SV', 'cc': 'GA'},
    # Guinee Equatoriale
    {'fn': 'Joaquin Nkogo', 'ln': 'Nguema Nchama', 'email': 'nkogonguema@gmail.com', 'title': 'Coordo/Point focal PPR', 'cc': 'GQ'},
    {'fn': 'Sebastian Mengomo', 'ln': 'Ntutumu Befolo', 'email': 'sebastianmengomo63@gmail.com', 'title': 'Point Focal RESEPI', 'cc': 'GQ'},
    {'fn': 'Gil Nsue', 'ln': 'Ndong Nkara', 'email': 'nndongnkara@gmail.com', 'title': 'Point Focal RESOLAB', 'cc': 'GQ'},
    {'fn': 'Pascual', 'ln': 'Bacale Mbiang', 'email': 'pascual_bamby@yahoo.es', 'title': 'D(G)SV', 'cc': 'GQ'},
    # RCA
    {'fn': 'Namkoisse Gbippa', 'ln': 'Nazi Tistella', 'email': 'nazitistellagbippa@gmail.com', 'title': 'Coordo/Point focal PPR', 'cc': 'CF'},
    {'fn': 'Constance', 'ln': 'Endjingbogo-Ada', 'email': 'adaconstanceendjingbogo@gmail.com', 'title': 'Point Focal RESOLAB', 'cc': 'CF'},
    # RDC
    {'fn': 'Roger', 'ln': 'Madiamba Mponda', 'email': 'rogermadiamb@yahoo.fr', 'title': 'Coordo/Point focal PPR', 'cc': 'CD'},
    {'fn': 'Fabrice', 'ln': 'Mukoko Ndonzuau', 'email': 'fabricemukoko54@gmail.com', 'title': 'Point Focal RESEPI', 'cc': 'CD'},
    {'fn': 'Serge', 'ln': 'Mpiana Tshipambe', 'email': 'drsmpiana@yahoo.fr', 'title': 'Point Focal RESOLAB', 'cc': 'CD'},
    {'fn': 'Honore', 'ln': "N'Lemba Mabela", 'email': 'dr_nlemba@yahoo.fr', 'title': 'D(G)SV', 'cc': 'CD'},
    # Sao Tome
    {'fn': 'Alfredo', 'ln': 'da Mata', 'email': 'mata66@gmail.com', 'title': 'Coordo/Point focal PPR', 'cc': 'ST'},
    # Tchad
    {'fn': 'Langtar Nadji', 'ln': 'Justin', 'email': 'langtarnadjijustin@gmail.com', 'title': 'Coordo/Point focal PPR', 'cc': 'TD'},
    {'fn': 'Ali', 'ln': 'Abdelkerim', 'email': 'abdelkerim8ali@gmail.com', 'title': 'Point Focal RESEPI', 'cc': 'TD'},
    {'fn': 'Adoum', 'ln': 'Gaye', 'email': 'gayevet@yahoo.fr', 'title': 'Point Focal RESOLAB', 'cc': 'TD'},
    {'fn': 'Singambaye Ghislaine', 'ln': 'Mbeurnodji', 'email': 'koumbaghis15@gmail.com', 'title': 'DGSV', 'cc': 'TD'},
    # Autres — ECCAS REC level
    {'fn': 'Mohammed', 'ln': 'Abakar', 'email': 'mouhammed.abakar@ceeac-eccas.org', 'title': 'DADR/CEEAC', 'cc': 'ECCAS'},
    {'fn': 'Marcel Casimir', 'ln': 'Ndongo Kounou', 'email': 'casimir.ndongokounou@au-ibar.org', 'title': 'Regional ECCAS PPR Coordinator', 'cc': 'ECCAS'},
    {'fn': 'Alhadji Souleyman', 'ln': 'Mahamat', 'email': 'adjimm1964@gmail.com', 'title': 'Point Focal RESEPI CRSA', 'cc': 'ECCAS'},
    {'fn': 'Bouzabo', 'ln': 'Patchili', 'email': 'bouzabo@gmail.com', 'title': 'Coord CRSA', 'cc': 'ECCAS'},
]

# ═══════════════════════════════════════
# Create user accounts
# ═══════════════════════════════════════

print('=' * 60)
print(f'  Creating {len(USERS)} user accounts on STAGING')
print('=' * 60)

c_app = paramiko.SSHClient()
c_app.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c_app.connect(STG_APP, username='arisadmin', password=SSH_PASS, timeout=15)

# Login
login = json.dumps({'email': 'admin@au-aris.org', 'password': 'Aris2026@@4!0'})
chan = c_app.get_transport().open_session()
chan.exec_command(
    f'curl -s -X POST http://localhost:3002/api/v1/credential/auth/login '
    f'-H "Content-Type: application/json" -d \'{login}\''
)
chan.settimeout(15)
out = b''
try:
    while True:
        ch = chan.recv(4096)
        if not ch: break
        out += ch
except:
    pass
token = json.loads(out.decode())['data']['accessToken']
print('  Login: OK\n')

created_ids = {}
update_users = []

for i, u in enumerate(USERS, 1):
    cc = u['cc']
    tid = TENANT_IDS.get(cc, CONTINENTAL)
    role = 'REC_ADMIN' if cc == 'ECCAS' else 'NATIONAL_ADMIN'

    body = json.dumps({
        'email': u['email'],
        'password': PASSWORD,
        'firstName': u['fn'],
        'lastName': u['ln'],
        'role': role,
        'tenantId': tid,
    }, ensure_ascii=False)

    chan = c_app.get_transport().open_session()
    chan.exec_command(
        'curl -s -X POST http://localhost:3002/api/v1/credential/auth/register '
        '-H "Content-Type: application/json" '
        f'-H "Authorization: Bearer {token}" '
        '--data-binary @-'
    )
    chan.settimeout(15)
    chan.sendall(body.encode('utf-8'))
    chan.shutdown_write()
    out = b''
    try:
        while True:
            ch = chan.recv(4096)
            if not ch: break
            out += ch
    except:
        pass

    try:
        resp = json.loads(out.decode(errors='replace'))
        if 'data' in resp:
            uid = resp['data'].get('id', '?')
            created_ids[u['email']] = uid
            print(f'  {i:2d}. NEW {u["email"]:45s} {cc:5s} {role}')
        else:
            msg = resp.get('message', '')[:80]
            if 'already registered' in msg.lower():
                # Update existing user's tenantId via DB
                update_users.append({'email': u['email'], 'tid': tid, 'role': role, 'cc': cc, 'idx': i, **u})
                print(f'  {i:2d}. UPD {u["email"]:45s} {cc:5s} (exists, will update tenant)')
            else:
                print(f'  {i:2d}. ERR {u["email"]:45s} {msg}')
    except Exception as e:
        print(f'  {i:2d}. ERR {u["email"]:45s} {e}')

print(f'\n  Created: {len(created_ids)}, To update: {len(update_users)}')

# Update existing users' tenantId via DB
if update_users:
    print('\n  Updating existing users via DB...')
    c_db = paramiko.SSHClient()
    c_db.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c_db.connect(STG_DB, username='arisadmin', password=SSH_PASS, timeout=15)
    SUDO = f"echo '{SSH_PASS}' | sudo -S bash -c"

    sql_lines = []
    for uu in update_users:
        email = uu['email'].replace("'", "''")
        sql_lines.append(
            f"UPDATE public.users SET tenant_id = '{uu['tid']}', role = '{uu['role']}' "
            f"WHERE email = '{email}';"
        )
    # Also fetch their IDs for email sending
    emails_list = ",".join(f"'{u['email']}'" for u in update_users)
    sql_lines.append(f"SELECT id, email FROM public.users WHERE email IN ({emails_list});")

    sftp = c_db.open_sftp()
    with sftp.file('/tmp/update_users.sql', 'w') as f:
        f.write('\n'.join(sql_lines))
    sftp.close()

    cmd = f"{SUDO} 'docker cp /tmp/update_users.sql aris-stg-postgres:/tmp/uu.sql && docker exec aris-stg-postgres psql -U aris -d aris -t -A -f /tmp/uu.sql'"
    chan = c_db.get_transport().open_session()
    chan.exec_command(cmd)
    chan.settimeout(15)
    out = b''
    try:
        while True:
            ch = chan.recv(4096)
            if not ch: break
            out += ch
    except:
        pass

    for line in out.decode(errors='replace').strip().split('\n'):
        if '|' in line:
            parts = line.split('|')
            if len(parts) == 2:
                uid, email = parts[0].strip(), parts[1].strip()
                created_ids[email] = uid
                print(f'    Updated: {email} → {uid[:12]}...')

    c_db.close()

# ═══════════════════════════════════════
# PHASE 3: Send welcome emails
# ═══════════════════════════════════════

print('\n' + '=' * 60)
print('  PHASE 3: Send welcome emails')
print('=' * 60 + '\n')

COUNTRY_NAMES = {
    'CM': 'Cameroun', 'CG': 'Congo', 'GA': 'Gabon', 'GQ': 'Guinée Equatoriale',
    'CF': 'RCA', 'CD': 'RDC', 'ST': 'São Tomé', 'TD': 'Tchad', 'ECCAS': 'CEEAC/ECCAS',
}

sent = 0
for u in USERS:
    uid = created_ids.get(u['email'])
    if not uid:
        continue

    country = COUNTRY_NAMES.get(u['cc'], u['cc'])
    body_text = (
        f"Dear {u['fn']} {u['ln']},\n\n"
        f"Your ARIS 4.0 account has been created for the Central Africa Virtual Workshop.\n"
        f"You have access as {u['title']} ({country}).\n\n"
        f"=== YOUR CREDENTIALS ===\n\n"
        f"URL: https://test.au-aris.org\n"
        f"Email: {u['email']}\n"
        f"Password: {PASSWORD}\n\n"
        f"IMPORTANT: Please change your password after your first login.\n\n"
        f"Best regards,\n"
        f"ARIS 4.0 Administration - AU-IBAR, Nairobi"
    )

    notification = json.dumps({
        'userId': uid,
        'channel': 'EMAIL',
        'subject': 'ARIS 4.0 - Workshop Account / Compte Atelier',
        'body': body_text,
    }, ensure_ascii=False)

    chan = c_app.get_transport().open_session()
    chan.exec_command(
        'curl -s -X POST http://localhost:3006/api/v1/messages/send '
        '-H "Content-Type: application/json" '
        f'-H "Authorization: Bearer {token}" '
        '--data-binary @-'
    )
    chan.settimeout(30)
    chan.sendall(notification.encode('utf-8'))
    chan.shutdown_write()
    out = b''
    try:
        while True:
            ch = chan.recv(4096)
            if not ch: break
            out += ch
    except:
        pass

    try:
        resp = json.loads(out.decode(errors='replace'))
        if 'data' in resp:
            sent += 1
            print(f'  EMAIL: {u["email"]}')
        else:
            print(f'  FAIL:  {u["email"]} — {resp.get("message", "")[:60]}')
    except:
        print(f'  FAIL:  {u["email"]}')

c_app.close()
print(f'\n  Emails sent: {sent}/{len(created_ids)}')
print('\nDONE')
