# Motord

Real-time multiplayer word translation game. English to Swedish/French translation racing.

Vibe coded and deployed on Scaleway.

## Quick Start

```bash
# Local development
docker compose up -d

# Production deployment  
cd infrastructure && ./deploy.sh
```

## Live

https://motord.eu

## Tech

- Frontend: React + TypeScript
- Backend: FastAPI + Python  
- Infrastructure: Scaleway + Terraform
- SSL: Let's Encrypt (auto-managed) 