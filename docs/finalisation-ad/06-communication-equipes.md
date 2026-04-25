# Chantier F.1 -- Communication equipes

Date: 2026-04-25

---

## Template -- Message 24h avant deploiement

### Objet : [ARIS 4.0] Deploiement chantiers A-D -- {STAGING|PRODUCTION} -- {DATE}

---

Chers collegues,

Un deploiement est prevu **{DATE a J+1} a {HEURE}** sur l'environnement **{STAGING / PRODUCTION}**.

### Perimetre du deploiement

Ce deploiement couvre les chantiers A a D de la finalisation ARIS 4.0 :

| Chantier | Description | Impact |
|----------|-------------|--------|
| A -- Sub-domains & Value Chains | Ciblage multi-domaine pour formulaires et campagnes | Nouvelles tables, pas d'impact existant |
| B -- Indicateurs refactorises | Systeme d'indicateurs unifie (remplace KPI/Statistics) | Nouvelles tables dans schema `analytics` |
| C -- Dashboard Builder | Tableaux de bord configurables avec widgets | Nouveau schema `dashboard_builder` |
| D -- Reports & Flash Alerts | Generation de rapports et alertes flash | Nouveau schema `reports` |

### Modifications techniques

- **20 nouvelles tables** dans la base de donnees
- **2 nouveaux schemas PostgreSQL** : `dashboard_builder`, `reports`
- **Aucune suppression** de donnees ou de tables existantes
- **Aucun renommage destructif** (tous les @map sont preserves)

### Duree estimee

- Backup DB : ~5 minutes
- Schema push (Prisma) : ~2 minutes
- Seeds (indicateurs, templates) : ~3 minutes
- Rebuild services : ~10 minutes
- Verification : ~5 minutes
- **Total : ~25 minutes**

### Impact sur les utilisateurs

- **Staging** : Le site test.au-aris.org sera indisponible pendant ~10 minutes pendant le rebuild des services.
- **Production** : Le site au-aris.org sera indisponible pendant ~10 minutes pendant le rebuild des services. Les soumissions en cours sur mobile ne seront PAS impactees (sync au retour du service).

### Plan de rollback

Un plan de rollback est en place :
- Dump complet de la base de donnees avant toute modification
- Revert Git possible en < 5 minutes
- Restauration DB complete en < 15 minutes

### Actions requises

- **Aucune action requise** de votre part
- Les fonctionnalites existantes ne sont pas modifiees
- Les nouvelles fonctionnalites seront accessibles apres deploiement

### Contacts

En cas de probleme pendant ou apres le deploiement :
- Equipe deploiement : [contact@au-aris.org]
- Canal Slack/Teams : #aris-deploys

Merci,
L'equipe ARIS 4.0

---

## Template -- Message post-deploiement (succes)

### Objet : [ARIS 4.0] Deploiement REUSSI -- Chantiers A-D -- {DATE}

Le deploiement des chantiers A-D a ete realise avec succes sur **{STAGING / PRODUCTION}** le {DATE} a {HEURE}.

**Resume :**
- 20 nouvelles tables creees
- 2 nouveaux schemas PostgreSQL actifs
- Seeds d'indicateurs et templates charges
- Tous les tests E2E passes

**Nouvelles fonctionnalites disponibles :**
- Dashboard Builder (tableaux de bord configurables)
- Systeme d'indicateurs unifie
- Moteur de rapports et alertes flash
- Ciblage multi-domaine pour formulaires et campagnes

L'equipe ARIS 4.0

---

## Template -- Message post-deploiement (echec / rollback)

### Objet : [ARIS 4.0] Deploiement ANNULE -- Chantiers A-D -- {DATE}

Le deploiement des chantiers A-D prevu le {DATE} a {HEURE} sur **{STAGING / PRODUCTION}** a ete annule suite a un probleme technique.

**Cause :** {description breve du probleme}

**Actions prises :**
- Base de donnees restauree a partir du dump pre-deploiement
- Code revenu au commit precedent
- Services reconstruits et verifies

**Impact :** Aucune perte de donnees. Les fonctionnalites existantes sont intactes.

**Prochaines etapes :** {description du plan correctif et nouvelle date estimee}

L'equipe ARIS 4.0
