document.addEventListener('DOMContentLoaded', function() {
  var gameStarted = false;
  var prevScores = {};
  var currentWordGlobal = null; // The current English word as set by the server
  var userReady = false; // Tracks current user's ready state
  var lastLeader = null;
  var lastLeaderScore = 0;
  var animationInProgress = false; // Prevent overlapping animations
  var justGuessedTime = 0; // Timestamp of last correct guess

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
            const newWordDisplay = data.translations[window.playerLanguage];
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
});
