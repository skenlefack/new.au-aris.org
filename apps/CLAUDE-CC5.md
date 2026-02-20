# CLAUDE.md — CC-5 Frontend Web

## Your Scope
- `apps/web/` — Main Next.js 14 application (App Router)
- `apps/admin/` — Admin panel (tenant management, user management, system config)
- `packages/ui-components/` — Shared Design System (Shadcn/UI + Tailwind)

## Tech Stack
- Next.js 14 (App Router, Server Components where appropriate)
- TypeScript strict
- Tailwind CSS + Shadcn/UI (customized ARIS theme)
- React Query (TanStack Query) for server state
- Zustand for client state
- React Hook Form + Zod for form validation
- Leaflet + react-leaflet for maps
- Recharts for charts
- Embedded Superset/Metabase iframes for advanced BI

## Design System (packages/ui-components/)
ARIS visual identity: AU green (#1B5E20) primary, teal (#006064) secondary, warm orange (#E65100) accent.
Components extend Shadcn/UI with ARIS-specific variants:
- `<KpiCard>` — Metric card with trend indicator
- `<DataTable>` — Sortable, filterable, paginated table with export
- `<MapView>` — Leaflet wrapper with ARIS layer controls
- `<FormRenderer>` — Renders JSON Schema forms (from form-builder)
- `<WorkflowStatusBadge>` — Shows validation level with color coding
- `<TenantSelector>` — Hierarchical AU → REC → MS selector
- `<ClassificationBadge>` — Shows data classification level
- `<QualityIndicator>` — Traffic light for quality gate status

## App Structure (apps/web/)
```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx              # Sidebar + header + tenant selector
│   ├── page.tsx                # Home dashboard (KPI overview)
│   ├── animal-health/
│   │   ├── page.tsx            # Health dashboard (outbreaks, coverage, lab)
│   │   ├── outbreaks/page.tsx  # Outbreak list + map
│   │   ├── vaccination/page.tsx
│   │   ├── laboratory/page.tsx
│   │   └── surveillance/page.tsx
│   ├── collecte/
│   │   ├── campaigns/page.tsx  # Campaign management
│   │   └── submissions/page.tsx
│   ├── workflow/
│   │   └── page.tsx            # Pending validations dashboard
│   ├── master-data/
│   │   ├── page.tsx            # Referential management
│   │   ├── geo/page.tsx
│   │   ├── species/page.tsx
│   │   └── denominators/page.tsx
│   ├── quality/
│   │   └── page.tsx            # Data quality dashboard
│   ├── interop/
│   │   └── page.tsx            # Interop hub status, export triggers
│   ├── form-builder/
│   │   ├── page.tsx            # Template list
│   │   └── [id]/edit/page.tsx  # Drag-and-drop form editor
│   └── settings/
│       ├── profile/page.tsx
│       └── data-contracts/page.tsx
├── api/                        # Next.js API routes (BFF proxy)
└── providers.tsx               # React Query, auth, theme providers
```

## Key Pages

### Dashboard Home
- KPI cards: active outbreaks, vaccination coverage %, pending validations, data quality score
- Map: continental overview with outbreak markers (color by severity)
- Recent activity feed (latest submissions, validations, exports)
- Tenant-scoped: MS sees own data, REC sees all MS, AU sees everything

### Workflow Dashboard
- Tabs per validation level (Level 1–4)
- Table: entity, domain, submitted by, submitted at, SLA countdown
- Actions: Approve / Reject / Return with comment
- Bulk actions for efficiency
- SLA indicators (green/yellow/red)

### Form Builder Editor
- Left panel: component palette (text, number, date, geo-picker, species-selector, etc.)
- Center: drag-and-drop canvas
- Right panel: component properties, validation rules, conditional logic
- Preview mode (desktop + mobile simulation)
- Save as draft / Publish

### Epidemiological Map
- Leaflet with PostGIS vector tiles (via geo-services)
- Layer controls: outbreaks, vaccination coverage, admin boundaries, risk heatmap
- Click marker → popup with outbreak details + workflow status
- Time slider for temporal animation
- Export as PNG/PDF

## API Communication
- All API calls through React Query hooks
- Base URL configured per environment
- JWT token in Authorization header (managed by auth provider)
- Automatic token refresh on 401
- Tenant context sent in `X-Tenant-Id` header

## Responsive Design
- Desktop-first (dashboards are primary use)
- Tablet-friendly for field supervisors
- Mobile collection happens in Kotlin app (CC-6), not web

## Dependencies
- `@aris/shared-types` (DTOs, enums — used for type-safe API calls)
- `@aris/ui-components` (design system)
- `@tanstack/react-query`, `zustand`, `react-hook-form`, `zod`
- `leaflet`, `react-leaflet`
- `recharts`
- `@dnd-kit/core` (drag-and-drop for form builder)
