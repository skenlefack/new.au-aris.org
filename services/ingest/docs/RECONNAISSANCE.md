# Service Ingest — Rapport de Reconnaissance (Lot 0)

**Date :** 2026-09-25
**Auteur :** CC-1 / CC-5

---

## 1. Structure du monorepo

### Services existants (35)

```
services/
  ai-orchestrator    analytics          analytics-worker   animal-health
  apiculture         climate-env        collecte           credential
  data-contract      data-quality       data-sharing       datalake
  drive              fisheries          form-builder       geo-services
  governance         interop            interop-hub        knowledge-hub
  livestock-prod     master-data        message            offline
  python-ml          realtime           support            tenant
  trade-sps          wildlife           workflow
```

**Port suivant disponible : 3046** (dernier utilisé : OFFLINE_PORT=3045).

### Packages partagés (11)

```
packages/
  access-control     auth-middleware    cache              db-schemas
  i18n               kafka-client       observability      quality-rules
  service-clients    shared-types       test-utils         ui-components
```

### Service de référence : `collecte/`

```
services/collecte/
├── src/
│   ├── main.ts                    # dotenv + OTEL + buildApp()
│   ├── app.ts                     # Fastify + CORS + Helmet + Prisma + Kafka + Auth
│   ├── plugins/prisma.ts          # PrismaClient lifecycle plugin
│   ├── routes/                    # campaigns.ts, submissions.ts, sync.ts, workflow.ts
│   ├── services/                  # campaign.service.ts, submission.service.ts, sync.service.ts, workflow-engine.service.ts
│   ├── schemas/                   # TypeBox schemas (campaign, submission, sync, workflow)
│   ├── campaign/entities/         # TypeScript interfaces
│   └── seed/                      # Seed data scripts
├── test/                          # Integration & E2E specs
├── package.json
├── tsconfig.json
├── vitest.config.ts               # Unit tests (src/**/*.spec.ts)
└── vitest.integration.config.ts   # Integration tests (60s timeout)
```

---

## 2. Schéma Prisma — modèles pertinents

### FormTemplate (`form_builder` schema)

```
id, tenant_id, name, domain, form_type (CAMPAIGN|EVENT_ALERT|PAID),
version, parent_template_id, schema (JSON), ui_schema (JSON),
status (DRAFT|PUBLISHED|ARCHIVED), data_classification, created_by
```

- **schema** : JSON structuré avec `sections[].fields[]`, chaque champ ayant `id, type, code, label (i18n), required, validation, properties`.
- **Types de champs** : `text, number, date, time, select, checkbox, radio, boolean, textarea, file-upload, geo-selector, admin-location, master-data-select, repeater, species-selector, disease-selector, photo-capture, signature-pad, lab-result-panel`.
- **Relation** : `FormTarget[]` (multi-domaine), `FormOverlay[]` (personnalisations tenant), `FormExtension[]` (ajouts campagne).

### Submission (`public` schema)

```
id, tenant_id, campaign_id, template_id, data (JSON), submitted_by,
status (DRAFT|SUBMITTED|VALIDATING|VALIDATED|REJECTED|RETURNED|CONFLICT),
data_classification, version, conflict_status, geo_zone_id
```

### CollectionCampaign (`public` schema)

```
id, code, name (JSON i18n), domain, form_template_id, form_template_ids[],
status (PLANNED|ACTIVE|COMPLETED|CANCELLED), scope, start_date, end_date,
target_countries (JSON), target_submissions
```

### Extensions PostgreSQL installées

| Extension | Présente | Usage pour Ingest |
|-----------|----------|-------------------|
| `PostGIS 3.4` | Oui | Non directement |
| `uuid-ossp` | Oui | Génération UUID |
| `pg_trgm` | **Oui** | Similarité lexicale (cascade niveau 1) |
| `pgvector` | **Non** | Embeddings vectoriels — **à installer ou utiliser OpenSearch** |

**Constat critique :** `pgvector` n'est pas installé. Les embeddings vectoriels devront passer par **OpenSearch** (kNN native) ou par ajout de l'extension. Je recommande OpenSearch pour éviter une migration PG.

---

## 3. Infrastructure disponible

### MinIO (`services/drive/`)

- Client : `minio` npm package, wrapper dans `services/drive/src/services/minio.storage.ts`.
- Buckets : `aris-{tenantId}`, objets préfixés par domaine.
- Opérations : `putObject`, `getObject`, `deleteObject`, `getPresignedUploadUrl`, `getPresignedDownloadUrl`.
- Évènement Kafka : `sys.drive.file.uploaded.v1`.
- **Réutilisable** : le wrapper MinIO est dans le service drive, pas dans un package partagé. Ingest devra importer `minio` directement ou extraire un client.

