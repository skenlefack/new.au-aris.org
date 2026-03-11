# Climate & Environment Service

**Port**: 3027 | **Prefix**: `/api/v1/climate`

ARIS 4.0 Climate & Environment domain service. Manages water stress indices, rangeland conditions, environmental hotspots, and climate data points across AU Member States.

## API Routes

### Water Stress
```
POST   /api/v1/climate/water-stress        Create water stress index
GET    /api/v1/climate/water-stress        List water stress indices
GET    /api/v1/climate/water-stress/:id    Get water stress index by ID
PATCH  /api/v1/climate/water-stress/:id    Update water stress index
```

### Rangelands
```
POST   /api/v1/climate/rangelands          Create rangeland assessment
GET    /api/v1/climate/rangelands          List rangeland conditions
GET    /api/v1/climate/rangelands/:id      Get rangeland condition by ID
PATCH  /api/v1/climate/rangelands/:id      Update rangeland condition
```

### Hotspots
```
POST   /api/v1/climate/hotspots            Create environmental hotspot
GET    /api/v1/climate/hotspots            List environmental hotspots
GET    /api/v1/climate/hotspots/:id        Get environmental hotspot by ID
PATCH  /api/v1/climate/hotspots/:id        Update environmental hotspot
```

### Climate Data
```
POST   /api/v1/climate/data               Create climate data point
GET    /api/v1/climate/data               List climate data points
GET    /api/v1/climate/data/:id           Get climate data point by ID
PATCH  /api/v1/climate/data/:id           Update climate data point
```

### Health
```
GET    /health                             Service health check
```

## Business Rules

- **Water Stress**: Unique constraint per tenant + geoEntityId + period (409 on duplicate)
- **Default classification**: All entities default to `PUBLIC`
- **Tenant isolation**: MEMBER_STATE users see only their data; CONTINENTAL users see all
- **Roles**: Create requires SUPER_ADMIN, CONTINENTAL_ADMIN, NATIONAL_ADMIN, DATA_STEWARD, or FIELD_AGENT. Update excludes FIELD_AGENT.

## Kafka Topics

| Topic | Trigger |
|-------|---------|
| `ms.climate.water-stress.created.v1` | Water stress index created |
| `ms.climate.water-stress.updated.v1` | Water stress index updated |
| `ms.climate.rangeland.assessed.v1` | Rangeland assessment created |
| `ms.climate.rangeland.updated.v1` | Rangeland condition updated |
| `ms.climate.hotspot.detected.v1` | Environmental hotspot detected |
| `ms.climate.hotspot.updated.v1` | Environmental hotspot updated |
| `ms.climate.data.recorded.v1` | Climate data point recorded |
| `ms.climate.data.updated.v1` | Climate data point updated |

## Development

```bash
pnpm dev          # Start with hot reload (tsx watch)
pnpm test         # Run tests
pnpm build        # TypeScript build
```
