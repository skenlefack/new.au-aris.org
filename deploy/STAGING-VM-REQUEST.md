# Demande de Provisionnement — 4 VMs Staging ARIS

**Projet** : ARIS 4.0 — Animal Resources Information System
**Demandeur** : Equipe ARIS / AU-IBAR
**Date** : 17 mars 2026
**Urgence** : Normale
**Objet** : Creation de 4 machines virtuelles pour l'environnement de test/staging
**Domaine** : `test.au-aris.org`

---

## 1. Contexte

L'equipe ARIS a besoin d'un environnement de staging isole de la production pour :
- Valider les nouvelles fonctionnalites avant deploiement en production
- Former les utilisateurs sur des donnees de test
- Tester les migrations de schema de base de donnees

Cet environnement est une replique fonctionnelle de la production (meme architecture 4 VMs, meme code) mais avec des **ressources fortement reduites** : il n'y aura que 2 a 5 testeurs simultanes, des donnees seeds uniquement, et aucun SLA de disponibilite.

---

## 2. Specifications des 4 Machines Virtuelles

### VM 1 — VM-APP-STG (Services applicatifs)

| Parametre | Valeur |
|-----------|--------|
| **Hostname** | `nbo-aris04-stg` |
| **Role** | 30 microservices Docker + reverse proxy + monitoring + BI |
| **OS** | Ubuntu Server 22.04 LTS (Jammy Jellyfish) — 64 bits |
| **vCPU** | **4 vCPU** |
| **RAM** | **16 Go** |
| **Disque systeme** | 40 Go SSD (montage `/`) |
| **Disque donnees** | 100 Go SSD (montage `/opt`) |
| **Reseau** | 1 interface, reseau interne AU-IBAR, IP statique |
| **Acces internet** | Oui (pull images Docker Hub, git pull GitHub) |

> **Justification 16 Go** : 25 microservices Node.js au repos consomment ~3 Go.
> Traefik + MinIO + Mailpit + Monitoring ~2 Go. Superset + Metabase ~2 Go.
> Marge pour build Docker : ~4 Go. Total reel en usage : ~11 Go.

**Ports a ouvrir (entrants)** :

| Port | Protocole | Service | Acces |
|------|-----------|---------|-------|
| 22 | TCP | SSH | Interne uniquement |
| 80 | TCP | HTTP (redirect vers HTTPS) | Interne + externe |
| 443 | TCP | HTTPS (Traefik reverse proxy) | Interne + externe |
| 8025 | TCP | Mailpit Web UI (emails de test) | Interne uniquement |
| 8090 | TCP | Traefik Dashboard | Interne uniquement |
| 9001 | TCP | MinIO Console | Interne uniquement |
| 3200 | TCP | Grafana monitoring | Interne uniquement |

Les autres ports (3001-3044, 9000, 9090, 16686, 8088, 3035) sont internes aux conteneurs Docker et n'ont pas besoin d'etre ouverts au niveau firewall VM.

---

### VM 2 — VM-KAFKA-STG (Message Broker)

| Parametre | Valeur |
|-----------|--------|
| **Hostname** | `nbo-brk01-stg` |
| **Role** | 3 brokers Apache Kafka (KRaft) + Schema Registry + Kafka UI |
| **OS** | Ubuntu Server 22.04 LTS (Jammy Jellyfish) — 64 bits |
| **vCPU** | **2 vCPU** |
| **RAM** | **8 Go** |
| **Disque systeme** | 40 Go SSD (montage `/`) |
| **Disque donnees** | 30 Go SSD (montage `/kafka-data`) |
| **Reseau** | 1 interface, reseau interne AU-IBAR, IP statique |
| **Acces internet** | Oui (pull images Docker Hub) |

> **Justification 8 Go** : En production, chaque broker Kafka utilise 4 Go de heap (12 Go total).
> En staging, le trafic est quasi nul (quelques messages par heure). Heap reduit a 512 Mo x 3 = 1.5 Go.
> Schema Registry + Kafka UI : ~500 Mo. Total reel : ~3 Go.

**Ports a ouvrir (entrants)** :

| Port | Protocole | Service | Acces |
|------|-----------|---------|-------|
| 22 | TCP | SSH | Interne uniquement |
| 8080 | TCP | Kafka UI | Interne uniquement |
| 8081 | TCP | Schema Registry | VM-APP-STG uniquement |
| 9092 | TCP | Kafka Broker 1 | VM-APP-STG uniquement |
| 9094 | TCP | Kafka Broker 2 | VM-APP-STG uniquement |
| 9096 | TCP | Kafka Broker 3 | VM-APP-STG uniquement |

---

