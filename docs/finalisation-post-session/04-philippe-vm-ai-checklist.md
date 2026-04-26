# VM-AI Setup Checklist for Philippe

**VM:** 10.202.101.142 | 16 vCPU | 32-128 GB RAM (dynamic) | 500 GB SSD | Ubuntu 24.04 LTS
**Purpose:** AI Orchestrator (Ollama + ML inference) for ARIS 4.0
**Estimated time:** 1h30 to 3h (depending on bandwidth for model downloads)

---

## Action 1 -- Verify Docker Installation

```bash
# Check Docker is installed and running
docker --version
docker compose version
systemctl status docker

# If not installed:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker arisadmin
newgrp docker
```

**Expected:** Docker 27+ and Docker Compose v2.x running.

---

## Action 2 -- Configure Ollama Memory Management

Create or edit `/etc/environment.d/ollama.conf` (or set in the Docker Compose environment):

```bash
# Dynamic memory management -- prevents OOM with large models
OLLAMA_MAX_LOADED_MODELS=2       # Max 2 models in VRAM/RAM simultaneously
OLLAMA_KEEP_ALIVE=10m            # Unload idle models after 10 minutes
OLLAMA_NUM_PARALLEL=2            # Max 2 concurrent inference requests
```

If Ollama runs as a Docker container, add these to the `environment:` section of the compose file:

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    environment:
      - OLLAMA_MAX_LOADED_MODELS=2
      - OLLAMA_KEEP_ALIVE=10m
      - OLLAMA_NUM_PARALLEL=2
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    restart: unless-stopped
```

---

## Action 3 -- Pull Additional Models

```bash
# Primary model for code/form generation (~20 GB download)
ollama pull qwen2.5-coder:32b

# Secondary model for NLP/classification (~10 GB download)
ollama pull phi4:14b

# Verify models are available
ollama list
```

**Note:** These downloads require ~30 GB of bandwidth. On a slow connection, this step alone can take 2+ hours.

---

## Action 4 -- Secure SSH Access

```bash
# 1. Create SSH directory for arisadmin if not exists
mkdir -p /home/arisadmin/.ssh
chmod 700 /home/arisadmin/.ssh

# 2. Add the public key (get from VM-APP or team)
cat >> /home/arisadmin/.ssh/authorized_keys << 'EOF'
ssh-ed25519 AAAA... arisadmin@nbo-aris04
EOF
chmod 600 /home/arisadmin/.ssh/authorized_keys

# 3. Disable password authentication
sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#*ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# 4. Test SSH key login from another terminal BEFORE closing current session
```

---

## Action 5 -- Configure UFW Firewall

```bash
# Reset and set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH from internal network only
sudo ufw allow from 10.202.101.0/24 to any port 22 proto tcp

# Allow Ollama API from internal network
sudo ufw allow from 10.202.101.0/24 to any port 11434 proto tcp

# Allow AI Orchestrator service ports from internal network
sudo ufw allow from 10.202.101.0/24 to any port 8000 proto tcp
sudo ufw allow from 10.202.101.0/24 to any port 8443 proto tcp

# Allow Prometheus metrics scraping from VM-APP
sudo ufw allow from 10.202.101.0/24 to any port 9090 proto tcp

# Allow Grafana agent (if needed)
sudo ufw allow from 10.202.101.0/24 to any port 3000 proto tcp

# Enable firewall
sudo ufw enable
sudo ufw status verbose
```

**Expected output:** 6 rules, all restricted to `10.202.101.0/24`.

---

## Action 6 -- Test Connectivity from VM-APP

From **nbo-aris04** (10.202.101.183), run:

```bash
# Test SSH
ssh arisadmin@10.202.101.142 'echo "SSH OK"'

# Test Ollama API
curl -s http://10.202.101.142:11434/api/tags | jq '.models[].name'

# Test Ollama health
curl -s http://10.202.101.142:11434/ 
# Expected: "Ollama is running"

# Test a quick inference (small model)
curl -s http://10.202.101.142:11434/api/generate \
  -d '{"model":"phi4:14b","prompt":"Hello","stream":false}' | jq '.response'
```

**All 4 tests must pass before ARIS AI integration can be enabled.**

---

## Action 7 -- Verify Disk Space

```bash
# Check available space
df -h /

# Check Ollama model storage
du -sh /root/.ollama/models 2>/dev/null || du -sh /var/lib/docker/volumes/*ollama*

# Minimum required: 100 GB free
# Current models will use ~30 GB
# Reserve 70 GB for future models, logs, temp files
```

**Minimum:** 100 GB free on the root partition after model downloads.

---

## Post-Completion

Once all 7 actions are done, confirm to the ARIS team:
1. Docker version installed
2. Ollama version and models list (`ollama list`)
3. UFW status (`sudo ufw status`)
4. Disk space remaining (`df -h /`)
5. Connectivity test results from VM-APP

The ARIS team will then configure Traefik on VM-APP to proxy `/api/v1/ai/*` to `10.202.101.142:8000`.
