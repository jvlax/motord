from flask import Flask, render_template, redirect, url_for, request, jsonify, session
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
import uuid, random, unicodedata, time, argparse, json

app = Flask(__name__)
app.secret_key = 'your_secret_key'
CORS(app)
socketio = SocketIO(app, 
    cors_allowed_origins="*",
    ping_timeout=60,
    ping_interval=25,
    async_mode='threading',
    logger=True,
    engineio_logger=True,
    max_http_buffer_size=1e8,
    allow_upgrades=True,
    http_compression=True,
    compression_threshold=1024,
    cookie=None,
    always_connect=True
)

# Load the curated wordlist from a JSON Lines file.
# Place the curated file in a folder "wordlists" at the project root.
WORDLIST = []
try:
    print("Loading wordlist from wordlist.json...")
    with open("wordlists/wordlist.json", "r", encoding="utf-8") as f:
        # Each line should be a JSON object
        WORDLIST = [json.loads(line) for line in f if line.strip()]
    print(f"Loaded {len(WORDLIST)} words from wordlist.json")
    if not WORDLIST:
        print("Warning: WORDLIST is empty.")
    else:
        # Print a sample of words to verify loading
        print("Sample words from wordlist:")
        for i in range(min(5, len(WORDLIST))):
            print(f"  {WORDLIST[i]['word']} (difficulty: {WORDLIST[i].get('difficulty')})")
except Exception as e:
    print("Error loading wordlist:", e)

def normalize_text(text):
    """Normalize text by removing diacritics and special characters."""
    if not text:
        return ""
    # First normalize to decomposed form (NFD)
    text = unicodedata.normalize('NFD', text.lower())
    # Remove diacritics (combining marks)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    # Remove any remaining special characters
    return text.lower().encode('ascii', 'ignore').decode('ascii')

def get_new_word(current_word, lobby_difficulty):
    """
    Choose a new word entry from WORDLIST based on the lobby's difficulty setting,
    using a simple filter:
      - "very easy": only select words with difficulty 0.
      - "easy": only select words with difficulty 1.
      - "medium": select words with difficulty 2 or 3.
      - "hard": select words with difficulty 4 or 5.
    Excludes the current word. If filtering yields no candidates, falls back to the entire WORDLIST (excluding the current word).
    """
    print(f"Getting new word with difficulty: {lobby_difficulty}")
    print(f"Current word: {current_word}")
    print(f"Total words in wordlist: {len(WORDLIST)}")
    
    if lobby_difficulty == "very easy":
        allowed = {0}
    elif lobby_difficulty == "easy":
        allowed = {1}
    elif lobby_difficulty == "medium":
        allowed = {2, 3}
    elif lobby_difficulty == "hard":
        allowed = {4, 5}
    else:
        allowed = {1, 2, 3, 4, 5}
    
    print(f"Allowed difficulties: {allowed}")

    candidates = [
        entry for entry in WORDLIST
        if entry["word"].lower() != (current_word or "").lower()
           and entry.get("difficulty") in allowed
    ]
    print(f"Found {len(candidates)} candidates with allowed difficulties")
    
    if not candidates:
        print("No candidates found with allowed difficulties, falling back to all words")
        candidates = [entry for entry in WORDLIST if entry["word"].lower() != (current_word or "").lower()]
        print(f"Found {len(candidates)} candidates after falling back to all words")
        if not candidates:
            print("No candidates found at all")
            return None

    chosen = random.choice(candidates)
    print(f"Chosen word: {chosen['word']} with difficulty {chosen.get('difficulty')}")
    print(f"Word entry: {chosen}")
    return chosen

# In-memory storage for lobbies.
# Each lobby: { "players": { player_id: {name, ready, language, score} },
#                "current_word": <string>, "current_entry": <wordlist entry>,
#                "difficulty": <"very easy"|"easy"|"medium"|"hard">,
#                "max_score": <int>, "game_over": <bool>, "winner": <string>,
#                "host": <player_id>, "passes": set(), "game_history": [], "game_started": <bool> }
lobbies = {}

def get_player_id():
    return session.get("player_id")

@app.route('/')
def index():
    return render_template('start.html')

