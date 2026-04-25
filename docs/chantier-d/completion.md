# Chantier D — Rapports avec generation IA — Completion Report

## Livrables
- [x] Schema Prisma rapports refondu (7 modeles, 8 enums)
- [x] 8 templates systeme seedes (3 FLASH, 3 ANNUAL, 1 QUARTERLY, 1 MONTHLY)
- [x] OllamaClient avec timeout, retry, healthCheck, fallback AI_UNAVAILABLE
- [x] PromptBuilder multilangue (FR/EN/PT/AR) avec anti-PVS
- [x] DataResolver pour injection stats ARIS
- [x] ReportGenerator pipeline complet
- [x] FlashDetector consumer Kafka avec cooldown
- [x] 18 endpoints REST
- [x] OutputValidator anti-PVS, anti-hallucination, verification langue
- [x] Frontend: liste rapports, wizard generation, detail avec sections, console flashs
- [x] Runbook Ollama pour Philippe
- [ ] VM nbo-ai01 provisionnee (attente Philippe)
- [ ] Tests E2E avec Ollama (attente VM)
- [ ] Monitoring Grafana (iteration suivante)

## Architecture
```
                    ┌─────────────┐
                    │  Frontend   │
                    │  (Next.js)  │
                    └──────┬──────┘
                           │ REST
                    ┌──────▼──────┐
                    │  Analytics  │
                    │  Service    │
                    └──┬───┬───┬──┘
                       │   │   │
              ┌────────┘   │   └────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  Report  │ │  Data    │ │  Output  │
        │Generator │ │ Resolver │ │Validator │
        └────┬─────┘ └──────────┘ └──────────┘
             │
        ┌────▼─────┐
        │  Ollama  │
        │  Client  │
        └────┬─────┘
             │ HTTP :11434
        ┌────▼─────┐
        │ nbo-ai01 │
        │ Qwen2.5  │
        │  32B     │
        └──────────┘
```

### Flux de generation
1. L'utilisateur cree un rapport via le wizard frontend
2. Le service analytics enregistre le rapport en base (status: PENDING)
3. ReportGenerator est appele en asynchrone
4. Pour chaque section AI: DataResolver → PromptBuilder → OllamaClient → OutputValidator
5. Si OutputValidator detecte des erreurs: retry avec prompt renforce (1 fois)
6. Si toujours invalide: section marquee FAILED
7. Si warnings: section marquee requiresReview = true
8. Rapport final: AWAITING_REVIEW (ou PUBLISHED pour FLASH)

### Flux flash automatique
1. FlashDetector ecoute les topics Kafka (outbreaks, trade alerts, etc.)
2. Cooldown de 24h par tenant+type pour eviter les doublons
3. Generation automatique du rapport flash
4. Publication immediate (status: PUBLISHED)

## Prochaines etapes
- Philippe provisionne nbo-ai01
- Tester la generation end-to-end avec Qwen 2.5-32B
- Ajouter monitoring Grafana
- Demo avec la Directrice
