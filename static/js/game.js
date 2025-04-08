// Play Again functionality
function initializePlayAgain() {
    console.log('Game.js: Initializing play again functionality');
    const playAgainSection = document.getElementById('playAgainSection');
    const playAgainSettings = document.getElementById('playAgainSettings');
    const playAgainReadyStatus = document.getElementById('playAgainReadyStatus');
    const playAgainButton = document.getElementById('playAgainButton');
    const playAgainReadyButton = document.getElementById('playAgainReadyButton');
    
    console.log('Game.js: Play again elements found:', {
        playAgainSection: !!playAgainSection,
        playAgainSettings: !!playAgainSettings,
        playAgainReadyStatus: !!playAgainReadyStatus,
        playAgainButton: !!playAgainButton,
        playAgainReadyButton: !!playAgainReadyButton
    });
    
    if (!playAgainSection || !playAgainSettings || !playAgainReadyStatus || !playAgainButton) {
        console.error('Game.js: Required play again elements not found:', {
            playAgainSection: !!playAgainSection,
            playAgainSettings: !!playAgainSettings,
            playAgainReadyStatus: !!playAgainReadyStatus,
            playAgainButton: !!playAgainButton
        });
        return;
    }

    // Show/hide controls based on player role
    const isHost = window.isHost;
    console.log('Game.js: Player role:', isHost ? 'host' : 'guest');
    console.log('Game.js: window.isHost value:', window.isHost);
    console.log('Game.js: document.body.dataset.isHost value:', document.body.dataset.isHost);
    
    // Initialize socket event listeners for play again
    if (!window.socket) {
        console.error('Game.js: window.socket is not defined');
        return;
    }
    
    console.log('Game.js: Setting up socket event listeners');
    
    // Join the room
    console.log('Game.js: Joining room:', window.currentRoom);
    window.socket.emit('join', { room: window.currentRoom });
    
    window.socket.on('user_joined', (data) => {
        console.log('Game.js: User joined event received:', data);
        updateReadyStatus(data);
    });
    
    window.socket.on('user_left', (data) => {
        console.log('Game.js: User left event received:', data);
        updateReadyStatus(data);
    });
    
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
        console.log('Game.js: Setting up ready button for non-host player');
        playAgainReadyButton.addEventListener('click', function() {
            console.log('Game.js: Ready button clicked by non-host player');
            const isReady = this.classList.contains('ready-on');
            this.classList.toggle('ready-on');
            this.classList.toggle('ready-not-ready');
            this.textContent = isReady ? 'Ready' : 'Not Ready';
            
            window.socket.emit('player_ready', { 
                room: window.currentRoom,
                is_ready: !isReady
            });
            
            if (playAgainReadyStatus) {
                playAgainReadyStatus.textContent = isReady ? 
                    'Waiting for host to start...' : 
                    'Click Ready when you want to play again';
            }
        });
    }

    // Handle play again button click for host
    if (isHost && playAgainButton) {
        console.log('Game.js: Setting up play again button for host');
        playAgainButton.addEventListener('click', function() {
            console.log('Game.js: Play again button clicked by host');
            const language = document.getElementById('playAgainLanguageSelect')?.value || 'sv';
            const difficulty = document.getElementById('playAgainDifficultySelect')?.value || 'medium';
            const playerName = document.getElementById('playAgainPlayerName')?.value || 'Player';
            
            console.log('Game.js: Starting new game with settings:', { language, difficulty, playerName });
            
            window.socket.emit('start_new_game', {
                room: window.currentRoom,
                language: language,
                difficulty: difficulty,
                playerName: playerName
            });
        });
    }
}

function updateReadyStatus(data) {
    console.log('Game.js: Updating ready status with data:', data);
    const playAgainReadyStatus = document.getElementById('playAgainReadyStatus');
    if (!playAgainReadyStatus) {
        console.error('Game.js: playAgainReadyStatus element not found');
        return;
    }

    const { ready_players, total_players } = data;
    const readyCount = Object.values(ready_players).filter(status => status).length;
    
    console.log('Game.js: Ready count:', readyCount, 'Total players:', total_players);
    
    if (window.isHost) {
        console.log('Game.js: Updating ready status for host');
        playAgainReadyStatus.textContent = `${readyCount}/${total_players} players ready`;
        const playAgainButton = document.getElementById('playAgainButton');
        if (playAgainButton) {
            playAgainButton.disabled = readyCount < total_players;
            console.log('Game.js: Play again button disabled:', readyCount < total_players);
        }
    } else {
        console.log('Game.js: Updating ready status for non-host');
        playAgainReadyStatus.textContent = `Waiting for host to start... (${readyCount}/${total_players} ready)`;
    }
}