### VM 3 — VM-DB-STG (Base de donnees)

| Parametre | Valeur |
|-----------|--------|
| **Hostname** | `nbo-dbms03-stg` |
| **Role** | PostgreSQL 16 + PostGIS 3.4 + PgBouncer (connection pool) |
| **OS** | Ubuntu Server 22.04 LTS (Jammy Jellyfish) — 64 bits |
| **vCPU** | **2 vCPU** |
| **RAM** | **8 Go** |
| **Disque systeme** | 40 Go SSD (montage `/`) |
| **Disque donnees** | 50 Go SSD (montage `/var/lib/postgresql`) |
| **Reseau** | 1 interface, reseau interne AU-IBAR, IP statique |
| **Acces internet** | Oui (pull images Docker Hub) |

> **Justification 8 Go** : En production, PostgreSQL utilise `shared_buffers=8GB` pour gerer
> des millions de lignes et des centaines de connexions. En staging, la base ne contiendra que
> quelques milliers de lignes (seeds). `shared_buffers=1GB` suffit largement. Total reel : ~3 Go.

**Ports a ouvrir (entrants)** :

| Port | Protocole | Service | Acces |
|------|-----------|---------|-------|
| 22 | TCP | SSH | Interne uniquement |
| 5432 | TCP | PostgreSQL (direct) | VM-APP-STG uniquement |
| 6432 | TCP | PgBouncer (connection pool) | VM-APP-STG uniquement |

---

### VM 4 — VM-CACHE-STG (Cache & Recherche)

| Parametre | Valeur |
|-----------|--------|
| **Hostname** | `nbo-cch01-stg` |
| **Role** | Redis 7 (cache) + OpenSearch 2.17 (recherche full-text) |
| **OS** | Ubuntu Server 22.04 LTS (Jammy Jellyfish) — 64 bits |
| **vCPU** | **2 vCPU** |
| **RAM** | **8 Go** |
| **Disque systeme** | 40 Go SSD (montage `/`) |
| **Disque donnees** | 30 Go SSD (montage `/var/lib`) |
| **Reseau** | 1 interface, reseau interne AU-IBAR, IP statique |
| **Acces internet** | Oui (pull images Docker Hub) |

> **Justification 8 Go** : En production, Redis utilise 8 Go de maxmemory et OpenSearch 8 Go de heap
> pour indexer des millions de documents. En staging, quelques centaines de cles et index.
> Redis 512 Mo + OpenSearch 1 Go heap suffisent. Total reel : ~3 Go.

**Ports a ouvrir (entrants)** :

| Port | Protocole | Service | Acces |
|------|-----------|---------|-------|
| 22 | TCP | SSH | Interne uniquement |
| 5601 | TCP | OpenSearch Dashboards | Interne uniquement |
| 6379 | TCP | Redis | VM-APP-STG uniquement |
| 9200 | TCP | OpenSearch HTTP | VM-APP-STG uniquement |
| 9600 | TCP | OpenSearch metrics | VM-APP-STG uniquement |

---

## 3. Resume des Ressources Totales

| Ressource | VM-APP-STG | VM-KAFKA-STG | VM-DB-STG | VM-CACHE-STG | **Total** |
|-----------|:----------:|:------------:|:---------:|:------------:|:---------:|
| vCPU | 4 | 2 | 2 | 2 | **10 vCPU** |
| RAM | 16 Go | 8 Go | 8 Go | 8 Go | **40 Go** |
| Disque systeme | 40 Go | 40 Go | 40 Go | 40 Go | 160 Go |
| Disque donnees | 100 Go | 30 Go | 50 Go | 30 Go | 210 Go |
| **Stockage total** | 140 Go | 70 Go | 90 Go | 70 Go | **370 Go SSD** |

### Comparaison avec la Production

| | Production | Staging | Ratio |
|--|-----------|---------|:-----:|
| **Total vCPU** | ~32 | 10 | **x3 moins** |
| **Total RAM** | ~128 Go | 40 Go | **x3 moins** |
| **Total stockage** | ~1.5 To | 370 Go | **x4 moins** |
| **Utilisateurs** | 55 pays, centaines | 2-5 testeurs | |
| **Donnees** | Millions de lignes | Seeds (~1000 lignes) | |
| **Emails** | Postmark (envoi reel) | Mailpit (catch-all local) | |
| **SLA** | 99.9% | Best-effort | |

---

## 4. Installation Ubuntu — Parametres Exacts

Les 4 VMs suivent la meme procedure d'installation.

### 4.1 Image ISO

- **Ubuntu Server 22.04.5 LTS** (Jammy Jellyfish)
- Architecture : **amd64**
- Variante : **minimized** (pas de GUI, serveur uniquement)

