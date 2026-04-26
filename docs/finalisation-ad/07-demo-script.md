# Script de demo Directrice — ARIS 4.0 Chantiers A-D

**Duree totale** : 25-30 minutes
**Public** : Directrice AU-IBAR + equipe direction
**Environnement** : Production (au-aris.org) — staging en backup

---

## Introduction (2 min)

> "Madame la Directrice, voici les 4 grandes evolutions livrees en production sur ARIS 4.0. Je vous propose de les presenter sur un cas concret : la surveillance de la peste des petits ruminants au Sahel."

Points cles a mentionner :
- 4 chantiers livres : A (Domaines), B (Dashboards), C (Indicateurs), D (Rapports IA)
- Tout est en production, accessible aux 55 pays membres
- Zero licence logicielle, 100% open source

---

## Scenario 1 — Drill-down domaine (4 min)

**Objectif** : Montrer la navigation hierarchique domaine > sous-domaine

### Etapes

1. **Page d'accueil** → cliquer sur la carte "Animal Health"
   - Pointer le nombre de sous-domaines et les statistiques globales

2. **Page domaine Animal Health** → pointer les 3 sections :
   - Tableau de bord (KPIs du domaine)
   - Planifications (campagnes actives)
   - Sous-domaines (Surveillance, Vaccination, Lab, AMR...)

3. **Cliquer sur "Surveillance"**
   - Montrer que la meme structure se repete au niveau sous-domaine
   - Tableau de bord specifique surveillance
   - Liste des campagnes de surveillance
   - Formulaires de collecte dedies

4. **Retour arriere** → montrer la navigation breadcrumb
   - Animal Health > Surveillance > ...

5. **Navigation transverse** : montrer rapidement un autre domaine (ex: Livestock)
   - Meme schema mental, meme structure

### Message cle

> "L'utilisateur reste sur le meme schema mental quel que soit le niveau. Qu'il travaille sur la sante animale, l'elevage ou la peche, l'interface est identique. Cela reduit considerablement le temps de formation."

---

## Scenario 2 — Dashboard personnalise (5 min)

**Objectif** : Montrer que chaque utilisateur peut construire ses propres tableaux de bord

### Etapes

1. **Aller a `/my-dashboards`**
   - Montrer la liste des dashboards existants
   - Pointer les templates pre-configures

2. **Ouvrir le dashboard "Vue strategique Directrice — Sante animale 2026"**
   - Ce dashboard a ete pre-cree pour la demo (voir checklist J-2)

3. **Pointer les widgets** :
   - Carte Afrique avec couche de risque PPR
   - KPIs : nombre de foyers, taux de couverture vaccinale, pays touches
   - Graphique evolution mensuelle
   - Tableau top 10 pays par nombre de cas
   - Camembert repartition par sous-region
   - Jauge objectif LiDeSA

4. **Demo drag-drop** :
   - Deplacer un widget (ex: la carte) vers le haut
   - Redimensionner un KPI
   - Montrer que le layout s'adapte

5. **Sauvegarder** le dashboard
   - Montrer la confirmation de sauvegarde
   - Mentionner que chaque utilisateur a ses propres dashboards

### Message cle

> "Chaque utilisateur peut construire ses propres dashboards sans aucune competence technique. La Directrice, un CVO, un point focal WAHIS — chacun voit ce qui est pertinent pour lui."

---

## Scenario 3 — Indicateur composite (3 min)

**Objectif** : Montrer la creation et le suivi d'indicateurs sans code

### Etapes

1. **Aller a `/settings/indicators`**
   - Page de gestion des indicateurs

2. **Filtrer sur "Animal Health"**
   - Montrer la liste des indicateurs du domaine
   - Pointer les types : simple, composite, derive

3. **Ouvrir l'indicateur `PPR_VAX_COVERAGE_WEIGHTED`**
   - Montrer la formule : couverture vaccinale ponderee par population de petits ruminants
   - Pointer les sources de donnees utilisees
   - Montrer les seuils d'alerte (vert/orange/rouge)

4. **Onglet Evolution** → courbe
   - Montrer l'evolution sur 5 pays saheliens
   - Pointer la tendance
   - Montrer le comparatif inter-pays

### Message cle

> "Les indicateurs composites sont crees par les equipes metier, pas par les developpeurs. Cela permet de reagir en jours, pas en mois, quand un nouveau besoin de suivi emerge."

---

## Scenario 4 — Rapport annuel IA (8 min — le clou du spectacle)

**Objectif** : Montrer la generation assistee par IA d'un rapport annuel complet

### Etapes

1. **Aller a `/reports`**
   - Montrer la liste des rapports : Flash, Annuels, Personnalises
   - Pointer les templates disponibles

2. **Ouvrir le rapport annuel pre-genere "Animal Health 2025"**
   - Ce rapport a ete genere la veille (25-40 min de generation)
   - Montrer la table des matieres generee automatiquement

3. **Lire le resume executif**
   - Pointer la qualite de la redaction IA
   - Montrer les donnees chiffrees injectees automatiquement
   - Mentionner les 2 langues disponibles (EN/FR)

4. **Montrer l'edition d'une section**
   - Cliquer sur une section (ex: "Situation epidemiologique")
   - Montrer l'editeur TinyMCE
   - Modifier une phrase → sauvegarder
   - Mentionner que le controle humain est obligatoire avant publication

