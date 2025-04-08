from flask import Flask, render_template, redirect, url_for, request, jsonify, session
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room
import uuid, random, unicodedata, time, argparse, json

app = Flask(__name__)
app.secret_key = 'your_secret_key'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Load the curated wordlist from a JSON Lines file.
# Place the curated file in a folder "wordlists" at the project root.
WORDLIST = []
try:
    with open("wordlists/wordlist.json", "r", encoding="utf-8") as f:
        # Each line should be a JSON object
        WORDLIST = [json.loads(line) for line in f if line.strip()]
    if not WORDLIST:
        print("Warning: WORDLIST is empty.")
except Exception as e:
    print("Error loading wordlist:", e)

def normalize_text(text):
    text = text.lower()
    text = unicodedata.normalize('NFD', text)
    return ''.join(c for c in text if unicodedata.category(c) != 'Mn')

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

    candidates = [
        entry for entry in WORDLIST
        if entry["word"].lower() != (current_word or "").lower()
           and entry.get("difficulty") in allowed
    ]
    if not candidates:
        candidates = [entry for entry in WORDLIST if entry["word"].lower() != (current_word or "").lower()]
        if not candidates:
            return None

    chosen = random.choice(candidates)
    return chosen

# In-memory storage for lobbies.
# Each lobby: { "players": { player_id: {name, ready, language, score} },
#                "current_word": <string>, "current_entry": <wordlist entry>,
#                "difficulty": <"very easy"|"easy"|"medium"|"hard">,
#                "max_score": <int>, "game_over": <bool>, "winner": <string>,
#                "host": <player_id>, "passes": set(), "game_history": [] }
lobbies = {}

def get_player_id():
    return session.get("player_id")

@app.route('/')
def index():
    return render_template('start.html')

@app.route('/create_lobby', methods=['POST'])
def create_lobby():
    session.clear()
    session["player_id"] = "pid-" + uuid.uuid4().hex[:9]
    lobby_id = str(uuid.uuid4())[:8]
    lobbies[lobby_id] = {
        "players": {},
        "current_word": None,
        "current_entry": None,
        "difficulty": "medium",
        "max_score": None,
        "game_over": False,
        "winner": None,
        "host": session["player_id"],
        "ready_players": {session["player_id"]: False},
        "passes": set(),
        "game_history": []  # List to store word history: [{word, translations, guessed_by}]
    }
    return redirect(url_for('lobby', lobby_id=lobby_id))

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

@app.route('/set_difficulty/<lobby_id>', methods=['POST'])
def set_difficulty(lobby_id):
    if lobby_id not in lobbies:
        return jsonify({"error": "Lobby not found"}), 404
    data = request.get_json()
    difficulty = data.get("difficulty", "medium")
    if difficulty not in ["very easy", "easy", "medium", "hard"]:
        return jsonify({"error": "Invalid difficulty"}), 400
    lobby = lobbies[lobby_id]
    lobby["difficulty"] = difficulty
    return jsonify({"status": "ok", "difficulty": difficulty})

@app.route('/pass/<lobby_id>', methods=['POST'])
def pass_word(lobby_id):
    if lobby_id not in lobbies:
        return jsonify({"error": "Lobby not found"}), 404
    lobby = lobbies[lobby_id]
    if lobby.get("game_over"):
        return jsonify({"error": "Game is over", "winner": lobby.get("winner")}), 400
    player_id = get_player_id()
    if not player_id or player_id not in lobby["players"]:
        return jsonify({"error": "Player not identified"}), 400
    if "passes" not in lobby:
        lobby["passes"] = set()
    lobby["passes"].add(player_id)
    if len(lobby["passes"]) == len(lobby["players"]):
        # Add current word to history before getting new word
        if lobby.get("current_entry"):
            lobby["game_history"].append({
                "word": lobby["current_word"],
                "translations": {
                    "sv": lobby["current_entry"]["translation_sw"],
                    "fr": lobby["current_entry"]["translation_fr"]
                },
                "guessed_by": None  # No one guessed it correctly
            })
        new_entry = get_new_word(lobby.get("current_word"), lobby.get("difficulty", "medium"))
        if new_entry is None:
            return jsonify({"error": "No new word available"}), 500
        lobby["current_entry"] = new_entry
        lobby["current_word"] = new_entry["word"]
        lobby["word_start_time"] = time.time()
        lobby["passes"] = set()
        return jsonify({
            "passed": True,
            "new_word": new_entry["word"],
            "translations": {
                "sv": new_entry["translation_sw"],
                "fr": new_entry["translation_fr"]
            },
            "players": lobby["players"]
        })
    else:
        return jsonify({
            "passed": False,
            "players": lobby["players"]
        })

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
                        "sv": lobby["current_entry"]["translation_sw"],
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
                    "sv": new_entry["translation_sw"],
                    "fr": new_entry["translation_fr"]
                }
    if lobby.get("current_word"):
        if "translations" not in response and lobby.get("current_entry"):
            response["translations"] = {
                "sv": lobby["current_entry"]["translation_sw"],
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
            "sv": new_entry["translation_sw"],
            "fr": new_entry["translation_fr"]
        },
        "players": players
    })

