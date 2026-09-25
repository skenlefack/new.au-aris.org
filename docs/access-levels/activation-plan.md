# Plan d'activation progressive — Domain Access Levels

**Date :** 2026-09-25

---

## Phase 1 : Deploiement du code (flag OFF)

**Duree :** 1 jour

1. Deployer le code sur staging (`ACCESS_LEVELS_ENABLED=false`)
2. Executer `prisma db push` pour creer les 3 tables :
   - `governance.domain_access_levels`
   - `public.user_scope_access_levels`
   - `public.campaign_scope_access_levels`
3. Verifier que **aucun** comportement n'a change (flag OFF = bypass)
4. Executer les tests E2E existants — tous doivent passer

---

## Phase 2 : Configuration pilote (flag OFF)

**Duree :** 2-3 jours

1. Sur staging, creer les niveaux d'acces pour 1 domaine pilote (ex: `animal-health`)
   - Exemples : `TERRAIN`, `LABORATOIRE`, `EPIDEMIOLOGIE`, `ENCADREMENT`
2. Affecter les niveaux a quelques utilisateurs de test
3. Configurer 2-3 campagnes de test avec des niveaux
4. Verifier en base que les donnees sont correctes

---

## Phase 3 : Activation staging

**Duree :** 3-5 jours

1. Activer le flag : `ACCESS_LEVELS_ENABLED=true` sur staging
2. Verifier avec 4 profils types :
   - **Admin continental** → voit tout (bypass)
   - **Agent terrain** avec `TERRAIN` sur `animal-health` → voit campagnes ouvertes + campagnes TERRAIN
   - **Epidemiologiste** avec `EPIDEMIOLOGIE` → ne voit PAS les campagnes TERRAIN-only
   - **Utilisateur sans niveaux** sur `animal-health` → ne voit que les campagnes ouvertes
3. Verifier le mobile : sync, revocation, soumissions preservees
4. Verifier analytics : domain-summary filtre par acces
5. Mesurer la performance (objectif p95 < 150ms)

---

## Phase 4 : Activation production

**Duree :** 1 jour

1. Deployer le code sur production (flag deja OFF en prod)
2. Executer `prisma db push` pour creer les tables
3. Creer les niveaux d'acces pour les domaines prioritaires
4. Affecter les niveaux aux utilisateurs
5. Activer le flag : `ACCESS_LEVELS_ENABLED=true`
6. Monitorer les metriques Grafana pendant 24h

---

## Phase 5 : Extension

**Duree :** Continue

1. Etendre les niveaux aux autres domaines
2. Former les administrateurs nationaux
3. Surveiller les tickets de support
4. Ajuster les niveaux selon les retours terrain

---

## Rollback

En cas de probleme :
1. Desactiver le flag : `ACCESS_LEVELS_ENABLED=false`
2. Redemarrer les services concernes (`collecte`, `tenant`)
3. Tous les utilisateurs retrouvent la visibilite d'avant
4. Les donnees (niveaux, affectations, scopes campagnes) restent en base — rien n'est perdu
5. Diagnostiquer et corriger avant de reactiver

---

## EXPLAIN ANALYZE — Requete de reference

Requete de filtrage des campagnes avec access-levels sur un jeu realiste :

```sql
-- Prerequis: >= 10 000 campagnes, >= 50 000 affectations

EXPLAIN ANALYZE
SELECT c.*
FROM public.campaigns c
WHERE c.domain IN ('animal-health', 'livestock-prod')
  AND c.status = 'ACTIVE'
  AND c.tenant_id = 'tenant-uuid'
  AND NOT EXISTS (
    SELECT 1 FROM public.campaign_scope_access_levels csal
    WHERE csal.campaign_id = c.id
  )
  OR EXISTS (
    SELECT 1 FROM public.campaign_scope_access_levels csal
    WHERE csal.campaign_id = c.id
      AND csal.node_code = 'animal-health'
      AND csal.level_code IN ('TERRAIN', 'LABORATOIRE')
  )
ORDER BY c.created_at DESC
LIMIT 20;
```

### Index en place

```sql
-- Deja crees par Prisma
CREATE UNIQUE INDEX uq_dal_node_code ON governance.domain_access_levels(node_code, code);
CREATE INDEX idx_dal_node_active ON governance.domain_access_levels(node_code, is_active);
CREATE INDEX idx_usal_node_level ON public.user_scope_access_levels(node_code, level_code);
CREATE INDEX idx_csal_node_level ON public.campaign_scope_access_levels(node_code, level_code);

-- Index existants sur campaigns
CREATE INDEX idx_campaign_domain ON public.campaigns(domain);
CREATE INDEX idx_campaign_status ON public.campaigns(status);
CREATE INDEX idx_campaign_tenant_id ON public.campaigns(tenant_id);
```

### Cible de performance

| Metrique | Cible | Methode |
|----------|-------|---------|
| p95 liste campagnes | < 150ms | `EXPLAIN ANALYZE` sur staging |
| p95 detail campagne | < 50ms | Requete simple + 1 lookup scopes |
| p95 sync delta | < 200ms | Post-filter en memoire sur ≤ 50 campagnes |

Le filtrage access-levels ajoute au plus 2 requetes supplementaires (userScopes + campaignScopes) qui sont indexees et rapides. Le post-filter `canViewCampaign()` est une fonction pure O(N*M) ou N = noeuds campagne et M = noeuds utilisateur, typiquement < 10.
