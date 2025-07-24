from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Form, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
import uuid
import json
from datetime import datetime, timedelta
import asyncio
import random

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Start background cleanup task"""
    asyncio.create_task(cleanup_task())

async def cleanup_task():
    """Background task to clean up disconnected players"""
    while True:
        try:
            await cleanup_disconnected_players()
        except Exception as e:
            print(f"Error in cleanup task: {e}")
        await asyncio.sleep(60)  # Run every minute

# Data models
class Player(BaseModel):
    id: str
    name: str
    language: str
    is_host: bool = False
    ready: bool = False
    joined_at: datetime
    score: int = 0

class Lobby(BaseModel):
    id: str
    host_id: str
    players: List[Player]
    difficulty: int = 2
    max_score: int = 10  # Default max score
    created_at: datetime
    invite_code: str

class GameState(BaseModel):
    current_word: str
    current_word_language: str
    current_word_translations: Dict[str, str]
    fuse_time: float = 30.0
    fuse_max_time: float = 30.0
    is_active: bool = False
    word_history: List[Dict] = []  # Track all words and their results
    start_time: Optional[datetime] = None

class ChatMessage(BaseModel):
    player_id: str
    player_name: str
    message: str
    timestamp: datetime

# In-memory storage (in production, use a database)
lobbies: Dict[str, Lobby] = {}
active_connections: Dict[str, List[WebSocket]] = {}
player_connections: Dict[str, WebSocket] = {}  # Map player_id to WebSocket connection
player_heartbeats: Dict[str, datetime] = {}  # Track last heartbeat for each player
game_states: Dict[str, GameState] = {}  # Game state for each lobby

# Load word data from filtered wordlist
WORDS_DATA = []

def load_words_data():
    """Load words from the filtered wordlist"""
    global WORDS_DATA
    try:
        with open('wordlists/filtered_wordlist.json', 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    word_data = json.loads(line.strip())
                    WORDS_DATA.append(word_data)
        print(f"Loaded {len(WORDS_DATA)} words from filtered wordlist")
    except FileNotFoundError:
        print("Warning: filtered_wordlist.json not found, using fallback words")
        # Fallback to basic words if file not found
        WORDS_DATA = [
            {
                "word": "bonjour",
                "difficulty": 0,
                "translation_sv": "hej",
                "translation_fr": "bonjour"
            },
            {
                "word": "hej",
                "difficulty": 0,
                "translation_sv": "hej",
                "translation_fr": "bonjour"
            },
            {
                "word": "merci",
                "difficulty": 0,
                "translation_sv": "tack",
                "translation_fr": "merci"
            },
            {
                "word": "tack",
                "difficulty": 0,
                "translation_sv": "tack",
                "translation_fr": "merci"
            }
        ]
    except Exception as e:
        print(f"Error loading wordlist: {e}")
        WORDS_DATA = []

# Load words on startup
load_words_data()

def normalize_word(word: str) -> str:
    """Normalize word by removing diacritics and special characters"""
    import unicodedata
    # Remove diacritics
    normalized = unicodedata.normalize('NFD', word.lower())
    # Remove combining characters (diacritics)
    normalized = ''.join(c for c in normalized if not unicodedata.combining(c))
    # Keep only letters, numbers, spaces, and hyphens
    normalized = ''.join(c for c in normalized if c.isalnum() or c in ' -')
    return normalized.strip()

def get_random_word(difficulty: int) -> Dict:
    """Get a random word for the given difficulty"""
    # Filter words by difficulty (words with difficulty <= selected difficulty)
    available_words = [w for w in WORDS_DATA if w["difficulty"] <= difficulty]
    if not available_words:
        # Fallback to all words if no words match difficulty
        available_words = WORDS_DATA
    
    if not available_words:
        # Ultimate fallback
        return {
            "word": "hello",
            "difficulty": 0,
            "translation_sv": "hej",
            "translation_fr": "bonjour"
        }
    
    return random.choice(available_words)

def verify_translation(input_word: str, player_language: str, current_word_data: Dict) -> bool:
    """Check if the translation is correct. Player must translate to the *other* language."""
    normalized_input = normalize_word(input_word)
    # Target language is the *other* language
    if player_language == "fr":
        correct_translation = current_word_data.get("translation_sv", "")
    elif player_language == "sv":
        correct_translation = current_word_data.get("translation_fr", "")
    else:
        correct_translation = ""
    normalized_correct = normalize_word(correct_translation)
    print(f"Translation check: input='{input_word}' -> '{normalized_input}', player_lang='{player_language}', correct='{correct_translation}' -> '{normalized_correct}', match={normalized_input == normalized_correct}")
    return normalized_input == normalized_correct

def generate_invite_code() -> str:
    """Generate a 6-character invite code"""
    return str(uuid.uuid4())[:6].upper()

@app.get("/")
def root():
    return {"message": "Motord Python Backend"}

@app.get("/health")
def health():
    return JSONResponse(content={"status": "healthy", "service": "motord-backend"})

@app.post("/lobby/create")
async def create_lobby(player_name: str = Form(...), language: str = Form(...)):
    """Create a new lobby and return the lobby ID"""
    lobby_id = str(uuid.uuid4())
    player_id = str(uuid.uuid4())
    invite_code = generate_invite_code()
    
    player = Player(
        id=player_id,
        name=player_name,
        language=language,
        is_host=True,
        ready=True,
        joined_at=datetime.now(),
        score=0
    )
    
    lobby = Lobby(
        id=lobby_id,
        host_id=player_id,
        players=[player],
        max_score=10,  # Default max score
        created_at=datetime.now(),
        invite_code=invite_code
    )
    
    lobbies[lobby_id] = lobby
    active_connections[lobby_id] = []
    
    return {
        "lobby_id": lobby_id,
        "player_id": player_id,
        "invite_code": invite_code,
        "lobby": {
            "id": lobby.id,
            "host_id": lobby.host_id,
            "players": [{
                "id": p.id,
                "name": p.name,
                "language": p.language,
                "is_host": p.is_host,
                "ready": p.ready,
                "joined_at": p.joined_at.isoformat(),
                "score": p.score
            } for p in lobby.players],
            "difficulty": lobby.difficulty,
            "invite_code": lobby.invite_code
        }
    }

@app.get("/lobby/{lobby_id}")
async def get_lobby(lobby_id: str):
    """Get lobby information"""
    if lobby_id not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    lobby = lobbies[lobby_id]
    return {
        "id": lobby.id,
        "host_id": lobby.host_id,
        "players": [{
            "id": player.id,
            "name": player.name,
            "language": player.language,
            "is_host": player.is_host,
            "ready": player.ready,
            "joined_at": player.joined_at.isoformat(),
            "score": player.score
        } for player in lobby.players],
        "difficulty": lobby.difficulty,
        "max_score": lobby.max_score,
        "invite_code": lobby.invite_code,
        "created_at": lobby.created_at.isoformat()
    }

@app.post("/lobby/{lobby_id}/join")
async def join_lobby(lobby_id: str, player_name: str = Form(...), language: str = Form(...)):
    """Join an existing lobby"""
    if lobby_id not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    lobby = lobbies[lobby_id]
    
    # Check if player name already exists in lobby
    if any(player.name == player_name for player in lobby.players):
        raise HTTPException(status_code=400, detail="Player name already taken")
    
    player_id = str(uuid.uuid4())
    player = Player(
        id=player_id,
        name=player_name,
        language=language,
        is_host=False,
        ready=False,
        joined_at=datetime.now(),
        score=0
    )
    
    lobby.players.append(player)
    
    # Notify other players via WebSocket
    print(f"=== BACKEND: PLAYER JOINED ===")
    print(f"Player {player.name} ({player.id}) joined lobby {lobby_id}")
    print(f"Current lobby players count: {len(lobby.players)}")
    print(f"Current lobby players: {[p.name for p in lobby.players]}")
    
    broadcast_message = {
        "type": "player_joined",
        "player": {
            "id": player.id,
            "name": player.name,
            "language": player.language,
            "is_host": player.is_host,
            "ready": player.ready,
            "joined_at": player.joined_at.isoformat(),
            "score": player.score
        }
    }
    print(f"Broadcasting player_joined message: {broadcast_message}")
    await broadcast_to_lobby(lobby_id, broadcast_message)
    print(f"=== BACKEND: PLAYER JOINED COMPLETE ===")
    
    return {
        "player_id": player_id,
        "lobby": {
            "id": lobby.id,
            "host_id": lobby.host_id,
            "players": [{
                "id": p.id,
                "name": p.name,
                "language": p.language,
                "is_host": p.is_host,
                "ready": p.ready,
                "joined_at": p.joined_at.isoformat(),
                "score": p.score
            } for p in lobby.players],
            "difficulty": lobby.difficulty,
            "invite_code": lobby.invite_code
        }
    }

@app.post("/lobby/{lobby_id}/player/{player_id}/ready")
async def toggle_player_ready(lobby_id: str, player_id: str):
    """Toggle player ready status"""
    if lobby_id not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    lobby = lobbies[lobby_id]
    player = next((p for p in lobby.players if p.id == player_id), None)
    
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    player.ready = not player.ready
    
    # Notify other players via WebSocket
    print(f"=== BACKEND: PLAYER READY CHANGED ===")
    print(f"Player {player.name} ({player_id}) ready status changed to: {player.ready}")
    print(f"Current lobby players count: {len(lobby.players)}")
    print(f"Current lobby players: {[p.name for p in lobby.players]}")
    
    broadcast_message = {
        "type": "player_ready_changed",
        "player_id": player_id,
        "ready": player.ready
    }
    print(f"Broadcasting player_ready_changed message: {broadcast_message}")
    await broadcast_to_lobby(lobby_id, broadcast_message)
    print(f"=== BACKEND: PLAYER READY CHANGED COMPLETE ===")
    
    return {"ready": player.ready}

@app.post("/lobby/{lobby_id}/difficulty")
async def update_difficulty(lobby_id: str, player_id: str = Form(...), difficulty: int = Form(...)):
    """Update lobby difficulty (host only)"""
    if lobby_id not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    lobby = lobbies[lobby_id]
    
    if lobby.host_id != player_id:
        raise HTTPException(status_code=403, detail="Only host can change difficulty")
    
    lobby.difficulty = difficulty
    
    # Notify other players via WebSocket
    await broadcast_to_lobby(lobby_id, {
        "type": "difficulty_changed",
        "difficulty": difficulty
    })
    
    return {"difficulty": difficulty}

@app.post("/lobby/{lobby_id}/max_score")
async def update_max_score(lobby_id: str, player_id: str = Form(...), max_score: int = Form(...)):
    """Update lobby max score (host only)"""
    if lobby_id not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    lobby = lobbies[lobby_id]
    
    if lobby.host_id != player_id:
        raise HTTPException(status_code=403, detail="Only host can change max score")
    
    if max_score < 1:
        raise HTTPException(status_code=400, detail="Max score must be at least 1")
    
    lobby.max_score = max_score
    
    # Notify other players via WebSocket
    await broadcast_to_lobby(lobby_id, {
        "type": "max_score_changed",
        "max_score": max_score
    })
    
    return {"max_score": max_score}

@app.post("/lobby/{lobby_id}/start")
async def start_game(lobby_id: str, player_id: str = Form(...)):
    """Start the game"""
    if lobby_id not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    lobby = lobbies[lobby_id]
    player = next((p for p in lobby.players if p.id == player_id), None)
    
    if not player or not player.is_host:
        raise HTTPException(status_code=403, detail="Only host can start the game")
    
    if not all(p.ready for p in lobby.players):
        raise HTTPException(status_code=400, detail="All players must be ready")
    
    # Get initial word
    word_data = get_random_word(lobby.difficulty)
    current_word = word_data["word"]
    current_word_language = "en"
    current_word_translations = {
        "sv": word_data.get("translation_sv", ""),
        "fr": word_data.get("translation_fr", "")
    }
    
    # Create game state
    game_state = GameState(
        current_word=current_word,
        current_word_language=current_word_language,
        current_word_translations=current_word_translations,
        is_active=True,
        start_time=datetime.now()
    )
    game_states[lobby_id] = game_state
    print(f"[FUSEBAR-BACKEND] Game started for lobby {lobby_id}. Word: {current_word}, fuse_time: {game_state.fuse_time}, fuse_max_time: {game_state.fuse_max_time}")
    
    # Broadcast game started message
    await broadcast_to_lobby(lobby_id, {
        "type": "game_started",
        "lobby_id": lobby_id,
        "difficulty": lobby.difficulty,
        "current_word": current_word,
        "current_word_language": current_word_language,
        "current_word_translations": current_word_translations
    })
    print(f"[FUSEBAR-BACKEND] Broadcasted game_started for lobby {lobby_id}.")
    
    return {"status": "game_started"}

@app.post("/lobby/{lobby_id}/play_again")
async def play_again(lobby_id: str, request: Request):
    form = await request.form()
    print(f"[DEBUG] Play Again called: remote_addr={request.client.host}, headers={dict(request.headers)}, form={dict(form)}")
    """Reset game and return to lobby (host only)"""
    if lobby_id not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    lobby = lobbies[lobby_id]
    player = next((p for p in lobby.players if p.id == form.get("player_id")), None)
    
    if not player or not player.is_host:
        raise HTTPException(status_code=403, detail="Only host can restart the game")
    
    # Reset all player scores and ready status (except host)
    for p in lobby.players:
        p.score = 0
        if not p.is_host:
            p.ready = False
    
    # Clear game state
    if lobby_id in game_states:
        del game_states[lobby_id]
        print(f"[FUSEBAR-BACKEND] Cleared game state for lobby {lobby_id} on play again.")
    
    # Broadcast play again message
    await broadcast_to_lobby(lobby_id, {
        "type": "play_again",
        "players": [{
            "id": p.id,
            "name": p.name,
            "language": p.language,
            "is_host": p.is_host,
            "ready": p.ready,
            "joined_at": p.joined_at.isoformat(),
            "score": p.score
        } for p in lobby.players]
    })
    print(f"[FUSEBAR-BACKEND] Broadcasted play_again for lobby {lobby_id}.")
    
    return {"status": "game_reset"}

@app.post("/lobby/{lobby_id}/player/{player_id}/translate")
async def check_translation(lobby_id: str, player_id: str, translation: str = Form(...)):
    """Check if a player's translation is correct"""
    if lobby_id not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    if lobby_id not in game_states:
        raise HTTPException(status_code=400, detail="Game not active")
    
    lobby = lobbies[lobby_id]
    player = next((p for p in lobby.players if p.id == player_id), None)
    
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    game_state = game_states[lobby_id]
    
    # Use the game state's current word and translations
    current_word_data = {
        "word": game_state.current_word,
        "translation_sv": game_state.current_word_translations.get("sv", ""),
        "translation_fr": game_state.current_word_translations.get("fr", "")
    }
    
    # Check if translation is correct
    is_correct = verify_translation(translation, player.language, current_word_data)
    
    if is_correct:
        # Calculate time taken for this word
        word_time_taken = 30 - game_state.fuse_time if hasattr(game_state, 'fuse_time') else 0
        
        # Add current word to history
        game_state.word_history.append({
            "word": game_state.current_word,
            "translations": game_state.current_word_translations,
            "winner": player.name,
            "winner_id": player_id,
            "time_taken": word_time_taken,
            "status": "correct"
        })
        
        # Update player score
        player.score += 1
        
        # Check if game should end (player reached max score)
        if player.score >= lobby.max_score:
            # Game ended - broadcast game end message
            game_state.is_active = False
            
            broadcast_message = {
                "type": "game_ended",
                "winner": player.name,
                "winner_id": player_id,
                "max_score": lobby.max_score,
                "word_history": game_state.word_history,
                "players": [{
                    "id": p.id,
                    "name": p.name,
                    "score": p.score,
                    "language": p.language
                } for p in lobby.players]
            }
            
            await broadcast_to_lobby(lobby_id, broadcast_message)
            return {
                "correct": True,
                "score": player.score,
                "game_ended": True
            }
        
        # Get new word
        new_word_data = get_random_word(lobby.difficulty)
        current_word_language = "en"  # English words from the wordlist
        current_word_translations = {
            "sv": new_word_data.get("translation_sv", ""),
            "fr": new_word_data.get("translation_fr", "")
        }
        
        game_state.current_word = new_word_data["word"]
        game_state.current_word_language = current_word_language
        game_state.current_word_translations = current_word_translations
        
        # Broadcast correct translation and new word
        broadcast_message = {
            "type": "translation_correct",
            "player_id": player_id,
            "player_name": player.name,
            "score": player.score,
            "new_word": new_word_data["word"],
            "new_word_language": current_word_language,
            "new_word_translations": current_word_translations
        }
        
        # Broadcast the message
        await broadcast_to_lobby(lobby_id, broadcast_message)
    else:
        # Broadcast incorrect translation
        broadcast_message = {
            "type": "translation_incorrect",
            "player_id": player_id,
            "player_name": player.name
        }
        
        # Broadcast the message
        await broadcast_to_lobby(lobby_id, broadcast_message)
    
    return {
        "correct": is_correct,
        "score": player.score if is_correct else None
    }

