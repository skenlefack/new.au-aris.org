# ARIS 4.0 — Rapport d'Audit Infrastructure
## État Matériel et Système des Serveurs AU-IBAR

| | |
|---|---|
| **Organisation** | AU-IBAR — Union Africaine, Bureau Interafricain des Ressources Animales |
| **Système** | ARIS 4.0 — Animal Resources Information System |
| **Date d'audit** | 9 mars 2026 |
| **Auditeur** | Audit automatisé (scan réseau externe) |
| **Méthode** | Scan de ports TCP + analyse de bannières SSH (sans authentification) |
| **Limitation** | Accès SSH non fonctionnel — audit interne en attente |

---

## 1. Résumé Exécutif

L'audit externe des 4 machines virtuelles ARIS a révélé les constats suivants :

| Aspect | État | Commentaire |
|---|---|---|
| **Ubuntu installé** | **3/4 VMs confirmées** | Banner SSH confirme Ubuntu 24.04 LTS |
| **Services ARIS déployés** | **0/4 VMs** | Aucun port applicatif ouvert |
| **Accessibilité réseau** | **3/4 VMs joignables** | VM-DB (nbo-dbms03) inaccessible |
| **Accès SSH** | **0/4 VMs authentifiables** | Mot de passe rejeté, clé non autorisée |

**Conclusion** : Les VMs sont dans un état de **post-installation Ubuntu** (OS installé, SSH actif) mais **aucun composant ARIS n'est encore déployé**. L'accès SSH doit être rétabli avant de poursuivre le déploiement.

---

## 2. État Détaillé par Machine Virtuelle

### 2.1 VM-APP (nbo-aris04) — Serveur Applicatif

| Paramètre | Spécification | Constaté | Statut |
|---|---|---|---|
| **Adresse IP** | 10.202.101.183 | 10.202.101.183 | OK |
| **Accessibilité réseau** | Port 22 ouvert | Port 22 ouvert | OK |
| **Version OS** | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS (OpenSSH_9.6p1 Ubuntu-3ubuntu13.14) | OK |
| **vCPU** | 16 | Non vérifiable (accès SSH requis) | EN ATTENTE |
| **RAM** | 32 Go | Non vérifiable | EN ATTENTE |
| **Stockage** | 300 Go SSD | Non vérifiable | EN ATTENTE |
| **Docker** | Installé (dépôt officiel) | Port non exposé → non vérifiable | EN ATTENTE |
| **Node.js** | Installé | Port 3100 fermé → non vérifié | EN ATTENTE |
| **Traefik** | Port 4000 | Port 4000 fermé | NON DEPLOYE |
| **Microservices (3001-3033)** | 22 services | Aucun port ouvert | NON DEPLOYE |
| **Next.js Frontend** | Port 3100 | Port 3100 fermé | NON DEPLOYE |
| **Authentification SSH** | Mot de passe | Rejeté | ECHEC |

**Ports scannés ouverts** : 22 (SSH uniquement)
**Ports applicatifs attendus** : 80, 443, 3001-3033, 3100, 4000 — tous fermés

---

### 2.2 VM-KAFKA (nbo-brk01) — Bus de Messages Kafka

| Paramètre | Spécification | Constaté | Statut |
|---|---|---|---|
| **Adresse IP** | 10.202.101.184 | 10.202.101.184 | OK |
| **Accessibilité réseau** | Port 22 ouvert | Port 22 ouvert | OK |
| **Version OS** | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS (OpenSSH_9.6p1 Ubuntu-3ubuntu13.14) | OK |
| **vCPU** | 8 | Non vérifiable | EN ATTENTE |
| **RAM** | 16 Go | Non vérifiable | EN ATTENTE |
| **Stockage** | 500 Go NVMe | Non vérifiable | EN ATTENTE |
| **/kafka-data (XFS)** | 400 Go XFS | Non vérifiable | EN ATTENTE |
| **Kafka Broker** | Port 9092 | Port 9092 fermé | NON DEPLOYE |
| **Schema Registry** | Port 8081 | Port 8081 fermé | NON DEPLOYE |
| **Kafka UI** | Port 8080 | Port 8080 fermé | NON DEPLOYE |
| **Java (OpenJDK 17)** | Installé | Non vérifiable | EN ATTENTE |
| **Authentification SSH** | Mot de passe | Rejeté | ECHEC |

