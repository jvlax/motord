from flask import Flask, render_template, redirect, url_for, request, jsonify, session
from flask_cors import CORS
import uuid, random, unicodedata, time
import argparse

app = Flask(__name__)
app.secret_key = 'your_secret_key'
CORS(app)

# Word bank: 10 easy words and 10 difficult words in English
word_bank = {
    "easy": ["apple", "banana", "cat", "dog", "house", "tree", "car", "book", "sun", "water"],
    "difficult": ["quintessence", "obfuscate", "antediluvian", "incongruous", "ephemeral", "labyrinth", "serendipity", "plethora", "mellifluous", "paradigm"]
}

# Translations mapping: English word -> { "sv": Swedish translation, "fr": French translation }
translations = {
    "apple": {"sv": "äpple", "fr": "pomme"},
    "banana": {"sv": "banan", "fr": "banane"},
    "cat": {"sv": "katt", "fr": "chat"},
    "dog": {"sv": "hund", "fr": "chien"},
    "house": {"sv": "hus", "fr": "maison"},
    "tree": {"sv": "träd", "fr": "arbre"},
    "car": {"sv": "bil", "fr": "voiture"},
    "book": {"sv": "bok", "fr": "livre"},
    "sun": {"sv": "sol", "fr": "soleil"},
    "water": {"sv": "vatten", "fr": "eau"},
    "quintessence": {"sv": "kvintessens", "fr": "quintessence"},
    "obfuscate": {"sv": "formorka", "fr": "obscurcir"},
    "antediluvian": {"sv": "forhistorisk", "fr": "antediluvien"},
    "incongruous": {"sv": "inkongruent", "fr": "incongru"},
    "ephemeral": {"sv": "flyktig", "fr": "éphémère"},
    "labyrinth": {"sv": "labyrint", "fr": "labyrinthe"},
    "serendipity": {"sv": "tur", "fr": "serendipité"},
    "plethora": {"sv": "överflöd", "fr": "pléthore"},
    "mellifluous": {"sv": "lättflytande", "fr": "melliflu"},
    "paradigm": {"sv": "paradigm", "fr": "paradigme"}
}

def normalize_text(text):
    text = text.lower()
    text = unicodedata.normalize('NFD', text)
    return ''.join(c for c in text if unicodedata.category(c) != 'Mn')

def get_new_word(current_word, difficulty):
    if difficulty == "easy":
        all_words = word_bank["easy"]
    elif difficulty == "hard":
        all_words = word_bank["difficult"]
    else:
        all_words = word_bank["easy"] + word_bank["difficult"]
    new_word = random.choice(all_words)
    while current_word is not None and new_word == current_word:
        new_word = random.choice(all_words)
    return new_word

# In-memory storage for lobbies.
# Each lobby: { "players": { player_id: {name, ready, language, score} },
#                "current_word": None, "difficulty": <"easy"|"medium"|"hard">,
#                "host": <player_id>, "word_start_time": <timestamp>, "passes": set() }
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
        "difficulty": "medium",
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
    return jsonify({"status": "ok", "players": lobby["players"]})

@app.route('/set_difficulty/<lobby_id>', methods=['POST'])
def set_difficulty(lobby_id):
    if lobby_id not in lobbies:
        return jsonify({"error": "Lobby not found"}), 404
    data = request.get_json()
    difficulty = data.get("difficulty", "medium")
    if difficulty not in ["easy", "medium", "hard"]:
        return jsonify({"error": "Invalid difficulty"}), 400
    lobby = lobbies[lobby_id]
    lobby["difficulty"] = difficulty
    return jsonify({"status": "ok", "difficulty": difficulty})

@app.route('/pass/<lobby_id>', methods=['POST'])
def pass_word(lobby_id):
    if lobby_id not in lobbies:
        return jsonify({"error": "Lobby not found"}), 404
    lobby = lobbies[lobby_id]
    player_id = get_player_id()
    if not player_id or player_id not in lobby["players"]:
        return jsonify({"error": "Player not identified"}), 400
    if "passes" not in lobby:
        lobby["passes"] = set()
    lobby["passes"].add(player_id)
    if len(lobby["passes"]) == len(lobby["players"]):
        new_word = get_new_word(lobby.get("current_word"), lobby.get("difficulty", "medium"))
        lobby["current_word"] = new_word
        lobby["word_start_time"] = time.time()
        lobby["passes"] = set()
        return jsonify({
            "passed": True,
            "new_word": new_word,
            "translations": translations[new_word],
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
    if lobby.get("current_word") and "word_start_time" in lobby:
        elapsed = time.time() - lobby["word_start_time"]
        remaining = max(0, 30 - elapsed)
        response["time_remaining"] = remaining
        if remaining == 0:
            new_word = get_new_word(lobby.get("current_word"), lobby.get("difficulty", "medium"))
            lobby["current_word"] = new_word
            lobby["word_start_time"] = time.time()
            lobby["passes"] = set()
            response["current_word"] = new_word
            response["translations"] = translations[new_word]
    if lobby.get("current_word"):
        response.setdefault("translations", translations[lobby["current_word"]])
    return jsonify(response)

@app.route('/start_game/<lobby_id>', methods=['POST'])
def start_game(lobby_id):
    if lobby_id not in lobbies:
        return jsonify({"error": "Lobby not found"}), 404
    lobby = lobbies[lobby_id]
    players = lobby.get("players", {})
    if players and any(not p.get("ready") for p in players.values()):
        return jsonify({"error": "Not all players are ready"}), 400
    new_word = get_new_word(lobby.get("current_word"), lobby.get("difficulty", "medium"))
    lobby["current_word"] = new_word
    lobby["word_start_time"] = time.time()
    lobby["passes"] = set()
    print(f"Lobby {lobby_id} started game with word: {new_word}")
    return jsonify({
        "current_word": new_word,
        "translations": translations[new_word],
        "players": players
    })

@app.route('/guess/<lobby_id>', methods=['POST'])
def guess(lobby_id):
    if lobby_id not in lobbies:
        return jsonify({"error": "Lobby not found"}), 404
    lobby = lobbies[lobby_id]
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
    if player_language == "sv":
        correct_answer = translations[current_word]["fr"]
    else:
        correct_answer = translations[current_word]["sv"]
    normalized_correct = normalize_text(correct_answer)
    if normalized_guess == normalized_correct:
        player["score"] += 1
        new_word = get_new_word(lobby.get("current_word"), lobby.get("difficulty", "medium"))
        lobby["current_word"] = new_word
        lobby["word_start_time"] = time.time()
        lobby["passes"] = set()
        return jsonify({
            "correct": True,
            "guesser": player_id,
            "new_word": new_word,
            "translations": translations[new_word],
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
