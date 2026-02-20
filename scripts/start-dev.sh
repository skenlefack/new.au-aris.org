#!/usr/bin/env bash
# ARIS 3.0 — Development Startup Script
# Usage:
#   ./scripts/start-dev.sh              # Infrastructure only (default)
#   ./scripts/start-dev.sh services     # Infrastructure + all 22 microservices
#   ./scripts/start-dev.sh all          # Infrastructure + services + frontend apps

set -euo pipefail

COMPOSE_BASE="docker compose -f docker-compose.yml"
COMPOSE_SERVICES="$COMPOSE_BASE -f docker-compose.services.yml"
COMPOSE_ALL="$COMPOSE_SERVICES -f docker-compose.apps.yml"

MODE="${1:-infra}"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║       ARIS 3.0 — Development Environment    ║${NC}"
  echo -e "${CYAN}║       AU-IBAR Digital Infrastructure         ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
  echo ""
}

print_ports() {
  echo -e "${GREEN}Infrastructure:${NC}"
  echo "  PostgreSQL+PostGIS : localhost:5432"
  echo "  Redis              : localhost:6379"
  echo "  Kafka brokers      : localhost:9092, 9094, 9096"
  echo "  Kafka UI           : http://localhost:8080"
  echo "  Schema Registry    : http://localhost:8081"
  echo "  Elasticsearch      : http://localhost:9200"
  echo "  MinIO Console      : http://localhost:9001"
  echo "  Mailpit            : http://localhost:8025"
  echo "  Traefik Dashboard  : http://localhost:8090"
  echo "  Traefik Gateway    : http://localhost:4000"
}

print_services() {
  echo ""
  echo -e "${GREEN}Microservices (via Traefik → localhost:4000):${NC}"
  echo "  tenant             : localhost:3001  → /api/v1/tenants"
  echo "  credential         : localhost:3002  → /api/v1/auth, /api/v1/users"
  echo "  master-data        : localhost:3003  → /api/v1/master-data"
  echo "  data-quality       : localhost:3004  → /api/v1/data-quality"
  echo "  data-contract      : localhost:3005  → /api/v1/data-contracts"
  echo "  message            : localhost:3006  → /api/v1/messages"
  echo "  drive              : localhost:3007  → /api/v1/drive"
  echo "  realtime           : localhost:3008  → /api/v1/realtime, /socket.io"
  echo "  form-builder       : localhost:3010  → /api/v1/form-builder"
  echo "  collecte           : localhost:3011  → /api/v1/collecte"
  echo "  workflow           : localhost:3012  → /api/v1/workflow"
  echo "  animal-health      : localhost:3020  → /api/v1/animal-health"
  echo "  livestock-prod     : localhost:3021  → /api/v1/livestock"
  echo "  fisheries          : localhost:3022  → /api/v1/fisheries"
  echo "  wildlife           : localhost:3023  → /api/v1/wildlife"
  echo "  apiculture         : localhost:3024  → /api/v1/apiculture"
  echo "  trade-sps          : localhost:3025  → /api/v1/trade"
  echo "  governance         : localhost:3026  → /api/v1/governance"
  echo "  climate-env        : localhost:3027  → /api/v1/climate"
  echo "  analytics          : localhost:3030  → /api/v1/analytics"
  echo "  geo-services       : localhost:3031  → /api/v1/geo"
  echo "  interop-hub        : localhost:3032  → /api/v1/interop"
  echo "  knowledge-hub      : localhost:3033  → /api/v1/knowledge"
}

print_apps() {
  echo ""
  echo -e "${GREEN}Frontend Applications:${NC}"
  echo "  web (Next.js)      : http://localhost:3100  → /"
  echo "  admin (Next.js)    : http://localhost:3101  → /admin"
}

banner

case "$MODE" in
  infra)
    echo -e "${YELLOW}Mode: Infrastructure only${NC}"
    echo "Starting Kafka (KRaft 3-node), PostgreSQL+PostGIS, Redis, Elasticsearch, MinIO, Mailpit, Traefik..."
    echo ""
    $COMPOSE_BASE up -d
    echo ""
    print_ports
    echo ""
    echo -e "${CYAN}Tip: Run services with:  ./scripts/start-dev.sh services${NC}"
    ;;

  services)
    echo -e "${YELLOW}Mode: Infrastructure + Microservices${NC}"
    echo "Starting all infrastructure + 22 NestJS microservices..."
    echo ""
    $COMPOSE_SERVICES up -d
    echo ""
    print_ports
    print_services
    echo ""
    echo -e "${CYAN}Tip: Add frontends with:  ./scripts/start-dev.sh all${NC}"
    ;;

  all)
    echo -e "${YELLOW}Mode: Full Stack (Infrastructure + Services + Apps)${NC}"
    echo "Starting everything..."
    echo ""
    $COMPOSE_ALL up -d
    echo ""
    print_ports
    print_services
    print_apps
    ;;

  down)
    echo -e "${YELLOW}Stopping all ARIS containers...${NC}"
    $COMPOSE_ALL down
    echo -e "${GREEN}All containers stopped.${NC}"
    ;;

  down-v)
    echo -e "${YELLOW}Stopping all ARIS containers and removing volumes...${NC}"
    $COMPOSE_ALL down -v
    echo -e "${GREEN}All containers and volumes removed.${NC}"
    ;;

  logs)
    SERVICE="${2:-}"
    if [ -n "$SERVICE" ]; then
      $COMPOSE_ALL logs -f "$SERVICE"
    else
      $COMPOSE_ALL logs -f
    fi
    ;;

  status)
    echo -e "${YELLOW}ARIS Container Status:${NC}"
    $COMPOSE_ALL ps
    ;;

  *)
    echo "Usage: $0 {infra|services|all|down|down-v|logs [service]|status}"
    echo ""
    echo "  infra      Start infrastructure only (Kafka, PG, Redis, ES, MinIO, Traefik)"
    echo "  services   Start infrastructure + all 22 microservices"
    echo "  all        Start everything (infra + services + frontend apps)"
    echo "  down       Stop all containers"
    echo "  down-v     Stop all containers and remove volumes"
    echo "  logs       Tail logs (optionally for a specific service)"
    echo "  status     Show container status"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
