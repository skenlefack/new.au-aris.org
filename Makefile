# ARIS 4.0 — Developer Makefile
# Usage: make <target>

.PHONY: install build test lint format typecheck ci clean \
        docker-build docker-up docker-down docker-logs docker-reset \
        db-setup db-reset db-seed db-migrate \
        help

# ═══════════════════════════════════════════════
# Development
# ═══════════════════════════════════════════════

install: ## Install all dependencies
	pnpm install

build: ## Build all packages and services
	pnpm turbo build

test: ## Run all unit tests
	pnpm turbo test

test-integration: ## Run integration tests (requires Docker services)
	pnpm turbo test:integration

lint: ## Run ESLint on all packages
	pnpm turbo lint

format: ## Format all files with Prettier
	pnpm format

format-check: ## Check formatting without modifying files
	pnpm format:check

typecheck: ## TypeScript type checking (via build)
	pnpm turbo build

clean: ## Remove all build outputs and node_modules
	pnpm clean

dev: ## Start all services in dev mode
	pnpm dev

# ═══════════════════════════════════════════════
# CI — local simulation
# ═══════════════════════════════════════════════

ci: lint typecheck test ## Run full CI pipeline locally (lint + typecheck + test)
	@echo "CI passed!"

# ═══════════════════════════════════════════════
# Docker — infrastructure
# ═══════════════════════════════════════════════

docker-up: ## Start all Docker infrastructure services
	docker compose up -d

docker-down: ## Stop all Docker infrastructure services
	docker compose down

docker-logs: ## Follow Docker logs
	docker compose logs -f

docker-reset: ## Reset Docker (remove volumes and restart)
	docker compose down -v && docker compose up -d

docker-build: ## Build a service Docker image (usage: make docker-build SERVICE=tenant)
	@test -n "$(SERVICE)" || (echo "Usage: make docker-build SERVICE=<name>" && exit 1)
	docker build --build-arg SERVICE=$(SERVICE) -t aris-$(SERVICE) .

docker-build-web: ## Build web app Docker image (usage: make docker-build-web APP=web)
	docker build -f Dockerfile.web --build-arg APP=$(or $(APP),web) -t aris-$(or $(APP),web) .

docker-build-all: ## Build all service Docker images
	@for svc in tenant credential message drive realtime \
		master-data data-quality data-contract interop-hub \
		form-builder collecte workflow \
		animal-health livestock-prod fisheries wildlife apiculture trade-sps governance climate-env \
		analytics geo-services knowledge-hub; do \
		echo "Building aris-$$svc..."; \
		docker build --build-arg SERVICE=$$svc -t aris-$$svc . || exit 1; \
	done
	@echo "All service images built!"

# ═══════════════════════════════════════════════
# Database
# ═══════════════════════════════════════════════

db-setup: ## Initialize databases (create schemas, run migrations)
	pnpm db:setup

db-migrate: ## Run Prisma migrations
	pnpm db:migrate

db-seed: ## Seed the database
	pnpm db:seed

db-reset: ## Reset databases (drop + recreate + migrate + seed)
	pnpm db:reset

# ═══════════════════════════════════════════════
# Help
# ═══════════════════════════════════════════════

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