### OpenSearch

- Client : `@opensearch-project/opensearch` dans `packages/cache/src/opensearch.client.ts`.
- Index existant : `aris-knowledge` (publications multilingues).
- Capacités : multi-match fuzzy, analyseurs FR/EN/PT/AR, agrégations, highlights.
- **kNN natif** : OpenSearch 2.17 supporte kNN pour les vecteurs d'embeddings — pas besoin de pgvector.

### Redis

- Package : `@aris/cache` avec helpers domain-aware.
- Opérations : `set/get/del/delByPattern`, `acquireLock/releaseLock`, `getOrSet`.
- TTL configurable par type de données.
- Verrous distribués pour opérations concurrentes.

### Kafka

- Package : `@aris/kafka-client` avec `StandaloneKafkaProducer` et `StandaloneKafkaConsumer`.
- Headers : `correlationId, sourceService, tenantId, userId, schemaVersion, timestamp`.
- DLQ : retry avec backoff, `x-retry-count`, `x-original-topic`, envoi vers `dlq.*.v1`.
- 3 brokers KRaft, replication factor 3, auto-create désactivé.

### AI Orchestrator (`services/ai-orchestrator/`)

- Client Ollama : `services/ai-orchestrator/src/clients/ollama.client.ts`.
- Endpoint : `OLLAMA_URL` → `http://10.202.101.142:11434`.
- Modèle par défaut : `qwen2.5:32b`.
- Timeout : 10 minutes (CPU inference ~1-3 tok/s).
- Client ML : `services/ai-orchestrator/src/clients/ml.client.ts` — XGBoost, Isolation Forest, NLP.
- **GPU** : non confirmé (mémoire indique 30 Go RAM, 16 vCPU). À vérifier sur le serveur.

---

## 4. API de soumission (Collecte) — contrat R1

### Soumission unique

```
POST /api/v1/collecte/submissions
Body: {
  campaignId: string (UUID, requis),
  data: Record<string, unknown> (requis),
  deviceId?: string,
  gpsLat?: number, gpsLng?: number, gpsAccuracy?: number,
  offlineCreatedAt?: string (ISO),
  dataClassification?: "PUBLIC"|"PARTNER"|"RESTRICTED"|"CONFIDENTIAL"
}
Response: 201 { data: SubmissionEntity }
```

Validation :
1. Campagne doit exister et être ACTIVE
2. Tenant isolation (owner ou pays ciblé)
3. Fenêtre temporelle (start_date → end_date + 24h)
4. Validation JSON Schema du template
5. Post-creation : quality gates Kafka → workflow

### Soumission batch (sync)

```
POST /api/v1/collecte/sync
Body: {
  submissions: [{ campaignId, data, id?, version?, ... }],
  lastSyncAt: string (ISO)
}
Response: { accepted: string[], rejected: [], conflicts: [], serverUpdates: [], syncedAt: string }
```

**Ingest devra utiliser l'endpoint single** (`POST /submissions`) en boucle ou le batch sync. Le single est plus simple et déclenche la chaîne qualité/workflow complète.

---

## 5. Auth middleware

- Package : `@aris/auth-middleware`
- JWT RS256 vérifié via clé publique (`JWT_PUBLIC_KEY_PATH`)
- `AuthenticatedUser` :
  ```typescript
  { userId, email, role, roles[], tenantId, tenantLevel, locale?, domains: Record<string, string[]> }
  ```
- Hooks Fastify : `authHook()` (JWT), `tenantHook()`, `rolesHook(...)`, `domainsHook(...)`
- Helpers : `hasAccessToDomain(user, code)`, `hasAccessToSubDomain(user, code, subCode)`
- Admin bypass : `SUPER_ADMIN`, `CONTINENTAL_ADMIN`

---

## 6. Chaîne de tests

- Runner : **Vitest** (v1.6.x)
- Unit : `src/**/*.spec.ts`, mocks Prisma/Kafka
- Integration : `test/**/*.integration.spec.ts`, Testcontainers (PG 16, Kafka 7.6, Redis 7)
- Factories : `@aris/test-utils` — `createMockUser()`, `createMockSubmission()`, `createMockTenant()`
- Couverture : provider v8, cible >80%

---

## 7. Frontend Next.js

