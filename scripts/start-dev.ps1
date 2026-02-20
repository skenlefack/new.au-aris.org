# ARIS 3.0 — Development Startup Script (PowerShell)
# Usage:
#   .\scripts\start-dev.ps1              # Infrastructure only (default)
#   .\scripts\start-dev.ps1 services     # Infrastructure + all 22 microservices
#   .\scripts\start-dev.ps1 all          # Infrastructure + services + frontend apps

param(
    [Parameter(Position = 0)]
    [ValidateSet("infra", "services", "all", "down", "down-v", "logs", "status")]
    [string]$Mode = "infra",

    [Parameter(Position = 1)]
    [string]$Service = ""
)

$ErrorActionPreference = "Stop"

$ComposeBase = "docker compose -f docker-compose.yml"
$ComposeServices = "$ComposeBase -f docker-compose.services.yml"
$ComposeAll = "$ComposeServices -f docker-compose.apps.yml"

function Write-Banner {
    Write-Host ""
    Write-Host "+==============================================+" -ForegroundColor Cyan
    Write-Host "|       ARIS 3.0 - Development Environment     |" -ForegroundColor Cyan
    Write-Host "|       AU-IBAR Digital Infrastructure          |" -ForegroundColor Cyan
    Write-Host "+==============================================+" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Ports {
    Write-Host "Infrastructure:" -ForegroundColor Green
    Write-Host "  PostgreSQL+PostGIS : localhost:5432"
    Write-Host "  Redis              : localhost:6379"
    Write-Host "  Kafka brokers      : localhost:9092, 9094, 9096"
    Write-Host "  Kafka UI           : http://localhost:8080"
    Write-Host "  Schema Registry    : http://localhost:8081"
    Write-Host "  Elasticsearch      : http://localhost:9200"
    Write-Host "  MinIO Console      : http://localhost:9001"
    Write-Host "  Mailpit            : http://localhost:8025"
    Write-Host "  Traefik Dashboard  : http://localhost:8090"
    Write-Host "  Traefik Gateway    : http://localhost:4000"
}

function Write-Services {
    Write-Host ""
    Write-Host "Microservices (via Traefik -> localhost:4000):" -ForegroundColor Green
    Write-Host "  tenant             : localhost:3001  -> /api/v1/tenants"
    Write-Host "  credential         : localhost:3002  -> /api/v1/auth, /api/v1/users"
    Write-Host "  master-data        : localhost:3003  -> /api/v1/master-data"
    Write-Host "  data-quality       : localhost:3004  -> /api/v1/data-quality"
    Write-Host "  data-contract      : localhost:3005  -> /api/v1/data-contracts"
    Write-Host "  message            : localhost:3006  -> /api/v1/messages"
    Write-Host "  drive              : localhost:3007  -> /api/v1/drive"
    Write-Host "  realtime           : localhost:3008  -> /api/v1/realtime, /socket.io"
    Write-Host "  form-builder       : localhost:3010  -> /api/v1/form-builder"
    Write-Host "  collecte           : localhost:3011  -> /api/v1/collecte"
    Write-Host "  workflow           : localhost:3012  -> /api/v1/workflow"
    Write-Host "  animal-health      : localhost:3020  -> /api/v1/animal-health"
    Write-Host "  livestock-prod     : localhost:3021  -> /api/v1/livestock"
    Write-Host "  fisheries          : localhost:3022  -> /api/v1/fisheries"
    Write-Host "  wildlife           : localhost:3023  -> /api/v1/wildlife"
    Write-Host "  apiculture         : localhost:3024  -> /api/v1/apiculture"
    Write-Host "  trade-sps          : localhost:3025  -> /api/v1/trade"
    Write-Host "  governance         : localhost:3026  -> /api/v1/governance"
    Write-Host "  climate-env        : localhost:3027  -> /api/v1/climate"
    Write-Host "  analytics          : localhost:3030  -> /api/v1/analytics"
    Write-Host "  geo-services       : localhost:3031  -> /api/v1/geo"
    Write-Host "  interop-hub        : localhost:3032  -> /api/v1/interop"
    Write-Host "  knowledge-hub      : localhost:3033  -> /api/v1/knowledge"
}

function Write-Apps {
    Write-Host ""
    Write-Host "Frontend Applications:" -ForegroundColor Green
    Write-Host "  web (Next.js)      : http://localhost:3100  -> /"
    Write-Host "  admin (Next.js)    : http://localhost:3101  -> /admin"
}

Write-Banner

switch ($Mode) {
    "infra" {
        Write-Host "Mode: Infrastructure only" -ForegroundColor Yellow
        Write-Host "Starting Kafka (KRaft 3-node), PostgreSQL+PostGIS, Redis, Elasticsearch, MinIO, Mailpit, Traefik..."
        Write-Host ""
        Invoke-Expression "$ComposeBase up -d"
        Write-Host ""
        Write-Ports
        Write-Host ""
        Write-Host "Tip: Run services with:  .\scripts\start-dev.ps1 services" -ForegroundColor Cyan
    }

    "services" {
        Write-Host "Mode: Infrastructure + Microservices" -ForegroundColor Yellow
        Write-Host "Starting all infrastructure + 22 NestJS microservices..."
        Write-Host ""
        Invoke-Expression "$ComposeServices up -d"
        Write-Host ""
        Write-Ports
        Write-Services
        Write-Host ""
        Write-Host "Tip: Add frontends with:  .\scripts\start-dev.ps1 all" -ForegroundColor Cyan
    }

    "all" {
        Write-Host "Mode: Full Stack (Infrastructure + Services + Apps)" -ForegroundColor Yellow
        Write-Host "Starting everything..."
        Write-Host ""
        Invoke-Expression "$ComposeAll up -d"
        Write-Host ""
        Write-Ports
        Write-Services
        Write-Apps
    }

    "down" {
        Write-Host "Stopping all ARIS containers..." -ForegroundColor Yellow
        Invoke-Expression "$ComposeAll down"
        Write-Host "All containers stopped." -ForegroundColor Green
    }

    "down-v" {
        Write-Host "Stopping all ARIS containers and removing volumes..." -ForegroundColor Yellow
        Invoke-Expression "$ComposeAll down -v"
        Write-Host "All containers and volumes removed." -ForegroundColor Green
    }

    "logs" {
        if ($Service) {
            Invoke-Expression "$ComposeAll logs -f $Service"
        } else {
            Invoke-Expression "$ComposeAll logs -f"
        }
    }

    "status" {
        Write-Host "ARIS Container Status:" -ForegroundColor Yellow
        Invoke-Expression "$ComposeAll ps"
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
