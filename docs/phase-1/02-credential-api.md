# Credential API — Sub-Domains & Permissions (Phase 1 S2)

**Date** : 2026-04-24

## Endpoints

### Admin CRUD (SUPER_ADMIN, CONTINENTAL_ADMIN, REC_ADMIN, NATIONAL_ADMIN)

```bash
# Create sub-domain
curl -X POST https://au-aris.org/api/v1/credential/admin/sub-domains \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"BUFFALO","domainCode":"livestock-prod","valueChainCode":null,"labelFr":"Buffle","labelEn":"Buffalo","typeEnum":"VALUE_CHAIN","active":true,"displayOrder":55}'

# Update sub-domain
curl -X PATCH https://au-aris.org/api/v1/credential/admin/sub-domains/:id \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"active":false}'

# Delete sub-domain
curl -X DELETE https://au-aris.org/api/v1/credential/admin/sub-domains/:id \
  -H "Authorization: Bearer $TOKEN"

# List with filters
curl "https://au-aris.org/api/v1/credential/admin/sub-domains?domainCode=livestock-prod&active=true&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

### Consultation (tout user authentifie)

```bash
# Sub-domains d'un domaine
curl https://au-aris.org/api/v1/credential/domains/livestock-prod/sub-domains \
  -H "Authorization: Bearer $TOKEN"

# Vue transverse par value chain code
curl https://au-aris.org/api/v1/credential/value-chain-codes/DAIRY/sub-domains \
  -H "Authorization: Bearer $TOKEN"

# Structure complete d'acces de l'utilisateur courant
curl https://au-aris.org/api/v1/credential/me/access \
  -H "Authorization: Bearer $TOKEN"
```

## Kafka Events

| Topic | Emis quand |
|-------|-----------|
| `sys.credential.subdomain.created.v1` | Creation |
| `sys.credential.subdomain.updated.v1` | Mise a jour (hors active) |
| `sys.credential.subdomain.activated.v1` | `active` passe a `true` |
| `sys.credential.subdomain.deactivated.v1` | `active` passe a `false` |
| `sys.credential.subdomain.deleted.v1` | Suppression |

## Permission Resolution

Le champ `User.permissions` (JSON) definit l'acces aux sous-domaines :

```json
{
  "livestock-prod": ["DAIRY", "RED_MEAT"],
  "trade-sps": ["*"],
  "governance": ["LABORATORIES"]
}
```

- `["*"]` = tous les sous-domaines actifs du domaine
- Liste explicite = uniquement ces codes (et actifs)
- Sous-domaines inactifs = jamais retournes
- SUPER_ADMIN / CONTINENTAL_ADMIN = acces total

## Fichiers

| Fichier | Role |
|---------|------|
| `services/credential/src/services/subdomain.service.ts` | CRUD + Kafka events |
| `services/credential/src/services/permission-resolver.ts` | Resolution permissions user → sous-domaines |
| `services/credential/src/routes/subdomain.routes.ts` | Endpoints REST |
| `services/credential/src/schemas/subdomain.schemas.ts` | Validation TypeBox |
| `packages/db-schemas/prisma/credential.prisma` | Champ `permissions` sur User |
