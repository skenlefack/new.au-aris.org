# ARIS 4.0 — Staging Environment Guide

## Overview

The staging environment is a complete replica of production running on 4 dedicated VMs.
It uses the domain `test.au-aris.org` and is covered by the existing wildcard SSL certificate.

| VM | Hostname | Role | IP |
|----|----------|------|:--:|
| VM-APP-STG | nbo-aris05 | Services, Traefik, Frontend, Monitoring, BI | `10.202.101.146` |
| VM-KAFKA-STG | nbo-brk02 | Kafka KRaft x3, Schema Registry, Kafka UI | `10.202.101.147` |
| VM-DB-STG | nbo-dbms03 | PostgreSQL 16 + PostGIS + PgBouncer | `10.202.101.148` |
| VM-CACHE-STG | nbo-cch02 | Redis 7 + OpenSearch 2.17 | `10.202.101.149` |

## Differences from Production

| Aspect | Production | Staging |
|--------|-----------|---------|
| Domain | `au-aris.org` | `test.au-aris.org` |
| Country subdomains | `cm.au-aris.org` | `cm-test.au-aris.org` |
| REC subdomains | `igad.au-aris.org` | `igad-test.au-aris.org` |
| NODE_ENV | `production` | `staging` |
| Email | Postmark (real emails) | Mailpit (local catch-all) |
| Traefik log level | INFO | DEBUG |
| Prometheus retention | 90 days | 30 days |
| OTEL sampling | 10% | 50% |
| Kafka heap | 4GB x3 | 512MB x3 |
| Redis maxmemory | 8GB | 512MB |
| OpenSearch heap | 8GB | 1GB |
| PostgreSQL memory limit | 28GB | 4GB |
| JWT keys | `/opt/aris/keys/` | `/opt/aris/keys-stg/` |
| Kafka CLUSTER_ID | `MkU3OEVBNTcwNTJENDM2Qk` | `U3RhZ2luZ0NsdXN0ZXJJRA` |
| Docker network | `aris-app-network` | `aris-stg-network` |
| Container prefix | `aris-` | `aris-stg-` |
| Compose dir | `/opt/aris-deploy/vm-app/` | `/opt/aris-deploy/vm-app-stg/` |
| Data | Production data | Fresh seeds only |

## Prerequisites

1. **4 VMs provisioned** by IT with network connectivity between them
2. **SSH access** as `arisadmin` (same credentials as production)
3. **SSL certificate** — copy the wildcard `*.au-aris.org` cert from production
4. **DNS entries** — point `test.au-aris.org` and `*-test.au-aris.org` to VM-APP-STG

## Initial Setup

### 1. Replace IP Placeholders

After receiving the 4 staging VM IPs, replace all `<STG_*_IP>` placeholders in:

```bash
# Files with placeholders:
deploy/vm-app-stg/.env.staging          # DB_HOST, KAFKA_HOST, CACHE_HOST
deploy/vm-app-stg/prometheus-staging.yml # Remote node exporter targets
deploy/vm-app-stg/grafana-datasources.yml # PostgreSQL URL
```

### 2. Prepare Each VM

SSH into each staging VM and set up the directory structure:

```bash
# On ALL 4 VMs:
sudo mkdir -p /opt/aris /opt/aris-deploy
cd /opt/aris && git clone <repo-url> . && git checkout main

# On VM-APP-STG:
sudo mkdir -p /opt/aris-deploy/vm-app-stg/certs
sudo mkdir -p /opt/aris/keys-stg

# Copy SSL cert from production (or download from GoDaddy):
sudo cp /path/to/fullchain.pem /opt/aris-deploy/vm-app-stg/certs/
sudo cp /path/to/private.key /opt/aris-deploy/vm-app-stg/certs/

# Copy .env.staging → .env
sudo cp /opt/aris/deploy/vm-app-stg/.env.staging /opt/aris-deploy/vm-app-stg/.env
# Edit .env to set actual IPs

# On VM-DB-STG:
sudo mkdir -p /opt/aris-deploy/vm-db-stg
sudo cp /opt/aris/deploy/vm-db-stg/docker-compose.yml /opt/aris-deploy/vm-db-stg/
# Copy init SQL scripts from production vm-db folder
sudo cp /opt/aris/deploy/vm-db/*.sql /opt/aris-deploy/vm-db-stg/
sudo cp /opt/aris/deploy/vm-db/postgresql.conf /opt/aris-deploy/vm-db-stg/
sudo cp /opt/aris/infrastructure/pgbouncer/pgbouncer.ini /opt/aris-deploy/vm-db-stg/
sudo cp /opt/aris/infrastructure/pgbouncer/userlist.txt /opt/aris-deploy/vm-db-stg/
# Edit userlist.txt to use staging password

# On VM-KAFKA-STG:
sudo mkdir -p /opt/aris-deploy/vm-kafka-stg
sudo cp /opt/aris/deploy/vm-kafka-stg/docker-compose.yml /opt/aris-deploy/vm-kafka-stg/
# Create .env with KAFKA_HOST=<this VM's IP>

# On VM-CACHE-STG:
sudo mkdir -p /opt/aris-deploy/vm-cache-stg
sudo cp /opt/aris/deploy/vm-cache-stg/docker-compose.yml /opt/aris-deploy/vm-cache-stg/
```

