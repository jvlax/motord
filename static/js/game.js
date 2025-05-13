// Initialize socket connection
const socket = io();
window.socket = socket;

// Get room and player info from hidden fields
const roomId = document.getElementById('roomId').value;
const playerId = document.getElementById('playerId').value;
const isHost = document.getElementById('isHost').value === 'true';
const playerLanguage = document.getElementById('playerLanguage').value;
const playerName = document.getElementById('playerName').value;

// Store in window for global access
window.currentRoom = roomId;
window.currentPlayer = playerId;
window.isHost = isHost;
window.playerLanguage = playerLanguage;
window.playerName = playerName;

// Join the room
socket.emit('join', { room: roomId });

// Initialize game state
document.addEventListener('DOMContentLoaded', function() {
    console.log('Game.js: Document ready, initializing game state');
    
    // Get the current word from the server
    socket.emit('get_current_word', { room: roomId });
    
    // Set up socket event handlers
    setupSocketEventHandlers();
});

let countdownTimeout = null;
let isGameOver = false;

function startCountdown() {
    const countdownBar = document.querySelector('.countdown-bar');
    const countdownProgress = document.querySelector('.countdown-progress');
    if (!countdownBar || !countdownProgress) return;
    
    // Clear any existing timeout
    if (countdownTimeout) {
        clearTimeout(countdownTimeout);
    }
    
    // Reset progress and force reflow
    countdownProgress.style.transition = 'none';
    countdownProgress.style.width = '100%';
    countdownProgress.offsetHeight; // Force reflow
    
    // Start the animation
    countdownProgress.style.transition = 'width 30s linear';
    countdownProgress.style.width = '0%';
    
    // Set timeout for when animation completes
    countdownTimeout = setTimeout(() => {
        if (!isGameOver) {
            socket.emit('timeout_word', {
                room: window.currentRoom
            });
        }
    }, 30000);
}

// Handle game events
socket.on('game_started', function(data) {
    console.log('Game started:', data);
    updateWordDisplay(data.current_word, data.translations);
    startCountdown();
    if (data.players) {
        updateScoreboard(data.players);
    }
});

socket.on('new_word', function(data) {
    console.log('New word received:', data);
    // Store the new word data but don't display it yet
    window.pendingNewWord = data;
});

socket.on('update_scoreboard', function(data) {
    console.log('Scoreboard update received:', data);
    if (data.players) {
        updateScoreboard(data.players);
    }
});

socket.on('current_word', function(data) {
    console.log('Current word received:', data);
    // Only update if we're not in the middle of an animation
    const wordDisplay = document.getElementById('currentWord');
    if (wordDisplay) {
        const isAnimating = wordDisplay.classList.contains('word-fly-out') || 
                          wordDisplay.classList.contains('word-fall-down');
        
        if (!isAnimating) {
            // Initial word display should not animate
            updateWordDisplay(data.word, data.translations, false);
            startCountdown();
        } else {
            // Store the word data to be displayed after animation
            window.pendingNewWord = data;
        }
    }
});

socket.on('user_joined', function(data) {
    console.log('User joined:', data);
    if (data.players) {
        updateScoreboard(data.players);
    }
});

function normalizeText(text) {
    return text.toLowerCase()
        .normalize('NFD')  // Decompose characters with diacritics
        .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
        .replace(/[^a-z0-9]/g, '');  // Remove any remaining special characters
}

function updateWordDisplay(word, translations, shouldAnimate = true) {
    const wordDisplay = document.getElementById('currentWord');
    if (!wordDisplay) {
        console.error('Word display element not found');
        return;
    }
    
    console.log('Updating word display:', {
        word,
        translations,
        playerLanguage: window.playerLanguage,
        shouldAnimate
    });
    
    // Get the translation for the player's language
    const displayWord = translations[window.playerLanguage];
    if (!displayWord) {
        console.error('No translation found for language:', window.playerLanguage);
        return;
    }
    
    console.log('Displaying word:', displayWord, 'for language:', window.playerLanguage);
    
    // Create a new word element
    const newWordDisplay = document.createElement('div');
    newWordDisplay.id = 'currentWord';
    newWordDisplay.className = 'word';
    if (shouldAnimate) {
        newWordDisplay.classList.add('word-drop-in');
    }
    newWordDisplay.textContent = displayWord;
    
    // Replace the word immediately
    wordDisplay.parentNode.replaceChild(newWordDisplay, wordDisplay);
    
    // Start countdown after new word is displayed
    startCountdown();
    
    // Clear any pending new word
    window.pendingNewWord = null;
}

