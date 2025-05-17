console.log('Main.js: Script starting to load');

// Initialize global variables
let socket;
let currentRoom = null;
let isHost = false;
let playerName = '';
let playerLanguage = '';
let isReady = false;
let playerId = null; // Add playerId to track the current player
let lastMessageId = 0; // Add message ID tracking to prevent duplicates

// Helper functions
function updatePlayerList(players) {
    const playersList = document.getElementById('playersList');
    if (!playersList) return;
    
    playersList.innerHTML = '';
    Object.entries(players).forEach(([id, playerData]) => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        
        const statusDot = document.createElement('div');
        statusDot.className = `player-status ${playerData.ready ? 'ready' : ''}`;
        
        const playerInfo = document.createElement('div');
        playerInfo.className = 'player-info';
        playerInfo.innerHTML = `
            <div class="player-name">${playerData.name}</div>
            <div class="player-language">${playerData.language === 'sv' ? '🫎 Svenska' : '🥐 Français'}</div>
        `;
        
        playerItem.appendChild(statusDot);
        playerItem.appendChild(playerInfo);
        playersList.appendChild(playerItem);
    });

    // Update start game button state if host
    if (isHost) {
        const startGameButton = document.getElementById('startGameButton');
        if (startGameButton) {
            const allPlayersReady = Object.values(players).every(player => player.ready);
            startGameButton.disabled = !allPlayersReady;
            startGameButton.classList.toggle('disabled', !allPlayersReady);
        }
    }
}

function addChatMessage(sender, message, messageId) {
    // Only filter out duplicate messages from the same sender
    if (sender === playerName && messageId === lastMessageId) return;
    lastMessageId = messageId;
    
    console.log('Adding chat message:', { sender, message, messageId });
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) {
        console.error('Chat messages container not found');
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const senderDiv = document.createElement('div');
    senderDiv.className = 'sender';
    senderDiv.textContent = sender;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message';
    messageContent.textContent = message;
    
    messageDiv.appendChild(senderDiv);
    messageDiv.appendChild(messageContent);
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Wait for both DOM and scripts to be ready
function initializeApp() {
  console.log('Main.js: Initializing application');
  
  // Initialize socket connection
  console.log('\n=== INITIALIZING SOCKET ===');
  socket = io();
  console.log('Main.js: Socket initialized');

  // Remove any existing handlers
  socket.off();
  console.log('Main.js: Removed any existing handlers');

  // Initialize based on current page
  const path = window.location.pathname;
  console.log('Main.js: Current path:', path);

  if (path === '/') {
    initializeStartPage();
  } else if (path.startsWith('/lobby/')) {
    initializeLobbyPage();
  }

  // Set up socket event handlers
  setupSocketHandlers();

  // Set up button handlers
  setupButtonHandlers();

  console.log('=== END INITIALIZING SOCKET ===\n');
}

function initializeStartPage() {
  console.log('Main.js: Initializing start page');
  const createLobbyButton = document.getElementById('createLobbyButton');
  console.log('Main.js: Create lobby button found:', createLobbyButton);
  
  if (createLobbyButton) {
    console.log('Main.js: Adding click handler to create lobby button');
    createLobbyButton.addEventListener('click', async (e) => {
      e.preventDefault();
      console.log('Main.js: Create lobby button clicked!');
      try {
        const response = await fetch('/create_lobby', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to create lobby');
        }
        
        const data = await response.json();
        console.log('Main.js: Lobby created:', data);
        
        // Redirect to the player setup page with the room ID
        window.location.href = `/lobby/${data.room}`;
      } catch (error) {
        console.error('Main.js: Error creating lobby:', error);
        alert('Failed to create lobby. Please try again.');
      }
    });
    console.log('Main.js: Click handler added to create lobby button');
  } else {
    console.error('Main.js: Create lobby button not found!');
  }
}

function initializeLobbyPage() {
  console.log('Main.js: Initializing lobby page');
  // Get DOM elements
  const playerSetup = document.getElementById('playerSetup');
  const lobbySection = document.getElementById('lobbySection');
  const playersList = document.getElementById('playersList');
  const readyButton = document.getElementById('readyButton');
  const playerControls = document.getElementById('playerControls');
  const hostControls = document.getElementById('hostControls');
  const chatInput = document.getElementById('chatInput');
  const sendMessageButton = document.getElementById('sendMessage');
  const chatMessages = document.getElementById('chatMessages');
  const copyRoomLinkButton = document.getElementById('copyRoomLink');
  const startGameButton = document.getElementById('startGameButton');
  const joinLobbyButton = document.getElementById('joinLobbyButton');

  // Get room ID from URL
  const roomId = window.location.pathname.split('/').pop();
  
  if (joinLobbyButton) {
    // Set button text based on whether this is a new lobby or joining existing
    joinLobbyButton.textContent = 'Join Game';
    
    joinLobbyButton.addEventListener('click', function(e) {
      console.log('Main.js: Join game button clicked!');
      e.preventDefault();
      
      const nameInput = document.getElementById('playerName');
      const languageSelect = document.getElementById('languageSelect');
      
      if (!nameInput || !languageSelect) {
        console.error('Main.js: Required input elements not found');
        return;
      }
      
      const name = nameInput.value.trim();
      const language = languageSelect.value;
      
      if (!name) {
        alert('Please enter your name');
        return;
      }
      
      // Store player info
      playerName = name;
      playerLanguage = language;
      
      // Emit join room event
      socket.emit('join_room', {
        room: roomId,
        player_name: name,
        player_language: language
      });
    });
  }

  // Ready Button
  if (readyButton) {
    // Only show ready button for non-host players
    if (!isHost) {
        readyButton.addEventListener('click', function() {
            if (!currentRoom || !playerId) return;
            
            isReady = !isReady;
            readyButton.textContent = isReady ? 'Not Ready' : 'Ready';
            readyButton.classList.toggle('ready', isReady);
            
            socket.emit('player_ready', {
                room: currentRoom,
                player_id: playerId,
                is_ready: isReady,
                name: playerName,
                language: playerLanguage
            });
        });
    } else {
        // Hide ready button for host
        readyButton.style.display = 'none';
    }
  }

  // Copy Room Link Button
  if (copyRoomLinkButton) {
    copyRoomLinkButton.addEventListener('click', function() {
      const roomLink = `${window.location.origin}/lobby/${currentRoom}`;
      navigator.clipboard.writeText(roomLink).then(() => {
        alert('Room link copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy room link:', err);
      });
    });
  }

  // Start Game Button (host only)
  if (startGameButton) {
    console.log('Start game button found, adding click handler');
    startGameButton.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Start game button clicked!');
        
        if (!currentRoom) {
            console.error('No room selected');
            return;
        }
        
        const difficulty = document.getElementById('difficultySelect').value;
        const maxScore = parseInt(document.getElementById('maxScoreInput').value) || 10;
        
        console.log('Emitting start_game event with settings:', {
            room: currentRoom,
            difficulty: difficulty,
            max_score: maxScore
        });
        
        socket.emit('start_game', {
            room: currentRoom,
            difficulty: difficulty,
            max_score: maxScore
        });
    });
  } else {
    console.log('Start game button not found');
  }

  // Add socket handler for game start
  socket.on('game_started', (data) => {
    console.log('Game started event received:', data);
    try {
        window.location.href = `/game/${currentRoom}`;
    } catch (error) {
        console.error('Error redirecting to game page:', error);
    }
  });

  socket.on('error', (data) => {
    console.error('Socket error:', data);
    alert(data.message);
  });

  // Add socket handler for all players ready
  socket.on('all_players_ready', function(data) {
    console.log('All players ready:', data);
    if (data.all_ready && isHost) {
        console.log('Enabling start game button');
        const startGameButton = document.getElementById('startGameButton');
        if (startGameButton) {
            startGameButton.disabled = false;
            startGameButton.classList.add('start-enabled');
            startGameButton.style.pointerEvents = 'auto';
            startGameButton.style.cursor = 'pointer';
        }
    }
  });

  // Set up button handlers
  setupButtonHandlers();
}