// Initialize play again section when the game ends
function showPlayAgainSection() {
    console.log('Game.js: Showing play again section');
    const playAgainSection = document.getElementById('playAgainSection');
    if (playAgainSection) {
        playAgainSection.style.display = 'block';
        console.log('Game.js: Play again section displayed');
        
        // Check computed style after setting display
        const computedStyle = window.getComputedStyle(playAgainSection);
        console.log('Game.js: Play Again Section computed style after display:block:', {
            backgroundColor: computedStyle.backgroundColor,
            display: computedStyle.display,
            visibility: computedStyle.visibility
        });
        
        initializePlayAgain();
    } else {
        console.error('Game.js: playAgainSection element not found');
    }
}

// Initialize socket connection
function initializeSocket() {
    console.log('Game.js: Initializing socket connection');
    if (!window.socket) {
        console.error('Game.js: window.socket is not defined');
        return false;
    }
    return true;
}

// Socket event handlers for Play Again
function setupSocketEventHandlers() {
    console.log('Game.js: Setting up socket event handlers');
    if (!initializeSocket()) {
        console.log('Game.js: Socket not available, retrying in 1 second...');
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
        console.log('Game.js: Game settings updated:', data);
        const difficultySelect = document.getElementById('playAgainDifficultySelect');
        const maxScoreInput = document.getElementById('playAgainMaxScoreInput');
        
        if (difficultySelect) difficultySelect.value = data.difficulty;
        if (maxScoreInput) maxScoreInput.value = data.maxScore;
    });

    window.socket.on('player_ready_status', function(data) {
        console.log('Game.js: Player ready status update:', data);
        if (data.room === window.currentRoom) {
            updateReadyStatus(data);
        }
    });

    window.socket.on('game_starting', function(data) {
        console.log('Game.js: Game starting event received:', data);
        if (data.room === window.currentRoom) {
            const playAgainButton = document.getElementById('playAgainButton');
            const playAgainReadyStatus = document.getElementById('playAgainReadyStatus');
            
            if (playAgainButton) playAgainButton.disabled = true;
            if (playAgainReadyStatus) playAgainReadyStatus.textContent = 'Game is starting...';
        }
    });

    window.socket.on('new_game_started', function(data) {
        console.log('Game.js: New game started event received:', data);
        if (data.room === window.currentRoom) {
            resetGameState();
            startNewGame(data);
        }
    });
}

// Call setupSocketEventHandlers when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Game.js: Document ready, setting up socket handlers');
    // Wait a short moment to ensure main.js has initialized the socket
    setTimeout(setupSocketEventHandlers, 100);
});

function showWinnerPopup(winner, gameHistory) {
    console.log('Game.js: Showing winner popup for:', winner);
    const winnerPopup = document.getElementById('winnerPopup');
    const winnerText = document.getElementById('winnerText');
    const historyTable = document.getElementById('historyTable');
    
    winnerText.textContent = `${winner} wins!`;
    
    // Clear existing table rows
    while (historyTable.rows.length > 1) {
        historyTable.deleteRow(1);
    }
    
    // Add game history rows
    gameHistory.forEach(entry => {
        const row = historyTable.insertRow();
        const wordCell = row.insertCell();
        const translationCell = row.insertCell();
        const guesserCell = row.insertCell();
        
        wordCell.textContent = entry.word;
        translationCell.textContent = entry.translations[window.PLAYER_LANGUAGE] || 'N/A';
        guesserCell.textContent = entry.guessed_by || 'Not guessed';
        
        if (entry.guessed_by) {
            row.classList.add('guessed');
        } else {
            row.classList.add('not-guessed');
        }
    });
    
    winnerPopup.style.display = 'block';
} 