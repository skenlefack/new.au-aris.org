# Chantier E -- Plateforme IA/ML complete -- Completion Report

## 7 cas d'usage livres

| # | Cas | Statut | Stack |
|---|-----|--------|-------|
| 1 | Prediction epidemique | Code livre | XGBoost + Python ML |
| 2 | Detection anomalies | Code livre | Isolation Forest + Python ML |
| 3 | NLP classification | Code livre | Ollama Qwen/Phi-4 |
| 4 | Analyse spatiale | Code livre | HDBSCAN + Python ML |
| 5 | Generation assistee | Code livre | Ollama Qwen + ai-orchestrator |
| 6 | ETL interop | Templates NiFi | NiFi 2.x |
| 7 | Code assist | Code livre | Ollama Coder |

## Architecture livree

### VM-APP (nbo-aris04)
- ai-orchestrator-service (port 3035) : 7 routers, RBAC, cache, audit
- Frontend : AiSuggestionDialog dans 4 builders, console admin

### VM-AI (nbo-ai01)
- Ollama : Qwen 2.5-32B + Coder + Phi-4
- Python ML service (port 8000) : predictions, anomalies, spatial, NLP
- NiFi (port 8443) : ETL flows
- Prometheus + Grafana : monitoring

## Composants livres

### Schemas Prisma (ai-orchestrator.prisma)
- `AiUsageLog` -- audit de chaque appel IA
- `AiGenerationDraft` -- brouillons generes par IA (forms, campaigns, indicators, dashboards)
- `MlModel` -- registre des modeles ML (type, version, status, metriques, artefact)
- `MlTrainingJob` -- historique des jobs d'entrainement (duree, lignes, erreurs)

### Python ML Service (services/python-ml/)
- `routes/predictions.py` -- predictions epidemiques (XGBoost)
- `routes/anomalies.py` -- detection anomalies (Isolation Forest)
- `routes/spatial.py` -- clustering spatial (HDBSCAN)
- `routes/nlp.py` -- classification NLP (Ollama)
- `routes/health.py` -- health check
- `models/epidemic_predictor.py` -- modele XGBoost
- `models/anomaly_detector.py` -- modele Isolation Forest
- `models/spatial_clusterer.py` -- modele HDBSCAN
- `models/ollama_client.py` -- client Ollama
- `training/data_loader.py` -- chargement donnees PostgreSQL
- `training/trainer.py` -- pipeline d'entrainement generique
- `training/scheduler.py` -- scheduler nocturne (02h00 UTC + retry 03h00)

### ai-orchestrator-service (services/ai-orchestrator/)
- 7 routers NestJS, 20+ endpoints
- RBAC par role, cache Redis, audit trail
- Proxy vers Python ML + Ollama

### Frontend
- `AiSuggestionDialog` integre dans 4 builders (form, campaign, indicator, dashboard)
- Console admin IA (monitoring, configuration)

### NiFi Flow Templates (deploy/vm-ai/nifi/)
- `flow-faostat.json` -- ingestion FAOSTAT: HTTP -> CSV -> JSON -> filtre -> Kafka
- `flow-wahis.json` -- ingestion WAHIS: HTTP -> JSON -> route severite -> Kafka

### Docker Compose VM-AI (deploy/vm-ai/docker-compose.yml)
- Ollama avec GPU passthrough
- Python ML FastAPI
- NiFi 2.x
- Prometheus + Grafana

## Livrables

- [x] Docker Compose VM-AI
- [x] Python ML service (FastAPI, 5 routes, 4 modeles)
- [x] ai-orchestrator-service (7 routers, 20+ endpoints)
- [x] Schemas Prisma (AiUsageLog, AiGenerationDraft, MlModel, MlTrainingJob)
- [x] Frontend AI dialog dans 4 builders
- [x] Console admin IA
- [x] Pipeline entrainement nocturne (scheduler + trainer + data_loader)
- [x] Registre modeles ML (table ml_models + ml_training_jobs)
- [x] Templates NiFi (FAOSTAT, WAHIS)
- [x] Deploy script VM-AI
- [x] Runbook operations (02-runbook-ai-platform.md)
- [ ] Tests E2E avec VM-AI reelle (attente provisioning)
- [ ] Monitoring Grafana dashboards (templates a importer)

## Prochaines etapes

1. Philippe provisionne Docker + GPU drivers sur nbo-ai01
2. Deployer la stack complete (docker compose up -d)
3. Telecharger les modeles Ollama (qwen2.5:32b, qwen2.5-coder:14b, phi4:14b)
4. Entrainer les modeles ML sur donnees reelles (trainer.py)
5. Configurer les flows NiFi via l'UI (importer les templates)
6. Demo Directrice avec 3 cas d'usage concrets
7. Monitoring: importer dashboards Grafana pour metriques ML
