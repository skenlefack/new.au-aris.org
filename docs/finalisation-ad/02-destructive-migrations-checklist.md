# Chantier F.1 -- Audit des changements destructifs

Date: 2026-04-25

## Methodologie

Chaque modification Prisma est classee selon son impact sur les donnees existantes :
- SAFE : ajout pur, pas d'impact sur les donnees existantes
- ATTENTION : renommage avec @map/@@@map preservant la colonne/table DB
- DANGER : suppression de colonnes, tables ou changement de type

## Chantier A -- Sub-domains, Value Chains, Multi-domain targeting

### form-builder.prisma
| Modification | Type | Impact | Statut |
|-------------|------|--------|--------|
| Ajout modele `FormTarget` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout relation `targets FormTarget[]` sur FormTemplate | Relation ajoutee | Aucun impact DB | SAFE |

### collecte.prisma
| Modification | Type | Impact | Statut |
|-------------|------|--------|--------|
| Ajout modele `CampaignDomainTarget` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `CampaignTarget` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout relation `targets CampaignDomainTarget[]` sur Campaign | Relation ajoutee | Aucun impact DB | SAFE |
| Ajout relation `targets CampaignTarget[]` sur CollectionCampaign | Relation ajoutee | Aucun impact DB | SAFE |

### settings.prisma (Sub-domains, Value Chains)
| Modification | Type | Impact | Statut |
|-------------|------|--------|--------|
| Modele `SubDomain` existe deja | Pre-existant | Aucun impact | SAFE |
| Modele `ValueChainCode` existe deja | Pre-existant | Aucun impact | SAFE |
| Modele `Domain` existe deja | Pre-existant | Aucun impact | SAFE |
| Enum `SubDomainType` existe deja | Pre-existant | Aucun impact | SAFE |

## Chantier B -- Indicators (refactored)

### indicators.prisma (NOUVEAU FICHIER)
| Modification | Type | Impact | Statut |
|-------------|------|--------|--------|
| Ajout modele `IndicatorType` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `Indicator` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `IndicatorValue` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `IndicatorFormula` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `IndicatorFormulaDependency` | Nouvelle table | Aucun impact existant | SAFE |
| 4 nouveaux enums (IndicatorMeasurementMode, etc.) | Nouveaux types | Aucun impact existant | SAFE |

Note : les anciens modeles `StatisticDefinition`, `KpiDefinition`, `CountryStatistic`, `CountryKpiScore` dans settings.prisma sont CONSERVES. Les nouveaux modeles Indicator* coexistent dans le schema `analytics`. Pas de suppression.

## Chantier C -- Dashboard Builder

### dashboard-builder.prisma (NOUVEAU FICHIER)
| Modification | Type | Impact | Statut |
|-------------|------|--------|--------|
| Ajout modele `Dashboard` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `DashboardWidget` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `DashboardShare` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `UserDashboardPreference` | Nouvelle table | Aucun impact existant | SAFE |
| 5 nouveaux enums | Nouveaux types | Aucun impact existant | SAFE |
| Nouveau schema DB `dashboard_builder` | Nouveau schema | A creer | SAFE |

## Chantier D -- Reports & Flash Alerts

### reports.prisma (NOUVEAU FICHIER)
| Modification | Type | Impact | Statut |
|-------------|------|--------|--------|
| Ajout modele `ReportTemplate` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `Report` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `ReportSection` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `ReportFile` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `FlashAlert` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `FlashStrategy` | Nouvelle table | Aucun impact existant | SAFE |
| Ajout modele `AiGenerationJob` | Nouvelle table | Aucun impact existant | SAFE |
| 9 nouveaux enums | Nouveaux types | Aucun impact existant | SAFE |
| Nouveau schema DB `reports` | Nouveau schema | A creer | SAFE |

## Modifications existantes (renommages avec preservation @map)

### governance.prisma
| Modification | Type | Impact | Statut |
|-------------|------|--------|--------|
| `PVSEvaluation` renomme en `VetEvaluation` | Renommage modele | Table DB reste `pvs_evaluations` via `@@map` | SAFE (@@map) |
| Champ `pvsScore` renomme en `vetServicesScore` | Renommage champ | Colonne DB reste `pvs_score` via `@map` | SAFE (@map) |
| Champ `pvsSelfAssessmentScore` renomme en `vetSelfAssessmentScore` | Renommage champ | Colonne DB reste `pvs_self_assessment_score` via `@map` | SAFE (@map) |

### animal-health.prisma
| Modification | Type | Impact | Statut |
|-------------|------|--------|--------|
| Champ `pvsScore` renomme en `vetServicesScore` sur SVCapacity | Renommage champ | Colonne DB reste `pvs_score` via `@map` | SAFE (@map) |
| Champ `pveSerologyDone` sur VaccinationCampaign | Inchange | Colonne DB `pve_serology_done` | SAFE |

## Verdict global

| Categorie | Nombre | Statut |
|-----------|--------|--------|
| Nouvelles tables | 20 | SAFE |
| Nouveaux schemas DB | 2 | SAFE |
| Nouveaux enums | 18+ | SAFE |
| Renommages avec @map | 3 | SAFE |
| Suppressions de colonnes | 0 | - |
| Suppressions de tables | 0 | - |
| Changements de type | 0 | - |

**CONCLUSION : Aucune modification destructive detectee. Toutes les modifications sont additives (nouvelles tables/schemas) ou preservent les noms de colonnes/tables existants via @map. Le deploiement peut se faire sans perte de donnees.**
