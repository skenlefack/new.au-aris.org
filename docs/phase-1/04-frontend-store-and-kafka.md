# Frontend Store & Kafka Topics — Phase 1 fin S3

## A. Zustand Domain Store

### Etat ajoute
- `domainPermissions: Record<string, string[]>` — permissions hierarchiques
- `subDomainsMetadata: SubDomain[]` — metadata des sous-domaines
- `valueChainCodes: ValueChainCode[]` — referentiel value chains
- `hydrated: boolean` — flag d'hydratation

### Getters ajoutes
- `hasAccessToSubDomain(domainCode, subDomainCode)` — check granulaire
- `hasAccessToValueChain(valueChainCode)` — check transverse
- `getSubDomainsOfDomain(domainCode)` — liste filtree + triee
- `getSubDomainsByValueChain(valueChainCode)` — vue transverse
- `getAccessibleValueChainCodes()` — codes accessibles

### Hydratation
Au mount du dashboard layout, appel `GET /api/v1/credential/me/access` pour hydrater.

### Hooks utilitaires
- `useSubDomains(domainCode)` — sous-domaines d'un domaine
- `useValueChainSubDomains(valueChainCode)` — vue transverse
- `useAccessibleValueChains()` — value chains avec metadata

## B. Kafka Topics

### Topics sub-domain ajoutes
- `sys.credential.subdomain.created.v1`
- `sys.credential.subdomain.updated.v1`
- `sys.credential.subdomain.deleted.v1`
- `sys.credential.subdomain.activated.v1`
- `sys.credential.subdomain.deactivated.v1`

### Helper dynamique
```ts
domainSubDomainTopic('ms', 'livestock-prod', 'dairy', 'metric.updated')
// → 'ms.livestock-prod.dairy.metric.updated.v1'
```

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| `apps/web/src/lib/stores/domain-store.ts` | Store etendu avec hierarchie |
| `apps/web/src/hooks/use-sub-domains.ts` | Nouveau : hooks utilitaires |
| `apps/web/src/app/(dashboard)/layout.tsx` | Hydratation /me/access |
| `packages/shared-types/src/kafka/topic-names.ts` | Topics + helper dynamique |