@app.route('/create_lobby', methods=['POST'])
def create_lobby():
    print("\n=== LOBBY CREATION REQUEST ===")
    print(f"Request headers: {dict(request.headers)}")
    print(f"Request content type: {request.content_type}")
    
    session.clear()
    player_id = "pid-" + uuid.uuid4().hex[:9]
    session["player_id"] = player_id
    lobby_id = str(uuid.uuid4())[:8]
    
    print(f"Creating new lobby {lobby_id} with host {player_id}")
    
    # Initialize the lobby with the host player
    lobbies[lobby_id] = {
        "players": {
            player_id: {
                "name": "",
                "ready": False,
                "language": "sv",
                "score": 0
            }
        },
        "current_word": None,
        "current_entry": None,
        "difficulty": "medium",
        "max_score": None,
        "game_over": False,
        "winner": None,
        "host": player_id,
        "ready_players": {player_id: False},
        "passes": set(),
        "game_history": [],
        "game_started": False
    }
    
    print(f"Lobby state after creation:")
    print(f"- Players: {lobbies[lobby_id]['players']}")
    print(f"- Ready players: {lobbies[lobby_id]['ready_players']}")
    print(f"- Total players: {len(lobbies[lobby_id]['players'])}")
    print(f"- Ready count: {sum(1 for status in lobbies[lobby_id]['ready_players'].values() if status)}")
    print("=== END LOBBY CREATION ===\n")
    
    return jsonify({
        "room": lobby_id,
        "player_id": player_id,
        "is_host": True
    })

@app.route('/lobby/<lobby_id>')
def lobby(lobby_id):
    if lobby_id not in lobbies:
        return "Lobby not found", 404
    if "player_id" not in session:
        session["player_id"] = "pid-" + uuid.uuid4().hex[:9]
    player_id = session["player_id"]
    lobby = lobbies[lobby_id]
    if player_id not in lobby["players"]:
        lobby["players"][player_id] = {"name": "", "ready": False, "language": "sv", "score": 0}
    return render_template('lobby.html', lobby_id=lobby_id, player_id=player_id, host_id=lobby["host"])

@app.route('/set_ready/<lobby_id>', methods=['POST'])
def set_ready(lobby_id):
    if lobby_id not in lobbies:
        return jsonify({"error": "Lobby not found"}), 404
    player_id = get_player_id()
    if not player_id:
        return jsonify({"error": "Player not identified"}), 400
    data = request.get_json()
    ready = data.get("ready", False)
    name = data.get("name", "Unknown")
    language = data.get("language", "sv")
    lobby = lobbies[lobby_id]
    prev_score = lobby["players"].get(player_id, {}).get("score", 0)
    lobby["players"][player_id] = {"name": name, "ready": ready, "language": language, "score": prev_score}
    # If the current user is the host, also update max_score if provided.
    if player_id == lobby["host"]:
        max_score = data.get("max_score")
        if max_score is not None:
            try:
                lobby["max_score"] = int(max_score)
            except ValueError:
                pass
    return jsonify({"status": "ok", "players": lobby["players"], "max_score": lobby.get("max_score")})

@app.route('/lobby_status/<lobby_id>')
def lobby_status(lobby_id):
    if lobby_id not in lobbies:
        return jsonify({"error": "Lobby not found"}), 404
    lobby = lobbies[lobby_id]
    players = lobby.get("players", {})
    ready_count = sum(1 for p in players.values() if p.get("ready"))
    total_count = len(players)
    response = {
        "current_word": lobby.get("current_word"),
        "players": players,
        "ready_count": ready_count,
        "total_count": total_count,
        "difficulty": lobby.get("difficulty", "medium"),
        "host": lobby.get("host")
    }
    if lobby.get("game_over"):
        response["game_over"] = True
        response["winner"] = lobby.get("winner")
        response["game_history"] = lobby.get("game_history", [])
    elif lobby.get("current_word") and "word_start_time" in lobby:
        elapsed = time.time() - lobby["word_start_time"]
        remaining = max(0, 30 - elapsed)
        response["time_remaining"] = remaining
        if remaining == 0:
            # Add current word to history before getting new word
            if lobby.get("current_entry"):
                lobby["game_history"].append({
                    "word": lobby["current_word"],
                    "translations": {
                        "sv": lobby["current_entry"]["translation_sv"],
                        "fr": lobby["current_entry"]["translation_fr"]
                    },
                    "guessed_by": None  # No one guessed it correctly
                })
            new_entry = get_new_word(lobby.get("current_word"), lobby.get("difficulty", "medium"))
            if new_entry is not None:
                lobby["current_entry"] = new_entry
                lobby["current_word"] = new_entry["word"]
                lobby["word_start_time"] = time.time()
                lobby["passes"] = set()
                response["current_word"] = new_entry["word"]
                response["translations"] = {
                    "sv": new_entry["translation_sv"],
                    "fr": new_entry["translation_fr"]
                }
    if lobby.get("current_word"):
        if "translations" not in response and lobby.get("current_entry"):
            response["translations"] = {
                "sv": lobby["current_entry"]["translation_sv"],
                "fr": lobby["current_entry"]["translation_fr"]
            }
    return jsonify(response)