function updateScoreboard(players) {
    console.log('Updating scoreboard with players:', players);
    const scoreboard = document.getElementById('scoreboard');
    if (!scoreboard) {
        console.error('Scoreboard element not found');
        return;
    }
    
    // Clear existing scores
    scoreboard.innerHTML = '';
    
    // Sort players by score
    const sortedPlayers = Object.entries(players).sort((a, b) => b[1].score - a[1].score);
    
    // Add each player's score
    sortedPlayers.forEach(([playerId, playerData]) => {
        const scoreItem = document.createElement('div');
        scoreItem.className = 'score-item';
        if (playerId === window.currentPlayer) {
            scoreItem.classList.add('current-player');
        }
        
        const playerName = document.createElement('div');
        playerName.className = 'player-name';
        playerName.textContent = playerData.name || 'Unknown';
        
        const playerScore = document.createElement('div');
        playerScore.className = 'player-score';
        playerScore.textContent = playerData.score;
        
        scoreItem.appendChild(playerName);
        scoreItem.appendChild(playerScore);
        scoreboard.appendChild(scoreItem);
    });
}

socket.on('game_over', function(data) {
    console.log('Game over event received:', data);
    isGameOver = true;
    if (countdownTimeout) {
        clearTimeout(countdownTimeout);
    }
    
    // Disable input
    const guessInput = document.getElementById('guessInput');
    const passButton = document.getElementById('passButton');
    if (guessInput) guessInput.disabled = true;
    if (passButton) passButton.disabled = true;
    
    // Show game over popup with summary
    const gameSummary = document.createElement('div');
    gameSummary.className = 'game-summary';
    
    let summaryHTML = `
        <div class="game-summary-content">
            <h2>Game Over!</h2>
            <h3>Winner: ${data.winner}</h3>
            <div class="word-history">
                <h4>Word History:</h4>
                <table>
                    <tr>
                        <th>Word</th>
                        <th>Swedish</th>
                        <th>French</th>
                        <th>Guessed By</th>
                    </tr>
    `;
    
    data.game_history.forEach(entry => {
        summaryHTML += `
            <tr>
                <td>${entry.word}</td>
                <td>${entry.translations.sv}</td>
                <td>${entry.translations.fr}</td>
                <td>${entry.guessed_by || 'No one'}</td>
            </tr>
        `;
    });
    
    summaryHTML += `
                </table>
            </div>
        </div>
    `;
    
    gameSummary.innerHTML = summaryHTML;
    document.body.appendChild(gameSummary);
    
    // Update scoreboard with final scores
    updateScoreboard(data.players);
});

// Handle input submission
const guessInput = document.getElementById('guessInput');
const passButton = document.getElementById('passButton');

function submitGuess() {
    if (isGameOver) {
        console.log('Game is over, ignoring guess');
        return;
    }
    
    const guess = guessInput.value.trim();
    if (guess) {
        // Normalize the guess to handle special characters
        const normalizedGuess = normalizeText(guess);
        
        console.log('Submitting guess:', {
            guess: normalizedGuess,
            playerId: window.currentPlayer,
            playerName: window.playerName
        });
        
        socket.emit('guess_word', {
            room: roomId,
            player_id: playerId,
            guess: normalizedGuess
        });
        guessInput.value = '';
    }
}

// Submit on enter
guessInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        submitGuess();
    }
});

// Handle pass button
passButton.addEventListener('click', function() {
    socket.emit('pass_word', {
        room: roomId,
        player_id: playerId
    });
});

// Show winner popup
function showWinnerPopup(winner, gameHistory) {
    const popup = document.getElementById('winnerPopup');
    const message = document.getElementById('winnerMessage');
    
    message.textContent = `Game Over! ${winner} wins!`;
    popup.style.display = 'flex';
    
    // Show play again section
    showPlayAgainSection();
}

// Play Again functionality
function initializePlayAgain() {
    console.log('Game.js: Initializing play again functionality');
    const playAgainSection = document.getElementById('playAgainSection');
    const playAgainSettings = document.getElementById('playAgainSettings');
    const playAgainReadyStatus = document.getElementById('playAgainReadyStatus');
    const playAgainButton = document.getElementById('playAgainButton');
    const playAgainReadyButton = document.getElementById('playAgainReadyButton');
    
    if (!playAgainSection || !playAgainSettings || !playAgainReadyStatus || !playAgainButton) {
        console.error('Game.js: Required play again elements not found');
        return;
    }

    // Show/hide controls based on player role
    if (isHost) {
        document.getElementById('hostControls').style.display = 'flex';
        document.getElementById('guestControls').style.display = 'none';
    } else {
        document.getElementById('hostControls').style.display = 'none';
        document.getElementById('guestControls').style.display = 'flex';
    }
    
    // Initialize socket event listeners for play again
    if (!window.socket) {
        console.error('Game.js: window.socket is not defined');
        return;
    }
    
    window.socket.on('player_ready_status', (data) => {
        console.log('Game.js: Received player_ready_status:', data);
        updateReadyStatus(data);
    });

    window.socket.on('game_starting', () => {
        console.log('Game.js: Game starting event received');
        if (playAgainButton) playAgainButton.disabled = true;
        if (playAgainReadyStatus) playAgainReadyStatus.textContent = 'Game is starting...';
    });

    // Handle ready button click for non-host players
    if (!isHost && playAgainReadyButton) {
        playAgainReadyButton.addEventListener('click', function() {
            const isReady = this.classList.contains('ready-on');
            this.classList.toggle('ready-on');
            this.classList.toggle('ready-not-ready');
            this.textContent = isReady ? 'Ready' : 'Not Ready';
            
            window.socket.emit('player_ready', { 
                room: window.currentRoom,
                is_ready: !isReady
            });
        });
    }

    // Handle play again button click for host
    if (isHost && playAgainButton) {
        playAgainButton.addEventListener('click', function() {
            const difficulty = document.getElementById('playAgainDifficultySelect')?.value || 'medium';
            const maxScore = document.getElementById('playAgainMaxScoreInput')?.value || 10;
            
            window.socket.emit('start_new_game', {
                room: window.currentRoom,
                difficulty: difficulty,
                max_score: maxScore
            });
        });
    }
}

