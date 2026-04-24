# Diagnostic JWT Migration — ARIS 4.0

**Date** : 2026-04-25
**Objectif** : Migrer `domains: string[]` vers `domains: Record<string, string[]>` dans le JWT

## 1. Issuance JWT

| Fichier | Ligne | Methode | Impact |
|---------|:-----:|---------|--------|
| `services/credential/src/services/auth.service.ts` | 386-392 | `generateTokens()` | **Modifier** : `domains` passe de `string[]` a `Record<string, string[]>` |
| meme fichier | 223-224 | `login()` | Source : `domainService.getUserDomainCodes()` → remplacer par `user.permissions` |
| meme fichier | 296-297 | `refresh()` | Idem : relire `user.permissions` au lieu de `getUserDomainCodes()` |

## 2. Validation JWT

| Fichier | Ligne | Impact |
|---------|:-----:|--------|
| `packages/auth-middleware/src/interfaces/jwt-payload.interface.ts` | 3-25 | **Modifier** : `domains?: string[]` → `domains?: Record<string, string[]>` |
| `packages/auth-middleware/src/fastify/auth.hook.ts` | 45-67 | **Modifier** : typage du champ `domains` |
| `packages/auth-middleware/src/guards/auth.guard.ts` | 45-65 | **Modifier** : typage du champ `domains` (NestJS) |

## 3. Consumers du champ `domains`

### 3.1. Access control hook — `domainsHook()`
| Fichier | Ligne | Code actuel | Modification |
|---------|:-----:|-------------|-------------|
| `packages/auth-middleware/src/fastify/domains.hook.ts` | 30 | `userDomains.includes(d)` | → `d in user.domains` (check clef) |

### 3.2. Services metier (~40 routes)
Tous utilisent `domainsHook('animal-health')`, `domainsHook('wildlife')`, etc. Une fois le hook modifie, ces routes fonctionnent sans changement.

### 3.3. Filtrage dans le code
| Fichier | Ligne | Code actuel |
|---------|:-----:|-------------|
| `services/collecte/src/services/campaign.service.ts` | 280-285 | `where['domain'] = { in: userDomains }` → `{ in: Object.keys(user.domains) }` |

### 3.4. Frontend
| Fichier | Ligne | Usage |
|---------|:-----:|-------|
| `apps/web/src/lib/api/hooks.ts` | 317-319 | `setUserDomains(user.domains)` — adapte la shape |
| `apps/web/src/app/(dashboard)/settings/users/page.tsx` | 1152-1160 | Affichage badges — lit `user.domains` du endpoint, pas du JWT |

### 3.5. Login response (`TokenResponse`)
| Fichier | Ligne | Champ |
|---------|:-----:|-------|
| `services/credential/src/services/auth.service.ts` | 28-45 | `domains: Array<{...}>` dans la reponse user — **pas le JWT**, pas de changement |

## 4. Refresh tokens
- Pattern Redis : `refresh:<userId>:<tokenId>` avec TTL 7 jours
- Invalidation : `redis.keys('refresh:*')` puis `redis.del()`
- Le refresh relit les domainCodes → modifier pour lire `user.permissions`

## 5. Champ `User.permissions`
**Deja present** en DB (`credential.prisma` ligne 46) : `permissions Json?`
Ajoute en Phase 1 S2. Aucune migration DB necessaire.

## 6. Plan de modifications

| # | Fichier | Type |
|---|---------|------|
| 1 | `packages/auth-middleware/src/interfaces/jwt-payload.interface.ts` | Modifier types |
| 2 | `packages/auth-middleware/src/fastify/auth.hook.ts` | Modifier typage |
| 3 | `packages/auth-middleware/src/guards/auth.guard.ts` | Modifier typage |
| 4 | `packages/auth-middleware/src/fastify/domains.hook.ts` | Modifier logique |
| 5 | `services/credential/src/services/auth.service.ts` | Modifier `generateTokens()` + `refresh()` |
| 6 | `services/collecte/src/services/campaign.service.ts` | Modifier filtrage |
| 7 | `apps/web/src/lib/api/hooks.ts` | Adapter shape |

**Total : 7 fichiers a modifier**