### 3. Generate JWT Keys (on VM-APP-STG)

```bash
sudo mkdir -p /opt/aris/keys-stg
openssl genrsa -out /opt/aris/keys-stg/private.pem 4096
openssl rsa -in /opt/aris/keys-stg/private.pem -pubout -out /opt/aris/keys-stg/public.pem
sudo chmod 600 /opt/aris/keys-stg/private.pem
sudo chmod 644 /opt/aris/keys-stg/public.pem
```

### 4. Deploy in Order

```bash
# 1. Database (must be first)
ssh arisadmin@10.202.101.148
cd /opt/aris-deploy/vm-db-stg
docker compose up -d
# Wait for PostgreSQL to be healthy:
docker compose logs -f postgres  # wait for "database system is ready"

# 2. Cache
ssh arisadmin@10.202.101.149
cd /opt/aris-deploy/vm-cache-stg
docker compose up -d

# 3. Kafka
ssh arisadmin@10.202.101.147
cd /opt/aris-deploy/vm-kafka-stg
export KAFKA_HOST=10.202.101.147
docker compose up -d
# Wait for kafka-init to finish creating topics:
docker compose logs -f kafka-init

# 4. App (all services + frontend)
ssh arisadmin@10.202.101.146
cd /opt/aris-deploy/vm-app-stg
docker compose --env-file .env up -d --build
```

### 5. Seed Data

From your local machine:

```bash
export ARIS_VM_APP=10.202.101.146
export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
python deploy/scripts/_seed_stg.py
```

### 6. DNS Setup

Add these DNS records (or `/etc/hosts` entries for testing):

```
10.202.101.146  test.au-aris.org
10.202.101.146  cm-test.au-aris.org
10.202.101.146  ke-test.au-aris.org
10.202.101.146  et-test.au-aris.org
10.202.101.146  ng-test.au-aris.org
10.202.101.146  sn-test.au-aris.org
10.202.101.146  za-test.au-aris.org
10.202.101.146  igad-test.au-aris.org
10.202.101.146  ecowas-test.au-aris.org
```

## Staging Credentials

| Service | Username | Password |
|---------|----------|----------|
| ARIS Super Admin | `admin@au-aris.org` | `Aris2024!` |
| National Admin (Kenya) | `admin@ke.au-aris.org` | `Aris2024!` |
| National Admin (Ethiopia) | `admin@et.au-aris.org` | `Aris2024!` |
| PostgreSQL | `aris` | `Ar1s_Stg_2024!xK9mZ` |
| Redis | — | `R3d1s_Stg_2024!vN7wQ` |
| Grafana | `admin` | `Gr4f4na_Stg_2024!aS7dF` |
| Superset | `admin` | `Sup3rs3t_Stg_2024!qR5tY` |
| MinIO | `aris_minio_stg` | `M1n10_Stg_2024!jH6pR` |

## Deployment (Ongoing)

### Deploy Web Frontend

```bash
export ARIS_VM_APP=10.202.101.146
export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
python deploy/scripts/_deploy_web_stg.py
```

### Deploy Backend Services

```bash
export ARIS_VM_APP=10.202.101.146
export ARIS_VM_KAFKA=10.202.101.147
export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'

# Deploy credential + message (default):
python deploy/scripts/_deploy_services_stg.py

# Deploy specific services:
python deploy/scripts/_deploy_services_stg.py tenant credential master-data animal-health
```

## Monitoring & Tools

| Tool | URL | Notes |
|------|-----|-------|
| ARIS Frontend | `https://test.au-aris.org/` | Main app |
| Mailpit | `http://10.202.101.146:8025` | All emails caught here |
| Grafana | `https://test.au-aris.org:3200` | Metrics dashboards |
| Traefik Dashboard | `http://10.202.101.146:8090` | Routing debug |
| Kafka UI | `http://10.202.101.147:8080` | Topic browser |
| MinIO Console | `http://10.202.101.146:9001` | Object storage |
| Jaeger | `http://10.202.101.146:16686` | Distributed tracing |
| Superset | `http://10.202.101.146:8088` | BI dashboards |
| Metabase | `http://10.202.101.146:3035` | Embedded analytics |
| OpenSearch Dashboards | `http://10.202.101.149:5601` | Search analytics |

## Troubleshooting

### Check container status
```bash
ssh arisadmin@10.202.101.146 "docker ps --format 'table {{.Names}}\t{{.Status}}' | grep aris-stg"
```

### View logs for a service
```bash
ssh arisadmin@10.202.101.146 "docker logs aris-stg-credential --tail 100"
```

### Restart all services
```bash
ssh arisadmin@10.202.101.146 "cd /opt/aris-deploy/vm-app-stg && docker compose --env-file .env restart"
```

### Reset database (destructive)
```bash
ssh arisadmin@10.202.101.148 "cd /opt/aris-deploy/vm-db-stg && docker compose down -v && docker compose up -d"
# Then re-seed:
python deploy/scripts/_seed_stg.py
```
