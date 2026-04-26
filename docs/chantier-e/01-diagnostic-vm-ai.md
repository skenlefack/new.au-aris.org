# Diagnostic VM-AI (nbo-ai01)

## Infrastructure
- IP: 10.202.101.142
- vCPU: 16, RAM: 32-128 GB dynamic, SSD: 500 GB
- OS: Ubuntu Server 24.04.2 LTS
- SSH: arisadmin

## Deja installe
- Ollama avec Qwen 2.5-32B (~20 GB)
- Service systemd actif

## A installer / verifier pour Chantier E
- Docker + Docker Compose
- Modeles Ollama supplementaires: qwen2.5-coder:32b (~20 GB), phi4:14b (~10 GB)
- Python 3.11+ avec pip/venv
- Espace disque libre >= 100 GB

## Ports a ouvrir (UFW)
- 11434: Ollama
- 8000: Python ML Service (FastAPI)
- 8443: Apache NiFi
- 9090: Prometheus
- 3000: Grafana
