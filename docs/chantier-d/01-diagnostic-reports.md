# Chantier D.1 -- Diagnostic Rapports existants

> Date : 2026-04-25
> Auteur : CC-5 (Frontend) + CC-1 (Packages)

---

## 1. Modele actuel des rapports

**Aucun modele Prisma `Report` n'existe** dans `packages/db-schemas/prisma/`.

Une recherche exhaustive sur tous les fichiers `.prisma` (33 fichiers) ne trouve aucune table
`report`, `report_template`, `flash_alert` ou equivalent.

Les seuls "rapports" existants sont :
- **Data Quality Reports** : tables dans `data-quality.prisma` (`QualityReport`, `QualityViolation`)
  qui sont des rapports de qualite de donnees automatiques, pas des rapports metier.
- Aucune table de rapports metier (annuels, flash, briefs) n'existe.

## 2. Types de rapports actuels

### Enumerations existantes

**Aucune enum `ReportType`** n'existe dans les schemas Prisma.

Le frontend utilise des types locaux hardcodes :
- `apps/web/src/app/(dashboard)/reports/page.tsx` : types `'WAHIS' | 'Continental' | 'Custom' | 'System'`
- `apps/web/src/app/(dashboard)/reports/generate/page.tsx` : types `'wahis_6monthly' | 'wahis_annual' | 'continental_brief' | 'custom'`
- `apps/web/src/lib/api/hooks.ts` : interface `ReportTemplate` avec types similaires

### Templates en dur (frontend)

6 templates placeholder dans `reports/page.tsx` :
1. WAHIS Notification Report
2. Six-Monthly Report
3. Continental Brief
4. Domain Performance Report
5. Data Quality Report
6. Country Profile Report

4 templates placeholder dans `hooks.ts` (placeholderData) :
1. WAHIS 6-Monthly Report
2. WAHIS Annual Report
3. Continental Brief
4. Custom Report

## 3. Generation actuelle

**Aucune generation reelle n'existe.**

- Pas de Puppeteer, pdfmake, jsPDF, docx ou autre librairie PDF/DOCX dans les dependances.
- Le frontend appelle `POST /reports/generate` via `useGenerateReport()` hook (TanStack Query mutation).
- Ce endpoint **n'existe dans aucun service backend** : pas de route `/reports/templates`,
  `/reports/generate` ou `/reports/history` dans aucun des services.
- Le frontend utilise `placeholderData` (donnees statiques) pour les templates et l'historique,
  ce qui signifie que la page fonctionne visuellement mais ne communique avec aucune API reelle.

## 4. Endpoints existants

### Routes backend

| Service | Route | Description |
|---------|-------|-------------|
| data-quality | `GET /api/v1/data-quality/reports` | Rapports qualite (pass/fail/warning) |
| data-quality | `GET /api/v1/data-quality/reports/:id` | Detail rapport qualite |

**Routes frontend attendues mais sans backend :**
- `GET /reports/templates` (hooks.ts l.3168)
- `POST /reports/generate` (hooks.ts l.3210)
- `GET /reports/history` (hooks.ts l.3222)

### Traefik

Aucune route Traefik specifique pour un service `reports`.

## 5. UI existante

| Page | Fichier | Etat |
|------|---------|------|
| Reports Hub | `apps/web/src/app/(dashboard)/reports/page.tsx` | Fonctionnel (donnees statiques) |
| Generate Report | `apps/web/src/app/(dashboard)/reports/generate/page.tsx` | Formulaire fonctionnel, API stub |
| Report History | `apps/web/src/app/(dashboard)/reports/history/page.tsx` | Table avec pagination, API stub |
| Quality Reports | `apps/web/src/app/(dashboard)/quality/reports/page.tsx` | Connecte a data-quality service |

### Sidebar

Le lien `/reports` est present dans le menu lateral sous "Analytics & Reports" avec l'icone `FileBarChart`.
Accessible aux roles : ANALYST, WAHIS_FOCAL_POINT, DATA_STEWARD, NATIONAL_ADMIN, REC_ADMIN,
CONTINENTAL_ADMIN, SUPER_ADMIN.

## 6. Stockage

- **MinIO** : le service `drive` (port 3007) gere le stockage S3-compatible.
  Pas de bucket specifique pour les rapports.
- Aucun fichier de rapport n'est actuellement genere ou stocke.
- Le frontend prevoit un `downloadUrl` dans le modele `GeneratedReport` (hooks.ts),
  ce qui suggere que l'intention etait de stocker dans MinIO via le service drive.

## 7. Volume

- **0 rapports** generes en base de donnees.
- **0 seeds/fixtures** pour les rapports metier.
- Les seules donnees sont les `placeholderData` dans les hooks React (5 rapports fictifs dans
  `page.tsx`, 4 templates fictifs dans `hooks.ts`).

---

## Resume

| Aspect | Etat | Action requise |
|--------|------|----------------|
| Schema DB | Inexistant | Creer `reports.prisma` |
| Enums | Hardcodes dans le frontend | Definir dans Prisma + shared-types |
| Backend service | Inexistant | Creer service ou module dans analytics |
| Generation PDF/DOCX | Inexistant | Integrer via IA (Qwen sur nbo-ai01) |
| Frontend | Pages UI pretes (stubs) | Connecter aux vrais endpoints |
| Stockage | MinIO disponible | Configurer bucket `aris-reports` |
| Seeds/Templates | Inexistants | Creer seed-report-templates.ts |
| Flash Alerts | Inexistant | Nouveau concept a implementer |