// Set up socket event handlers
function setupSocketHandlers() {
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    socket.on('room_joined', (data) => {
        console.log('Room joined:', data);
        currentRoom = data.room;
        isHost = data.is_host;
        playerId = data.player_id;
        
        // Show lobby section and hide setup
        document.getElementById('playerSetup').style.display = 'none';
        document.getElementById('lobbySection').style.display = 'block';
        
        // Show appropriate controls
        if (isHost) {
            document.getElementById('hostControls').style.display = 'block';
            // Host is always ready
            isReady = true;
        } else {
            document.getElementById('playerControls').style.display = 'block';
            isReady = false;
        }
        
        updatePlayerList(data.players);
    });
    
    socket.on('user_joined', (data) => {
        console.log('User joined:', data);
        updatePlayerList(data.players);
    });
    
    socket.on('user_left', (data) => {
        console.log('User left:', data);
        updatePlayerList(data.players);
    });
    
    socket.on('chat_message', (data) => {
        console.log('Chat message received:', data);
        addChatMessage(data.sender, data.message, data.message_id);
    });

    socket.on('player_ready_status', (data) => {
        console.log('Player ready status updated:', data);
        updatePlayerList(data.players);
        
        // Update ready button state if it exists
        const readyButton = document.getElementById('readyButton');
        if (readyButton && data.ready_players && data.ready_players[playerId] !== undefined) {
            isReady = data.ready_players[playerId];
            readyButton.textContent = isReady ? 'Not Ready' : 'Ready';
            readyButton.classList.toggle('ready', isReady);
        }
    });
}

// Set up button handlers
function setupButtonHandlers() {
    // Chat functionality
    const chatInput = document.getElementById('chatInput');
    const sendMessageButton = document.getElementById('sendMessage');
    
    if (chatInput && sendMessageButton) {
        const sendMessage = () => {
            const message = chatInput.value.trim();
            if (message && currentRoom && playerName) {
                const messageId = Date.now(); // Generate unique message ID
                console.log('Sending chat message:', {
                    room: currentRoom,
                    message: message,
                    sender: playerName,
                    message_id: messageId
                });
                socket.emit('chat_message', {
                    room: currentRoom,
                    message: message,
                    sender: playerName,
                    message_id: messageId
                });
                chatInput.value = '';
            }
        };
        
        sendMessageButton.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }
}

// Check if the DOM is already loaded
if (document.readyState === 'loading') {
  // If still loading, wait for DOMContentLoaded
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // If already loaded, run immediately
  initializeApp();
}
