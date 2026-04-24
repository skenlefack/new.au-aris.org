# Runbook : Migration JWT hierarchique — ARIS 4.0

## Contexte
Migration du format JWT `domains: string[]` vers `domains: Record<string, string[]>`.
Bascule propre : tous les utilisateurs seront deconnectes et recevront le nouveau format au re-login.

## Pre-requis
- Phase 1 S1 (schema sub_domains) deployee
- Phase 1 S2 (credential API) deployee
- User.permissions (JSON) deja en base (S2)

## Etapes de deploiement

### 1. Git pull sur APP
```bash
cd /opt/aris && git pull origin main
```

### 2. Rebuild les services impactes
```bash
# Staging
cd /opt/aris-deploy/vm-app-stg
docker compose up -d --build --no-deps credential collecte web

# Production
cd /opt/aris-deploy/vm-app
docker compose up -d --build --no-deps credential collecte web
```

### 3. Invalider toutes les sessions Redis
```bash
python deploy/scripts/_invalidate_sessions.py
```
Cela supprime tous les `refresh:*` et `blacklist:*` dans Redis.

### 4. Verification
- Se connecter : le JWT contient `domains: { "livestock-prod": ["*"], ... }`
- Decoder le JWT sur jwt.io pour verifier le format
- Les routes protegees par `domainsHook()` fonctionnent

## Rollback
Pas de rollback prevu (bascule propre). En cas de probleme :
1. Revert le commit sur auth-middleware
2. Rebuild credential + tous les services
3. Re-invalider les sessions

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| `packages/auth-middleware/src/interfaces/jwt-payload.interface.ts` | `domains: Record<string, string[]>` |
| `packages/auth-middleware/src/fastify/auth.hook.ts` | `domains: payload.domains ?? {}` |
| `packages/auth-middleware/src/guards/auth.guard.ts` | Idem (NestJS) |
| `packages/auth-middleware/src/fastify/domains.hook.ts` | `d in userDomains` |
| `packages/auth-middleware/src/permissions.ts` | Nouveau : helpers |
| `services/credential/src/services/auth.service.ts` | `generateTokens()` + `login()` + `refresh()` |
| `services/collecte/src/services/campaign.service.ts` | `Object.keys(user.domains)` |
| `apps/web/src/lib/api/hooks.ts` | Compatible array + object |
