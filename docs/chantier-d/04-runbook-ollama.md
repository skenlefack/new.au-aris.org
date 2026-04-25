# Runbook Ollama — VM nbo-ai01

## Infrastructure
- Hostname : nbo-ai01
- IP : 10.202.101.188
- vCPU : 16, RAM : 128 GB, Disque : 500 GB SSD
- OS : Ubuntu Server 24.04.2 LTS
- Modele : Qwen 2.5-32B (~20 GB)

## Demarrage / Arret
```bash
sudo systemctl start ollama
sudo systemctl stop ollama
sudo systemctl status ollama
```

## Verification
```bash
curl http://localhost:11434/api/tags
curl http://localhost:11434/api/generate -d '{"model":"qwen2.5:32b","prompt":"Bonjour","stream":false}'
```

## Mise a jour du modele
```bash
ollama pull qwen2.5:32b
```

## Logs
```bash
journalctl -u ollama -f
```

## Monitoring
- CPU/RAM : Prometheus node-exporter
- Metriques ARIS : aris_ai_generation_duration_seconds, aris_ai_tokens_total

## Troubleshooting
- Si Ollama ne repond pas : `sudo systemctl restart ollama`
- Si le modele est corrompu : `ollama rm qwen2.5:32b && ollama pull qwen2.5:32b`
- Si la VM est saturee : verifier `htop`, reduire concurrency dans le report-service

## Securite
- UFW : autoriser uniquement port 11434 depuis 10.202.101.0/24
- JAMAIS exposer Ollama sur Internet
