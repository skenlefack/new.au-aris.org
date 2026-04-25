# Smoke Tests -- Chantiers A-D (Staging)

URL: https://test.au-aris.org/
Login: admin@au-aris.org / Aris2026@@4!0

---

## Multi-target -- Chantier A

- [ ] Login admin -> page formulaires (`/forms`) -> le selecteur Cibles s'affiche
- [ ] Creation formulaire avec 2 cibles (1 primaire, 1 secondaire)
- [ ] Liste formulaires affiche les badges targets (pastilles colorees par cible)
- [ ] Idem pour campagnes (`/campaigns`) : cibles visibles dans le listing
- [ ] Modification d'un formulaire existant -> les cibles sont pre-remplies
- [ ] Suppression d'une cible secondaire -> le formulaire reste valide

## DashboardBuilder -- Chantier B

- [ ] `/domains/animal-health` charge avec 3 sections (KPIs, carte, graphiques)
- [ ] `/my-dashboards` -> bouton "Creer nouveau dashboard" visible
- [ ] Creation d'un nouveau dashboard -> titre + description
- [ ] Drag-drop widget KPI depuis la palette -> grille
- [ ] Ajout widget MAP_AFRICA -> la carte se charge
- [ ] Ajout widget BAR_CHART -> graphique s'affiche
- [ ] Sauvegarde du dashboard -> rechargement OK (les widgets persistent)
- [ ] Redimensionnement d'un widget dans la grille
- [ ] Suppression d'un widget -> confirmation puis suppression

## Indicateurs -- Chantier C

- [ ] `/settings/indicator-types` -> 6 types affiches (SURVEILLANCE, PRODUCTION, TRADE, etc.)
- [ ] `/settings/indicators` -> bouton creation indicateur
- [ ] Creation indicateur de type Manual -> formulaire valide
- [ ] Creation indicateur de type Computed -> formule requise
- [ ] Aucune mention "PVS" visible nulle part (ni labels, ni tooltips, ni placeholders)
- [ ] Edition d'un indicateur existant -> sauvegarde OK
- [ ] Suppression d'un indicateur -> confirmation requise

## Rapports -- Chantier D

- [ ] `/reports` -> 8 templates affiches (Animal Health, Livestock, Fisheries, etc.)
- [ ] Chaque template affiche : nom, description, domaine, nombre de sections
- [ ] `/reports/generate` -> wizard de generation de rapport
- [ ] Wizard etape 1 : selection template
- [ ] Wizard etape 2 : selection pays / REC / periode
- [ ] Wizard etape 3 : apercu avant generation
- [ ] `/reports/flash-console` -> 3 onglets (Flash, Summary, Comparative)
- [ ] Si Ollama UP : cliquer "Generer" sur un flash -> texte genere en < 30s
- [ ] Si Ollama DOWN : message d'erreur explicite (pas de crash)
- [ ] Export PDF d'un rapport genere -> fichier telecharge

## Regression

- [ ] Login normal utilisateur (non-admin) -> redirection dashboard
- [ ] Navigation sidebar complete (tous les liens fonctionnent)
- [ ] Sous-domaines admin (`/settings/sub-domains`) fonctionne toujours
- [ ] `/settings/value-chains` accessible et fonctionnel
- [ ] Changement de langue (EN/FR) -> interface traduite
- [ ] Deconnexion -> retour page login
- [ ] Tentative d'acces page admin avec role ANALYST -> acces refuse ou redirection