### 4.2 Parametres d'installation

| Parametre | Valeur |
|-----------|--------|
| Langue | English |
| Clavier | US International |
| Fuseau horaire | **Africa/Nairobi (EAT, UTC+3)** |
| Nom utilisateur | `arisadmin` |
| Mot de passe | `@u-1baR.0rg$U24` |
| Hostname | Voir tableau par VM ci-dessus |
| Partitionnement | Voir section 4.3 |

### 4.3 Schema de Partitionnement

**VM-APP-STG** (140 Go total) :

| Partition | Montage | Taille | Type | Commentaire |
|-----------|---------|--------|------|-------------|
| `/dev/sda1` | `/boot/efi` | 512 Mo | EFI | UEFI boot |
| `/dev/sda2` | `/boot` | 1 Go | ext4 | Kernel/initrd |
| `/dev/sda3` | `/` | 38 Go | ext4 | Systeme |
| `/dev/sdb1` | `/opt` | 100 Go | ext4 | Code + images Docker + donnees |

**VM-DB-STG** (90 Go total) :

| Partition | Montage | Taille | Type | Commentaire |
|-----------|---------|--------|------|-------------|
| `/dev/sda1` | `/boot/efi` | 512 Mo | EFI | UEFI boot |
| `/dev/sda2` | `/boot` | 1 Go | ext4 | Kernel/initrd |
| `/dev/sda3` | `/` | 38 Go | ext4 | Systeme |
| `/dev/sdb1` | `/var/lib/postgresql` | 50 Go | ext4 | Donnees PostgreSQL |

**VM-KAFKA-STG** (70 Go total) :

| Partition | Montage | Taille | Type | Commentaire |
|-----------|---------|--------|------|-------------|
| `/dev/sda1` | `/boot/efi` | 512 Mo | EFI | UEFI boot |
| `/dev/sda2` | `/boot` | 1 Go | ext4 | Kernel/initrd |
| `/dev/sda3` | `/` | 38 Go | ext4 | Systeme |
| `/dev/sdb1` | `/kafka-data` | 30 Go | ext4 | Logs Kafka |

**VM-CACHE-STG** (70 Go total) :

| Partition | Montage | Taille | Type | Commentaire |
|-----------|---------|--------|------|-------------|
| `/dev/sda1` | `/boot/efi` | 512 Mo | EFI | UEFI boot |
| `/dev/sda2` | `/boot` | 1 Go | ext4 | Kernel/initrd |
| `/dev/sda3` | `/` | 38 Go | ext4 | Systeme |
| `/dev/sdb1` | `/var/lib` | 30 Go | ext4 | Donnees Redis + OpenSearch |

> **Note** : Pas de swap. Docker et les conteneurs gerent la memoire eux-memes. Si l'IT prefere ajouter du swap : 2 Go max.

### 4.4 Paquets a Installer lors du Setup

Cocher lors de l'installation :
- **OpenSSH server** (serveur SSH)

Rien d'autre. Pas de GUI, pas de snaps inutiles.

### 4.5 Configuration Post-Installation (les 4 VMs)

Apres reboot, se connecter en SSH avec `arisadmin` et executer :

```bash
# ── 1. Mise a jour systeme ──
sudo apt update && sudo apt upgrade -y

# ── 2. Installer Docker Engine (pas Docker Desktop, pas snap) ──
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# ── 3. Ajouter arisadmin au groupe docker ──
sudo usermod -aG docker arisadmin

# ── 4. Installer git + utilitaires ──
sudo apt install -y git curl wget htop iotop net-tools jq unzip

# ── 5. Parametres sysctl (pour OpenSearch et Kafka) ──
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
echo "vm.swappiness=1" | sudo tee -a /etc/sysctl.conf
echo "net.core.somaxconn=65535" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# ── 6. Limites fichiers ouverts ──
cat << 'EOF' | sudo tee -a /etc/security/limits.conf
arisadmin soft nofile 65536
arisadmin hard nofile 65536
* soft nofile 65536
* hard nofile 65536
EOF

# ── 7. Desactiver le pare-feu UFW (firewall gere au niveau hyperviseur) ──
# OU configurer les ports specifiques a la VM — voir section 2
sudo ufw disable

# ── 8. Configurer le fuseau horaire ──
sudo timedatectl set-timezone Africa/Nairobi

# ── 9. Reboot ──
sudo reboot
```

### 4.6 Arborescence a Creer (apres installation Docker)