@app.route('/guess/<lobby_id>', methods=['POST'])
def guess(lobby_id):
    if lobby_id not in lobbies:
        return jsonify({"error": "Lobby not found"}), 404
    lobby = lobbies[lobby_id]
    if lobby.get("game_over"):
        return jsonify({"error": "Game is over", "winner": lobby.get("winner")}), 400
    player_id = get_player_id()
    if not player_id or player_id not in lobby["players"]:
        return jsonify({"error": "Player not identified"}), 400
    data = request.get_json()
    guess_text = data.get("guess", "")
    normalized_guess = normalize_text(guess_text)
    current_word = lobby.get("current_word")
    if not current_word:
        return jsonify({"error": "Game not started"}), 400
    player = lobby["players"][player_id]
    player_language = player.get("language", "sv")
    if not lobby.get("current_entry"):
        return jsonify({"error": "Current word entry missing"}), 400
    current_entry = lobby["current_entry"]
    # If player's language is Swedish, they see the Swedish word and must type the French translation.
    # Otherwise, they see the French word and must type the Swedish translation.
    if player_language == "sv":
        correct_answer = current_entry["translation_fr"]
    else:
        correct_answer = current_entry["translation_sw"]
    normalized_correct = normalize_text(correct_answer)
    if normalized_guess == normalized_correct:
        player["score"] += 1
        # Add current word to history with the player who guessed it
        lobby["game_history"].append({
            "word": current_word,
            "translations": {
                "sv": current_entry["translation_sw"],
                "fr": current_entry["translation_fr"]
            },
            "guessed_by": player["name"] if player["name"] else player_id
        })
        # Check if player's score has reached max_score (if set)
        max_score = lobby.get("max_score")
        if max_score and player["score"] >= max_score:
            lobby["game_over"] = True
            winner = player["name"] if player["name"] else player_id
            lobby["winner"] = winner
            return jsonify({
                "correct": True,
                "game_over": True,
                "winner": winner,
                "players": lobby["players"],
                "game_history": lobby["game_history"]
            })
        new_entry = get_new_word(lobby.get("current_word"), lobby.get("difficulty", "medium"))
        if new_entry is None:
            return jsonify({"error": "No new word available"}), 500
        lobby["current_entry"] = new_entry
        lobby["current_word"] = new_entry["word"]
        lobby["word_start_time"] = time.time()
        lobby["passes"] = set()
        return jsonify({
            "correct": True,
            "guesser": player_id,
            "new_word": new_entry["word"],
            "translations": {
                "sv": new_entry["translation_sw"],
                "fr": new_entry["translation_fr"]
            },
            "players": lobby["players"]
        })
    else:
        return jsonify({"correct": False})

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
        "game_history": []
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

# Socket event handlers
@socketio.on('join')
def on_join(data):
    room = data.get('room')
    player_id = request.sid
    print(f"Server: Player {player_id} joining room {room}")
    
    if room in lobbies:
        join_room(room)
        # Add player to ready_players if not already there
        if player_id not in lobbies[room]['ready_players']:
            lobbies[room]['ready_players'][player_id] = False
            print(f"Server: Added player {player_id} to ready_players in room {room}")
        
        # Emit join confirmation
        emit('user_joined', {
            'player_id': player_id,
            'ready_players': lobbies[room]['ready_players'],
            'total_players': len(lobbies[room]['ready_players'])
        }, room=room)
    else:
        print(f"Server: Error - Room {room} not found")
        emit('error', {'message': 'Room not found'})

