from flask import Flask, render_template, redirect, url_for, request, jsonify, session
from flask_cors import CORS
import uuid, random, unicodedata, time, argparse, json

app = Flask(__name__)
app.secret_key = 'your_secret_key'
CORS(app)

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
#                "host": <player_id>, "passes": set() }
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
        "passes": set()
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
    elif lobby.get("current_word") and "word_start_time" in lobby:
        elapsed = time.time() - lobby["word_start_time"]
        remaining = max(0, 30 - elapsed)
        response["time_remaining"] = remaining
        if remaining == 0:
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

@app.route('/start_game/<lobby_id>', methods=['POST'])
def start_game(lobby_id):
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
                "players": lobby["players"]
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

@app.route('/submit', methods=['POST'])
def submit():
    data = request.get_json()
    word = data.get('word', '')
    print("Received word:", word)
    return jsonify({"status": "success", "received": word})

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Run the Flask app")
    parser.add_argument('--local', action='store_true', help="Run in local development mode (with debug)")
    parser.add_argument('--host', default='0.0.0.0', help="Host address")
    parser.add_argument('--port', type=int, default=5000, help="Port number")
    args = parser.parse_args()
    if args.local:
        app.run(host=args.host, port=args.port, debug=True)
    else:
        app.run(host=args.host, port=args.port)