- App Router (`apps/web/src/app/`)
- State : Zustand (stores dans `lib/stores/`)
- API : React Query (hooks dans `lib/api/`)
- Composants : shadcn/ui + composants custom dans `components/`
- i18n : 6 langues (`apps/web/src/messages/{en,fr,ar,pt,es,sw}.json`)
- Pattern page settings : card grid, inline forms, toasts via `useRealtimeStore`

---

## 8. Écarts entre le prompt et la réalité du code

| Point du prompt | Réalité observée | Impact |
|-----------------|------------------|--------|
| JWT `domains` contient des codes comme `ANIMAL_HEALTH` | Le code utilise `animal-health` (kebab-case), pas SCREAMING_SNAKE | Adapter le dictionnaire d'alias |
| `pgvector` mentionné comme possible | **Non installé** — seuls `postgis`, `uuid-ossp`, `pg_trgm` | Utiliser OpenSearch kNN pour les embeddings |
| Schéma `collecte` pour les tables campaigns/submissions | Les tables sont dans le schéma `public`, pas `collecte` | Impact mineur sur les requêtes SQL brutes |
| Services : "dix-septième microservice" | Il y a déjà 35 services (Ingest sera le 36e) | Aucun impact |
| GPU sur nbo-ai01 | Non confirmé (30 Go RAM, 16 vCPU dans la mémoire) | Prévoir inference CPU-only |
| bge-m3 pour les embeddings | Non déployé actuellement sur Ollama | À déployer en lot 1 |

---

## 9. Points de raccordement identifiés

| Composant | Service | API / Mécanisme |
|-----------|---------|-----------------|
| Dépôt fichier | **MinIO** | Client `minio` direct, bucket `aris-{tenantId}` |
| Catalogue formulaires | **FormBuilder** | `GET /api/v1/form-builder/templates?status=PUBLISHED&domainCode=X` |
| Schéma formulaire | **FormBuilder** | `GET /api/v1/form-builder/templates/:id` → `.schema.sections[].fields[]` |
| Création soumission | **Collecte** | `POST /api/v1/collecte/submissions` (une par ligne) |
| Campagnes actives | **Collecte** | `GET /api/v1/collecte/campaigns?status=ACTIVE&domain=X` |
| Référentiels | **MasterData** | `GET /api/v1/master-data/species`, `/diseases`, `/geo` |
| Droits utilisateur | **JWT** | `user.domains`, `user.tenantId`, `user.role` |
| Embeddings vectoriels | **OpenSearch** | Index `aris-form-signatures`, kNN search |
| LLM annotation | **Ollama** | Client HTTP direct vers `OLLAMA_URL` |
| Notifications | **Kafka** → Message service | Topic `sys.message.notification.sent.v1` |
| Audit | **Prisma** | Table `audit.audit_log` |

---

## 10. Questions (maximum 7)

**Q1.** Le service Ingest doit-il créer son propre schéma PostgreSQL (`ingest`) ou utiliser le schéma `public` comme Collecte ? Je recommande `ingest` pour l'isolation, mais cela nécessite une modification de `init-databases.sql` et de `schema.prisma`.

**Q2.** Pour l'API de soumission en batch : Ingest doit-il appeler `POST /collecte/submissions` une fois par ligne (simple, ~50 req/s) ou utiliser `POST /collecte/sync` (batch, mais conçu pour le mobile) ? La première option est plus propre mais plus lente pour 200K lignes.

**Q3.** Le modèle d'embeddings `bge-m3` doit-il être déployé sur Ollama (nbo-ai01) ou comme un service Python séparé sur la même VM ? Ollama gère nativement les embeddings via `/api/embeddings`, mais bge-m3 n'est pas dans le catalogue Ollama standard.

**Q4.** Les fichiers déposés doivent-ils être scannés par un antivirus (ClamAV) avant parsing ? Si oui, ClamAV doit être ajouté à l'infrastructure Docker. Si non, la validation se limite aux magic bytes et au type MIME.

**Q5.** Le prompt mentionne Row-Level Security (RLS) PostgreSQL comme quatrième niveau d'isolation. RLS n'est activé sur aucune table existante dans ARIS. Doit-on l'implémenter pour Ingest uniquement (précurseur) ou reporter à un chantier global ?

**Q6.** Pour le lot 3 (génération de brouillon de formulaire), le brouillon doit-il être créé via l'API FormBuilder (`POST /form-builder/templates`) ou directement en base dans le schéma `form_builder` ? L'API est la voie propre mais requiert les droits `WRITE_ROLES`.

**Q7.** Le port 3046 est-il confirmé pour le service Ingest, ou un autre port est-il préféré ?
