# Checklist pre-demo Directrice — ARIS 4.0

## J-2 : Creation des assets de demo

### Donnees et contenu

- [ ] **Campagne multi-target** : "Surveillance saisonniere PPR 2026 — Sahel"
  - Domaines cibles : Animal Health > Surveillance + Vaccination + Livestock > Small ruminants
  - Pays : Senegal, Mali, Burkina Faso, Niger, Tchad
  - Statut : ACTIVE avec quelques soumissions de test
  - Route : POST `/api/v1/collecte/campaigns`

- [ ] **Dashboard custom** : "Vue strategique Directrice — Sante animale 2026"
  - 6 widgets minimum :
    1. Carte Afrique — couche de risque PPR (type: map)
    2. KPI foyers actifs (type: stat-card)
    3. KPI couverture vaccinale (type: stat-card)
    4. Evolution mensuelle des cas (type: line-chart)
    5. Top 10 pays par nombre de cas (type: table)
    6. Repartition par sous-region (type: pie-chart)
  - Route : POST `/api/v1/reports/dashboards`

- [ ] **Indicateur composite** : `PPR_VAX_COVERAGE_WEIGHTED`
  - Formule : somme(couverture_pays * population_ruminants_pays) / somme(population_ruminants_pays)
  - Valeurs historiques : 5 pays saheliens, 2022-2026
  - Seuils : vert > 70%, orange 40-70%, rouge < 40%
  - Route : POST `/api/v1/reports/indicators`

- [ ] **Rapport annuel pre-genere** : "Animal Health 2025"
  - Generer la veille de la demo (25-40 min)
  - Verifier : resume executif, graphiques, mise en page PDF
  - Si Ollama non disponible : utiliser un rapport pre-rempli manuellement
  - Route : POST `/api/v1/reports/annual-reports/generate`

- [ ] **Flash IA pre-genere** : alerte indicateur PPR
  - Simuler un depassement de seuil
  - Verifier : contenu, formatage, PDF
  - Route : POST `/api/v1/reports/flash-reports/generate`

### Comptes utilisateurs

- [ ] Compte "Directrice" cree (role: CONTINENTAL_ADMIN)
  - Dashboard pre-configure sur la page d'accueil
  - Langue : FR
- [ ] Compte admin de demo (role: SUPER_ADMIN) pour les ecrans de configuration

---

## J-1 : Verification technique

### Infrastructure

- [ ] **Healthcheck production** : tous services repondent OK
  ```
  curl https://au-aris.org/api/v1/credential/health
  curl https://au-aris.org/api/v1/master-data/health
  curl https://au-aris.org/api/v1/reports/health
  # ... tous les services
  ```

- [ ] **Healthcheck Ollama** : modele charge et fonctionnel
  ```
  curl http://10.202.101.183:11434/api/tags
  ```
  - Si Ollama KO : basculer sur le rapport pre-genere (plan B)

- [ ] **Espace disque** : > 20% libre sur VM-APP et VM-DB
- [ ] **Certificats SSL** : valides (pas d'expiration proche)
- [ ] **DNS** : au-aris.org resout correctement

### Test des 5 scenarios

- [ ] Scenario 1 — Drill-down domaine : navigation fluide, pas d'erreur 404
- [ ] Scenario 2 — Dashboard : widgets charges, drag-drop fonctionne, sauvegarde OK
- [ ] Scenario 3 — Indicateur : courbe affichee, donnees coherentes
- [ ] Scenario 4 — Rapport annuel : ouverture rapide, PDF telecharge OK
- [ ] Scenario 5 — Flash : console accessible, flash pre-genere visible

### Environnement de presentation

- [ ] **Browser** : Chrome dernier version, cache vide, pas d'extensions parasites
- [ ] **Resolution** : 1920x1080 minimum (idealement sur ecran externe)
- [ ] **2 onglets pre-logges** :
  - Onglet 1 : compte Directrice (pour les scenarios 1-3)
  - Onglet 2 : compte admin (pour les scenarios 4-5 si besoin)
- [ ] **Network** : connexion filaire (pas de WiFi instable)
- [ ] **Presentateur** : micro teste, pointeur laser dispo

### Plan B

- [ ] **Staging en backup** : test.au-aris.org fonctionnel avec les memes assets
- [ ] **Captures d'ecran** : screenshots de chaque etape cle (en cas de panne totale)
- [ ] **PDF rapport** : copie locale du rapport annuel genere

---

## J0 : Jour de la demo

### Avant la demo (30 min avant)

- [ ] Ouvrir le navigateur, charger les 2 onglets
- [ ] Verifier que tous les assets sont toujours la (dashboard, rapport, flash)
- [ ] Faire un test rapide de navigation (1 min)
- [ ] Verifier la connexion reseau
- [ ] Preparer le projecteur / ecran partage

### Pendant la demo

- [ ] Suivre le script `/docs/finalisation-ad/07-demo-script.md`
- [ ] Noter les questions posees (pour le compte rendu)
- [ ] Si probleme technique : basculer sur staging ou captures d'ecran

### Apres la demo

- [ ] Remercier les participants
- [ ] Annoncer l'envoi du compte rendu sous 24h
- [ ] Recueillir le feedback informel immediat

---

## J+1 : Post-demo

- [ ] **Compte rendu ecrit** dans les 24h (utiliser le template `09-post-demo-template.md`)
- [ ] **Captures d'ecran cles** : sauvegarder dans `/docs/finalisation-ad/demo-screenshots/`
- [ ] **Feedback Directrice** documente et classe (positif / ameliorations / long-terme)
- [ ] **Communication large** aux 55 pays :
  - Newsletter ARIS 4.0 avec highlights
  - Invitation webinaire de demonstration elargie
  - Mise a jour du portail Knowledge Hub
- [ ] **Planification Chantier E** si feu vert obtenu