@app.route('/start_game/<lobby_id>', methods=['GET', 'POST'])
def start_game(lobby_id):
    if request.method == 'GET':
        return render_template('game.html')
    if lobby_id not in lobbies:
        return jsonify({"error": "Lobby not found"}), 404
    lobby = lobbies[lobby_id]
    players = lobby.get("players", {})
    if players and any(not p.get("ready") for p in players.values()):
        return jsonify({"error": "Not all players are ready"}), 400
    new_entry = get_new_word(lobby.get("current_word"), lobby.get("difficulty", "medium"))
    if new_entry is None:
        return jsonify({"error": "No new word available"}), 500
    lobby["current_entry"] = new_entry
    lobby["current_word"] = new_entry["word"]
    lobby["word_start_time"] = time.time()
    lobby["passes"] = set()
    print(f"Lobby {lobby_id} started game with word: {new_entry['word']}")
    return jsonify({
        "current_word": new_entry["word"],
        "translations": {
            "sv": new_entry["translation_sv"],
            "fr": new_entry["translation_fr"]
        },
        "players": players
    })

@app.route('/play_again/<lobby_id>', methods=['POST'])
def play_again(lobby_id):
    if lobby_id not in lobbies:
        return jsonify({"error": "Lobby not found"}), 404
    
    # Get the current lobby
    current_lobby = lobbies[lobby_id]
    
    # Create a new lobby with the same settings
    new_lobby_id = str(uuid.uuid4())[:8]
    lobbies[new_lobby_id] = {
        "players": {},
        "current_word": None,
        "current_entry": None,
        "difficulty": current_lobby.get("difficulty", "medium"),
        "max_score": current_lobby.get("max_score"),
        "game_over": False,
        "winner": None,
        "host": current_lobby.get("host"),
        "ready_players": {current_lobby.get("host"): False},
        "passes": set(),
        "game_history": [],
        "game_started": False
    }
    
    # Get the player data from the request
    data = request.get_json()
    player_id = get_player_id()
    
    # Add the player to the new lobby
    lobbies[new_lobby_id]["players"][player_id] = {
        "name": data.get("name", "Unknown"),
        "ready": True,  # Player is automatically ready
        "language": data.get("language", "sv"),
        "score": 0
    }
    
    # If the player is the host, also set the difficulty and max score
    if player_id == current_lobby.get("host"):
        if "difficulty" in data:
            lobbies[new_lobby_id]["difficulty"] = data["difficulty"]
        if "max_score" in data and data["max_score"]:
            try:
                lobbies[new_lobby_id]["max_score"] = int(data["max_score"])
            except ValueError:
                pass
    
    return jsonify({
        "new_lobby_id": new_lobby_id,
        "redirect_url": url_for('lobby', lobby_id=new_lobby_id)
    })

@app.route('/submit', methods=['POST'])
def submit():
    data = request.get_json()
    word = data.get('word', '')
    print("Received word:", word)
    return jsonify({"status": "success", "received": word})

@app.route('/translation_help')
def translation_help():
    return render_template('translation_help.html')

@app.route('/get_random_word', methods=['GET'])
def get_random_word():
    lang = request.args.get('lang', 'en')
    entry = random.choice(WORDLIST)
    response = {
        "word": entry["word"],
        "difficulty": entry.get("difficulty", 2),  # default to medium if not defined
        "existing_translation": ""
    }
    if lang == "sv":
        translation = entry.get("translation_sv") or entry.get("translation_sw", "")
        response["existing_translation"] = translation if translation else "Translation not available."
    elif lang == "fr":
        translation = entry.get("translation_fr", "")
        response["existing_translation"] = translation if translation else "Translation not available."
    else:
        response["existing_translation"] = ""
    return jsonify(response)


