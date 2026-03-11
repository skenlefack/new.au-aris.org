# RAPPORT COMPLET DE DÉPLOIEMENT — ARIS 4.0

## Animal Resources Information System — AU-IBAR
### Infrastructure Numérique Continentale pour les Ressources Animales

---

**Version du document** : 1.0
**Date** : 11 mars 2026
**Classification** : CONFIDENTIEL — Usage interne AU-IBAR uniquement
**Auteur** : Équipe DevOps ARIS
**Destinataires** : Direction AU-IBAR, Équipe IT, Administrateurs système

---

## TABLE DES MATIÈRES

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Architecture de Déploiement](#2-architecture-de-déploiement)
3. [Inventaire des Machines Virtuelles](#3-inventaire-des-machines-virtuelles)
4. [Configuration Réseau et Sécurité](#4-configuration-réseau-et-sécurité)
5. [VM-DB — Serveur de Base de Données](#5-vm-db--serveur-de-base-de-données)
6. [VM-KAFKA — Serveur de Messages](#6-vm-kafka--serveur-de-messages)
7. [VM-CACHE — Serveur Cache et Recherche](#7-vm-cache--serveur-cache-et-recherche)
8. [VM-APP — Serveur d'Application](#8-vm-app--serveur-dapplication)
9. [Liste Complète des Services (38 conteneurs)](#9-liste-complète-des-services-38-conteneurs)
10. [Configuration de l'API Gateway (Traefik)](#10-configuration-de-lapi-gateway-traefik)
11. [Données de Référence et Seeds](#11-données-de-référence-et-seeds)
12. [Authentification et Sécurité](#12-authentification-et-sécurité)
13. [Monitoring et Observabilité](#13-monitoring-et-observabilité)
14. [Outils BI (Business Intelligence)](#14-outils-bi-business-intelligence)
15. [Procédures Opérationnelles](#15-procédures-opérationnelles)
16. [Sauvegarde et Restauration](#16-sauvegarde-et-restauration)
17. [Résolution de Problèmes (Troubleshooting)](#17-résolution-de-problèmes-troubleshooting)
18. [Vérifications Post-Déploiement](#18-vérifications-post-déploiement)
19. [Historique des Correctifs Appliqués](#19-historique-des-correctifs-appliqués)
20. [Recommandations et Prochaines Étapes](#20-recommandations-et-prochaines-étapes)
21. [Annexes](#21-annexes)

---

## 1. Résumé Exécutif

ARIS 4.0 (Animal Resources Information System) est l'infrastructure numérique continentale de l'UA-BIRA (Bureau Interafricain des Ressources Animales de l'Union Africaine). Le système a été déployé avec succès sur **4 machines virtuelles** au Centre de Données de Nairobi (AU-IBAR HQ), couvrant **9 domaines métier** pour les **55 États Membres** et **8 Communautés Économiques Régionales (CER)**.

### État du déploiement

| Indicateur | Valeur |
|---|---|
| **Nombre total de conteneurs** | 38 (tous en cours d'exécution) |
| **Microservices backend** | 22 services Fastify/NestJS |
| **Frontend** | Next.js 14 (App Router) |
| **Outils BI** | Apache Superset + Metabase |
| **Monitoring** | Prometheus + Grafana + Jaeger |
| **Base de données** | PostgreSQL 16 + PostGIS 3.4 + PgBouncer |
| **Message broker** | Apache Kafka (3 brokers KRaft) |
| **Cache** | Redis 7 + OpenSearch 2.17.1 |
| **API Gateway** | Traefik v3 |
| **Authentification** | JWT RS256 + bcrypt (admin opérationnel) |
| **Langues** | EN, FR, PT, AR (RTL supporté) |

### Points clés

- **Connectivité** : Toutes les VMs communiquent via le réseau interne 10.202.101.0/24
- **Sécurité** : UFW configuré sur chaque VM, JWT RS256 pour l'authentification
- **Données** : Seeds de référence chargés (63 tenants, 139 utilisateurs, 21 formulaires, 26 espèces, 25 maladies)
- **Frontend** : API calls utilisent des chemins relatifs (`/api/v1/...`) routés par Traefik
- **Monitoring** : Dashboards Grafana, métriques Prometheus, traces Jaeger

---

## 2. Architecture de Déploiement

### 2.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Réseau Interne AU-IBAR (10.202.101.0/24)                │
│                                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │   VM-APP      │   │  VM-KAFKA    │   │   VM-DB      │   │  VM-CACHE    │ │
│  │ 10.202.101.183│   │10.202.101.184│   │10.202.101.185│   │10.202.101.186│ │
│  │  nbo-aris04   │   │  nbo-brk01   │   │  nbo-dbms03  │   │  nbo-cch01   │ │
│  │               │   │              │   │              │   │              │ │
│  │ 22 services   │   │ 3 Kafka      │   │ PostgreSQL   │   │ Redis 7      │ │
│  │ Traefik       │   │ Schema Reg   │   │ PgBouncer    │   │ OpenSearch   │ │
│  │ MinIO         │   │ Kafka UI     │   │              │   │ Dashboards   │ │
│  │ Grafana       │   │              │   │              │   │              │ │
│  │ Prometheus    │   │              │   │              │   │              │ │
│  │ Jaeger        │   │              │   │              │   │              │ │
│  │ Superset      │   │              │   │              │   │              │ │
│  │ Metabase      │   │              │   │              │   │              │ │
│  │ Mailpit       │   │              │   │              │   │              │ │
│  │ pg_tileserv   │   │              │   │              │   │              │ │
│  │ Next.js       │   │              │   │              │   │              │ │
│  └───────┬───────┘   └──────────────┘   └──────────────┘   └──────────────┘ │
│          │                                                                   │
│          ▼                                                                   │
│   Port 80/443 → Traefik → Route vers les microservices                      │
│   Les utilisateurs accèdent via http://10.202.101.183                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Principes de conception

1. **Dockerisation complète** : Chaque composant tourne dans un conteneur Docker pour la reproductibilité
2. **Séparation des préoccupations** : DB, messaging, cache, et application sur des VMs distinctes
3. **Communication inter-VM** : Via IP directes sur le réseau interne (pas de DNS)
4. **Résilience** : `restart: unless-stopped` sur tous les conteneurs, healthchecks configurés
5. **Sécurité** : Pare-feu UFW restrictif, pas d'exposition inutile vers l'extérieur

### 2.3 Flux de données

```
Navigateur (Utilisateur)
    │
    ▼ HTTP :80
┌──────────┐     ┌──────────────────┐     ┌──────────┐
│ Traefik  │────▶│ Microservices    │────▶│ PostgreSQL│ (VM-DB :6432)
│ (Gateway)│     │ (22 services)    │     └──────────┘
└──────────┘     │                  │────▶┌──────────┐
    │            │                  │     │ Kafka    │ (VM-KAFKA :9092/94/96)
    │            │                  │     └──────────┘
    │            │                  │────▶┌──────────┐
    │            └──────────────────┘     │ Redis    │ (VM-CACHE :6379)
    │                                     └──────────┘
    ▼ PathPrefix(`/`)
┌──────────┐
│ Next.js  │ (Frontend, port 3000 interne, 3100 externe)
│ (Web App)│
└──────────┘
```

---

## 3. Inventaire des Machines Virtuelles

### 3.1 Spécifications matérielles

| VM | Hostname | IP | Rôle | CPU | RAM | Stockage |
|---|---|---|---|---|---|---|
| VM-APP | nbo-aris04 | 10.202.101.183 | Application | 8 vCPU | 32 GB | 200 GB SSD |
| VM-KAFKA | nbo-brk01 | 10.202.101.184 | Message Broker | 8 vCPU | 16 GB | 400 GB XFS |
| VM-DB | nbo-dbms03 | 10.202.101.185 | Base de données | 8 vCPU | 32 GB | 500 GB (LUKS) |
| VM-CACHE | nbo-cch01 | 10.202.101.186 | Cache & Recherche | 8 vCPU | 32 GB | 150 GB |

### 3.2 Système d'exploitation

- **OS** : Ubuntu 24.04 LTS (Noble Numbat)
- **Kernel** : Linux 6.8+ (avec paramètres kernel optimisés par VM)
- **Docker** : Docker CE 27.x + Docker Compose v2
- **Node.js** (VM-APP uniquement) : v22 LTS
- **pnpm** (VM-APP uniquement) : v9.x

### 3.3 Accès SSH

| VM | Utilisateur | Méthode |
|---|---|---|
| Toutes | `arisadmin` | Mot de passe SSH |

> **Note de sécurité** : En production, remplacer l'authentification par mot de passe par des clés SSH Ed25519 et désactiver `PasswordAuthentication` dans `/etc/ssh/sshd_config`.

---

## 4. Configuration Réseau et Sécurité

### 4.1 Ports ouverts par VM

#### VM-APP (10.202.101.183)

| Port | Service | Accès |
|---|---|---|
| 22 | SSH | Global |
| 80 | HTTP (Traefik) | Global |
| 443 | HTTPS (Traefik) | Global |
| 3100 | Next.js (direct) | Réseau interne |
| 8025 | Mailpit UI | Réseau interne |
| 8088 | Apache Superset | Réseau interne |
| 8090 | Traefik Dashboard | Réseau interne |
| 3035 | Metabase | Réseau interne |
| 3200 | Grafana | Réseau interne |
| 9000/9001 | MinIO API/Console | Réseau interne |
| 9090 | Prometheus | Réseau interne |
| 16686 | Jaeger UI | Réseau interne |
| 3001–3044 | Microservices (direct) | Réseau interne |

#### VM-KAFKA (10.202.101.184)

| Port | Service | Accès |
|---|---|---|
| 22 | SSH | Global |
| 9092 | Kafka Broker 1 (external) | Réseau interne |
| 9094 | Kafka Broker 2 (external) | Réseau interne |
| 9096 | Kafka Broker 3 (external) | Réseau interne |
| 8081 | Schema Registry | Réseau interne |
| 8080 | Kafka UI | Réseau interne |

#### VM-DB (10.202.101.185)

| Port | Service | Accès |
|---|---|---|
| 22 | SSH | Global |
| 5432 | PostgreSQL (direct) | Réseau interne |
| 6432 | PgBouncer | Réseau interne |

#### VM-CACHE (10.202.101.186)

| Port | Service | Accès |
|---|---|---|
| 22 | SSH | Global |
| 6379 | Redis | Réseau interne |
| 9200 | OpenSearch API | Réseau interne |
| 5601 | OpenSearch Dashboards | Réseau interne |

### 4.2 Configuration UFW

Chaque VM a son pare-feu UFW configuré pour n'autoriser que les ports nécessaires depuis le réseau interne `10.202.101.0/24`. Exemple pour VM-DB :

```bash
# Règles UFW - VM-DB
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow from 10.202.101.0/24 to any port 5432 comment 'PostgreSQL direct'
ufw allow from 10.202.101.0/24 to any port 6432 comment 'PgBouncer'
ufw --force enable
```

### 4.3 Communication inter-VM

Toutes les communications inter-VM utilisent des adresses IP directes :

| Source | Destination | Port | Protocole |
|---|---|---|---|
| VM-APP → VM-DB | 10.202.101.185 | 6432 | PostgreSQL (via PgBouncer) |
| VM-APP → VM-DB | 10.202.101.185 | 5432 | PostgreSQL (migrations) |
| VM-APP → VM-KAFKA | 10.202.101.184 | 9092,9094,9096 | Kafka |
| VM-APP → VM-KAFKA | 10.202.101.184 | 8081 | Schema Registry |
| VM-APP → VM-CACHE | 10.202.101.186 | 6379 | Redis |
| VM-APP → VM-CACHE | 10.202.101.186 | 9200 | OpenSearch |

---

## 5. VM-DB — Serveur de Base de Données

### 5.1 Composants

| Conteneur | Image | Port | Volume |
|---|---|---|---|
| `aris-postgres` | `postgis/postgis:16-3.4` | 5432 | `/var/lib/postgresql/data` |
| `aris-pgbouncer` | `edoburu/pgbouncer:latest` | 6432 | — |

### 5.2 Configuration PostgreSQL

Le fichier `postgresql.conf` est monté depuis `deploy/vm-db/postgresql.conf` :

```ini
# Mémoire — Optimisé pour 32GB RAM
shared_buffers = 8GB            # 25% de la RAM
effective_cache_size = 24GB     # 75% de la RAM
work_mem = 64MB
maintenance_work_mem = 2GB
wal_buffers = 64MB

# Connexions
max_connections = 200           # PgBouncer gère le pooling
listen_addresses = '*'

# WAL et Checkpoints
max_wal_size = 4GB
checkpoint_completion_target = 0.9

# Performance I/O (SSD)
random_page_cost = 1.1
effective_io_concurrency = 200

# Logging
log_min_duration_statement = 1000   # Log requêtes > 1s
log_statement = 'ddl'
log_timezone = 'Africa/Nairobi'
```

### 5.3 PgBouncer

Configuration : `deploy/vm-db/pgbouncer.ini`

```ini
[databases]
aris = host=postgres port=5432 dbname=aris

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
pool_mode = transaction        # Mode transaction (compatible Prisma)
max_client_conn = 500
default_pool_size = 50
min_pool_size = 10
reserve_pool_size = 10
auth_type = md5
```

### 5.4 Schémas de base de données

La base de données `aris` contient **26 schémas** créés via `init-databases.sql` :

| Schéma | Service | Description |
|---|---|---|
| `tenant` | tenant | Hiérarchie multi-tenant (UA → CER → ÉM) |
| `credential` | credential | Utilisateurs, rôles, tokens JWT |
| `settings` | tenant | Configuration système, BI, workflows |
| `master_data` | master-data | Référentiels (géo, espèces, maladies) |
| `data_quality` | data-quality | Règles de qualité, scores |
| `data_contract` | data-contract | Contrats de données |
| `collecte` | collecte | Formulaires, campagnes, soumissions |
| `form_builder` | form-builder | Templates de formulaires |
| `workflow` | workflow | Moteur de validation 4 niveaux |
| `animal_health` | animal-health | Surveillance, foyers, vaccination |
| `livestock_prod` | livestock-prod | Recensement, production, abattage |
| `fisheries` | fisheries | Pêches, aquaculture |
| `wildlife` | wildlife | Faune, aires protégées, CITES |
| `apiculture` | apiculture | Ruchers, production, santé colonies |
| `trade_sps` | trade-sps | Commerce, certification SPS |
| `governance` | governance | Cadres juridiques, capacités, PVS |
| `climate_env` | climate-env | Stress hydrique, parcours |
| `analytics` | analytics | KPIs, agrégations |
| `geo_services` | geo-services | PostGIS, couches risque |
| `knowledge_hub` | knowledge-hub | Publications, e-learning |
| `message` | message | Notifications (SMS, email, push) |
| `drive` | drive | Stockage documents |
| `realtime` | realtime | WebSocket, présence |
| `interop` | interop-hub | Connecteurs WAHIS/EMPRES/FAOSTAT |
| `datalake` | datalake | OLAP, ingestion |
| `audit` | global | Journal d'audit |

### 5.5 Extensions PostgreSQL

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- Génération UUID
CREATE EXTENSION IF NOT EXISTS "postgis";       -- Données géographiques
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Recherche texte floue
```

### 5.6 Démarrage et arrêt

```bash
# Se connecter à VM-DB
ssh arisadmin@10.202.101.185

# Démarrer
sudo docker compose -f /opt/aris-deploy/vm-db/docker-compose.yml up -d

# Arrêter
sudo docker compose -f /opt/aris-deploy/vm-db/docker-compose.yml down

# Voir les logs
sudo docker logs aris-postgres --tail 50 -f
sudo docker logs aris-pgbouncer --tail 50 -f

# Accéder à psql
sudo docker exec -it aris-postgres psql -U aris -d aris
```

---

## 6. VM-KAFKA — Serveur de Messages

### 6.1 Composants

| Conteneur | Image | Port | Volume |
|---|---|---|---|
| `aris-kafka-1` | `confluentinc/cp-kafka:7.6.1` | 9092 | `/kafka-data/broker-1` |
| `aris-kafka-2` | `confluentinc/cp-kafka:7.6.1` | 9094 | `/kafka-data/broker-2` |
| `aris-kafka-3` | `confluentinc/cp-kafka:7.6.1` | 9096 | `/kafka-data/broker-3` |
| `aris-schema-registry` | `confluentinc/cp-schema-registry:7.6.1` | 8081 | — |
| `aris-kafka-ui` | `provectuslabs/kafka-ui:v0.7.2` | 8080 | — |
| `aris-kafka-init` | Custom (shell) | — | — |

### 6.2 Configuration Kafka

- **Mode** : KRaft (sans ZooKeeper)
- **Cluster ID** : `MkU3OEVBNTcwNTJENDM2Qk`
- **Réplication** : Facteur 3 (chaque partition répliquée sur les 3 brokers)
- **ISR minimum** : 2 (au moins 2 répliques synchrones pour confirmer)
- **Partitions par défaut** : 6
- **Rétention** : 168 heures (7 jours)
- **Auto-création de topics** : Désactivée (topics créés par `kafka-init`)
- **JVM Heap** : `-Xmx4g -Xms4g` par broker (12 GB total)

### 6.3 Topics Kafka

Les topics suivent la convention : `{scope}.{domain}.{entity}.{action}.v{version}`

Exemples de topics créés :
```
ms.health.outbreak.created.v1
ms.health.outbreak.updated.v1
ms.health.lab-result.created.v1
ms.health.vaccination.created.v1
ms.livestock.census.created.v1
ms.collecte.form.submitted.v1
ms.collecte.campaign.created.v1
ms.workflow.instance.submitted.v1
ms.workflow.instance.approved.v1
au.quality.record.rejected.v1
sys.master.species.updated.v1
au.interop.wahis.exported.v1
sys.cache.invalidation.v1
...
```

Total : **50+ topics** créés automatiquement au démarrage par `kafka-init`.

### 6.4 Optimisation OS (Kernel tuning)

```bash
# /etc/sysctl.d/99-aris-kafka.conf
vm.swappiness = 1                # Kafka déteste le swap
vm.dirty_ratio = 80
vm.dirty_background_ratio = 5
net.core.wmem_max = 2097152
net.core.rmem_max = 2097152
```

### 6.5 Démarrage et arrêt

```bash
# Se connecter à VM-KAFKA
ssh arisadmin@10.202.101.184

# Démarrer
sudo docker compose -f /opt/aris-deploy/vm-kafka/docker-compose.yml up -d

# Arrêter (ATTENTION : arrêter VM-APP d'abord)
sudo docker compose -f /opt/aris-deploy/vm-kafka/docker-compose.yml down

# Lister les topics
sudo docker exec aris-kafka-1 kafka-topics --list --bootstrap-server localhost:29092

# Voir l'état des consumer groups
sudo docker exec aris-kafka-1 kafka-consumer-groups --list --bootstrap-server localhost:29092

# Logs
sudo docker logs aris-kafka-1 --tail 50 -f
```

### 6.6 Kafka UI

Accessible via `http://10.202.101.184:8080` — Interface web pour :
- Visualiser les topics et leurs partitions
- Voir les consumer groups et leur lag
- Inspecter les messages
- Gérer les schémas (Schema Registry)

---

## 7. VM-CACHE — Serveur Cache et Recherche

### 7.1 Composants

| Conteneur | Image | Port | Volume |
|---|---|---|---|
| `aris-redis` | `redis:7-alpine` | 6379 | `/var/lib/redis` |
| `aris-opensearch` | `opensearchproject/opensearch:2.17.1` | 9200 | `/var/lib/opensearch` |
| `aris-opensearch-dashboards` | `opensearchproject/opensearch-dashboards:2.17.1` | 5601 | — |

### 7.2 Configuration Redis

```
# Paramètres Redis
maxmemory 8gb                    # Limite mémoire
maxmemory-policy allkeys-lru     # Politique d'éviction LRU
appendonly yes                   # Persistance AOF activée
save 900 1                      # Snapshot RDB : chaque 900s si 1 clé modifiée
save 300 10                     # Snapshot RDB : chaque 300s si 10 clés modifiées
save 60 10000                   # Snapshot RDB : chaque 60s si 10000 clés modifiées
tcp-backlog 65535               # File d'attente TCP
timeout 300                     # Timeout connexion inactive
tcp-keepalive 60                # Keep-alive TCP
```

**Stratégie de cache** :
- Clés par domaine : `aris:{domain}:{entity}:{id}` (ex: `aris:master-data:species:uuid`)
- TTL : Master data 1h, requêtes 5min, dashboards 2min
- Invalidation via Kafka : topic `sys.cache.invalidation.v1`
- Verrous distribués : `acquireLock()` / `releaseLock()`

### 7.3 Configuration OpenSearch

```yaml
discovery.type: single-node
OPENSEARCH_JAVA_OPTS: "-Xms8g -Xmx8g"    # Heap 8 GB
cluster.name: aris-search-production
bootstrap.memory_lock: true                 # Pas de swap
plugins.security.disabled: true             # Sécurité gérée au niveau réseau
```

### 7.4 Optimisation OS

```bash
# /etc/sysctl.d/99-aris-cache.conf
vm.swappiness = 1
vm.overcommit_memory = 1         # Requis par Redis
net.core.somaxconn = 65535       # Backlog élevé pour Redis
vm.max_map_count = 1048576       # Requis par OpenSearch (≥262144)
```

### 7.5 Démarrage et arrêt

```bash
# Se connecter à VM-CACHE
ssh arisadmin@10.202.101.186

# Démarrer
sudo docker compose -f /opt/aris-deploy/vm-cache/docker-compose.yml up -d

# Arrêter
sudo docker compose -f /opt/aris-deploy/vm-cache/docker-compose.yml down

# Vérifier Redis
sudo docker exec aris-redis redis-cli -a 'R3d1s_Pr0d_2024!vN7wQ' ping
# → PONG

# Vérifier OpenSearch
curl http://10.202.101.186:9200/_cluster/health?pretty

# Logs
sudo docker logs aris-redis --tail 50 -f
sudo docker logs aris-opensearch --tail 50 -f
```

---

## 8. VM-APP — Serveur d'Application

### 8.1 Vue d'ensemble

La VM-APP héberge tous les microservices ARIS, le frontend Next.js, l'API gateway Traefik, les outils BI, le monitoring, et le stockage objet. C'est le point d'entrée unique pour tous les utilisateurs.

### 8.2 Pré-requis installés

| Outil | Version | Usage |
|---|---|---|
| Docker CE | 27.x | Conteneurisation |
| Docker Compose | v2.x | Orchestration |
| Node.js | 22 LTS | Build Next.js, exécution services |
| pnpm | 9.x | Gestionnaire de paquets |
| Git | 2.x | Synchronisation du code source |

### 8.3 Répertoires clés

| Chemin | Contenu |
|---|---|
| `/opt/aris` | Code source ARIS (clone du dépôt git) |
| `/opt/aris/apps/web` | Frontend Next.js |
| `/opt/aris/services/*` | Microservices backend |
| `/opt/aris/packages/*` | Packages partagés (auth, cache, kafka…) |
| `/opt/aris/keys/` | Clés JWT RS256 (private.pem, public.pem) |
| `/opt/aris-deploy/vm-app/` | Docker Compose + configs de déploiement |

### 8.4 Variables d'environnement

Les variables d'environnement sont centralisées dans le `docker-compose.yml` via le bloc `x-service-env` :

```yaml
x-service-env: &service-env
  NODE_ENV: production
  LOG_LEVEL: info
  DATABASE_URL: postgresql://aris:<PASS>@10.202.101.185:6432/aris?pgbouncer=true
  DIRECT_DATABASE_URL: postgresql://aris:<PASS>@10.202.101.185:5432/aris
  REDIS_URL: redis://:<PASS>@10.202.101.186:6379
  KAFKA_BROKERS: 10.202.101.184:9092,10.202.101.184:9094,10.202.101.184:9096
  SCHEMA_REGISTRY_URL: http://10.202.101.184:8081
  OPENSEARCH_URL: http://10.202.101.186:9200
  MINIO_ENDPOINT: minio
  MINIO_PORT: "9000"
  JWT_PRIVATE_KEY_PATH: /app/keys/private.pem
  JWT_PUBLIC_KEY_PATH: /app/keys/public.pem
  OTEL_EXPORTER_OTLP_ENDPOINT: http://jaeger:4318
```

> **Important** : Les mots de passe sont définis dans le docker-compose.yml comme valeurs par défaut. Pour une sécurité accrue, utiliser un fichier `.env` ou Docker Secrets.

### 8.5 Démarrage et arrêt

```bash
# Se connecter à VM-APP
ssh arisadmin@10.202.101.183

# Démarrer tous les services
sudo docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d

# Arrêter tous les services
sudo docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml down

# Redémarrer un service spécifique
sudo docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml restart credential

# Voir tous les conteneurs
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Logs d'un service
sudo docker logs aris-credential --tail 100 -f
```

---

## 9. Liste Complète des Services (38 conteneurs)

### 9.1 Infrastructure (VM-DB : 2 conteneurs)

| # | Conteneur | Image | Port | Description |
|---|---|---|---|---|
| 1 | `aris-postgres` | `postgis/postgis:16-3.4` | 5432 | Base de données principale |
| 2 | `aris-pgbouncer` | `edoburu/pgbouncer` | 6432 | Pool de connexions |

### 9.2 Message Broker (VM-KAFKA : 6 conteneurs)

| # | Conteneur | Image | Port | Description |
|---|---|---|---|---|
| 3 | `aris-kafka-1` | `confluentinc/cp-kafka:7.6.1` | 9092 | Broker Kafka 1 |
| 4 | `aris-kafka-2` | `confluentinc/cp-kafka:7.6.1` | 9094 | Broker Kafka 2 |
| 5 | `aris-kafka-3` | `confluentinc/cp-kafka:7.6.1` | 9096 | Broker Kafka 3 |
| 6 | `aris-schema-registry` | `confluentinc/cp-schema-registry:7.6.1` | 8081 | Registre de schémas |
| 7 | `aris-kafka-ui` | `provectuslabs/kafka-ui:v0.7.2` | 8080 | Interface Kafka |
| 8 | `aris-kafka-init` | Custom (shell) | — | Création des topics |

### 9.3 Cache & Recherche (VM-CACHE : 3 conteneurs)

| # | Conteneur | Image | Port | Description |
|---|---|---|---|---|
| 9 | `aris-redis` | `redis:7-alpine` | 6379 | Cache en mémoire |
| 10 | `aris-opensearch` | `opensearchproject/opensearch:2.17.1` | 9200 | Moteur de recherche |
| 11 | `aris-opensearch-dashboards` | `opensearchproject/opensearch-dashboards:2.17.1` | 5601 | UI OpenSearch |

### 9.4 Plateforme (VM-APP : 27 conteneurs)

#### Infrastructure applicative (10 conteneurs)

| # | Conteneur | Image | Port | Description |
|---|---|---|---|---|
| 12 | `aris-traefik` | `traefik:latest` | 80, 443, 8090 | API Gateway |
| 13 | `aris-web` | Custom (Next.js) | 3100→3000 | Frontend web |
| 14 | `aris-minio` | `minio/minio` | 9000, 9001 | Stockage S3 |
| 15 | `aris-mailpit` | `axllent/mailpit:v1.18` | 1025, 8025 | Serveur email (dev) |
| 16 | `aris-prometheus` | `prom/prometheus:v2.51.2` | 9090 | Métriques |
| 17 | `aris-grafana` | `grafana/grafana:10.4.2` | 3200→3000 | Dashboards |
| 18 | `aris-jaeger` | `jaegertracing/all-in-one:1.57` | 16686, 4317, 4318 | Traces |
| 19 | `aris-superset` | `apache/superset:3.1.3` | 8088 | BI Superset |
| 20 | `aris-metabase` | `metabase/metabase:v0.49.6` | 3035→3000 | BI Metabase |
| 21 | `aris-pg-tileserv` | `pramsey/pg_tileserv` | 7800 | Tuiles vectorielles |

#### Services métier (17 microservices)

| # | Conteneur | Port | Tier | Description |
|---|---|---|---|---|
| 22 | `aris-tenant` | 3001 | Plateforme | Multi-tenant (UA→CER→ÉM) |
| 23 | `aris-credential` | 3002 | Plateforme | Authentification JWT, RBAC |
| 24 | `aris-message` | 3006 | Plateforme | Notifications |
| 25 | `aris-drive` | 3007 | Plateforme | Stockage documents |
| 26 | `aris-realtime` | 3008 | Plateforme | WebSocket temps réel |
| 27 | `aris-master-data` | 3003 | Data Hub | Référentiels maîtres |
| 28 | `aris-data-quality` | 3004 | Data Hub | Contrôle qualité |
| 29 | `aris-data-contract` | 3005 | Data Hub | Contrats de données |
| 30 | `aris-interop-hub` | 3032 | Data Hub | Connecteurs WAHIS/FAO |
| 31 | `aris-form-builder` | 3010 | Collecte | Formulaires no-code |
| 32 | `aris-collecte` | 3011 | Collecte | Campagnes terrain |
| 33 | `aris-workflow` | 3012 | Collecte | Validation 4 niveaux |
| 34 | `aris-animal-health` | 3020 | Domaine | Santé animale |
| 35 | `aris-livestock-prod` | 3021 | Domaine | Production animale |
| 36 | `aris-fisheries` | 3022 | Domaine | Pêches & aquaculture |
| 37 | `aris-wildlife` | 3023 | Domaine | Faune sauvage |
| 38 | `aris-apiculture` | 3024 | Domaine | Apiculture |
| — | `aris-trade-sps` | 3025 | Domaine | Commerce & SPS |
| — | `aris-governance` | 3026 | Domaine | Gouvernance |
| — | `aris-climate-env` | 3027 | Domaine | Climat & environnement |
| — | `aris-analytics` | 3030 | Data & Integ. | Analytique |
| — | `aris-geo-services` | 3031 | Data & Integ. | Services géographiques |
| — | `aris-knowledge-hub` | 3033 | Data & Integ. | Hub de connaissances |
| — | `aris-support` | 3041 | Fastify | Support technique |
| — | `aris-interop` | 3042 | Fastify | Interopérabilité v2 |
| — | `aris-analytics-worker` | 3043 | Fastify | Worker analytique |
| — | `aris-datalake` | 3044 | Fastify | Datalake OLAP |
| — | `aris-offline` | 3040 | Fastify | Synchronisation mobile |

> **Note** : Certains services sont construits avec Fastify (framework HTTP léger) au lieu de NestJS, suite à la migration Phase 6.

---

## 10. Configuration de l'API Gateway (Traefik)

### 10.1 Architecture de routage

Traefik v3 est le point d'entrée unique sur le port 80. Il route les requêtes HTTP vers les microservices en se basant sur les préfixes d'URL (labels Docker) :

```
http://10.202.101.183/                           → aris-web (Next.js)      :3000
http://10.202.101.183/api/v1/tenants/*           → aris-tenant             :3001
http://10.202.101.183/api/v1/credential/*        → aris-credential         :3002
http://10.202.101.183/api/v1/auth/*              → aris-credential         :3002
http://10.202.101.183/api/v1/users/*             → aris-credential         :3002
http://10.202.101.183/api/v1/i18n/*              → aris-credential         :3002
http://10.202.101.183/api/v1/master-data/*       → aris-master-data        :3003
http://10.202.101.183/api/v1/data-quality/*      → aris-data-quality       :3004
http://10.202.101.183/api/v1/data-contracts/*    → aris-data-contract      :3005
http://10.202.101.183/api/v1/messages/*          → aris-message            :3006
http://10.202.101.183/api/v1/drive/*             → aris-drive              :3007
http://10.202.101.183/api/v1/realtime/*          → aris-realtime           :3008
http://10.202.101.183/socket.io/*                → aris-realtime           :3008
http://10.202.101.183/api/v1/form-builder/*      → aris-form-builder       :3010
http://10.202.101.183/api/v1/collecte/*          → aris-collecte           :3011
http://10.202.101.183/api/v1/workflow/*           → aris-workflow           :3012
http://10.202.101.183/api/v1/animal-health/*     → aris-animal-health      :3020
http://10.202.101.183/api/v1/livestock/*          → aris-livestock-prod     :3021
http://10.202.101.183/api/v1/fisheries/*         → aris-fisheries          :3022
http://10.202.101.183/api/v1/wildlife/*          → aris-wildlife           :3023
http://10.202.101.183/api/v1/apiculture/*        → aris-apiculture         :3024
http://10.202.101.183/api/v1/trade/*             → aris-trade-sps          :3025
http://10.202.101.183/api/v1/governance/*        → aris-governance         :3026
http://10.202.101.183/api/v1/climate/*           → aris-climate-env        :3027
http://10.202.101.183/api/v1/analytics/*         → aris-analytics          :3030
http://10.202.101.183/api/v1/geo/*               → aris-geo-services       :3031
http://10.202.101.183/api/v1/geo/tiles/*         → aris-pg-tileserv        :7800
http://10.202.101.183/api/v1/interop/*           → aris-interop-hub        :3032
http://10.202.101.183/api/v1/knowledge/*         → aris-knowledge-hub      :3033
http://10.202.101.183/api/v1/offline/*           → aris-offline            :3040
http://10.202.101.183/api/v1/support/*           → aris-support            :3041
http://10.202.101.183/api/v1/interop-v2/*        → aris-interop            :3042
http://10.202.101.183/api/v1/analytics-worker/*  → aris-analytics-worker   :3043
http://10.202.101.183/api/v1/datalake/*          → aris-datalake           :3044
```

### 10.2 Configuration Traefik

```yaml
command:
  - "--api.insecure=true"                          # Dashboard sur :8080
  - "--api.dashboard=true"
  - "--providers.docker=true"                      # Auto-découverte Docker
  - "--providers.docker.exposedbydefault=false"     # Opt-in via labels
  - "--providers.docker.network=aris-app-network"  # Réseau Docker
  - "--entrypoints.web.address=:80"                # Point d'entrée HTTP
  - "--entrypoints.websecure.address=:443"         # Point d'entrée HTTPS
  - "--log.level=INFO"
  - "--accesslog=true"
  - "--accesslog.format=json"                      # Logs d'accès JSON
  - "--ping=true"                                  # Healthcheck endpoint
```

### 10.3 Dashboard Traefik

Accessible via `http://10.202.101.183:8090` — Interface web pour :
- Visualiser les routes HTTP configurées
- Voir les services backend et leur état de santé
- Diagnostiquer les problèmes de routage

### 10.4 Frontend — Chemins relatifs

Le frontend Next.js utilise des **chemins relatifs** (`/api/v1/...`) pour tous les appels API. Traefik intercepte ces requêtes et les route vers le bon microservice. Cela élimine le besoin de variables d'environnement `NEXT_PUBLIC_*` pour les URLs d'API.

Fichiers configurés :
- `apps/web/src/lib/api/client.ts` → Base: `/api/v1`
- `apps/web/src/lib/api/form-builder-hooks.ts` → Base: `/api/v1/form-builder`
- `apps/web/src/lib/api/settings-hooks.ts` → Base: `''` (relatif)
- `apps/web/src/lib/api/ref-data-hooks.ts` → Base: `''` (relatif)
- `apps/web/src/lib/api/bi-hooks.ts` → Base: `/api/v1`
- `apps/web/src/components/auth/AuthGuard.tsx` → Base: `/api/v1`

---

## 11. Données de Référence et Seeds

### 11.1 Ordre d'exécution des seeds

Les seeds doivent être exécutés dans un ordre strict pour respecter les dépendances :

```
1. seed-tenant.ts     → Tenants (1 continental + 8 CER + 54 ÉM = 63)
2. seed-credential.ts → Utilisateurs (139 users, tous les rôles)
3. seed-functions.ts  → Fonctions et division admin (288+ fonctions)
4. seed-workflow.ts   → Templates de workflow (54 templates, 150 chaînes)
5. seed-bi.ts         → Outils BI et accès (3 outils, 21 règles)
6. master-data seed   → Espèces, maladies, référentiels (via service)
7. form-builder seed  → Templates de formulaires (21 templates)
```

### 11.2 Comptes utilisateurs prédéfinis

| Email | Rôle | Mot de passe | Tenant |
|---|---|---|---|
| `admin@au-aris.org` | SUPER_ADMIN | `Aris2024!` | UA-BIRA (continental) |
| `admin@ke.au-aris.org` | NATIONAL_ADMIN | `Aris2024!` | Kenya |
| `admin@et.au-aris.org` | NATIONAL_ADMIN | `Aris2024!` | Éthiopie |
| `admin@ng.au-aris.org` | NATIONAL_ADMIN | `Aris2024!` | Nigeria |
| `admin@sn.au-aris.org` | NATIONAL_ADMIN | `Aris2024!` | Sénégal |
| `admin@za.au-aris.org` | NATIONAL_ADMIN | `Aris2024!` | Afrique du Sud |

> **Important** : Changer TOUS les mots de passe en production ! Les mots de passe `Aris2024!` sont des valeurs de seed pour le développement.

### 11.3 Données de référence chargées

| Catégorie | Nombre | Schéma |
|---|---|---|
| Tenants (UA + CER + ÉM) | 63 | `tenant` |
| Utilisateurs | 139 | `credential` |
| Fonctions administratives | 288+ | `settings` |
| Templates de workflow | 54 | `workflow` |
| Chaînes de validation | 150 | `settings` |
| Espèces | 26 | `master_data` |
| Groupes d'espèces | 10 | `master_data` |
| Groupes d'âge | 13 | `master_data` |
| Maladies | 25 | `master_data` |
| Relations maladie-espèce | 55+ | `master_data` |
| CER | 8 | `tenant` |
| Pays (ÉM) | 55 | `tenant` |
| Templates de formulaires | 21 | `collecte` |
| Outils BI | 3 | `settings` |
| Règles d'accès BI | 21 | `settings` |
| Dashboards BI | 3 | `settings` |

### 11.4 Hiérarchie multi-tenant

```
UA-BIRA (CONTINENTAL)
  ├── IGAD (REC)
  │   ├── Kenya (ÉM)
  │   ├── Éthiopie (ÉM)
  │   ├── Djibouti (ÉM)
  │   ├── Érythrée (ÉM)
  │   ├── Somalie (ÉM)
  │   ├── Soudan (ÉM)
  │   ├── Soudan du Sud (ÉM)
  │   └── Ouganda (ÉM)
  ├── CEDEAO / ECOWAS (REC)
  │   ├── Nigeria (ÉM)
  │   ├── Sénégal (ÉM)
  │   ├── Ghana (ÉM)
  │   └── ...15 ÉM
  ├── SADC (REC)
  │   ├── Afrique du Sud (ÉM)
  │   └── ...16 ÉM
  ├── UA (REC)
  ├── CEEAC / ECCAS (REC)
  ├── CAE / EAC (REC)
  ├── UMA (REC)
  └── CEN-SAD (REC)
```

---

## 12. Authentification et Sécurité

### 12.1 Mécanisme JWT RS256

ARIS utilise des tokens JWT signés avec RSA-256 (asymétrique) :

- **Clé privée** : `/opt/aris/keys/private.pem` (signe les tokens, côté serveur uniquement)
- **Clé publique** : `/opt/aris/keys/public.pem` (vérifie les tokens, partagée avec tous les services)
- **Durée du token** : 15 minutes (access token) + refresh token longue durée
- **Format du payload** :

```json
{
  "sub": "user-uuid",
  "email": "admin@au-aris.org",
  "role": "SUPER_ADMIN",
  "tenantId": "tenant-uuid",
  "tenantLevel": "CONTINENTAL",
  "iat": 1710150000,
  "exp": 1710150900
}
```

### 12.2 Rôles RBAC (8 rôles)

| Rôle | Description | Niveau |
|---|---|---|
| `SUPER_ADMIN` | Administrateur système UA-BIRA | Continental |
| `CONTINENTAL_ADMIN` | Officiers de programme UA-BIRA | Continental |
| `REC_ADMIN` | Coordinateurs CER | Régional |
| `NATIONAL_ADMIN` | Administrateurs nationaux (Bureau CVO) | National |
| `DATA_STEWARD` | Responsables qualité données | National/CER |
| `WAHIS_FOCAL_POINT` | Rapporteurs WOAH autorisés | National |
| `ANALYST` | Analystes (lecture seule) | Tous niveaux |
| `FIELD_AGENT` | Collecteurs terrain (mobile) | National |

### 12.3 Génération des clés JWT

```bash
# Sur VM-APP, dans /opt/aris/keys/
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem
chmod 600 private.pem
chmod 644 public.pem
```

### 12.4 Endpoints d'authentification

```
POST /api/v1/credential/auth/login       → Connexion (rate limit: 10/min)
POST /api/v1/credential/auth/register    → Inscription (rôles admin)
POST /api/v1/credential/auth/refresh     → Rafraîchir le token
POST /api/v1/credential/auth/logout      → Déconnexion
GET  /api/v1/credential/users/me         → Profil utilisateur courant
```

### 12.5 Classification des données

| Niveau | Description | Exemples |
|---|---|---|
| `PUBLIC` | Données ouvertes, stats agrégées | KPIs continentaux, nombre d'espèces |
| `PARTNER` | Partagé avec orgs autorisées | Données WOAH, FAO |
| `RESTRICTED` | Données individuelles non confirmées | Foyers épidémiques en cours |
| `CONFIDENTIAL` | Credentials, sécurité nationale | Mots de passe, tokens |

---

## 13. Monitoring et Observabilité

### 13.1 Stack de monitoring

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Services │─────│Prometheus│─────│ Grafana  │
│ (metrics)│     │  :9090   │     │  :3200   │
└──────────┘     └──────────┘     └──────────┘
      │
      │ OTLP
      ▼
┌──────────┐
│  Jaeger  │
│  :16686  │
└──────────┘
```

### 13.2 Prometheus

- **URL** : `http://10.202.101.183:9090`
- **Rétention** : 90 jours
- **Scrape interval** : 15s
- **Targets** : Tous les microservices exposent `/metrics` (format Prometheus)
- **Alertes** : `infra/prometheus/alert-rules.yml`

Targets scrappés :
```yaml
- job_name: 'aris-credential'
  static_configs:
    - targets: ['credential:3002']
- job_name: 'aris-tenant'
  static_configs:
    - targets: ['tenant:3001']
# ... (un job par service)
```

### 13.3 Grafana

- **URL** : `http://10.202.101.183:3200`
- **Login** : `admin` / (voir mot de passe dans docker-compose)
- **Datasource** : Prometheus (auto-provisionnée)

Dashboards pré-configurés :
| Dashboard | Description |
|---|---|
| `aris-overview` | Vue d'ensemble des services (UP/DOWN, latence) |
| `aris-api` | Métriques API (requêtes/s, temps de réponse, erreurs) |
| `aris-kafka` | Métriques Kafka (messages/s, lag consumers) |
| `aris-business` | KPIs métier (soumissions, validations) |
| `aris-traces` | Traces distribuées (via Jaeger datasource) |
| `aris-continental` | KPIs continentaux |
| `aris-animal-health` | Indicateurs santé animale |
| `aris-trade-production` | Commerce et production |

### 13.4 Jaeger (Traces distribuées)

- **URL** : `http://10.202.101.183:16686`
- **Protocole** : OTLP (ports 4317 gRPC, 4318 HTTP)
- **Stockage** : Badger (local, volume Docker)
- **Taux d'échantillonnage** : 10% en production (`OTEL_TRACES_SAMPLER_ARG: 0.1`)

### 13.5 Logs

Chaque service écrit des logs structurés en JSON via `@aris/observability` :

```bash
# Voir les logs de tous les services
sudo docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml logs -f --tail 50

# Logs d'un service spécifique
sudo docker logs aris-credential --tail 100 -f

# Filtrer les erreurs
sudo docker logs aris-credential 2>&1 | grep -i error | tail -20
```

---

## 14. Outils BI (Business Intelligence)

### 14.1 Apache Superset

- **URL** : `http://10.202.101.183:8088`
- **Login** : `admin` / (voir `SUPERSET_ADMIN_PASSWORD` dans docker-compose)
- **Base de données** : Connecté directement à PostgreSQL VM-DB
- **Usage** : Dashboards avancés, SQL Lab, explorations ad-hoc

### 14.2 Metabase

- **URL** : `http://10.202.101.183:3035`
- **Configuration** : Base de données Metabase stockée dans PostgreSQL (DB `metabase`)
- **Embedding** : Activé (`MB_ENABLE_EMBEDDING=true`)
- **Usage** : Dashboards embarqués dans ARIS, requêtes simplifiées

### 14.3 Accès BI depuis ARIS

Le frontend ARIS propose un module BI (menu latéral) qui intègre Grafana, Superset, et Metabase via iframes. Les accès sont contrôlés par le schéma `settings` (table `bi_access_rules`).

---

## 15. Procédures Opérationnelles

### 15.1 Ordre de démarrage (boot complet)

L'ordre est critique à cause des dépendances :

```
1. VM-DB       → PostgreSQL + PgBouncer
2. VM-KAFKA    → 3 brokers Kafka + Schema Registry + Kafka UI
3. VM-CACHE    → Redis + OpenSearch
4. VM-APP      → Traefik → Services → Frontend
```

```bash
# Script de démarrage complet (depuis n'importe quelle machine avec SSH)

# 1. VM-DB
ssh arisadmin@10.202.101.185 "sudo docker compose -f /opt/aris-deploy/vm-db/docker-compose.yml up -d"

# 2. VM-KAFKA
ssh arisadmin@10.202.101.184 "sudo docker compose -f /opt/aris-deploy/vm-kafka/docker-compose.yml up -d"

# 3. VM-CACHE
ssh arisadmin@10.202.101.186 "sudo docker compose -f /opt/aris-deploy/vm-cache/docker-compose.yml up -d"

# 4. VM-APP (attendre que les infras soient prêtes)
sleep 30
ssh arisadmin@10.202.101.183 "sudo docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d"
```

### 15.2 Ordre d'arrêt (shutdown propre)

```bash
# Inverse du démarrage :
1. VM-APP      → Arrêter les services d'abord
2. VM-CACHE    → Arrêter Redis/OpenSearch
3. VM-KAFKA    → Arrêter Kafka (s'assurer que les consumers sont déconnectés)
4. VM-DB       → Arrêter PostgreSQL en dernier
```

```bash
ssh arisadmin@10.202.101.183 "sudo docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml down"
ssh arisadmin@10.202.101.186 "sudo docker compose -f /opt/aris-deploy/vm-cache/docker-compose.yml down"
ssh arisadmin@10.202.101.184 "sudo docker compose -f /opt/aris-deploy/vm-kafka/docker-compose.yml down"
ssh arisadmin@10.202.101.185 "sudo docker compose -f /opt/aris-deploy/vm-db/docker-compose.yml down"
```

### 15.3 Mise à jour du code source

```bash
# Sur VM-APP
ssh arisadmin@10.202.101.183

# 1. Synchroniser le code
cd /opt/aris
sudo git pull origin main

# 2. Installer les dépendances
sudo pnpm install --no-frozen-lockfile

# 3. Exécuter les migrations Prisma
sudo DIRECT_DATABASE_URL="postgresql://aris:<PASS>@10.202.101.185:5432/aris" \
     npx prisma migrate deploy --schema=prisma

# 4. Reconstruire les services
sudo docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml build
sudo docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d

# 5. Reconstruire le frontend (si nécessaire)
cd /opt/aris/apps/web
sudo NODE_ENV=production npx next build
# Puis copier le build standalone dans le conteneur (voir deploy/scripts/rebuild-frontend-v2.py)
```

### 15.4 Redémarrage d'un service individuel

```bash
# Redémarrer le service credential
sudo docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml restart credential

# Reconstruire et redémarrer
sudo docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d --build credential
```

### 15.5 Exécuter les migrations Prisma

```bash
# IMPORTANT : Utiliser DIRECT_DATABASE_URL (port 5432, pas PgBouncer 6432)
sudo docker exec aris-tenant sh -c \
  "DIRECT_DATABASE_URL='postgresql://aris:<PASS>@10.202.101.185:5432/aris' \
   npx prisma migrate deploy --schema=prisma"
```

### 15.6 Re-seed des données

```bash
# Via script Python (depuis la machine de développement)
python deploy/scripts/reseed-ordered.py

# Ou manuellement sur VM-APP
cd /opt/aris
sudo npx tsx packages/db-schemas/prisma/seed-tenant.ts
sudo npx tsx packages/db-schemas/prisma/seed-credential.ts
sudo npx tsx packages/db-schemas/prisma/seed-functions.ts
sudo npx tsx packages/db-schemas/prisma/seed-workflow.ts
sudo npx tsx packages/db-schemas/prisma/seed-bi.ts
```

---

## 16. Sauvegarde et Restauration

### 16.1 Sauvegarde PostgreSQL

```bash
# Sur VM-DB — Dump complet
sudo docker exec aris-postgres pg_dump -U aris -d aris -F c -f /tmp/aris_backup.dump

# Copier le dump
sudo docker cp aris-postgres:/tmp/aris_backup.dump /backups/aris_$(date +%Y%m%d_%H%M%S).dump

# Dump d'un schéma spécifique
sudo docker exec aris-postgres pg_dump -U aris -d aris -n tenant -F c -f /tmp/tenant_backup.dump
```

### 16.2 Restauration PostgreSQL

```bash
# Restaurer un dump complet
sudo docker exec aris-postgres pg_restore -U aris -d aris -c --if-exists /tmp/aris_backup.dump

# Restaurer un schéma spécifique
sudo docker exec aris-postgres pg_restore -U aris -d aris -n tenant /tmp/tenant_backup.dump
```

### 16.3 Sauvegarde Redis

```bash
# Déclencher un snapshot RDB
sudo docker exec aris-redis redis-cli -a 'R3d1s_Pr0d_2024!vN7wQ' BGSAVE

# Le fichier dump.rdb est dans le volume /var/lib/redis/
sudo cp /var/lib/redis/dump.rdb /backups/redis_$(date +%Y%m%d).rdb
```

### 16.4 Recommandations de sauvegarde

| Composant | Fréquence | Rétention | Méthode |
|---|---|---|---|
| PostgreSQL (full) | Quotidien (2h AM) | 30 jours | `pg_dump` → stockage externe |
| PostgreSQL (WAL) | Continu | 7 jours | Archivage WAL |
| Redis | Toutes les 6h | 7 jours | `BGSAVE` + copie dump.rdb |
| MinIO | Quotidien | 30 jours | `mc mirror` → stockage externe |
| Clés JWT | Manuel | Permanent | Copie sécurisée offline |
| Docker Compose | Dans git | Permanent | Versionné avec le code |

---

## 17. Résolution de Problèmes (Troubleshooting)

### 17.1 Un service ne démarre pas

```bash
# Voir les logs du conteneur
sudo docker logs aris-<service> --tail 100

# Vérifier l'état du conteneur
sudo docker inspect aris-<service> --format='{{.State.Status}} - {{.State.Error}}'

# Causes fréquentes :
# 1. PostgreSQL pas prêt → attendre que VM-DB soit UP
# 2. Kafka pas prêt → attendre que VM-KAFKA soit UP
# 3. Clés JWT manquantes → vérifier /opt/aris/keys/
# 4. Port déjà utilisé → sudo lsof -i :PORT
```

### 17.2 Le frontend affiche des erreurs API

```bash
# Vérifier que Traefik route correctement
curl -s http://10.202.101.183/api/v1/credential/auth/login -X POST \
     -H 'Content-Type: application/json' -d '{}' | head -c 200

# Vérifier le dashboard Traefik
http://10.202.101.183:8090

# Vérifier les logs du frontend
sudo docker logs aris-web --tail 50

# Reconstruire le frontend si les API calls ne marchent pas
python deploy/scripts/rebuild-frontend-v2.py
```

### 17.3 La base de données est lente

```bash
# Vérifier les connexions actives
sudo docker exec aris-postgres psql -U aris -d aris -c \
  "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# Vérifier les requêtes lentes
sudo docker exec aris-postgres psql -U aris -d aris -c \
  "SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE state != 'idle' AND now() - pg_stat_activity.query_start > interval '5 seconds'
   ORDER BY duration DESC;"

# Vérifier le pool PgBouncer
sudo docker exec aris-pgbouncer sh -c 'psql -p 6432 -U aris pgbouncer -c "SHOW POOLS;"'
```

### 17.4 Kafka lag des consumers

```bash
# Voir le lag de tous les consumer groups
sudo docker exec aris-kafka-1 kafka-consumer-groups \
  --bootstrap-server localhost:29092 \
  --all-groups --describe

# Ou via Kafka UI
http://10.202.101.184:8080
```

### 17.5 Redis plein

```bash
# Vérifier la mémoire utilisée
sudo docker exec aris-redis redis-cli -a 'R3d1s_Pr0d_2024!vN7wQ' info memory

# Voir les clés les plus volumineuses
sudo docker exec aris-redis redis-cli -a 'R3d1s_Pr0d_2024!vN7wQ' --bigkeys

# Vider le cache (avec précaution)
sudo docker exec aris-redis redis-cli -a 'R3d1s_Pr0d_2024!vN7wQ' FLUSHDB
```

### 17.6 Conteneur en restart loop

```bash
# Identifier le conteneur en boucle
sudo docker ps -a --filter status=restarting

# Voir les logs avant le crash
sudo docker logs aris-<service> --tail 200 2>&1 | tail -50

# Arrêter le redémarrage automatique et debug
sudo docker update --restart=no aris-<service>
sudo docker start aris-<service>
sudo docker logs aris-<service> -f
```

---

## 18. Vérifications Post-Déploiement

### 18.1 Checklist de vérification

```bash
# ── VM-DB ──
# PostgreSQL répond
sudo docker exec aris-postgres pg_isready -U aris -d aris
# PgBouncer répond
psql -h 10.202.101.185 -p 6432 -U aris -d aris -c '\dn'
# 26 schémas présents

# ── VM-KAFKA ──
# Kafka cluster sain
sudo docker exec aris-kafka-1 kafka-metadata --snapshot /var/lib/kafka/data/__cluster_metadata-0/00000000000000000000.log --cluster-id MkU3OEVBNTcwNTJENDM2Qk 2>/dev/null | head -5
# Topics créés
sudo docker exec aris-kafka-1 kafka-topics --list --bootstrap-server localhost:29092 | wc -l
# → 50+

# ── VM-CACHE ──
# Redis répond
sudo docker exec aris-redis redis-cli -a '<PASS>' ping
# → PONG
# OpenSearch sain
curl http://10.202.101.186:9200/_cluster/health?pretty
# → status: green

# ── VM-APP ──
# Tous les conteneurs running
sudo docker ps --format "{{.Names}}: {{.Status}}" | sort
# → Tous "Up"

# Frontend accessible
curl -s -o /dev/null -w '%{http_code}' http://10.202.101.183:3100
# → 200
curl -s -o /dev/null -w '%{http_code}' http://10.202.101.183:80
# → 200

# Login fonctionnel
curl -s -X POST http://10.202.101.183/api/v1/credential/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'
# → {"accessToken":"...","user":{...}}

# Form templates
curl -s http://10.202.101.183/api/v1/form-builder/templates | head -c 200
# → {"data":[...], "meta":{"total":21}}

# Master data
curl -s http://10.202.101.183/api/v1/master-data/species | head -c 200
# → {"data":[...]}
```

### 18.2 Script de vérification automatisé

Un script Python `deploy/scripts/verify-all-vms.py` est disponible pour vérifier automatiquement l'état de toutes les VMs et services.

```bash
python deploy/scripts/verify-all-vms.py
```

---

## 19. Historique des Correctifs Appliqués

### 19.1 Correctif : API URLs du frontend (localhost → relatif)

**Problème** : Le frontend Next.js utilisait des URLs `http://localhost:XXXX` en fallback dans tous les hooks API. En production, le navigateur envoyait les requêtes à `localhost` au lieu de `10.202.101.183`.

**Impact** : Aucun appel API ne fonctionnait depuis le navigateur en production. Login, formulaires, settings — tout était cassé.

**Solution** : Remplacement de tous les fallbacks par des chemins relatifs (`/api/v1/...`). Traefik route ces requêtes vers les bons microservices.

**Fichiers modifiés** :
- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/api/form-builder-hooks.ts`
- `apps/web/src/lib/api/workflow-hooks.ts`
- `apps/web/src/lib/api/bi-hooks.ts`
- `apps/web/src/lib/api/ref-data-hooks.ts`
- `apps/web/src/lib/api/settings-hooks.ts`
- `apps/web/src/lib/api/historical-hooks.ts`
- `apps/web/src/lib/api/public-data.ts`
- `apps/web/src/components/auth/AuthGuard.tsx`

### 19.2 Correctif : Traefik v2 → v3

**Problème** : La configuration initiale utilisait des labels Traefik v2 (`traefik.http.routers.xxx.rule=Host(...)`) qui ne fonctionnaient pas avec Traefik v3.

**Solution** : Mise à jour vers Traefik v3.6.10 avec `PathPrefix()` au lieu de `Host()`.

### 19.3 Correctif : `new URL()` avec chemins relatifs

**Problème** : Le constructeur JavaScript `new URL('/api/v1/...', undefined)` lance une erreur car il nécessite une URL absolue.

**Solution** : Remplacement par concaténation de chaînes + `URLSearchParams` pour les paramètres de requête.

### 19.4 Correctif : Ordre des seeds

**Problème** : Les seeds échouaient car `seed-credential.ts` dépend de `seed-tenant.ts`, et `seed-functions.ts` dépend des deux.

**Solution** : Script `deploy/scripts/reseed-ordered.py` qui exécute les seeds dans le bon ordre avec vérification entre chaque étape.

### 19.5 Renommage : ARIS 3.0 → ARIS 4.0

**Date** : 11 mars 2026

Remplacement global de toutes les références "ARIS 3.0" par "ARIS 4.0" dans :
- Package.json root et tous les services/packages
- Dockerfiles (3 fichiers)
- Docker Compose (7 fichiers)
- Frontend (manifest.json, composants TSX)
- Scripts de déploiement (11+ fichiers)
- Documentation (35+ fichiers)
- Dashboards Grafana (5 fichiers JSON)
- Configuration infrastructure (8+ fichiers)

---

## 20. Recommandations et Prochaines Étapes

### 20.1 Sécurité (Priorité haute)

1. **Changer tous les mots de passe par défaut** :
   - PostgreSQL : `Ar1s_Pr0d_2024!xK9mZ`
   - Redis : `R3d1s_Pr0d_2024!vN7wQ`
   - MinIO : `M1n10_Pr0d_2024!jH6pR`
   - Grafana : `Gr4f4na_Pr0d_2024!aS7dF`
   - Superset : `Sup3rs3t_Pr0d_2024!qR5tY`
   - Utilisateur SSH : `@u-1baR.0rg$U24`
   - Utilisateurs ARIS : `Aris2024!`

2. **Activer HTTPS** : Configurer un certificat TLS dans Traefik (Let's Encrypt ou certificat interne)

3. **Passer en authentification SSH par clé** : Désactiver `PasswordAuthentication` dans sshd_config

4. **Sécuriser Kafka** : Activer SASL/SCRAM ou mTLS entre les services et Kafka

5. **Redis ACLs** : Configurer des ACLs Redis par service

6. **OpenSearch Security** : Réactiver le plugin de sécurité OpenSearch avec TLS

### 20.2 Haute Disponibilité

1. **PostgreSQL** : Configurer un réplica en streaming replication (standby)
2. **Redis** : Ajouter un Redis Sentinel ou passer en cluster mode
3. **Load Balancer** : Ajouter un load balancer (HAProxy/Nginx) devant Traefik
4. **Backup automatisé** : Cron jobs pour pg_dump quotidien + archivage WAL

### 20.3 Performance

1. **CDN** : Mettre les assets statiques Next.js derrière un CDN
2. **Connection pooling** : Ajuster les paramètres PgBouncer selon la charge
3. **Kafka partitions** : Augmenter le nombre de partitions pour les topics à fort débit
4. **Index PostgreSQL** : Auditer et ajouter des index sur les requêtes fréquentes

### 20.4 Fonctionnel

1. **Email de production** : Remplacer Mailpit par un vrai serveur SMTP (SendGrid, AWS SES, ou serveur interne)
2. **Dashboards BI** : Créer les dashboards Superset/Metabase pour les 9 domaines
3. **Mobile** : Déployer l'application Android Kotlin pour les agents terrain
4. **Formation** : Former les administrateurs nationaux à l'utilisation d'ARIS

### 20.5 Monitoring

1. **Alertes** : Configurer les alertes Grafana (email, Slack) pour :
   - Service DOWN > 5 min
   - Kafka consumer lag > 10000
   - PostgreSQL connections > 150
   - Redis memory > 7 GB
   - Disk usage > 85%
2. **Node Exporter** : Installer Prometheus Node Exporter sur chaque VM pour les métriques OS

---

## 21. Annexes

### Annexe A — Scripts de déploiement disponibles

| Script | Description |
|---|---|
| `deploy/deploy-all.py` | Orchestrateur principal : installe et configure les 4 VMs |
| `deploy/scripts/setup-vm-db.sh` | Setup complet VM-DB |
| `deploy/scripts/setup-vm-kafka.sh` | Setup complet VM-KAFKA |
| `deploy/scripts/setup-vm-cache.sh` | Setup complet VM-CACHE |
| `deploy/scripts/setup-vm-app.sh` | Setup complet VM-APP |
| `deploy/scripts/sync-repo.sh` | Synchronise le dépôt git sur VM-APP |
| `deploy/scripts/run-migrations.py` | Exécute les migrations Prisma |
| `deploy/scripts/reseed-ordered.py` | Re-seed dans le bon ordre |
| `deploy/scripts/rebuild-frontend-v2.py` | Reconstruit et déploie le frontend Next.js |
| `deploy/scripts/fix-frontend-api-urls.py` | Corrige les URLs API du frontend |
| `deploy/scripts/verify-all-vms.py` | Vérifie l'état de toutes les VMs |
| `deploy/scripts/verify-login.py` | Teste le login sur la production |
| `deploy/scripts/verify-infra.py` | Vérifie les infras (DB, Kafka, Redis) |
| `deploy/scripts/fix-bi-seed-and-login.py` | Corrige les seeds BI et le login |
| `deploy/scripts/install-node-exporter.sh` | Installe Prometheus Node Exporter |
| `deploy/audit_vms.py` | Audit complet des 4 VMs |
| `deploy/scripts/verify-production-seeds.py` | Vérifie les seeds en production |

### Annexe B — Ports réseau complets

```
VM-APP (10.202.101.183):
  80    → Traefik HTTP (public)
  443   → Traefik HTTPS (public)
  1025  → Mailpit SMTP
  3001  → tenant
  3002  → credential
  3003  → master-data
  3004  → data-quality
  3005  → data-contract
  3006  → message
  3007  → drive
  3008  → realtime
  3010  → form-builder
  3011  → collecte
  3012  → workflow
  3020  → animal-health
  3021  → livestock-prod
  3022  → fisheries
  3023  → wildlife
  3024  → apiculture
  3025  → trade-sps
  3026  → governance
  3027  → climate-env
  3030  → analytics
  3031  → geo-services
  3032  → interop-hub
  3033  → knowledge-hub
  3035  → Metabase
  3040  → offline
  3041  → support
  3042  → interop
  3043  → analytics-worker
  3044  → datalake
  3100  → Next.js web (direct)
  3200  → Grafana
  4317  → Jaeger OTLP gRPC
  4318  → Jaeger OTLP HTTP
  7800  → pg_tileserv
  8025  → Mailpit UI
  8088  → Superset
  8090  → Traefik Dashboard
  9000  → MinIO API
  9001  → MinIO Console
  9090  → Prometheus
  14268 → Jaeger (legacy)
  16686 → Jaeger UI

VM-KAFKA (10.202.101.184):
  8080  → Kafka UI
  8081  → Schema Registry
  9092  → Kafka Broker 1 (external)
  9094  → Kafka Broker 2 (external)
  9096  → Kafka Broker 3 (external)

VM-DB (10.202.101.185):
  5432  → PostgreSQL (direct)
  6432  → PgBouncer

VM-CACHE (10.202.101.186):
  5601  → OpenSearch Dashboards
  6379  → Redis
  9200  → OpenSearch API
  9600  → OpenSearch Performance Analyzer
```

### Annexe C — Commandes de diagnostic rapide

```bash
# === ÉTAT GLOBAL ===
# Tous les conteneurs sur VM-APP
ssh arisadmin@10.202.101.183 "sudo docker ps --format 'table {{.Names}}\t{{.Status}}' | sort"

# Conteneurs sur toutes les VMs
for VM in 183 184 185 186; do
  echo "=== VM 10.202.101.$VM ==="
  ssh arisadmin@10.202.101.$VM "sudo docker ps --format '{{.Names}}: {{.Status}}'" 2>/dev/null
done

# === SANTÉ ===
# PostgreSQL
ssh arisadmin@10.202.101.185 "sudo docker exec aris-postgres pg_isready"

# Kafka
ssh arisadmin@10.202.101.184 "sudo docker exec aris-kafka-1 kafka-topics --list --bootstrap-server localhost:29092 | wc -l"

# Redis
ssh arisadmin@10.202.101.186 "sudo docker exec aris-redis redis-cli -a 'R3d1s_Pr0d_2024!vN7wQ' ping"

# Frontend
curl -s -o /dev/null -w '%{http_code}' http://10.202.101.183:80

# === MÉTRIQUES ===
# Espace disque
for VM in 183 184 185 186; do
  echo "=== VM $VM ==="
  ssh arisadmin@10.202.101.$VM "df -h / /var /opt 2>/dev/null"
done

# Mémoire
for VM in 183 184 185 186; do
  echo "=== VM $VM ==="
  ssh arisadmin@10.202.101.$VM "free -h"
done
```

### Annexe D — Diagramme des 9 domaines métier

```
┌────────────────────────────────────────────────────────────────────┐
│                    ARIS 4.0 — 9 Domaines Métier                   │
├────────────────────┬───────────────────┬───────────────────────────┤
│ 1. Gouvernance &   │ 2. Santé Animale  │ 3. Production &          │
│    Capacités       │    & One Health   │    Pastoralisme          │
│    (governance)    │    (animal-health)│    (livestock-prod)      │
├────────────────────┼───────────────────┼───────────────────────────┤
│ 4. Commerce,       │ 5. Pêches &       │ 6. Faune &               │
│    Marchés & SPS   │    Aquaculture    │    Biodiversité          │
│    (trade-sps)     │    (fisheries)    │    (wildlife)            │
├────────────────────┼───────────────────┼───────────────────────────┤
│ 7. Apiculture &    │ 8. Climat &       │ 9. Gestion des           │
│    Pollinisation   │    Environnement  │    Connaissances         │
│    (apiculture)    │    (climate-env)  │    (knowledge-hub)       │
└────────────────────┴───────────────────┴───────────────────────────┘
```

### Annexe E — Contacts et support

| Rôle | Contact |
|---|---|
| Équipe DevOps ARIS | devops@au-aris.org |
| Support technique | support@au-aris.org |
| Sécurité | security@au-aris.org |

---

**Fin du rapport de déploiement — ARIS 4.0**
*Document généré le 11 mars 2026*
*Classification : CONFIDENTIEL — Usage interne AU-IBAR uniquement*