@app.post("/lobby/{lobby_id}/player/{player_id}/leave")
async def leave_lobby(lobby_id: str, player_id: str):
    """Leave a lobby"""
    if lobby_id not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    lobby = lobbies[lobby_id]
    player = next((p for p in lobby.players if p.id == player_id), None)
    
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Remove player from lobby
    lobby.players = [p for p in lobby.players if p.id != player_id]
    
    # If no players left, delete the lobby
    if not lobby.players:
        del lobbies[lobby_id]
        if lobby_id in active_connections:
            del active_connections[lobby_id]
        if lobby_id in game_states:
            del game_states[lobby_id]
    else:
        # If host left, assign new host
        if lobby.host_id == player_id and lobby.players:
            lobby.host_id = lobby.players[0].id
            lobby.players[0].is_host = True
        
        # Notify other players via WebSocket
        await broadcast_to_lobby(lobby_id, {
            "type": "player_left",
            "player_id": player_id,
            "player_name": player.name
        })
    
    return {"status": "left_lobby"}

@app.post("/lobby/{lobby_id}/timeout")
async def handle_timeout(lobby_id: str):
    """Handle fuse timeout and send a new word"""
    if lobby_id not in lobbies:
        raise HTTPException(status_code=404, detail="Lobby not found")
    
    if lobby_id not in game_states:
        raise HTTPException(status_code=400, detail="Game not active")
    
    lobby = lobbies[lobby_id]
    game_state = game_states[lobby_id]
    
    # Add current word to history as timed out
    game_state.word_history.append({
        "word": game_state.current_word,
        "translations": game_state.current_word_translations,
        "winner": None,
        "winner_id": None,
        "time_taken": 30,  # Full time for timeout
        "status": "timeout"
    })
    print(f"[FUSEBAR-BACKEND] Timeout for lobby {lobby_id}. Previous word: {game_state.current_word}")
    
    # Get new word
    new_word_data = get_random_word(lobby.difficulty)
    current_word_language = "en"  # English words from the wordlist
    current_word_translations = {
        "sv": new_word_data.get("translation_sv", ""),
        "fr": new_word_data.get("translation_fr", "")
    }
    
    game_state.current_word = new_word_data["word"]
    game_state.current_word_language = current_word_language
    game_state.current_word_translations = current_word_translations
    print(f"[FUSEBAR-BACKEND] New word after timeout: {game_state.current_word}, fuse_time: {game_state.fuse_time}, fuse_max_time: {game_state.fuse_max_time}")
    
    # Broadcast new word (no winner, just timeout)
    broadcast_message = {
        "type": "word_timeout",
        "new_word": new_word_data["word"],
        "new_word_language": current_word_language,
        "new_word_translations": current_word_translations
    }
    
    # Broadcast the message
    await broadcast_to_lobby(lobby_id, broadcast_message)
    print(f"[FUSEBAR-BACKEND] Broadcasted word_timeout for lobby {lobby_id}.")
    
    return {"status": "timeout_handled"}