**Ports scannés ouverts** : 22 (SSH uniquement)
**Ports applicatifs attendus** : 8080, 8081, 9092, 9094 — tous fermés

---

### 2.3 VM-DB (nbo-dbms03) — Base de Données PostgreSQL

| Paramètre | Spécification | Constaté | Statut |
|---|---|---|---|
| **Adresse IP** | 10.202.101.185 | 10.202.101.185 | INACCESSIBLE |
| **Accessibilité réseau** | Port 22 ouvert | **Aucun port accessible (timeout)** | ECHEC |
| **Version OS** | Ubuntu 24.04 LTS | Non vérifiable | EN ATTENTE |
| **vCPU** | 8 | Non vérifiable | EN ATTENTE |
| **RAM** | 32 Go | Non vérifiable | EN ATTENTE |
| **Stockage** | 1 To (SSD+HDD) | Non vérifiable | EN ATTENTE |
| **PostgreSQL 16** | Port 5432 | Port 5432 inaccessible | NON VERIFIE |
| **PgBouncer** | Port 6432 | Port 6432 inaccessible | NON VERIFIE |
| **LUKS chiffrement** | /var/lib/postgresql | Non vérifiable | EN ATTENTE |
| **Authentification SSH** | Mot de passe | Connexion impossible | ECHEC |

