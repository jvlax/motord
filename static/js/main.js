document.addEventListener('DOMContentLoaded', function() {
  // Initialize socket.io
  const socket = io();
  window.socket = socket; // Make socket globally accessible
  
  var gameStarted = false;
  var prevScores = {};
  var currentWordGlobal = null; // The current English word as set by the server
  var userReady = false; // Tracks current user's ready state
  var lastLeader = null;
  var lastLeaderScore = 0;
  var animationInProgress = false; // Prevent overlapping animations
  var justGuessedTime = 0; // Timestamp of last correct guess
  let isReady = false;
  let allPlayersReady = false;
  let currentRoom = LOBBY_ID; // Initialize currentRoom with LOBBY_ID
  window.currentRoom = currentRoom; // Make currentRoom globally accessible

  // Helper: Reset the fuse animation (when a new word is set)
  function resetFuse() {
    const fuse = document.getElementById('fuse');
    fuse.style.display = 'block';
    fuse.classList.remove('word-fade-down'); // Ensure fade-down class is removed
    fuse.style.animation = 'none';
    void fuse.offsetWidth; // Trigger reflow
    fuse.style.animation = 'fuseAnim 30s linear forwards';
  }

  // Helper: Hide the fuse immediately
  function hideFuse() {
    const fuse = document.getElementById('fuse');
    fuse.style.display = 'none';
  }

  // Helper: Reset timer (fuse) and remove pass indicator
  function resetTimer() {
    resetFuse();
    const passButton = document.getElementById('passButton');
    passButton.classList.remove('pass-selected');
  }

  // Get reference to the word display element
  const wordText = document.getElementById('wordText');

  // --- Input (Guess) submission logic ---
  const inputField = document.querySelector('.input-container input');
  inputField.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      const text = inputField.value;
      if (gameStarted && !animationInProgress) {
        fetch(`/guess/${LOBBY_ID}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            "X-Player-ID": window.PLAYER_ID
          },
          body: JSON.stringify({ guess: text })
        })
        .then(response => response.json())
        .then(data => {
          if (data.error) {
            console.log("Error from guess:", data.error);
            inputField.classList.add('shake');
            setTimeout(() => inputField.classList.remove('shake'), 500);
          } else if (data.correct) {
            inputField.classList.add('correct-flash');
            setTimeout(() => inputField.classList.remove('correct-flash'), 500);
            updateScoreboard(data.players);
            // Save the new word in currentWordGlobal
            currentWordGlobal = data.new_word;
            // Check if translations and playerLanguage exist before accessing
            const newWordDisplay = data.translations && window.playerLanguage && data.translations[window.playerLanguage] 
              ? data.translations[window.playerLanguage] 
              : data.new_word || "New Word";
            console.log("Correct guess received. data.guesser:", data.guesser, "window.PLAYER_ID:", window.PLAYER_ID);
            animationInProgress = true;
            // Use flyOut if local player is the guesser; otherwise, default fadeDown.
            if (data.guesser && window.PLAYER_ID === data.guesser) {
              console.log("Local player is the guesser. Using flyOut animation.");
              wordText.classList.add('word-fly-out');
              hideFuse();
              setTimeout(() => {
                wordText.classList.remove('word-fly-out');
                wordText.textContent = " ";
                setTimeout(() => {
                  wordText.classList.add('word-fade-in');
                  setTimeout(() => {
                    wordText.classList.remove('word-fade-in');
                    wordText.textContent = newWordDisplay.toUpperCase();
                    resetTimer();
                    animationInProgress = false;
                    justGuessedTime = Date.now();
                  }, 600);
                }, 500);
              }, 400);
            } else {
              console.log("Local player is NOT the guesser. Using fadeDown animation.");
              hideFuse();
              wordText.classList.add('word-fade-down');
              setTimeout(() => {
                wordText.classList.remove('word-fade-down');
                wordText.textContent = " ";
                setTimeout(() => {
                  wordText.classList.add('word-fade-in');
                  setTimeout(() => {
                    wordText.classList.remove('word-fade-in');
                    wordText.textContent = newWordDisplay.toUpperCase();
                    resetTimer();
                    animationInProgress = false;
                    justGuessedTime = Date.now();
                  }, 600);
                }, 500);
              }, 400);
            }
            inputField.value = "";
          } else {
            inputField.classList.add('shake');
            setTimeout(() => inputField.classList.remove('shake'), 500);
            inputField.value = "";
          }
        })
        .catch(error => console.error("Error:", error));
      }
    }
  });

  // --- Pass button logic ---
  const passButton = document.getElementById('passButton');
  passButton.addEventListener('click', function() {
    if (!gameStarted || animationInProgress) return;
    passButton.classList.add('pass-selected');
    fetch(`/pass/${LOBBY_ID}`, { method: 'POST' })
      .then(response => response.json())
      .then(data => {
        if (data.passed) {
          const lang = window.playerLanguage;
          let newWordDisplay = data.translations[lang];
          currentWordGlobal = data.new_word ? data.new_word : currentWordGlobal;
          wordText.textContent = newWordDisplay.toUpperCase();
          updateScoreboard(data.players);
          resetTimer();
        }
      })
      .catch(error => console.error("Error:", error));
  });

  // --- Ready button logic (toggle on/off) ---
  const readyButton = document.getElementById('readyButton');
  readyButton.addEventListener('click', function() {
    const playerNameInput = document.getElementById('playerName');
    const playerName = playerNameInput.value.trim();
    if (!playerName) {
      alert('Please enter your name.');
      return;
    }
    const language = document.getElementById('languageSelect').value;
    window.playerLanguage = language;
    // For the host, also include maxScore from the input field.
    let payload = { ready: true, name: playerName, language: language };
    if (window.isHost) {
      const maxScoreVal = document.getElementById('maxScoreInput').value;
      if (maxScoreVal) {
        payload.max_score = parseInt(maxScoreVal, 10);
      }
      fetch(`/set_difficulty/${LOBBY_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: document.getElementById('difficultySelect').value })
      })
      .then(() => {
        return fetch(`/set_ready/${LOBBY_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      })
      .then(response => response.json())
      .then(data => {
        readyButton.classList.remove('ready-not-ready');
        readyButton.classList.add('ready-on');
        userReady = true;
        window.playerName = playerName;
        console.log("Ready toggled ON for host");
      })
      .catch(error => console.error("Error:", error));
    } else {
      fetch(`/set_ready/${LOBBY_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(response => response.json())
      .then(data => {
        readyButton.classList.remove('ready-not-ready');
        readyButton.classList.add('ready-on');
        userReady = true;
        window.playerName = playerName;
        console.log("Ready toggled ON for guest");
      })
      .catch(error => console.error("Error:", error));
    }
  });

  // --- Start Game button logic (host only) ---
  const startGameButton = document.getElementById('startGameButton');
  startGameButton.addEventListener('click', function() {
    if (!window.isHost || !startGameButton.classList.contains('start-enabled')) return;
    fetch(`/start_game/${LOBBY_ID}`, { method: 'POST' })
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          alert(data.error);
          return;
        }
        gameStarted = true;
        currentWordGlobal = data.current_word;
        const lang = window.playerLanguage;
        let newWordDisplay = data.translations[lang];
        wordText.classList.add('word-pop');
        setTimeout(() => {
          wordText.classList.remove('word-pop');
          wordText.textContent = newWordDisplay.toUpperCase();
          resetTimer();
        }, 500);
        document.getElementById('scoreboard').style.display = 'block';
        updateScoreboard(data.players);
        document.querySelector('.combined-settings').style.display = 'none';
        document.getElementById('readyStatus').style.display = 'none';
      })
      .catch(error => console.error("Error:", error));
  });

  // --- Polling for lobby status every 2 seconds ---
  setInterval(() => {
    if (!animationInProgress && (Date.now() - justGuessedTime >= 2000)) {
      fetch(`/lobby_status/${LOBBY_ID}`)
        .then(response => response.json())
        .then(data => {
          // Check for game over and winner declaration
          if (data.game_over) {
            document.getElementById('winnerDiv').style.display = 'block';
            document.getElementById('winnerName').textContent = data.winner;
            // Populate game history table
            const historyTable = document.getElementById('historyTable').getElementsByTagName('tbody')[0];
            historyTable.innerHTML = ''; // Clear existing rows
            if (data.game_history) {
              data.game_history.forEach(entry => {
                const row = historyTable.insertRow();
                row.insertCell(0).textContent = entry.word;
                row.insertCell(1).textContent = entry.translations.sv;
                row.insertCell(2).textContent = entry.translations.fr;
                const guessedByCell = row.insertCell(3);
                if (entry.guessed_by) {
                  guessedByCell.textContent = entry.guessed_by;
                  guessedByCell.classList.add('guessed');
                } else {
                  guessedByCell.textContent = 'Not guessed';
                  guessedByCell.classList.add('not-guessed');
                }
              });
            }
            
            // Populate Play Again settings with current values
            const playerNameInput = document.getElementById('playerName');
            const languageSelect = document.getElementById('languageSelect');
            const difficultySelect = document.getElementById('difficultySelect');
            const maxScoreInput = document.getElementById('maxScoreInput');
            
            // Set values in the Play Again form
            document.getElementById('playAgainPlayerName').value = playerNameInput.value;
            document.getElementById('playAgainLanguageSelect').value = languageSelect.value;
            
            // Only show difficulty and max score if the current player is the host
            if (window.isHost) {
              document.getElementById('playAgainDifficultySelect').value = difficultySelect.value;
              document.getElementById('playAgainMaxScoreInput').value = maxScoreInput.value;
              document.getElementById('playAgainDifficultySelect').style.display = 'inline-block';
              document.getElementById('playAgainMaxScoreInput').style.display = 'inline-block';
            } else {
              document.getElementById('playAgainDifficultySelect').style.display = 'none';
              document.getElementById('playAgainMaxScoreInput').style.display = 'none';
            }
            
            // Optionally, disable input field and pass button
            inputField.disabled = true;
            passButton.disabled = true;
            return; // Stop further updates
          }
          const readyStatus = document.getElementById('readyStatus');
          readyStatus.textContent = data.ready_count + "/" + data.total_count + " players ready";
          if (data.total_count > 0 && data.ready_count === data.total_count) {
            if (window.isHost) {
              startGameButton.classList.add('start-enabled');
              startGameButton.classList.add('start-glow');
            }
          } else {
            startGameButton.classList.remove('start-enabled');
            startGameButton.classList.remove('start-glow');
          }
          if (data.current_word && data.translations) {
            gameStarted = true;
            if (currentWordGlobal !== data.current_word) {
              currentWordGlobal = data.current_word;
              resetTimer();
              animationInProgress = true;
              const lang = window.playerLanguage;
              let newWordDisplay = data.translations[lang];
              console.log("Polling detected new word. Running default fadeDown animation (hiding fuse).");
              hideFuse();
              wordText.classList.add('word-fade-down');
              setTimeout(() => {
                wordText.classList.remove('word-fade-down');
                wordText.textContent = " ";
                setTimeout(() => {
                  wordText.classList.add('word-fade-in');
                  setTimeout(() => {
                    wordText.classList.remove('word-fade-in');
                    wordText.textContent = newWordDisplay.toUpperCase();
                    resetTimer();
                    animationInProgress = false;
                    justGuessedTime = Date.now();
                  }, 600);
                }, 500);
              }, 400);
            }
            document.querySelector('.combined-settings').style.display = 'none';
            readyStatus.style.display = 'none';
            document.getElementById('scoreboard').style.display = 'block';
            updateScoreboard(data.players);
          }
        })
        .catch(error => console.error("Error:", error));
    }
  }, 2000);

  // --- Helper: Update scoreboard (sorted descending, pop effect on score number only) ---
  var lastLeader = null;
  var lastLeaderScore = 0;
  function updateScoreboard(players) {
    const scoreTable = document.getElementById('scoreTable');
    let playerArr = Object.entries(players).sort((a, b) => b[1].score - a[1].score);

    if (playerArr.length > 0) {
      const currentLeaderId = playerArr[0][0];
      const currentLeaderScore = playerArr[0][1].score;
      if (lastLeader !== null && currentLeaderId !== lastLeader && currentLeaderScore > lastLeaderScore) {
        const scoreboard = document.getElementById('scoreboard');
        scoreboard.classList.add('leader-change');
        setTimeout(() => scoreboard.classList.remove('leader-change'), 500);
      }
      lastLeader = currentLeaderId;
      lastLeaderScore = currentLeaderScore;
    }

    let playerHTML = playerArr.map(([pid, player]) => {
      if (player.name) {
        return `<tr>
                  <td class="score-name">${player.name.substring(0,12)}</td>
                  <td class="score-cell"><span id="score-${pid}" class="score-number">${player.score}</span></td>
                </tr>`;
      }
      return "";
    }).join("");
    scoreTable.innerHTML = playerHTML;

    playerArr.forEach(([pid, player]) => {
      if (prevScores.hasOwnProperty(pid) && player.score > prevScores[pid]) {
        const scoreSpan = document.getElementById('score-' + pid);
        if (scoreSpan) {
          scoreSpan.classList.add('score-pop');
          setTimeout(() => scoreSpan.classList.remove('score-pop'), 500);
        }
      }
      prevScores[pid] = player.score;
    });
  }

  var prevScores = {};
  var currentWordGlobal = null;

  // --- Play Again button logic ---
  document.getElementById('playAgainButton').addEventListener('click', function() {
    const playerName = document.getElementById('playAgainPlayerName').value.trim();
    if (!playerName) {
      alert('Please enter your name.');
      return;
    }
    
    const language = document.getElementById('playAgainLanguageSelect').value;
    const difficulty = document.getElementById('playAgainDifficultySelect').value;
    const maxScore = document.getElementById('playAgainMaxScoreInput').value;
    
    // Prepare the data to send
    const data = {
      name: playerName,
      language: language
    };
    
    // Only include difficulty and max score if the player is the host
    if (window.isHost) {
      data.difficulty = difficulty;
      if (maxScore) {
        data.max_score = maxScore;
      }
    }
    
    // Send the request to create a new lobby
    fetch(`/play_again/${LOBBY_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
        return;
      }
      // Redirect to the new lobby
      window.location.href = data.redirect_url;
    })
    .catch(error => console.error("Error:", error));
  });

  function updatePlayAgainStatus() {
    const readyStatus = document.getElementById('playAgainReadyStatus');
    const playAgainButton = document.getElementById('playAgainButton');
    const readyButton = document.getElementById('readyButton');
    
    if (!readyStatus || !playAgainButton) {
      console.error('Play again status elements are missing');
      return;
    }
    
    if (window.isHost) {
      playAgainButton.disabled = !allPlayersReady;
      readyStatus.textContent = allPlayersReady ? 
        'All players are ready! You can start the game.' : 
        'Waiting for all players to be ready...';
    } else {
      if (readyButton) {
        readyButton.textContent = isReady ? 'Not Ready' : 'Ready';
        readyButton.classList.toggle('ready-on', isReady);
        readyButton.classList.toggle('ready-not-ready', !isReady);
      }
      readyStatus.textContent = isReady ? 
        'You are ready! Waiting for other players...' : 
        'Click Ready when you want to play again';
    }
  }

  function toggleReady() {
    if (!window.isHost) {
      isReady = !isReady;
      const readyButton = document.getElementById('readyButton');
      if (readyButton) {
        readyButton.classList.toggle('ready-on');
        readyButton.classList.toggle('ready-not-ready');
        readyButton.textContent = isReady ? 'Not Ready' : 'Ready';
      }
      console.log('Emitting player_ready event');
      socket.emit('player_ready');
      updatePlayAgainStatus();
    }
  }

  function startNewGame() {
    if (window.isHost && allPlayersReady) {
        const difficulty = document.getElementById('playAgainDifficultySelect').value;
        const maxScore = document.getElementById('playAgainMaxScoreInput').value;
        
        socket.emit('start_new_game', {
            lobby_id: LOBBY_ID,
            difficulty: difficulty,
            max_score: maxScore
        });
    }
  }

  socket.on('player_ready_update', function(data) {
    if (data.lobby_id === LOBBY_ID) {
        allPlayersReady = data.all_ready;
        updatePlayAgainStatus();
    }
  });

  socket.on('new_game_started', function(data) {
    if (data.lobby_id === LOBBY_ID) {
        // Reset game state
        isReady = false;
        allPlayersReady = false;
        
        // Hide winner popup and play again section
        document.getElementById('winnerPopup').style.display = 'none';
        document.querySelector('.play-again-section').style.display = 'none';
        
        // Reset game UI and start new game
        resetGameUI();
        startGame(data.difficulty, data.max_score);
    }
  });

  // Socket event handlers for Play Again
  socket.on('player_ready_status', function(data) {
    console.log('Received player_ready_status:', data);
    if (data.username === window.PLAYER_ID) {
      isReady = data.is_ready;
      updatePlayAgainStatus();
    } else {
      const playAgainReadyStatus = document.getElementById('playAgainReadyStatus');
      if (playAgainReadyStatus) {
        playAgainReadyStatus.textContent = `${data.username} is ${data.is_ready ? 'ready' : 'not ready'}`;
      }
    }
  });

  socket.on('all_players_ready', function() {
    console.log('All players are ready');
    allPlayersReady = true;
    if (window.isHost) {
      const playAgainReadyStatus = document.getElementById('playAgainReadyStatus');
      const playAgainButton = document.getElementById('playAgainButton');
      if (playAgainReadyStatus) {
        playAgainReadyStatus.textContent = 'All players are ready!';
      }
      if (playAgainButton) {
        playAgainButton.disabled = false;
      }
    }
  });

  socket.on('new_game_started', function() {
    console.log('New game started');
    // Reset game state
    isReady = false;
    allPlayersReady = false;
    
    // Hide winner popup and play again section
    const winnerPopup = document.getElementById('winnerPopup');
    const playAgainSection = document.querySelector('.play-again-section');
    
    if (winnerPopup) {
      winnerPopup.style.display = 'none';
    }
    if (playAgainSection) {
      playAgainSection.style.display = 'none';
    }
    
    // Reset game UI and start new game
    resetGameUI();
    startGame();
  });

  // Initialize play again when the winner popup is shown
  function showWinnerPopup(winner, gameHistory) {
    const winnerPopup = document.getElementById('winnerPopup');
    const winnerText = document.getElementById('winnerMessage');
    const historyTable = document.getElementById('historyTable');
    
    if (!winnerPopup || !winnerText || !historyTable) {
      console.error('Winner popup elements are missing');
      return;
    }
    
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
    
    // Initialize play again controls
    const hostControls = document.getElementById('hostControls');
    const guestControls = document.getElementById('guestControls');
    const readyButton = document.getElementById('readyButton');
    const playAgainButton = document.getElementById('playAgainButton');
    const playAgainReadyStatus = document.getElementById('playAgainReadyStatus');

    if (window.isHost) {
      if (hostControls) hostControls.style.display = 'flex';
      if (guestControls) guestControls.style.display = 'none';
      if (playAgainReadyStatus) playAgainReadyStatus.textContent = 'Waiting for players to be ready...';
    } else {
      if (hostControls) hostControls.style.display = 'none';
      if (guestControls) guestControls.style.display = 'flex';
      if (playAgainReadyStatus) playAgainReadyStatus.textContent = 'Click Ready when you want to play again';
    }

    // Add event listeners for play again controls
    if (readyButton) {
      readyButton.addEventListener('click', toggleReady);
    }

    if (playAgainButton) {
      playAgainButton.addEventListener('click', function() {
        console.log('Play again button clicked');
        socket.emit('start_new_game');
      });
    }
  }

  // Socket event handlers
  socket.on('connect', () => {
    console.log('Connected to server');
    updateConnectionStatus(true);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateConnectionStatus(false);
  });

  socket.on('room_created', (data) => {
    console.log('Room created:', data);
    currentRoom = data.room;
    document.body.dataset.isHost = 'true';
    showGameSection();
    initializeGame();
  });

  socket.on('room_joined', (data) => {
    console.log('Room joined:', data);
    currentRoom = data.room;
    document.body.dataset.isHost = 'false';
    showGameSection();
    initializeGame();
  });

  socket.on('user_joined', (data) => {
    console.log('User joined:', data);
    updatePlayerList(data.players);
  });

  socket.on('user_left', (data) => {
    console.log('User left:', data);
    updatePlayerList(data.players);
  });

  socket.on('game_state_update', (data) => {
    console.log('Game state update:', data);
    updateGameState(data);
  });

  socket.on('game_over', (data) => {
    console.log('Game over:', data);
    showGameOverScreen(data);
    showPlayAgainSection();
  });

  // UI update functions
  function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
      statusElement.textContent = connected ? 'Connected' : 'Disconnected';
      statusElement.className = connected ? 'status-connected' : 'status-disconnected';
    }
  }

  function updatePlayerList(players) {
    const playerList = document.getElementById('playerList');
    if (!playerList) return;

    playerList.innerHTML = '';
    players.forEach(player => {
      const playerElement = document.createElement('div');
      playerElement.className = 'player-item';
      playerElement.textContent = player;
      playerList.appendChild(playerElement);
    });
  }

  function showGameSection() {
    const mainSection = document.getElementById('mainSection');
    const gameSection = document.getElementById('gameSection');
    if (mainSection && gameSection) {
      mainSection.style.display = 'none';
      gameSection.style.display = 'block';
    }
  }

  function showGameOverScreen(data) {
    console.log('Main.js: Showing game over screen with data:', data);
    const gameOverScreen = document.getElementById('winnerDiv');
    if (!gameOverScreen) {
        console.error('Main.js: winnerDiv element not found');
        return;
    }

    // Hide the word display and fuse immediately
    const wordText = document.getElementById('wordText');
    const fuse = document.getElementById('fuse');
    if (wordText) {
        wordText.style.display = 'none';
        wordText.textContent = ''; // Clear the text content
        console.log('Main.js: Word text hidden and cleared');
    }
    if (fuse) {
        fuse.style.display = 'none';
        console.log('Main.js: Fuse hidden');
    }

    // Hide the game section to ensure no game elements are visible
    const gameSection = document.getElementById('gameSection');
    if (gameSection) {
        gameSection.style.display = 'none';
        console.log('Main.js: Game section hidden');
    }

    const winnerElement = document.getElementById('winnerName');
    const scoreElement = document.getElementById('finalScore');
    
    if (winnerElement) winnerElement.textContent = data.winner;
    if (scoreElement) scoreElement.textContent = data.score;
    
    gameOverScreen.style.display = 'block';
    console.log('Main.js: Game over screen displayed');
  }

  function showPlayAgainSection() {
    console.log('Main.js: Showing play again section');
    const playAgainSection = document.getElementById('playAgainSection');
    if (!playAgainSection) {
        console.error('Main.js: playAgainSection element not found');
        return;
    }
    
    playAgainSection.style.display = 'block';
    console.log('Main.js: Play again section displayed');
    
    // Check computed style after setting display
    const computedStyle = window.getComputedStyle(playAgainSection);
    console.log('Main.js: Play Again Section computed style after display:block:', {
        backgroundColor: computedStyle.backgroundColor,
        display: computedStyle.display,
        visibility: computedStyle.visibility
    });
    
    // Initialize play again functionality
    if (typeof initializePlayAgain === 'function') {
        console.log('Main.js: Calling initializePlayAgain function');
        initializePlayAgain();
    } else {
        console.error('Main.js: initializePlayAgain function not found');
    }
  }

  function initializePlayAgain() {
    console.log('Main.js: Initializing play again functionality');
    const playAgainSection = document.getElementById('playAgainSection');
    const playAgainSettings = document.getElementById('playAgainSettings');
    const playAgainReadyStatus = document.getElementById('playAgainReadyStatus');
    const playAgainButton = document.getElementById('playAgainButton');
    const playAgainReadyButton = document.getElementById('playAgainReadyButton');
    
    console.log('Main.js: Play again elements found:', {
        playAgainSection: !!playAgainSection,
        playAgainSettings: !!playAgainSettings,
        playAgainReadyStatus: !!playAgainReadyStatus,
        playAgainButton: !!playAgainButton,
        playAgainReadyButton: !!playAgainReadyButton
    });
    
    if (!playAgainSection || !playAgainSettings || !playAgainReadyStatus || !playAgainButton) {
        console.error('Main.js: Required play again elements not found');
        return;
    }

    // Show/hide controls based on player role
    const isHost = window.isHost;
    console.log('Main.js: Player role:', isHost ? 'host' : 'guest');
    
    // Initialize socket event listeners for play again
    if (!window.socket) {
        console.error('Main.js: window.socket is not defined');
        return;
    }
    
    // Remove any existing event listeners to prevent duplicates
    window.socket.off('player_ready_status');
    window.socket.off('game_starting');
    
    // Set up socket event listeners
    window.socket.on('player_ready_status', (data) => {
        console.log('Main.js: Received player_ready_status:', data);
        if (data.room === window.currentRoom) {
            updateReadyStatus(data);
        }
    });

    window.socket.on('game_starting', (data) => {
        console.log('Main.js: Game starting event received:', data);
        if (data.room === window.currentRoom) {
            if (playAgainButton) playAgainButton.disabled = true;
            if (playAgainReadyStatus) playAgainReadyStatus.textContent = 'Game is starting...';
        }
    });

    // Handle ready button click for non-host players
    if (!isHost && playAgainReadyButton) {
        console.log('Main.js: Setting up ready button for non-host player');
        // Remove existing event listener if any
        playAgainReadyButton.removeEventListener('click', handleReadyButtonClick);
        // Add new event listener
        playAgainReadyButton.addEventListener('click', handleReadyButtonClick);
    }

    // Handle play again button click for host
    if (isHost && playAgainButton) {
        console.log('Main.js: Setting up play again button for host');
        // Remove existing event listener if any
        playAgainButton.removeEventListener('click', handlePlayAgainButtonClick);
        // Add new event listener
        playAgainButton.addEventListener('click', handlePlayAgainButtonClick);
    }
}

// Separate function for handling ready button click
function handleReadyButtonClick() {
    console.log('Main.js: Ready button clicked by non-host player');
    if (!window.socket || !window.currentRoom) {
        console.error('Main.js: Socket or room not defined');
        return;
    }
    
    const isReady = this.classList.contains('ready-on');
    this.classList.toggle('ready-on');
    this.classList.toggle('ready-not-ready');
    this.textContent = isReady ? 'Ready' : 'Not Ready';
    
    window.socket.emit('player_ready', {
        room: window.currentRoom,
        is_ready: !isReady
    });
}

// Separate function for handling play again button click
function handlePlayAgainButtonClick() {
    console.log('Main.js: Play again button clicked by host');
    if (!window.socket || !window.currentRoom) {
        console.error('Main.js: Socket or room not defined');
        return;
    }
    
    const language = document.getElementById('playAgainLanguageSelect')?.value || 'sv';
    const difficulty = document.getElementById('playAgainDifficultySelect')?.value || 'medium';
    const playerName = document.getElementById('playAgainPlayerName')?.value || 'Player';
    
    console.log('Main.js: Starting new game with settings:', { language, difficulty, playerName });
    
    window.socket.emit('start_new_game', {
        room: window.currentRoom,
        language: language,
        difficulty: difficulty,
        playerName: playerName
    });
}

function updateReadyStatus(data) {
    console.log('Main.js: Updating ready status with data:', data);
    const playAgainReadyStatus = document.getElementById('playAgainReadyStatus');
    if (!playAgainReadyStatus) {
        console.error('Main.js: playAgainReadyStatus element not found');
        return;
    }

    const { readyPlayers, totalPlayers } = data;
    const readyCount = Object.values(readyPlayers).filter(status => status).length;
    
    console.log('Main.js: Ready count:', readyCount, 'Total players:', totalPlayers);
    
    if (window.isHost) {
        console.log('Main.js: Updating ready status for host');
        playAgainReadyStatus.textContent = `${readyCount}/${totalPlayers} players ready`;
        const playAgainButton = document.getElementById('playAgainButton');
        if (playAgainButton) {
            playAgainButton.disabled = readyCount < totalPlayers;
            console.log('Main.js: Play again button disabled:', readyCount < totalPlayers);
        }
    } else {
        console.log('Main.js: Updating ready status for non-host');
        playAgainReadyStatus.textContent = `Waiting for host to start... (${readyCount}/${totalPlayers} ready)`;
    }
}
});