5. **Montrer les graphiques et cartes integres**
   - Charts auto-generes depuis les donnees ARIS
   - Cartes de risque integrees

6. **Telecharger PDF**
   - Cliquer sur "Exporter PDF"
   - Montrer le document genere avec mise en page AU-IBAR
   - Pointer le logo, les en-tetes, la numerotation

### Message cle

> "L'IA fait gagner 80% du temps de redaction des rapports annuels. Mais le controle humain reste obligatoire : chaque section doit etre validee avant publication. L'IA est un outil, pas un substitut."

### Points techniques a mentionner si question

- IA locale (Ollama) — aucune donnee ne quitte les serveurs AU-IBAR
- Modele : Llama 3 ou equivalent open source
- Pas de dependance a OpenAI, Google ou autre fournisseur cloud
- Audit trail complet : qui a genere, qui a modifie, qui a valide

---

## Scenario 5 — Flash alertes (3 min)

**Objectif** : Montrer la generation rapide d'alertes pour les decideurs

### Etapes

1. **Aller a `/reports/flash-console`**
   - Montrer la console de generation de flash

2. **Ouvrir un flash pre-genere**
   - Ex: "Alerte PPR — Foyer confirme Nord Senegal"
   - Montrer la structure : contexte, donnees, recommandations
   - Pointer le temps de generation (30s-2min)

3. **Montrer les strategies de diffusion**
   - Email aux points focaux
   - Notification in-app
   - PDF attache
   - Mentionner la diffusion SMS (future)

### Message cle

> "En moins de 5 minutes, un flash d'alerte structure est entre les mains des decideurs. Avant ARIS, ce processus prenait des jours."

---

## Conclusion (2 min)

### Resume des 4 chantiers

| Chantier | Livrable | Impact |
|----------|----------|--------|
| A — Domaines | Navigation hierarchique 9 domaines + sous-domaines | Structure mentale unifiee |
| B — Dashboards | Dashboards personnalisables drag-drop | Autonomie des utilisateurs |
| C — Indicateurs | Indicateurs composites sans code | Reactivite metier |
| D — Rapports IA | Generation IA rapports + flash alertes | 80% gain de temps |

### Points forts transversaux

- **Open source** : zero cout de licence, souverainete technologique
- **Multilingue** : EN, FR, PT, AR (RTL) — couvre les 55 pays
- **Offline-first** : application mobile Kotlin pour le terrain
- **Securite** : IA locale, audit trail, RBAC 8 roles, MFA
- **Interoperabilite** : WAHIS, EMPRES, FAOSTAT, FishStatJ, CITES

### Transition vers la suite

> "Avec ces 4 chantiers en production, nous avons les fondations. Le Chantier E — Plateforme IA/ML — ajoutera 7 cas d'usage predictifs : prevision d'epidemies, optimisation des campagnes de vaccination, detection precoce des menaces emergentes..."

---

## Q&R preparees

### "Et si l'IA dit n'importe quoi ?"

> L'IA n'a jamais le dernier mot. Trois garde-fous :
> 1. **Score de confiance** affiche sur chaque section generee
> 2. **Validation humaine obligatoire** avant publication — aucun rapport ne sort sans approbation
> 3. **Audit trail complet** — on sait exactement ce que l'IA a genere et ce que l'humain a modifie

### "Combien ca coute ?"

> Zero licence logicielle. Les seuls couts sont :
> - **Infrastructure** : 4 VMs (que nous avons deja)
> - **Ressources humaines** : equipe technique AU-IBAR
> - **Bande passante** : existante
> L'IA tourne en local sur nos serveurs — pas d'abonnement OpenAI ou equivalent.

### "Combien de temps pour un rapport ?"

> - **Flash alerte** : 30 secondes a 2 minutes
> - **Rapport annuel** : 25-40 minutes de generation IA, puis revision humaine
> - **Avant ARIS** : un rapport annuel prenait 3-6 mois de travail manuel

### "Securite des donnees ?"

> - IA 100% locale — **aucune donnee ne quitte les serveurs AU-IBAR** a Nairobi
> - Pas de cloud externe (pas d'OpenAI, pas de Google)
> - Audit trail sur chaque action (qui, quand, quoi)
> - RBAC avec 8 roles, MFA obligatoire pour les administrateurs
> - Classification des donnees (PUBLIC, PARTNER, RESTRICTED, CONFIDENTIAL)

### "Formation ?"

> Sessions planifiees :
> - **1h pour les decideurs** (navigation + dashboards)
> - **2h pour les data stewards** (indicateurs + rapports)
> - **Demi-journee pour les administrateurs** (configuration complete)
> - Documentation video en preparation

### "Quelle est la suite ?"

> **Chantier E — Plateforme IA/ML** avec 7 cas d'usage :
> 1. Prevision d'epidemies (modeles epidemiologiques)
> 2. Optimisation des campagnes de vaccination
> 3. Detection precoce des menaces emergentes
> 4. Analyse de sentiment sur les rapports
> 5. Classification automatique des documents
> 6. Recommandations de politique publique
> 7. Alertes predictives multi-sources
>
> Ce chantier necesite une VM GPU supplementaire (estimation a fournir).
