# Email to Philippe -- VM-AI Setup

**To:** Philippe
**Subject:** ARIS 4.0 -- VM-AI (10.202.101.142) setup checklist -- 7 actions

---

Bonjour Philippe,

La VM dediee a l'IA pour ARIS 4.0 (10.202.101.142, Ubuntu 24.04, 16 vCPU, 32-128 GB RAM) est provisionnee. Il reste 7 actions de configuration avant que nous puissions activer le service d'inference IA en production.

J'ai prepare une checklist detaillee avec toutes les commandes : voir le fichier `docs/finalisation-post-session/04-philippe-vm-ai-checklist.md` dans le repo (ou en piece jointe).

En resume : installer/verifier Docker, configurer Ollama (limites memoire), telecharger 2 modeles (~30 GB au total), securiser SSH (cle publique), configurer UFW (6 regles, reseau interne uniquement), tester la connectivite depuis VM-APP, et verifier l'espace disque (100 GB libres minimum).

Temps estime : 1h30 a 3h selon la bande passante (les modeles font 20 GB et 10 GB).

Merci de me confirmer une fois termine, je lancerai les tests d'integration depuis VM-APP.

Cordialement,
Serge