@app.route('/submit_translation', methods=['POST'])
def submit_translation():
    data = request.get_json()
    # Check that required fields exist.
    if not data or not all(field in data for field in ("word", "language", "translation")):
        return jsonify({"error": "Missing fields"}), 400
    # Optionally add a timestamp and player ID.
    data["timestamp"] = time.time()
    data["player_id"] = get_player_id()
    try:
        with open("submitted_translations.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(data, ensure_ascii=False) + "\n")
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/submit_nonsense', methods=['POST'])
def submit_nonsense():
    data = request.get_json()
    # Check that required field "word" exists.
    if not data or "word" not in data:
        return jsonify({"error": "Missing fields"}), 400
    original_word = data.get("word")
    # Prefix the word with "nonsense_"
    data["word"] = "nonsense_" + original_word
    data["timestamp"] = time.time()
    data["player_id"] = get_player_id()
    try:
        with open("submitted_translations.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(data, ensure_ascii=False) + "\n")
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/game/<room_id>')
def game(room_id):
    print(f"\n=== HANDLING GAME ROUTE ===")
    print(f"Room ID: {room_id}")
    print(f"Session data: {session}")
    
    if room_id not in lobbies:
        print(f"Room {room_id} not found")
        return "Game not found", 404
        
    if "player_id" not in session:
        print("No player ID in session")
        return "Not logged in", 401
        
    player_id = session["player_id"]
    lobby = lobbies[room_id]
    
    print(f"Player ID: {player_id}")
    print(f"Lobby state: {lobby}")
    print(f"Current players: {lobby['players']}")
    print(f"Previous players: {lobby.get('previous_players', {})}")
    
    # Check if game has started
    if not lobby.get('game_started'):
        print("Game has not started")
        return "Game has not started", 400
        
    # Get player data
    player_data = None
    if player_id in lobby["players"]:
        print(f"Player {player_id} found in current players")
        player_data = lobby["players"][player_id]
    elif player_id in lobby.get("previous_players", {}):
        print(f"Player {player_id} found in previous players, re-adding to game")
        player_data = lobby["previous_players"][player_id]
        # Re-add player to current players
        lobby["players"][player_id] = player_data.copy()
    
    if not player_data:
        print(f"Player {player_id} not found in game")
        return "Not in game", 403
    
    return render_template('game.html', 
                         room_id=room_id, 
                         player_id=player_id, 
                         host_id=lobby["host"],
                         player_language=player_data["language"],
                         player_name=player_data["name"],
                         current_word=lobby.get('current_word'),
                         translations=lobby.get('current_entry', {}).get('translations', {}))

# Socket event handlers
@socketio.on('join')
def on_join(data):
    room = data.get('room')
    player_id = get_player_id()
    if not player_id:
        print("Server: Error - No player ID in session")
        emit('error', {'message': 'No player ID in session'})
        return
        
    print("\n=== PLAYER JOIN ===")
    print(f"Player {player_id} joining room {room}")
    
    if room in lobbies:
        join_room(room)
        
        print(f"Lobby state before join:")
        print(f"- Players: {lobbies[room]['players']}")
        print(f"- Ready players: {lobbies[room]['ready_players']}")
        print(f"- Total players: {len(lobbies[room]['players'])}")
        print(f"- Ready count: {sum(1 for status in lobbies[room]['ready_players'].values() if status)}")
        
        # Initialize player data if not exists
        if player_id not in lobbies[room]['players']:
            lobbies[room]['players'][player_id] = {
                "name": "",
                "ready": False,
                "language": "sv",
                "score": 0
            }
            print(f"Added player {player_id} to players in room {room}")
        
        # Add player to ready_players if not already there
        if player_id not in lobbies[room]['ready_players']:
            lobbies[room]['ready_players'][player_id] = False
            print(f"Added player {player_id} to ready_players in room {room}")
        
        # Count ready players
        ready_count = sum(1 for status in lobbies[room]['ready_players'].values() if status)
        total_players = len(lobbies[room]['ready_players'])
        
        print(f"Lobby state after join:")
        print(f"- Players: {lobbies[room]['players']}")
        print(f"- Ready players: {lobbies[room]['ready_players']}")
        print(f"- Total players: {total_players}")
        print(f"- Ready count: {ready_count}")
        
        # Emit join confirmation with ready status
        join_data = {
            'player_id': player_id,
            'players': lobbies[room]['players'],
            'ready_players': lobbies[room]['ready_players'],
            'total_players': total_players,
            'ready_count': ready_count
        }
        print(f"Emitting user_joined with data: {join_data}")
        emit('user_joined', join_data, room=room)
        
        # Also emit player_ready_status to update the UI
        ready_data = {
            'ready_players': lobbies[room]['ready_players'],
            'total_players': total_players,
            'ready_count': ready_count
        }
        print(f"Emitting player_ready_status with data: {ready_data}")
        emit('player_ready_status', ready_data, room=room)
        print("=== END PLAYER JOIN ===\n")
    else:
        print(f"Server: Error - Room {room} not found")
        emit('error', {'message': 'Room not found'})

@socketio.on('leave')
def on_leave(data):
    room = data.get('room')
    player_id = get_player_id()
    if not player_id:
        print("Server: Error - No player ID in session")
        emit('error', {'message': 'No player ID in session'})
        return
        
    print(f"Server: Player {player_id} leaving room {room}")
    
    if room in lobbies:
        # Remove player from ready_players
        if player_id in lobbies[room]['ready_players']:
            del lobbies[room]['ready_players'][player_id]
            print(f"Server: Removed player {player_id} from ready_players in room {room}")
        
        # Emit leave notification
        emit('user_left', {
            'player_id': player_id,
            'ready_players': lobbies[room]['ready_players'],
            'total_players': len(lobbies[room]['ready_players'])
        }, room=room)
    else:
        print(f"Server: Error - Room {room} not found")

@socketio.on('player_ready')
def handle_player_ready(data):
    room = data.get('room')
    is_ready = data.get('is_ready', False)
    player_id = get_player_id()
    player_name = data.get('name', '')
    language = data.get('language', 'sv')
    
    if not player_id:
        print("Server: Error - No player ID in session")
        emit('error', {'message': 'No player ID in session'})
        return
        
    print(f"\n=== PLAYER READY EVENT ===")
    print(f"Player {player_id} ready event received for room {room}, is_ready: {is_ready}")
    
    if room in lobbies:
        # Don't allow host to change ready status
        if player_id == lobbies[room]['host']:
            print(f"Server: Host {player_id} cannot change ready status")
            return
            
        # Update player data
        if player_id not in lobbies[room]['players']:
            lobbies[room]['players'][player_id] = {
                "name": player_name,
                "ready": is_ready,
                "language": language,
                "score": 0
            }
        else:
            lobbies[room]['players'][player_id].update({
                "name": player_name,
                "ready": is_ready,
                "language": language
            })
        
        # Update ready status
        if player_id in lobbies[room]['ready_players']:
            lobbies[room]['ready_players'][player_id] = is_ready
            print(f"Server: Updated ready status for player {player_id} in room {room} to {is_ready}")
            
            # Count ready players (host is always counted as ready)
            ready_count = sum(1 for pid, status in lobbies[room]['ready_players'].items() 
                            if status or pid == lobbies[room]['host'])
            total_players = len(lobbies[room]['ready_players'])
            all_ready = ready_count == total_players and total_players > 0
            
            print(f"Server: Room {room} status - All ready: {all_ready}, Ready count: {ready_count}/{total_players}")
            
            # Emit updated ready status to all players in the room
            ready_data = {
                'room': room,
                'players': lobbies[room]['players'],
                'ready_players': lobbies[room]['ready_players'],
                'total_players': total_players,
                'ready_count': ready_count,
                'all_ready': all_ready
            }
            print(f"Server: Emitting player_ready_status with data: {ready_data}")
            emit('player_ready_status', ready_data, room=room)
            
            # If all players are ready, notify the host
            if all_ready:
                print(f"Server: All players ready in room {room}, notifying host")
                emit('all_players_ready', {
                    'room': room,
                    'players': lobbies[room]['players'],
                    'ready_players': lobbies[room]['ready_players'],
                    'total_players': total_players,
                    'all_ready': True
                }, room=room)
        else:
            print(f"Server: Error - Player {player_id} not found in ready_players for room {room}")
            emit('error', {'message': 'Player not found in room'})
    else:
        print(f"Server: Error - Room {room} not found")
        emit('error', {'message': 'Room not found'})
    print("=== END PLAYER READY EVENT ===\n")

@socketio.on('start_game')
def handle_start_game(data):
    print(f"\n=== START GAME REQUEST ===")
    print(f"Data received: {data}")
    
    room = data.get('room')
    difficulty = data.get('difficulty', 'medium')
    max_score = data.get('max_score', 10)
    
    if not room:
        print("Missing room")
        emit('error', {'message': 'Missing room'})
        return
        
    if room not in lobbies:
        print(f"Room {room} not found")
        emit('error', {'message': 'Room not found'})
        return
        
    lobby = lobbies[room]
    print(f"Found lobby: {lobby}")
    
    # Store current players as previous players
    lobby["previous_players"] = {pid: data.copy() for pid, data in lobby["players"].items()}
    print(f"Stored previous players: {lobby['previous_players']}")
    
    # Verify all players are ready
    ready_count = sum(1 for pid, status in lobby['ready_players'].items() 
                     if status or pid == lobby['host'])
    total_players = len(lobby['ready_players'])
    
    print(f"Ready count: {ready_count}/{total_players}")
    
    if ready_count != total_players:
        print(f"Not all players are ready. Ready: {ready_count}/{total_players}")
        emit('error', {'message': 'Not all players are ready'})
        return
    
    # Update game settings
    lobby['difficulty'] = difficulty
    lobby['max_score'] = max_score
    lobby['game_started'] = True
    
    print(f"Updated game settings: difficulty={difficulty}, max_score={max_score}")
    
    # Get first word
    new_entry = get_new_word(None, difficulty)
    if new_entry is None:
        print("No word available")
        emit('error', {'message': 'No word available'})
        return
        
    lobby['current_entry'] = new_entry
    lobby['current_word'] = new_entry['word']
    lobby['word_start_time'] = time.time()
    lobby['passes'] = set()
    
    print(f"Starting game in room {room} with word: {new_entry['word']}")
    
    # Emit game started event to all players
    game_started_data = {
        'room': room,
        'current_word': new_entry['word'],
        'translations': {
            'sv': new_entry['translation_sv'],
            'fr': new_entry['translation_fr']
        }
    }
    print(f"Emitting game_started event with data: {game_started_data}")
    emit('game_started', game_started_data, room=room)
    
    print("=== END START GAME REQUEST ===\n")

@socketio.on('set_difficulty')
def handle_set_difficulty(data):
    room = data.get('room')
    difficulty = data.get('difficulty')
    
    if not room or not difficulty:
        return {'error': 'Missing room or difficulty'}
        
    if room not in lobbies:
        return {'error': 'Room not found'}
        
    lobby = lobbies[room]
    lobby['difficulty'] = difficulty
    
    # Broadcast the difficulty update to all players
    emit('difficulty_updated', {
        'difficulty': difficulty
    }, room=room)
    
    return {'status': 'success'}

@socketio.on('pass_word')
def handle_pass_word(data):
    print(f"Pass word event received: {data}")
    room = data.get('room')
    player_id = data.get('player_id')
    
    if not room or not player_id:
        print("Missing room or player_id")
        return {'error': 'Missing room or player_id'}
        
    if room not in lobbies:
        print(f"Room {room} not found")
        return {'error': 'Room not found'}
        
    lobby = lobbies[room]
    
    if not lobby.get('game_started'):
        print("Game not started")
        return {'error': 'Game not started'}
        
    if player_id not in lobby.get('passed_players', []):
        lobby.setdefault('passed_players', []).append(player_id)
        print(f"Player {player_id} passed. Total passes: {len(lobby.get('passed_players', []))}")
        
        # If all players have passed, get a new word
        if len(lobby.get('passed_players', [])) == len(lobby.get('players', [])):
            print("All players passed, getting new word")
            new_word = get_new_word(lobby.get('current_word'), lobby.get('difficulty', 'medium'))
            if new_word:
                lobby['current_word'] = new_word['word']
                lobby['current_entry'] = new_word
                lobby['word_start_time'] = time.time()
                lobby['passed_players'] = []
                
                # Broadcast new word to all players
                emit('new_word', {
                    'word': new_word['word'],
                    'translations': {
                        'sv': new_word['translation_sv'],
                        'fr': new_word['translation_fr']
                    }
                }, room=room)
            
        # Broadcast pass status to all players
        emit('pass_status', {
            'player_id': player_id,
            'passed_players': lobby.get('passed_players', [])
        }, room=room)
        
    return {'status': 'success'}

@socketio.on('timeout_word')
def handle_timeout_word(data):
    room = data.get('room')
    if not room:
        return
    
    print("=== HANDLING TIMEOUT WORD ===")
    print(f"Data received: {data}")
    
    if room not in lobbies:
        print(f"Room {room} not found")
        return
    
    lobby = lobbies[room]
    if not lobby.get('game_started'):
        print("Game not started")
        return
        
    # Check if game is already over
    if lobby.get('game_over'):
        print("Game is already over")
        return
    
    # Check if we're already processing a timeout
    if lobby.get('processing_timeout'):
        print("Already processing a timeout")
        return
    
    # Set processing flag
    lobby['processing_timeout'] = True
    
    try:
        # Add current word to history as not guessed
        if lobby.get('current_entry'):
            lobby['game_history'].append({
                "word": lobby['current_word'],
                "translations": {
                    "sv": lobby['current_entry']['translation_sv'],
                    "fr": lobby['current_entry']['translation_fr']
                },
                "guessed_by": None  # No one guessed it correctly
            })
        
        # Get new word
        new_entry = get_new_word(lobby['current_word'], lobby['difficulty'])
        if new_entry:
            # Update game state
            lobby['current_word'] = new_entry['word']
            lobby['current_entry'] = new_entry
            lobby['word_start_time'] = time.time()
            lobby['passes'] = set()
            
            # Make the word fall down for all players
            socketio.emit('word_fall_down', room=room)
            
            # Broadcast new word and scores
            socketio.emit('new_word', {
                'word': new_entry['word'],
                'translations': {
                    'sv': new_entry['translation_sv'],
                    'fr': new_entry['translation_fr']
                },
                'players': lobby['players']
            }, room=room)
            
            # Update scoreboard
            socketio.emit('update_scoreboard', {
                'players': lobby['players']
            }, room=room)
            
            print(f"New word set: {new_entry['word']}")
    finally:
        # Clear processing flag
        lobby['processing_timeout'] = False
    
    print("=== END HANDLING TIMEOUT WORD ===")

@socketio.on('guess_word')
def handle_guess_word(data):
    print("\n=== HANDLING GUESS WORD ===")
    print(f"Data received: {data}")
    
    room = data.get('room')
    player_id = data.get('player_id')
    guess = data.get('guess')
    
    if not all([room, player_id, guess]):
        print("Missing required data")
        return
    
    if room not in lobbies:
        print(f"Room {room} not found")
        return
    
    lobby = lobbies[room]
    if not lobby.get('game_started'):
        print("Game not started")
        return
    
    # Check if game is already over
    if lobby.get('game_over'):
        print("Game is already over")
        socketio.emit('guess_result', {'correct': False, 'game_over': True})
        return
    
    current_word = lobby.get('current_word')
    current_entry = lobby.get('current_entry', {})
    
    if not current_word or not current_entry:
        print("No current word")
        return
    
    # Get the player's language from the lobby data
    player_data = lobby['players'].get(player_id)
    if not player_data:
        print(f"Player {player_id} not found in lobby")
        return
    
    player_language = player_data.get('language', 'en')
    print(f"Player language from lobby: {player_language}")
    
    # If player is French, they need to guess the Swedish word and vice versa
    target_language = 'sv' if player_language == 'fr' else 'fr'
    translation_key = f'translation_{target_language}'
    correct_translation = current_entry.get(translation_key)
    
    if not correct_translation:
        print(f"No translation found for language {target_language}")
        return
    
    # Normalize both the guess and the correct answer
    normalized_guess = normalize_text(guess)
    normalized_answer = normalize_text(correct_translation)
    
    print(f"Player language: {player_language}")
    print(f"Target language: {target_language}")
    print(f"Guess {guess} (normalized: {normalized_guess})")
    print(f"Correct answer: {correct_translation} (normalized: {normalized_answer})")
    
    is_correct = normalized_guess == normalized_answer
    print(f"Guess is {'correct' if is_correct else 'incorrect'}")
    
    if is_correct:
        # Add current word to history as guessed
        lobby['game_history'].append({
            "word": current_word,
            "translations": {
                "sv": current_entry['translation_sv'],
                "fr": current_entry['translation_fr']
            },
            "guessed_by": player_data['name']
        })
        
        # Update player score
        if player_id in lobby['players']:
            lobby['players'][player_id]['score'] += 1
            print(f"Updated score for player {player_id}: {lobby['players'][player_id]['score']}")
            
            # Check if game is over
            max_score = lobby.get('max_score', 10)
            print(f"Current score: {lobby['players'][player_id]['score']}, Max score: {max_score}")
            if lobby['players'][player_id]['score'] >= max_score:
                print(f"Game over! Player {player_id} reached max score")
                lobby['game_over'] = True
                lobby['winner'] = lobby['players'][player_id]['name']
                
                # Broadcast game over
                socketio.emit('game_over', {
                    'winner': lobby['winner'],
                    'players': lobby['players'],
                    'game_history': lobby['game_history']
                }, room=room)
                
                # Send guess result to the player
                socketio.emit('guess_result', {'correct': True, 'game_over': True})
                
                # Broadcast updated scores
                socketio.emit('update_scoreboard', {'players': lobby['players']}, room=room)
                return  # End the game here
            
            # Get new word for next round
            new_entry = get_new_word(lobby['current_word'], lobby.get('difficulty', 'medium'))
            if new_entry:
                print(f"Getting new word: {new_entry['word']}")
                lobby['current_word'] = new_entry['word']
                lobby['current_entry'] = new_entry
                lobby['word_start_time'] = time.time()
                lobby['passes'] = set()
                
                # Broadcast new word and scores
                socketio.emit('new_word', {
                    'word': new_entry['word'],
                    'translations': {
                        'sv': new_entry['translation_sv'],
                        'fr': new_entry['translation_fr']
                    },
                    'players': lobby['players']
                }, room=room)
                
                # Update scoreboard
                socketio.emit('update_scoreboard', {'players': lobby['players']}, room=room)
    
    # Send guess result to the player
    socketio.emit('guess_result', {'correct': is_correct})
    
    # If guess was correct, make the word fall down for other players
    if is_correct:
        socketio.emit('word_fall_down', room=room, skip_sid=request.sid)
    
    # Broadcast updated scores
    socketio.emit('update_scoreboard', {'players': lobby['players']}, room=room)
    
    print("=== END HANDLING GUESS WORD ===\n")

@socketio.on('create_room')
def handle_create_room(data):
    print("\n=== ROOM CREATION REQUEST ===")
    room = str(uuid.uuid4())[:8]
    player_id = request.sid
    
    # Create room with initial player
    lobbies[room] = {
        'players': {
            player_id: {
                'name': data['name'],
                'language': data['language'],
                'ready': False,
                'score': 0
            }
        },
        'host': player_id,
        'current_word': None,
        'current_entry': None,
        'difficulty': 'medium',
        'max_score': None,
        'game_over': False,
        'winner': None,
        'passes': set(),
        'game_history': [],
        'game_started': False
    }
    
    join_room(room)
    emit('room_created', {
        'room': room,
        'player_id': player_id,
        'is_host': True
    })
    print("=== END ROOM CREATION REQUEST ===\n")

@socketio.on('join_room')
def handle_join_room(data):
    print(f"\n=== HANDLING JOIN ROOM ===")
    print(f"Data received: {data}")
    
    room = data.get('room')
    player_name = data.get('player_name')
    player_language = data.get('player_language')
    
    if not all([room, player_name, player_language]):
        print("Missing required data")
        return
    
    if room not in lobbies:
        print(f"Room {room} not found")
        return
    
    player_id = get_player_id()
    if not player_id:
        print("No player ID found")
        return
    
    print(f"Player {player_id} joining room {room}")
    print(f"Name: {player_name}")
    print(f"Language: {player_language}")
    
    # Update player info in lobby
    lobby = lobbies[room]
    is_host = player_id == lobby['host']
    
    lobby['players'][player_id] = {
        "name": player_name,
        "ready": is_host,  # Host is always ready
        "language": player_language,
        "score": 0
    }
    
    # Add player to ready_players if not already there
    if player_id not in lobby['ready_players']:
        lobby['ready_players'][player_id] = is_host  # Host is always ready
        print(f"Added player {player_id} to ready_players in room {room} with ready status {is_host}")
    
    # Join the socket room
    join_room(room)
    
    # Emit room_joined event back to the client
    emit('room_joined', {
        'room': room,
        'player_id': player_id,
        'is_host': is_host,
        'players': lobby['players']
    })
    
    # Broadcast to other players that someone joined
    emit('user_joined', {
        'players': lobby['players']
    }, room=room, include_self=False)
    
    print(f"=== END HANDLING JOIN ROOM ===\n")

@socketio.on('chat_message')
def handle_chat_message(data):
    print(f"\n=== CHAT MESSAGE ===")
    print(f"Data received: {data}")
    
    room = data.get('room')
    message = data.get('message')
    sender = data.get('sender')
    message_id = data.get('message_id')
    
    if not all([room, message, sender]):
        print("Missing required data")
        return
    
    if room not in lobbies:
        print(f"Room {room} not found")
        return
    
    # Broadcast the message to all players in the room
    emit('chat_message', {
        'sender': sender,
        'message': message,
        'message_id': message_id
    }, room=room)
    
    print("=== END CHAT MESSAGE ===\n")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"\n=== HANDLING DISCONNECT ===")
    player_id = get_player_id()
    if not player_id:
        print("No player ID found")
        return
        
    print(f"Player {player_id} disconnected")
    
    # Find and clean up player from all lobbies
    for room, lobby in list(lobbies.items()):
        if player_id in lobby['players']:
            print(f"Removing player {player_id} from room {room}")
            
            # Remove player from players and ready_players
            del lobby['players'][player_id]
            if player_id in lobby['ready_players']:
                del lobby['ready_players'][player_id]
            
            # If this was the host, assign a new host if there are other players
            if player_id == lobby['host'] and lobby['players']:
                new_host = next(iter(lobby['players']))
                lobby['host'] = new_host
                lobby['players'][new_host]['ready'] = True
                lobby['ready_players'][new_host] = True
                print(f"Assigned new host: {new_host}")
            
            # Only delete the lobby if it's empty and the game hasn't started
            if not lobby['players'] and not lobby.get('game_started'):
                print(f"Removing empty room {room}")
                del lobbies[room]
            else:
                # Notify remaining players
                emit('user_left', {
                    'players': lobby['players'],
                    'ready_players': lobby['ready_players']
                }, room=room)
    
    print("=== END HANDLING DISCONNECT ===\n")

@socketio.on('get_current_word')
def handle_get_current_word(data):
    print("\n=== HANDLING GET CURRENT WORD ===")
    print(f"Data received: {data}")
    
    room = data.get('room')
    if not room:
        print("No room provided")
        return {'error': 'No room provided'}
    
    if room not in lobbies:
        print(f"Room {room} not found")
        return {'error': 'Room not found'}
    
    lobby = lobbies[room]
    if not lobby.get('game_started'):
        print("Game not started")
        return {'error': 'Game not started'}
    
    current_word = lobby.get('current_word')
    current_entry = lobby.get('current_entry', {})
    
    if not current_word or not current_entry:
        print("No current word")
        return {'error': 'No current word'}
    
    print(f"Current word: {current_word}")
    print(f"Current entry: {current_entry}")
    
    # Send the current word with translations
    emit('current_word', {
        'word': current_word,
        'translations': {
            'sv': current_entry.get('translation_sv', ''),
            'fr': current_entry.get('translation_fr', '')
        }
    })
    
    return {'status': 'success'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Run the Flask app")
    parser.add_argument('--local', action='store_true', help="Run in local development mode (with debug)")
    parser.add_argument('--host', default='0.0.0.0', help="Host address")
    parser.add_argument('--port', type=int, default=5000, help="Port number")
    args = parser.parse_args()
    if args.local:
        socketio.run(app, host=args.host, port=args.port, debug=True)
    else:
        socketio.run(app, host=args.host, port=args.port)
