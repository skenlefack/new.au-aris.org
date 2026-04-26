# Chantier E -- Runbook Plateforme IA/ML

## 1. Demarrage / Arret de la stack complete

### Demarrage
```bash
# Sur VM-AI (nbo-ai01)
cd /opt/aris-deploy/vm-ai
sudo docker compose up -d

# Verifier que tout est lance
sudo docker compose ps

# Attendre que Ollama charge les modeles (~2-5 min pour 32B)
sudo docker compose logs -f ollama --tail=50
```

### Arret
```bash
cd /opt/aris-deploy/vm-ai
sudo docker compose down
```

### Arret partiel (un seul service)
```bash
sudo docker compose stop python-ml
sudo docker compose start python-ml
```

### Redemarrage apres mise a jour du code
```bash
cd /opt/aris
sudo git pull origin main
cd /opt/aris-deploy/vm-ai
sudo docker compose up -d --build --no-deps python-ml
```

## 2. Commandes utiles

### Ollama
```bash
# Lister les modeles charges
docker exec aris-ollama ollama list

# Telecharger un nouveau modele
docker exec aris-ollama ollama pull qwen2.5:32b
docker exec aris-ollama ollama pull qwen2.5-coder:14b
docker exec aris-ollama ollama pull phi4:14b

# Tester un modele
docker exec aris-ollama ollama run qwen2.5:32b "Hello, test"

# Voir l'utilisation GPU
docker exec aris-ollama nvidia-smi

# Supprimer un modele
docker exec aris-ollama ollama rm model-name
```

### Python ML Service
```bash
# Logs en temps reel
docker compose logs -f python-ml --tail=100

# Tester le health check
curl http://localhost:8000/health

# Tester une prediction
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"disease_code": "FMD", "country_code": "KE", "horizon_days": 30}'

# Lancer un entrainement manuel
docker exec aris-python-ml python -c "
from training.trainer import train_all_models
results = train_all_models(triggered_by='MANUAL')
print(results)
"
```

### NiFi
```bash
# UI NiFi
# https://nbo-ai01:8443/nifi

# Logs NiFi
docker compose logs -f nifi --tail=100

# Statut des processors via API
curl -k https://localhost:8443/nifi-api/flow/process-groups/root/status

# Lister les process groups
curl -k https://localhost:8443/nifi-api/flow/process-groups/root
```

### ai-orchestrator (sur VM-APP)
```bash
# Logs
docker compose logs -f ai-orchestrator --tail=100

# Health check
curl http://localhost:3035/api/v1/ai/health

# Tester la generation
curl -X POST http://localhost:3035/api/v1/ai/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"type": "FORM", "prompt": "Create a livestock census form"}'
```

## 3. Troubleshooting

### Modele Ollama pas charge
**Symptome**: Erreur 500 "model not found" depuis ai-orchestrator.
```bash
# Verifier les modeles disponibles
docker exec aris-ollama ollama list

# Re-telecharger le modele manquant
docker exec aris-ollama ollama pull qwen2.5:32b

# Verifier la memoire GPU
docker exec aris-ollama nvidia-smi
# Si memoire pleine, redemarrer Ollama
docker compose restart ollama
```

### Python ML timeout
**Symptome**: ai-orchestrator retourne 504 timeout sur /predict.
```bash
# Verifier que python-ml repond
curl http://localhost:8000/health

# Verifier les logs pour erreurs
docker compose logs python-ml --tail=50

# Verifier l'utilisation CPU/memoire
docker stats aris-python-ml

# Si le service est bloque, redemarrer
docker compose restart python-ml

# Augmenter le timeout dans ai-orchestrator config si necessaire
# services/ai-orchestrator/src/config/ml.config.ts -> ML_TIMEOUT_MS
```

### NiFi flow stuck
**Symptome**: Les FlowFiles s'accumulent dans un processor.
```bash
# Via l'UI NiFi (https://nbo-ai01:8443/nifi):
# 1. Cliquer sur le processor bloque
# 2. Verifier les bulletins (icone d'avertissement)
# 3. Verifier la queue en amont (clic droit -> List queue)

# Vider une queue bloquee (attention: perte de donnees)
# UI NiFi -> clic droit sur la connexion -> Empty queue

# Redemarrer un processor
# UI NiFi -> clic droit -> Stop, puis Start

# Si NiFi entier est bloque
docker compose restart nifi
```

### Entrainement nocturne echoue
**Symptome**: Modeles restent en status FAILED dans ml_models.
```bash
# Verifier les logs du scheduler
docker compose logs python-ml --since=6h | grep "Training"

# Verifier les jobs en echec dans PostgreSQL
docker exec -e PGPASSWORD=<password> aris-postgres psql -U aris -d aris -c "
  SELECT j.id, m.code, j.status, j.error_message, j.created_at
  FROM ai.ml_training_jobs j
  JOIN ai.ml_models m ON m.id = j.model_id
  WHERE j.status = 'FAILED'
  ORDER BY j.created_at DESC
  LIMIT 10;
"

# Relancer manuellement
docker exec aris-python-ml python -c "
from training.trainer import train_all_models
results = train_all_models(triggered_by='MANUAL')
for r in results:
    print(f\"{r.get('model_code')}: {r['status']}\")
"
```

