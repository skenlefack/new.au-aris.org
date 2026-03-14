#!/usr/bin/env python3
"""Debug routing - test endpoints from host network."""
from ssh_config import get_client, VM_APP, VM_PASS

c = get_client(VM_APP)

tests = [
    # Test from host using curl (should go through Traefik on port 4000)
    ("curl -sk https://localhost:4000/api/v1/settings/config/general -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -3",
     "Traefik HTTPS :4000 -> /api/v1/settings/config/general"),

    ("curl -sk https://localhost:4000/api/v1/public/stats -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -3",
     "Traefik HTTPS :4000 -> /api/v1/public/stats"),

    ("curl -sk https://localhost:4000/api/v1/tenants -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -3",
     "Traefik HTTPS :4000 -> /api/v1/tenants"),

    # Test direct to tenant container (port 3001 inside Docker network)
    (f"echo '{VM_PASS}' | sudo -S docker exec aris-tenant node -e \"const http=require('http');http.get('http://localhost:3001/api/v1/settings/scope',(r)=>{{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log('STATUS:',r.statusCode,'BODY:',d.substring(0,100)))}}).on('error',e=>console.log('ERROR:',e.message))\" 2>&1",
     "Direct to tenant:3001 -> /api/v1/settings/scope"),

    # Check what port Traefik listens on
    (f"echo '{VM_PASS}' | sudo -S docker port aris-traefik 2>/dev/null",
     "Traefik port mappings"),
]

for cmd, desc in tests:
    print(f"\n=== {desc} ===")
    stdin, stdout, stderr = c.exec_command(cmd, timeout=15)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    for line in out.split('\n'):
        if not line.startswith('[sudo]'):
            print(f"  {line[:200]}")
    if err:
        for line in err.split('\n'):
            if not line.startswith('[sudo]'):
                print(f"  [err] {line[:200]}")

c.close()