**ALERTE** : La VM-DB est **totalement inaccessible** depuis le réseau. Causes possibles :
- La VM est éteinte ou en erreur sur l'hyperviseur
- Le LUKS demande une passphrase au boot (la VM pourrait être bloquée à l'invite LUKS)
- Un firewall bloque tout le trafic entrant
- L'interface réseau n'est pas correctement configurée

**Action requise** : Vérifier l'état de cette VM depuis la console de l'hyperviseur (VMware/Proxmox).

---

### 2.4 VM-CACHE (nbo-cch01) — Redis + OpenSearch

| Paramètre | Spécification | Constaté | Statut |
|---|---|---|---|
| **Adresse IP** | 10.202.101.186 | 10.202.101.186 | OK |
| **Accessibilité réseau** | Port 22 ouvert | Port 22 ouvert | OK |
| **Version OS** | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS (OpenSSH_9.6p1 Ubuntu-3ubuntu13.14) | OK |
| **vCPU** | 8 | Non vérifiable | EN ATTENTE |
| **RAM** | 32 Go | Non vérifiable | EN ATTENTE |
| **Stockage** | 200 Go SSD | Non vérifiable | EN ATTENTE |
| **Redis 7** | Port 6379 | Port 6379 fermé | NON DEPLOYE |
| **OpenSearch** | Port 9200 | Port 9200 fermé | NON DEPLOYE |
| **Authentification SSH** | Mot de passe | Rejeté | ECHEC |

**Ports scannés ouverts** : 22 (SSH uniquement)
**Ports applicatifs attendus** : 6379, 9200 — tous fermés

---

## 3. Conformité avec les Documents de Spécification

### 3.1 Points Conformes (vérifiés à distance)

| # | Exigence | Statut | Preuve |
|---|---|---|---|
| 1 | Ubuntu 24.04 LTS installé | **CONFORME** (3/4) | Banner SSH `OpenSSH_9.6p1 Ubuntu-3ubuntu13.14` |
| 2 | OpenSSH installé | **CONFORME** (3/4) | Port 22 ouvert, banner conforme |
| 3 | IP statiques configurées | **CONFORME** (3/4) | VMs répondent sur les IPs attendues |
| 4 | Profil serveur (sans GUI) | **PROBABLE** | Banner serveur SSH, pas de port X11 (6000) |

### 3.2 Points Non Vérifiables (accès SSH requis)

| # | Exigence | Source |
|---|---|---|
| 1 | LVM activé avec partitions dédiées | Guide d'installation §3-6 |
| 2 | Nombre de vCPU par VM | Spécifications §2.1 |
| 3 | RAM allouée par VM | Spécifications §2.1 |
| 4 | Partitionnement disque (ext4/XFS) | Guide d'installation §3-6 |
| 5 | /var/lib/docker sur partition 200 Go | Guide §3.1 |
| 6 | /kafka-data en XFS 400 Go | Guide §4.1 |
| 7 | LUKS sur /var/lib/postgresql | Guide §5.1 |
| 8 | vm.swappiness, vm.max_map_count | Guide §4-6 |
| 9 | Snaps non installés | Guide §2.2 |
| 10 | Docker via dépôt officiel | Guide §3.2 |
| 11 | UFW activé | Guide §2.2 |
| 12 | Auth SSH par clé uniquement | Guide §2.2 |
| 13 | nofile=100000 (VM-KAFKA) | Guide §4.2 |
| 14 | THP désactivé (VM-CACHE) | Guide §6.2 |

### 3.3 Points Non Conformes (anomalies détectées)

| # | Anomalie | Sévérité | Recommandation |
|---|---|---|---|
| 1 | **VM-DB (nbo-dbms03) inaccessible** | **CRITIQUE** | Vérifier via console hyperviseur. Possible blocage LUKS au boot. |
| 2 | **Auth SSH mot de passe échoue** | **BLOQUANT** | Vérifier le mot de passe du compte `arisadmin` depuis la console VM. Possible verrouillage du compte (fail2ban ou pam_tally2). |
| 3 | **Aucun service applicatif déployé** | **ATTENDU** | Normal si l'installation OS vient d'être faite. Le déploiement ARIS est une étape ultérieure. |

---

## 4. Informations Réseau Collectées

### 4.1 Topologie Confirmée

```
Internet
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  VLAN 10.202.101.0/24 — AU-IBAR Nairobi DC              │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ VM-APP      │  │ VM-KAFKA     │  │ VM-CACHE       │  │
│  │ .183        │  │ .184         │  │ .186           │  │
│  │ SSH OK      │  │ SSH OK       │  │ SSH OK         │  │
│  │ Auth FAIL   │  │ Auth FAIL    │  │ Auth FAIL      │  │
│  └─────────────┘  └──────────────┘  └────────────────┘  │
│                                                          │
│  ┌─────────────────────┐                                 │
│  │ VM-DB               │                                 │
│  │ .185                │                                 │
│  │ INACCESSIBLE        │                                 │
│  └─────────────────────┘                                 │
│                                                          │
│  Gateway: 10.202.101.1                                   │
│  DNS: 10.202.101.2, 10.202.101.3                         │
└──────────────────────────────────────────────────────────┘
```

### 4.2 Versions SSH Détectées

| VM | Banner SSH | Version Ubuntu déduite |
|---|---|---|
| VM-APP | `SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.14` | Ubuntu 24.04 LTS |
| VM-KAFKA | `SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.14` | Ubuntu 24.04 LTS |
| VM-DB | N/A (inaccessible) | Non confirmé |
| VM-CACHE | `SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.14` | Ubuntu 24.04 LTS |

### 4.3 Méthodes d'Authentification SSH Acceptées

| VM | Publickey | Password | Résultat |
|---|---|---|---|
| VM-APP | Oui | Oui | Les deux échouent |
| VM-KAFKA | Oui | Oui | Les deux échouent |
| VM-DB | N/A | N/A | Port 22 inaccessible |
| VM-CACHE | Oui | Oui | Les deux échouent |

---

## 5. Actions Prioritaires

### 5.1 Actions Immédiates (Requièrent Philippe / Accès Console)

| # | Action | VM | Priorité |
|---|---|---|---|
| 1 | **Vérifier l'état de VM-DB** depuis la console hyperviseur | VM-DB | CRITIQUE |
| 2 | **Vérifier/réinitialiser le mot de passe** de `arisadmin` depuis la console | Toutes | CRITIQUE |
| 3 | Si LUKS actif sur VM-DB : entrer la passphrase au boot | VM-DB | CRITIQUE |
| 4 | Copier la clé SSH publique dans `~arisadmin/.ssh/authorized_keys` | Toutes | HAUTE |
| 5 | Vérifier si fail2ban a banni notre IP (10.x.x.x) | 183/184/186 | HAUTE |

### 5.2 Clé SSH Publique à Installer

La clé publique à ajouter dans `/home/arisadmin/.ssh/authorized_keys` sur chaque VM se trouve dans :
```
C:\Users\flex zone\.ssh\id_rsa.pub
```

Commande à exécuter sur chaque VM (depuis la console) :
```bash
mkdir -p /home/arisadmin/.ssh
echo "CONTENU_DE_id_rsa.pub" >> /home/arisadmin/.ssh/authorized_keys
chmod 700 /home/arisadmin/.ssh
chmod 600 /home/arisadmin/.ssh/authorized_keys
chown -R arisadmin:arisadmin /home/arisadmin/.ssh
```

### 5.3 Actions Post-Accès (une fois SSH rétabli)

| # | Action | Commande |
|---|---|---|
| 1 | Relancer l'audit complet | `python deploy/audit_vms.py` |
| 2 | Vérifier CPU/RAM/Disque | Automatique dans le script |
| 3 | Vérifier LVM et partitionnement | Automatique dans le script |
| 4 | Vérifier kernel parameters | Automatique dans le script |
| 5 | Vérifier Docker installation | Automatique dans le script |
| 6 | Comparer avec les spécifications | Rapport auto-généré |

---

## 6. Checklist d'Installation — État Actuel

| # | Étape | VM-APP | VM-KAFKA | VM-DB | VM-CACHE |
|---|---|---|---|---|---|
| 1 | Ubuntu 24.04 LTS installé | OK | OK | ? | OK |
| 2 | LVM activé | ? | ? | ? | ? |
| 3 | OpenSSH installé | OK | OK | ? | OK |
| 4 | IP statique configurée | OK | OK | ? | OK |
| 5 | UFW activé | ? | ? | ? | ? |
| 6 | Aucun snap | ? | ? | ? | ? |
| 7 | Docker installé (VM-APP) | ? | N/A | N/A | N/A |
| 8 | /var/lib/docker 200 Go | ? | N/A | N/A | N/A |
| 9 | /kafka-data XFS (VM-KAFKA) | N/A | ? | N/A | N/A |
| 10 | nofile=100000 (VM-KAFKA) | N/A | ? | N/A | N/A |
| 11 | LUKS /var/lib/postgresql | N/A | N/A | ? | N/A |
| 12 | vm.swappiness=1 (VM-DB) | N/A | N/A | ? | N/A |
| 13 | vm.max_map_count=262144 | N/A | N/A | N/A | ? |
| 14 | THP désactivé (VM-CACHE) | N/A | N/A | N/A | ? |

**Légende** : OK = Vérifié conforme | ? = Non vérifiable (accès requis) | N/A = Non applicable

---

## 7. Fichiers de Référence

| Fichier | Emplacement | Description |
|---|---|---|
| Spécifications VMs | `deploy/ARIS_Specifications_VM_AU-IBAR_For_Hosting.docx` | Dimensionnement et architecture |
| Guide d'installation | `deploy/ARIS_Ubuntu_Installation_VMs.docx` | Procédure d'installation pas à pas |
| Paramètres de connexion | `deploy/vm-credentials.env` | IPs, credentials, paramètres réseau |
| Script d'audit | `deploy/audit_vms.py` | Script Python pour audit complet (exécuter post-accès) |
| Scan réseau | `deploy/vm_scan_results.json` | Résultats du scan de ports (9 mars 2026) |
| Ce rapport | `deploy/ARIS_VM_Audit_Report.md` | Rapport d'état complet |

---

## 8. Annexe — Paramètres de Connexion

```
Utilisateur : arisadmin
Mot de passe : @u- 1bar.0rg$U24

VM-APP    (nbo-aris04)  :  10.202.101.183  :  16 vCPU / 32 Go / 300 Go SSD
VM-KAFKA  (nbo-brk01)   :  10.202.101.184  :   8 vCPU / 16 Go / 500 Go NVMe
VM-DB     (nbo-dbms03)  :  10.202.101.185  :   8 vCPU / 32 Go / 1 To SSD+HDD
VM-CACHE  (nbo-cch01)   :  10.202.101.186  :   8 vCPU / 32 Go / 200 Go SSD

Passphrase LUKS VM-DB : (identique au mot de passe arisadmin)
Réseau : 10.202.101.0/24 — Gateway 10.202.101.1 — DNS 10.202.101.2/3
```

---

*Rapport généré le 9 mars 2026 — Audit automatisé ARIS 4.0*
*Prochaine étape : rétablir l'accès SSH puis relancer `python deploy/audit_vms.py`*