**VM-APP-STG** :
```bash
sudo mkdir -p /opt/aris                         # Code source (git clone)
sudo mkdir -p /opt/aris-deploy/vm-app-stg/certs # Compose + cert SSL
sudo mkdir -p /opt/aris/keys-stg                # Cles JWT staging
sudo chown -R arisadmin:arisadmin /opt/aris /opt/aris-deploy
```

**VM-KAFKA-STG** :
```bash
sudo mkdir -p /opt/aris
sudo mkdir -p /opt/aris-deploy/vm-kafka-stg
sudo mkdir -p /kafka-data/broker-{1,2,3}
sudo chown -R arisadmin:arisadmin /opt/aris /opt/aris-deploy /kafka-data
```

**VM-DB-STG** :
```bash
sudo mkdir -p /opt/aris
sudo mkdir -p /opt/aris-deploy/vm-db-stg
sudo mkdir -p /var/lib/postgresql/data
sudo chown -R arisadmin:arisadmin /opt/aris /opt/aris-deploy
# PostgreSQL data dir sera gere par le conteneur Docker (user postgres:999)
```

**VM-CACHE-STG** :
```bash
sudo mkdir -p /opt/aris
sudo mkdir -p /opt/aris-deploy/vm-cache-stg
sudo mkdir -p /var/lib/redis
sudo mkdir -p /var/lib/opensearch
sudo chown -R arisadmin:arisadmin /opt/aris /opt/aris-deploy /var/lib/redis
sudo chown -R 1000:1000 /var/lib/opensearch  # OpenSearch user UID 1000
```

---

## 5. Reseau

### 5.1 IP Statiques

Les 4 VMs doivent etre sur le **meme sous-reseau** (meme VLAN de preference) pour communiquer entre elles sans restrictions.

**Format attendu** : `10.202.101.XXX/24` (meme plage que la production) ou un autre sous-reseau dedie staging.

> **Merci de fournir les 4 IPs une fois assignees.** Nous remplacerons les placeholders dans notre configuration.

### 5.2 Connectivite Inter-VMs

| Source | Destination | Ports | Obligatoire |
|--------|-------------|-------|:-----------:|
| VM-APP-STG | VM-DB-STG | 5432, 6432 | Oui |
| VM-APP-STG | VM-KAFKA-STG | 9092, 9094, 9096, 8081 | Oui |
| VM-APP-STG | VM-CACHE-STG | 6379, 9200 | Oui |
| Toutes | Internet (sortant) | 443, 80 | Oui (Docker pull, git) |

### 5.3 DNS

Ajouter dans le DNS interne AU-IBAR (une fois les IPs connues) :

```
<IP_VM_APP_STG>   test.au-aris.org
<IP_VM_APP_STG>   cm-test.au-aris.org
<IP_VM_APP_STG>   ke-test.au-aris.org
<IP_VM_APP_STG>   et-test.au-aris.org
<IP_VM_APP_STG>   ng-test.au-aris.org
<IP_VM_APP_STG>   sn-test.au-aris.org
<IP_VM_APP_STG>   za-test.au-aris.org
<IP_VM_APP_STG>   igad-test.au-aris.org
<IP_VM_APP_STG>   ecowas-test.au-aris.org
<IP_VM_APP_STG>   sadc-test.au-aris.org
<IP_VM_APP_STG>   comesa-test.au-aris.org
<IP_VM_APP_STG>   eccas-test.au-aris.org
<IP_VM_APP_STG>   uma-test.au-aris.org
<IP_VM_APP_STG>   cen-sad-test.au-aris.org
<IP_VM_APP_STG>   ead-test.au-aris.org
```

> Le certificat SSL wildcard `*.au-aris.org` (GoDaddy, valide jusqu'au 18/03/2027) couvre deja tous ces sous-domaines. Pas besoin de nouveau certificat.

---

## 6. Informations a Retourner par l'IT

Une fois les VMs creees, merci de fournir :

1. **Les 4 adresses IP** assignees a chaque VM
2. **Confirmation de la connectivite inter-VMs** (ports ouverts)
3. **Confirmation de l'acces internet sortant** (Docker Hub, GitHub)
4. **Confirmation SSH accessible** depuis le poste de l'equipe ARIS

| VM | Hostname | IP (a remplir) |
|----|----------|:---------------:|
| VM-APP-STG | `nbo-aris04-stg` | ______________ |
| VM-KAFKA-STG | `nbo-brk01-stg` | ______________ |
| VM-DB-STG | `nbo-dbms03-stg` | ______________ |
| VM-CACHE-STG | `nbo-cch01-stg` | ______________ |

---

## 7. Contact

Pour toute question technique sur cette demande :
- **Email** : admin@au-aris.org
- **Projet** : ARIS 4.0 — AU-IBAR