function updateReadyStatus(data) {
    const playAgainReadyStatus = document.getElementById('playAgainReadyStatus');
    if (!playAgainReadyStatus) return;

    const { ready_players, total_players } = data;
    const readyCount = Object.values(ready_players).filter(status => status).length;
    
    if (isHost) {
        playAgainReadyStatus.textContent = `${readyCount}/${total_players} players ready`;
        const playAgainButton = document.getElementById('playAgainButton');
        if (playAgainButton) {
            playAgainButton.disabled = readyCount < total_players;
        }
    } else {
        playAgainReadyStatus.textContent = `Waiting for host to start... (${readyCount}/${total_players} ready)`;
    }
}

// Initialize play again section when the game ends
function showPlayAgainSection() {
    const playAgainSection = document.getElementById('playAgainSection');
    if (playAgainSection) {
        playAgainSection.style.display = 'block';
        initializePlayAgain();
    }
}

// Initialize socket connection
function initializeSocket() {
    if (!window.socket) {
        console.error('Game.js: window.socket is not defined');
        return false;
    }
    return true;
}

// Socket event handlers for Play Again
function setupSocketEventHandlers() {
    if (!initializeSocket()) {
        setTimeout(setupSocketEventHandlers, 1000);
        return;
    }

    // Remove any existing event listeners to prevent duplicates
    window.socket.off('game_settings_updated');
    window.socket.off('player_ready_status');
    window.socket.off('game_starting');
    window.socket.off('new_game_started');

    // Set up socket event listeners
    window.socket.on('game_settings_updated', function(data) {
        const difficultySelect = document.getElementById('playAgainDifficultySelect');
        const maxScoreInput = document.getElementById('playAgainMaxScoreInput');
        
        if (difficultySelect) difficultySelect.value = data.difficulty;
        if (maxScoreInput) maxScoreInput.value = data.maxScore;
    });

    window.socket.on('player_ready_status', function(data) {
        if (data.room === window.currentRoom) {
            updateReadyStatus(data);
        }
    });

    window.socket.on('game_starting', function(data) {
        if (data.room === window.currentRoom) {
            const playAgainButton = document.getElementById('playAgainButton');
            const playAgainReadyStatus = document.getElementById('playAgainReadyStatus');
            
            if (playAgainButton) playAgainButton.disabled = true;
            if (playAgainReadyStatus) playAgainReadyStatus.textContent = 'Game is starting...';
        }
    });

    window.socket.on('new_game_started', function(data) {
        if (data.room === window.currentRoom) {
            window.location.reload();
        }
    });
}

// Handle correct guess animation
socket.on('guess_result', function(data) {
    if (data.correct && !isGameOver) {
        const wordDisplay = document.getElementById('currentWord');
        if (wordDisplay) {
            // Remove any existing animation classes
            wordDisplay.classList.remove('word-fall-down', 'word-drop-in');
            // Add the fly-out animation
            wordDisplay.classList.add('word-fly-out');
            
            // Wait for the animation to complete before allowing new word
            wordDisplay.addEventListener('animationend', () => {
                // Remove the animation class
                wordDisplay.classList.remove('word-fly-out');
                // Request new word after animation completes
                socket.emit('get_current_word', { room: window.currentRoom });
            }, { once: true });
        }
    }
});

// Handle word falling down for other players when someone guesses correctly
socket.on('word_fall_down', function() {
    if (!isGameOver) {
        const wordDisplay = document.getElementById('currentWord');
        if (wordDisplay) {
            // Remove any existing animation classes
            wordDisplay.classList.remove('word-fly-out', 'word-drop-in');
            // Add the fall-down animation
            wordDisplay.classList.add('word-fall-down');
            
            // Wait for the animation to complete before allowing new word
            wordDisplay.addEventListener('animationend', () => {
                // Remove the animation class
                wordDisplay.classList.remove('word-fall-down');
                // Request new word after animation completes
                socket.emit('get_current_word', { room: window.currentRoom });
            }, { once: true });
        }
    }
}); 