### Connexion PostgreSQL echouee depuis python-ml
**Symptome**: "connection refused" ou "timeout" dans data_loader.
```bash
# Verifier la variable DB_URL
docker exec aris-python-ml env | grep DB_URL

# Tester la connexion
docker exec aris-python-ml python -c "
import psycopg2
conn = psycopg2.connect('postgresql://aris:password@nbo-dbms03:5432/aris')
print('OK:', conn.status)
conn.close()
"

# Verifier le reseau Docker
docker network inspect vm-ai_default
```

## 4. Monitoring -- Metriques cles a surveiller

### Prometheus metriques (python-ml)
| Metrique | Description | Seuil alerte |
|----------|-------------|--------------|
| `ml_prediction_duration_seconds` | Duree d'une prediction | > 30s |
| `ml_prediction_total` | Nombre total de predictions | - |
| `ml_prediction_errors_total` | Predictions en erreur | > 10/h |
| `ml_training_duration_seconds` | Duree d'un entrainement | > 3600s |
| `ml_training_failures_total` | Entrainements echoues | > 0 |
| `ml_model_accuracy` | Accuracy du dernier entrainement | < 0.6 |

### Prometheus metriques (Ollama)
| Metrique | Description | Seuil alerte |
|----------|-------------|--------------|
| `ollama_gpu_memory_used_bytes` | Memoire GPU utilisee | > 90% |
| `ollama_request_duration_seconds` | Duree d'une requete LLM | > 60s |
| `ollama_requests_total` | Nombre total de requetes | - |

### Grafana dashboards a importer
- Python ML Service: predictions, anomalies, latence, erreurs
- Ollama: GPU, memoire, requetes, modeles charges
- NiFi: FlowFiles in/out, queue sizes, processor status
- Training Pipeline: jobs/nuit, duree, accuracy, echecs

## 5. Procedure d'ajout d'un nouveau modele ML

### Etape 1: Enregistrer le modele dans PostgreSQL
```sql
INSERT INTO ai.ml_models (id, code, name, type, version, status, config)
VALUES (
  gen_random_uuid(),
  'epidemic-rvf-v1',           -- code unique
  'Rift Valley Fever Predictor', -- nom descriptif
  'XGBOOST',                    -- type: XGBOOST | ISOLATION_FOREST | HDBSCAN | CHRONOS | PROPHET
  '1.0.0',
  'TRAINING',                   -- status initial
  '{
    "indicator_codes": ["RVF-001", "RVF-002"],
    "since_days": 1825,
    "xgb_params": {"n_estimators": 200, "max_depth": 8}
  }'::jsonb
);
```

### Etape 2: Implementer le trainer (si nouveau type)
Si le type de modele n'a pas encore de trainer dans `services/python-ml/training/trainer.py`:
1. Ajouter une fonction `train_<type>_<usecase>(model_record)` dans `trainer.py`
2. Ajouter le mapping dans le dict `TRAINERS`
3. La fonction doit retourner `{"metrics": {...}, "accuracy": float, "artifact_path": str, "input_row_count": int}`

### Etape 3: Ajouter la route de prediction (si nouveau endpoint)
1. Creer `services/python-ml/routes/<usecase>.py`
2. Charger le modele depuis `artifact_path` avec `joblib.load()`
3. Enregistrer la route dans `main.py`

### Etape 4: Tester
```bash
# Entrainer manuellement
docker exec aris-python-ml python -c "
from training.trainer import get_registered_models, train_model
models = get_registered_models()
for m in models:
    if m['code'] == 'epidemic-rvf-v1':
        print(train_model(m, triggered_by='MANUAL'))
"
```

### Etape 5: Verifier
Le scheduler nocturne prendra le relais automatiquement a 02:00 UTC.

## 6. Procedure d'ajout d'un nouveau flow NiFi

### Etape 1: Documenter le flow
Creer un template JSON dans `deploy/vm-ai/nifi/flow-<source>.json` suivant le pattern existant:
- Definir les processors (InvokeHTTP, ConvertRecord, RouteOnAttribute, JoltTransformJSON, PublishKafka)
- Documenter les variables (URLs, topics Kafka, credentials)
- Specifier le scheduling (CRON expression)

### Etape 2: Creer le topic Kafka
Ajouter le topic dans `packages/shared-types/src/kafka/topic-names.ts`:
```typescript
export const TOPIC_CONNECTOR_<SOURCE>_<ENTITY>_RECEIVED_V1 = 'connector.<source>.<entity>.received.v1';
```

### Etape 3: Configurer dans NiFi UI
1. Ouvrir https://nbo-ai01:8443/nifi
2. Creer un Process Group nomme "ARIS_<SOURCE>_Ingestion"
3. Ajouter les processors selon le template JSON
4. Configurer les Controller Services (CSVReader, JsonRecordSetWriter, etc.)
5. Configurer les credentials (WAHIS API token, etc.) via NiFi Parameter Contexts
6. Connecter les processors
7. Demarrer le flow

### Etape 4: Creer le consumer Kafka
Dans le service NestJS concerne (ex: `services/interop-hub/`), ajouter un consumer pour le topic:
```typescript
@KafkaConsumer(TOPIC_CONNECTOR_<SOURCE>_<ENTITY>_RECEIVED_V1)
async handleExternalData(message: KafkaMessage) {
  // Validate, transform, store
}
```

### Etape 5: Monitorer
- Verifier les FlowFiles dans l'UI NiFi
- Verifier les messages dans Kafka UI (nbo-brk01:8080)
- Verifier les logs du consumer NestJS
