# Demo Assets Status

## Assets non-IA (creables via SQL)
| Asset | Description | Script | Statut |
|-------|------------|--------|--------|
| Campagne multi-target | PPR Sahel 2026, 3 cibles | _create_demo_assets.py | Pret |
| Indicateur composite | PPR_VAX_COVERAGE_WEIGHTED + 3 sources + valeurs demo | _create_demo_assets.py | Pret |
| Dashboard Directrice | Vue strategique, 9 widgets | _create_demo_assets.py | Pret |

## Assets IA (dependent Ollama)
| Asset | Description | Dependance | Plan |
|-------|------------|-----------|------|
| Rapport annuel | Animal Health 2025 | Ollama prod | Plan A si dispo, Plan B sinon |
| Flash IA | Alerte indicateur | Ollama prod | Plan A si dispo, Plan B sinon |

## Plan A — Ollama operationnel
Lancer la generation via API, verifier le contenu, presenter en demo.

## Plan B — Ollama non operationnel
Presenter l'UI rapports (templates, wizard), montrer un rapport statique pre-ecrit.
Pivot narratif : "Cette fonctionnalite sera pleinement active des la mise en service de la VM IA."