@socketio.on('leave')
def on_leave(data):
    room = data.get('room')
    player_id = request.sid
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
    is_ready = data.get('is_ready', True)  # Default to True for backward compatibility
    print(f"Server: Player ready event received for room {room}, is_ready: {is_ready}")
    
    if room in lobbies:
        player_id = request.sid
        print(f"Server: Player {player_id} is ready in room {room}")
        
        # Add player to ready_players if not already there
        if player_id not in lobbies[room]['ready_players']:
            lobbies[room]['ready_players'][player_id] = False
            print(f"Server: Added player {player_id} to ready_players in room {room}")
        
        # Update player ready status
        lobbies[room]['ready_players'][player_id] = is_ready
        print(f"Server: Updated ready status for player {player_id} in room {room} to {is_ready}")
        
        # Check if all players are ready
        all_ready = all(lobbies[room]['ready_players'].values())
        total_players = len(lobbies[room]['ready_players'])
        ready_count = sum(1 for status in lobbies[room]['ready_players'].values() if status)
        
        print(f"Server: Room {room} status - All ready: {all_ready}, Ready count: {ready_count}/{total_players}")
        
        # Emit updated ready status to all players in the room
        emit('player_ready_status', {
            'ready_players': lobbies[room]['ready_players'],
            'total_players': total_players
        }, room=room)
        
        # If all players are ready, notify the host
        if all_ready:
            print(f"Server: All players ready in room {room}, notifying host")
            emit('all_players_ready', room=room)
    else:
        print(f"Server: Error - Room {room} not found")

@socketio.on('start_new_game')
def handle_start_new_game(data):
    room = data.get('room')
    print(f"Server: Start new game event received for room {room}")
    
    if room in lobbies:
        # Get game settings
        language = data.get('language', 'sv')
        difficulty = data.get('difficulty', 'medium')
        player_name = data.get('playerName', 'Player')
        
        print(f"Server: Starting new game in room {room} with settings:", {
            'language': language,
            'difficulty': difficulty,
            'player_name': player_name
        })
        
        # Reset ready status for all players
        lobbies[room]['ready_players'] = {player: False for player in lobbies[room]['ready_players']}
        print(f"Server: Reset ready status for all players in room {room}")
        
        # Emit game starting event
        emit('game_starting', room=room)
        print(f"Server: Emitted game_starting event to room {room}")
        
        # Start new game with settings
        start_new_game(room, language, difficulty)
    else:
        print(f"Server: Error - Room {room} not found")

def start_new_game(room, language, difficulty):
    print(f"Server: Starting new game for room {room}")
    try:
        # Reset game state
        lobbies[room]['game_state'] = {
            'current_word': '',
            'guessed_letters': set(),
            'wrong_guesses': 0,
            'max_wrong_guesses': 6,
            'game_over': False,
            'winner': None,
            'score': 0
        }
        
        # Get new word based on language and difficulty
        word = get_new_word(lobbies[room].get('current_word'), difficulty)
        if word:
            lobbies[room]['current_entry'] = word
            lobbies[room]['current_word'] = word['word']
            lobbies[room]['word_start_time'] = time.time()
            lobbies[room]['passes'] = set()
            
            print(f"Server: New game started in room {room} with word: {word['word']}")
            
            # Emit new game state to all players
            emit('new_game_state', {
                'current_word': word['word'],
                'translations': {
                    'sv': word['translation_sw'],
                    'fr': word['translation_fr']
                }
            }, room=room)
            print(f"Server: Emitted new game state to room {room}")
        else:
            print(f"Server: Error - No word available for room {room}")
            emit('error', {'message': 'No word available'}, room=room)
            
    except Exception as e:
        print(f"Server: Error starting new game in room {room}: {str(e)}")
        emit('error', {'message': 'Failed to start new game'}, room=room)

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
