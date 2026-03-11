# ARIS 4.0 — SSL Certificate Files

This directory must contain the following files on the production server:

## Required Files

| File | Description | Status |
|------|-------------|--------|
| `fullchain.pem` | Server certificate + GoDaddy CA chain (3 certs) | Available |
| `private.key` | RSA private key matching the certificate | **PENDING from Philippe** |

## Certificate Details

- **Domain**: `*.au-aris.org` (wildcard)
- **Issuer**: GoDaddy Secure Certificate Authority - G2
- **Valid**: 2026-02-14 to 2027-03-18
- **Serial**: 8a1a5323c50c516

## Deployment

1. Place `private.key` in this directory on VM-APP:
   ```bash
   scp private.key arisadmin@10.202.101.183:/opt/aris-deploy/vm-app/certs/
   ```

2. Set proper permissions:
   ```bash
   sudo chmod 600 /opt/aris-deploy/vm-app/certs/private.key
   sudo chmod 644 /opt/aris-deploy/vm-app/certs/fullchain.pem
   ```

3. Restart Traefik:
   ```bash
   cd /opt/aris-deploy/vm-app
   sudo docker compose restart traefik
   ```

4. Verify:
   ```bash
   curl -I https://au-aris.org/
   ```