async def broadcast_to_lobby(lobby_id: str, message: dict):
    """Broadcast message to all connected players in a lobby"""
    print(f"=== BACKEND: BROADCAST START ===")
    print(f"Lobby ID: {lobby_id}")
    print(f"Message type: {message.get('type', 'unknown')}")
    print(f"Full message: {message}")
    
    if lobby_id in active_connections:
        print(f"Found {len(active_connections[lobby_id])} connections in lobby {lobby_id}")
        disconnected = []
        for i, connection in enumerate(active_connections[lobby_id]):
            try:
                message_json = json.dumps(message)
                print(f"Sending to connection {i}: {message_json}")
                await connection.send_text(message_json)
                print(f"Successfully sent message to connection {i}")
            except Exception as e:
                print(f"Failed to send message to connection {i}: {e}")
                # Mark for removal
                disconnected.append(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            if connection in active_connections[lobby_id]:
                active_connections[lobby_id].remove(connection)
                print(f"Removed disconnected connection from lobby {lobby_id}")
    else:
        print(f"No active connections found for lobby {lobby_id}")
    
    print(f"=== BACKEND: BROADCAST END ===")

async def cleanup_disconnected_players():
    """Remove players who have been disconnected for too long"""
    current_time = datetime.now()
    timeout = timedelta(minutes=5)  # 5 minutes timeout
    
    for lobby_id, lobby in list(lobbies.items()):
        players_to_remove = []
        for player in lobby.players:
            if player.id in player_heartbeats:
                last_heartbeat = player_heartbeats[player.id]
                if current_time - last_heartbeat > timeout:
                    players_to_remove.append(player)
                    print(f"Player {player.name} ({player.id}) timed out in lobby {lobby_id}")
        
        # Remove timed out players
        for player in players_to_remove:
            lobby.players = [p for p in lobby.players if p.id != player.id]
            if player.id in player_heartbeats:
                del player_heartbeats[player.id]
            if player.id in player_connections:
                del player_connections[player.id]
            
            # Notify other players
            await broadcast_to_lobby(lobby_id, {
                "type": "player_left",
                "player_id": player.id,
                "player_name": player.name
            })
        
        # Only delete lobby if no players left AND no active connections
        if not lobby.players and (lobby_id not in active_connections or not active_connections[lobby_id]):
            print(f"Deleting empty lobby {lobby_id} (no players and no active connections)")
            del lobbies[lobby_id]
            if lobby_id in active_connections:
                del active_connections[lobby_id]
            if lobby_id in game_states:
                del game_states[lobby_id]
        elif not lobby.players and lobby_id in active_connections and active_connections[lobby_id]:
            print(f"Lobby {lobby_id} has no players but still has {len(active_connections[lobby_id])} active connections. Keeping lobby alive.")

@app.websocket("/ws/{lobby_id}")
async def websocket_endpoint(websocket: WebSocket, lobby_id: str):
    await websocket.accept()
    
    if lobby_id not in active_connections:
        active_connections[lobby_id] = []
    
    active_connections[lobby_id].append(websocket)
    print(f"WebSocket connected to lobby {lobby_id}. Total connections: {len(active_connections[lobby_id])}")
    
    # Track which player this connection belongs to
    current_player_id = None
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            print(f"Received message in lobby {lobby_id}: {message}")
            
            # Handle different message types
            if message.get("type") == "chat":
                if lobby_id in lobbies:
                    lobby = lobbies[lobby_id]
                    player = next((p for p in lobby.players if p.id == message.get("player_id")), None)
                    if player:
                        chat_message = {
                            "type": "chat",
                            "player_id": player.id,
                            "player_name": player.name,
                            "message": message.get("message", ""),
                            "timestamp": datetime.now().isoformat()
                        }
                        print(f"Broadcasting chat message: {chat_message}")
                        # Broadcast to all players including sender
                        await broadcast_to_lobby(lobby_id, chat_message)
            
            elif message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                
            elif message.get("type") == "player_connect":
                # Player is connecting and identifying themselves
                current_player_id = message.get("player_id")
                if current_player_id:
                    player_connections[current_player_id] = websocket
                    player_heartbeats[current_player_id] = datetime.now()
                    print(f"Player {current_player_id} connected to lobby {lobby_id}")
            
            elif message.get("type") == "player_leave":
                # Player is leaving gracefully (browser close, etc.)
                player_id = message.get("player_id")
                if player_id and lobby_id in lobbies:
                    lobby = lobbies[lobby_id]
                    player = next((p for p in lobby.players if p.id == player_id), None)
                    if player:
                        print(f"Player {player.name} ({player_id}) is leaving lobby {lobby_id} gracefully")
                        
                        # Remove player from lobby
                        lobby.players = [p for p in lobby.players if p.id != player_id]
                        
                        # Clean up tracking
                        if player_id in player_connections:
                            del player_connections[player_id]
                        if player_id in player_heartbeats:
                            del player_heartbeats[player_id]
                        
                        # Only delete lobby if no players left AND no active connections
                        if not lobby.players and (lobby_id not in active_connections or not active_connections[lobby_id]):
                            print(f"Deleting empty lobby {lobby_id} (no players and no active connections)")
                            del lobbies[lobby_id]
                            if lobby_id in active_connections:
                                del active_connections[lobby_id]
                            if lobby_id in game_states:
                                del game_states[lobby_id]
                        elif not lobby.players and lobby_id in active_connections and active_connections[lobby_id]:
                            print(f"Lobby {lobby_id} has no players but still has {len(active_connections[lobby_id])} active connections. Keeping lobby alive.")
                        else:
                            # If host left, assign new host
                            if lobby.host_id == player_id and lobby.players:
                                lobby.host_id = lobby.players[0].id
                                lobby.players[0].is_host = True
                                print(f"New host assigned: {lobby.players[0].name}")
                            
                            # Notify other players
                            await broadcast_to_lobby(lobby_id, {
                                "type": "player_left",
                                "player_id": player_id,
                                "player_name": player.name
                            })
                        
                        print(f"Player {player.name} ({player_id}) left lobby {lobby_id} gracefully")
                
    except WebSocketDisconnect:
        print(f"WebSocket disconnected from lobby {lobby_id}")
        if lobby_id in active_connections:
            try:
                if websocket in active_connections[lobby_id]:
                    active_connections[lobby_id].remove(websocket)
                    print(f"Removed connection from lobby {lobby_id}. Remaining connections: {len(active_connections[lobby_id])}")
                    
                    # If we know which player this was, remove them from tracking
                    if current_player_id:
                        if current_player_id in player_connections:
                            del player_connections[current_player_id]
                        if current_player_id in player_heartbeats:
                            del player_heartbeats[current_player_id]
                        print(f"Player {current_player_id} disconnected from lobby {lobby_id}")
                    
                    # If this was the last connection and there are players in the lobby,
                    # we should clean up the lobby after a delay to allow reconnection
                    if not active_connections[lobby_id] and lobby_id in lobbies:
                        lobby = lobbies[lobby_id]
                        if lobby.players:
                            print(f"All connections lost for lobby {lobby_id}, but players still exist. Keeping lobby alive for potential reconnection.")
            except ValueError:
                # Connection already removed
                print(f"Connection already removed from lobby {lobby_id}")
                pass 