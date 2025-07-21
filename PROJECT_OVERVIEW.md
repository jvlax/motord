# Motord Word Game - LLM Project Reference

## Project Summary

Motord is a real-time multiplayer word translation game. Players translate English words into Swedish or French, competing for points and speed.

## Architecture

### Frontend
- Location: `frontend/`
- Tech: React + TypeScript + Tailwind CSS
- Features: WebSocket real-time communication, animated UI, lobby system

### Backend  
- Location: `backend/`
- Tech: FastAPI + Python
- Features: WebSocket server, word management, translation verification, game state

### Infrastructure
- Location: `infrastructure/`
- Cloud: Scaleway (Terraform managed)
- Components: Load Balancer, VM Instance, Container Registry, Private Network
- Domain: https://motord.eu (SSL/HTTPS only)

## Deployment

### Production (Scaleway)
```bash
cd infrastructure
./deploy.sh
```

### Local Development
```bash
docker compose up -d  # Starts all services
```

## Game Flow

1. Player creates/joins lobby via frontend
2. WebSocket connection established to backend
3. Host configures difficulty and max score
4. Players mark ready, host starts game
5. English words presented, players submit translations
6. First correct translation scores point
7. Game continues until max score reached

## Technical Details

### Word System
- Wordlist: `filtered_wordlist.json` (curated list)
- Difficulty levels: easy, medium, hard (word length based)
- Translation verification: exact match required

### Game State Management
- Lobby states: waiting, playing, finished
- Player states: joined, ready, playing
- Real-time updates via WebSocket events

### Infrastructure Security
- Private network communication between load balancer and instance
- No public ports exposed on VM (SSH via flexible IP when needed)
- SSL certificate auto-managed by Scaleway
- HTTP automatically redirects to HTTPS

## File Structure

```
motord/
├── frontend/           # React app
├── backend/           # FastAPI server  
├── infrastructure/    # Terraform (gitignored secrets)
├── wordlists/        # Game data
└── docker-compose.yml # Local development
```

## Key Files

- `backend/main.py` - FastAPI application entry
- `frontend/src/App.tsx` - Main React component
- `frontend/src/config.ts` - Environment-based API configuration
- `infrastructure/main.tf` - Complete infrastructure definition
- `filtered_wordlist.json` - Game wordlist

## Deployment Status

- Production URL: https://motord.eu
- Infrastructure: Deployed on Scaleway
- SSL: Let's Encrypt (auto-managed)
- Containers: AMD64 architecture for production compatibility
- Database: None (stateless game sessions)

## Development Commands

```bash
# Infrastructure
cd infrastructure && terraform apply

# Build and deploy containers
cd infrastructure && ./build-and-deploy.sh

# Local testing
docker compose up -d
```

## Important Notes

- Game sessions are stateless (no persistence)
- All API endpoints use dynamic configuration (dev vs prod)
- Terraform state contains sensitive data (gitignored)
- SSH access only via flexible IP attachment
- Load balancer handles all public traffic via private network 