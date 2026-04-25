# Chantier F.1 -- Plan de rollback

Date: 2026-04-25

## Vue d'ensemble

Les chantiers A-D sont 100% additifs (nouvelles tables, nouveaux schemas, nouveaux enums). Aucune modification destructive. Le rollback est donc simple : les nouvelles tables peuvent etre ignorees par l'ancien code sans impact.

---

## Scenario A : Echec en staging

### Symptomes
- `prisma db push` echoue (erreur de permissions, schema invalide, timeout)
- Seeds echouent (FK violations, contrainte unique, container inaccessible)
- Service ne demarre pas apres deploiement

### Procedure

1. **Arreter immediatement** le deploiement en cours
   ```bash
   # Sur VM-APP-STG (10.202.101.146)
   cd /opt/aris-deploy/vm-app-stg
   docker compose stop web credential analytics
   ```

2. **Restaurer le dump PostgreSQL** (pris avant le deploiement par le script)
   ```bash
   # Sur VM-DB-STG (10.202.101.148)
   # Identifier le dump le plus recent
   ls -la /tmp/aris_stg_backup_*.sql.gz

   # Restaurer
   docker exec -i aris-stg-postgres bash -c \
     "gunzip -c /tmp/aris_stg_backup_YYYYMMDD_HHMMSS.sql.gz | psql -U aris -d aris"
   ```

3. **Revenir au commit precedent**
   ```bash
   # Sur VM-APP-STG (10.202.101.146)
   cd /opt/aris
   sudo git log --oneline -5   # noter le commit pre-deploiement
   sudo git reset --hard <commit-pre-deploy>
   ```

4. **Reconstruire les services**
   ```bash
   cd /opt/aris-deploy/vm-app-stg
   sudo docker compose up -d --build --no-deps web credential analytics
   ```

5. **Verifier**
   - Login: `curl -X POST https://test.au-aris.org/api/v1/credential/auth/login`
   - Dashboard: `https://test.au-aris.org/`

### Temps estime : 15-20 minutes

---

## Scenario B : Echec en production

### Symptomes
- Service en erreur apres deploiement (500, crash loop)
- Donnees corrompues (tres improbable car pas de migration destructive)
- Performance degradee

### Procedure

1. **Activer la page de maintenance** (optionnel, si Traefik est configure)
   ```bash
   # Sur VM-APP (10.202.101.183)
   cd /opt/aris-deploy/vm-app
   # Mettre le service web en pause
   sudo docker compose stop web
   ```

2. **Restaurer le dump PostgreSQL**
   ```bash
   # Sur VM-DB (10.202.101.185)
   # Le script cree un dump horodate avant toute modification
   ls -la /tmp/aris_prod_backup_*.sql.gz

   # Restaurer (ATTENTION: arrete les connexions actives)
   docker exec aris-postgres psql -U aris -d aris \
     -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='aris' AND pid <> pg_backend_pid();"

   docker exec -i aris-postgres bash -c \
     "gunzip -c /tmp/aris_prod_backup_YYYYMMDD_HHMMSS.sql.gz | psql -U aris -d aris"
   ```

3. **Revert du code**
   ```bash
   # Sur VM-APP (10.202.101.183)
   cd /opt/aris
   sudo git log --oneline -5
   sudo git reset --hard <commit-pre-deploy>
   ```

4. **Reconstruire les images Docker**
   ```bash
   cd /opt/aris-deploy/vm-app
   sudo docker compose up -d --build --force-recreate web credential analytics
   ```

5. **Verifier la production**
   ```bash
   # Test login
   curl -sf -X POST http://localhost:3002/api/v1/credential/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"admin@au-aris.org","password":"Aris2026@@4!0"}'

   # Test API
   curl -sf http://localhost:3003/api/v1/master-data/geo/countries | head -c 200

   # Test frontend
   curl -sf -o /dev/null -w "%{http_code}" https://au-aris.org/
   ```

6. **Communication** : informer les equipes que le deploiement est annule (voir 06-communication-equipes.md)

### Temps estime : 20-30 minutes

---

## Scenario C : Regression fonctionnelle (hotfix sans rollback total)

### Symptomes
- Les nouvelles fonctionnalites (Dashboard Builder, Reports, Indicators) ont un bug
- Les fonctionnalites existantes continuent de marcher
- Pas de corruption de donnees

### Procedure

1. **Diagnostiquer** le probleme
   ```bash
   # Logs du service concerne
   docker logs --tail 100 aris-web
   docker logs --tail 100 aris-credential
   docker logs --tail 100 aris-analytics
   ```

2. **Hotfix local** : corriger le bug dans le code source
   ```bash
   # Sur la machine de dev
   git checkout -b hotfix/chantier-ad-fix
   # ... corriger ...
   git commit -m "fix: <description du probleme>"
   git push origin hotfix/chantier-ad-fix
   # Merge dans main via PR
   ```

3. **Deployer le hotfix** (sans toucher a la DB)
   ```bash
   # Sur VM-APP (prod ou staging)
   cd /opt/aris
   sudo git pull origin main
   cd /opt/aris-deploy/vm-app
   sudo docker compose up -d --build --no-deps <service-concerne>
   ```

4. **Desactiver temporairement** la fonctionnalite si le hotfix prend du temps :
   - Dashboard Builder : masquer l'onglet dans le menu (feature flag dans settings)
   - Reports : desactiver la route dans Traefik ou dans le code
   - Indicators : les donnees restent en DB, pas de risque

### Temps estime : 30 minutes - 2 heures selon la complexite du bug

---

## Checklist pre-deploiement

- [ ] Dump DB staging realise et verifie
- [ ] Dump DB production realise et verifie
- [ ] Commit de reference (pre-deploy) note
- [ ] Tests E2E passes sur staging
- [ ] Equipes informees (voir 06-communication)
- [ ] Acces SSH verifie sur les 4 VMs
- [ ] Espace disque suffisant pour le dump (>2GB libre sur VM-DB)

## Contacts d'urgence

| Role | Contact | Action |
|------|---------|--------|
| DevOps | Equipe CC-1 | Rollback infrastructure |
| DBA | Equipe CC-2 | Restauration DB |
| Frontend | Equipe CC-5 | Hotfix UI |
| Coordination | Chef de projet | Decision go/no-go |
