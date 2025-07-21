import React, { useState, useEffect, useRef } from 'react'
import { FiLink, FiCheck } from 'react-icons/fi';
import { config } from './config';

interface Player {
  id: string
  name: string
  language: string
  is_host: boolean
  ready: boolean
  joined_at: string
  score?: number
}

interface Lobby {
  id: string
  host_id: string
  players: Player[]
  difficulty: number
  max_score: number
  invite_code: string
}

interface ChatMessage {
  id: string
  player: string
  message: string
  timestamp: string
}

interface GameState {
  currentWord: string
  currentWordLanguage: string
  currentWordTranslations?: { sv: string, fr: string }
  fuseTime: number
  fuseMaxTime: number
  isGameActive: boolean
  lastWinner?: string
  wordAnimation: 'none' | 'fly-out' | 'drop-down' | 'drop-in' | 'hidden'
  wordKey: string // Unique key for each word to track animation state
  pendingWordData?: {
    currentWord: string
    currentWordLanguage: string
    currentWordTranslations?: { sv: string, fr: string }
    wordKey: string
  }
}

interface GameSummary {
  winner: string
  winner_id: string
  max_score: number
  word_history: Array<{
    word: string
    translations: { sv: string, fr: string }
    winner?: string
    winner_id?: string
    time_taken: number
    status: 'correct' | 'timeout'
  }>
  players: Array<{
    id: string
    name: string
    score: number
    language: string
  }>
}

function App() {
  // Add shake animation CSS
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }
      .animate-shake {
        animation: shake 0.5s ease-in-out;
      }
      
      @keyframes overtake-slide-up {
        0% { 
          transform: translateY(0) scale(1);
        }
        25% { 
          transform: translateY(-8px) scale(1.02);
        }
        50% { 
          transform: translateY(-12px) scale(1.05);
        }
        75% { 
          transform: translateY(-6px) scale(1.02);
        }
        100% { 
          transform: translateY(0) scale(1);
        }
      }
      .animate-overtake-slide-up {
        animation: overtake-slide-up 0.6s ease-out;
      }
      
      @keyframes overtake-slide-down {
        0% { 
          transform: translateY(0) scale(1);
        }
        25% { 
          transform: translateY(8px) scale(0.98);
        }
        50% { 
          transform: translateY(12px) scale(0.95);
        }
        75% { 
          transform: translateY(6px) scale(0.98);
        }
        100% { 
          transform: translateY(0) scale(1);
        }
      }
      .animate-overtake-slide-down {
        animation: overtake-slide-down 0.6s ease-out;
      }
      
      @keyframes drop-in {
        0% { 
          transform: translateY(-100px);
          opacity: 0;
        }
        100% { 
          transform: translateY(0);
          opacity: 1;
        }
      }
      .animate-drop-in {
        animation: drop-in 0.5s ease-out;
      }
      
      @keyframes word-fly-out {
        0% { 
          transform: translateX(0);
          opacity: 1;
        }
        100% { 
          transform: translateX(100%);
          opacity: 0;
        }
      }
      .animate-word-fly-out {
        animation: word-fly-out 0.6s ease-out forwards;
      }
      
      @keyframes word-drop-down {
        0% { 
          transform: translateY(0);
          opacity: 1;
        }
        100% { 
          transform: translateY(100%);
          opacity: 0;
        }
      }
      .animate-word-drop-down {
        animation: word-drop-down 0.6s ease-out forwards;
      }
      
      .animate-hidden {
        opacity: 0 !important;
        visibility: hidden !important;
        transform: translateY(0) !important;
      }
    `
    document.head.appendChild(style)
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style)
      }
    }
  }, [])

  const [currentPage, setCurrentPage] = useState('landing')
  const [playerName, setPlayerName] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isMaxScoreDropdownOpen, setIsMaxScoreDropdownOpen] = useState(false)
  const [selectedDifficulty, setSelectedDifficulty] = useState(2)
  const [selectedMaxScore, setSelectedMaxScore] = useState(10)
  const [chatMessage, setChatMessage] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [translationInput, setTranslationInput] = useState('')
  const [isInputShaking, setIsInputShaking] = useState(false)
  const [gameSummary, setGameSummary] = useState<GameSummary | null>(null)
  
  // Lobby state
  const [lobbyId, setLobbyId] = useState<string>('')
  const [playerId, setPlayerId] = useState<string>('')
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  
  // Game state
  const [gameState, setGameState] = useState<GameState>({
    currentWord: '',
    currentWordLanguage: 'en',
    fuseTime: 30,
    fuseMaxTime: 30,
    isGameActive: false,
    wordAnimation: 'none',
    wordKey: 'initial'
  })
  
  // WebSocket
  const wsRef = useRef<WebSocket | null>(null)
  const fuseIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [fuseBarKey, setFuseBarKey] = useState(0)
  const [fuseBarWidth, setFuseBarWidth] = useState('100%')
  const [fuseBarTransition, setFuseBarTransition] = useState('none')
  const fuseBarRef = useRef<HTMLDivElement>(null)
  const [showFuseBar, setShowFuseBar] = useState(true)

  // Leaderboard animation state - simplified like word animations
  const [overtakeAnimation, setOvertakeAnimation] = useState<'none' | 'slide-up' | 'slide-down'>('none')
  const [overtakingPlayerId, setOvertakingPlayerId] = useState<string>('')
  const [overtakenPlayerId, setOvertakenPlayerId] = useState<string>('')
  const [previousPlayerPositions, setPreviousPlayerPositions] = useState<Map<string, number>>(new Map())
  const previousPositionsRef = useRef<Map<string, number>>(new Map())

  const languages = [
    { code: 'sv', name: 'Svenska' },
    { code: 'fr', name: 'Français' }
  ]

  const difficulties = [
    { value: 0, label: 'Very Easy' },
    { value: 1, label: 'Easy' },
    { value: 2, label: 'Medium' },
    { value: 3, label: 'Hard' },
    { value: 4, label: 'Very Hard' }
  ]

  const maxScoreOptions = [
    { value: 5, label: '5 points' },
    { value: 10, label: '10 points' },
    { value: 15, label: '15 points' },
    { value: 20, label: '20 points' },
    { value: 25, label: '25 points' }
  ]

  const canContinue = playerName.trim() && selectedLanguage

  // Check URL for lobby ID on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const lobbyIdFromUrl = urlParams.get('lobby')
    if (lobbyIdFromUrl) {
      setLobbyId(lobbyIdFromUrl)
      setCurrentPage('setup')
    }
  }, [])

  // WebSocket connection
  useEffect(() => {
    if (lobbyId && playerId) {
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close()
      }
      // Small delay to ensure clean connection
      setTimeout(() => {
        connectWebSocket()
      }, 100)
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [lobbyId, playerId])

  // Debug animation state changes
  useEffect(() => {
    console.log('🔄 Animation state changed to:', gameState.wordAnimation)
  }, [gameState.wordAnimation])

  // Fuse timer effect
  useEffect(() => {
    if (gameState.isGameActive && gameState.fuseTime > 0) {
      // This effect is no longer needed as the fuse bar animation handles the time
    }
  }, [gameState.isGameActive, gameState.fuseTime])

  // Separate animation handlers for different word animations
  const handleWordFlyOutEnd = () => {
    console.log('🎬 Word fly-out animation ended')
    // After fly-out, hide the word and apply new word content (but keep old wordKey)
    setGameState(prev => {
      if (prev.pendingWordData) {
        console.log('🎯 Applying pending word data after fly-out:', prev.pendingWordData)
        return {
          ...prev,
          currentWord: prev.pendingWordData.currentWord,
          currentWordLanguage: prev.pendingWordData.currentWordLanguage,
          currentWordTranslations: prev.pendingWordData.currentWordTranslations,
          wordAnimation: 'hidden' as const,
          pendingWordData: undefined
        }
      }
      return {
        ...prev,
        wordAnimation: 'hidden' as const
      }
    })
    
    // After a brief delay, trigger drop-in animation
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        wordAnimation: 'drop-in' as const
      }))
    }, 100)
  }
  
  const handleWordDropDownEnd = () => {
    console.log('🎬 Word drop-down animation ended')
    // After drop-down, hide the word and apply new word content (but keep old wordKey)
    setGameState(prev => {
      if (prev.pendingWordData) {
        console.log('🎯 Applying pending word data after drop-down:', prev.pendingWordData)
        return {
          ...prev,
          currentWord: prev.pendingWordData.currentWord,
          currentWordLanguage: prev.pendingWordData.currentWordLanguage,
          currentWordTranslations: prev.pendingWordData.currentWordTranslations,
          wordAnimation: 'hidden' as const,
          pendingWordData: undefined
        }
      }
      return {
        ...prev,
        wordAnimation: 'hidden' as const
      }
    })
    
    // After a brief delay, trigger drop-in animation
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        wordAnimation: 'drop-in' as const
      }))
    }, 100)
  }
  
  const handleWordDropInEnd = () => {
    console.log('🎬 Word drop-in animation ended')
    // Word is now visible after drop-in animation - update wordKey to show this word
    setGameState(prev => ({
      ...prev,
      wordAnimation: 'none',
      wordKey: prev.pendingWordData?.wordKey || prev.wordKey
    }))
    
    // Reset fuse timer for new word
    setShowFuseBar(true)
    setFuseBarKey(prev => prev + 1)
    // Force fuse bar to reset
    setTimeout(() => {
      if (fuseBarRef.current) {
        fuseBarRef.current.style.transition = 'none'
        fuseBarRef.current.style.transform = 'scaleX(1)'
        setTimeout(() => {
          if (fuseBarRef.current) {
            fuseBarRef.current.style.transition = `transform linear ${gameState.fuseMaxTime}s`
            fuseBarRef.current.style.transform = 'scaleX(0)'
          }
        }, 20)
      }
    }, 50)
  }
  

  


  // Separate animation handlers for overtake animations
  const handleOvertakeSlideUpEnd = () => {
    console.log('🎬 Overtake slide-up animation ended')
    setIsOvertakeAnimating(false)
    setOvertakeAnimation('none')
    setOvertakingPlayerId('')
    setOvertakenPlayerId('')
  }
  
  const handleOvertakeSlideDownEnd = () => {
    console.log('🎬 Overtake slide-down animation ended')
    setIsOvertakeAnimating(false)
    setOvertakeAnimation('none')
    setOvertakingPlayerId('')
    setOvertakenPlayerId('')
  }
  
  // Overtake animation state management
  const [isOvertakeAnimating, setIsOvertakeAnimating] = useState(false)

  // Clear winner state when animation starts
  useEffect(() => {
    if (gameState.wordAnimation === 'fly-out' || gameState.wordAnimation === 'drop-down') {
      // Clear winner state immediately when animation starts
      setGameState(prev => ({ ...prev, lastWinner: undefined }))
    }
  }, [gameState.wordAnimation])

  useEffect(() => {
    if (!gameState.isGameActive) return
    if (!fuseBarRef.current) return
    if (!showFuseBar) return
    // Instantly reset bar to full width, no transition
    fuseBarRef.current.style.transition = 'none'
    fuseBarRef.current.style.transform = 'scaleX(1)'
    setTimeout(() => {
      if (!fuseBarRef.current) return
      fuseBarRef.current.style.transition = `transform linear ${gameState.fuseMaxTime}s`
      fuseBarRef.current.style.transform = 'scaleX(0)'
    }, 20)
  }, [gameState.currentWord, showFuseBar])

  const handleFuseTransitionEnd = () => {
    if (!showFuseBar) return
    if (fuseBarRef.current && fuseBarRef.current.style.transform === 'scaleX(0)') {
      setShowFuseBar(false)
      setGameState(prev => ({ ...prev, wordAnimation: 'drop-down' }))
      // Call backend timeout endpoint to get a new word
      fetch(config.api.endpoints.timeout(lobbyId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }).catch(error => {
        console.error('Error calling timeout endpoint:', error)
      })
    }
  }


  const handleTranslationSubmit = () => {
    if (!translationInput.trim() || !lobby || !gameState.isGameActive) return
    
    // Send translation to backend
    fetch(config.api.endpoints.translate(lobby.id, playerId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `translation=${encodeURIComponent(translationInput.trim())}`
    })
    .then(response => response.json())
    .then(data => {
      if (data.correct) {
        // Clear input on correct translation
        setTranslationInput('')
      } else {
        // Shake input on incorrect translation
        setIsInputShaking(true)
        setTranslationInput('')
        setTimeout(() => setIsInputShaking(false), 500) // Shake for 0.5 seconds
      }
    })
    .catch(error => {
      console.error('Error submitting translation:', error)
      // Shake input on error too
      setIsInputShaking(true)
      setTranslationInput('')
      setTimeout(() => setIsInputShaking(false), 500)
    })
  }

  const rollNewWord = () => {
    // First, reset animation state to 'none' and update the word
    setGameState(prev => ({
      ...prev,
      wordAnimation: 'none'
    }))
    // Then, after a brief delay, trigger the drop-in animation
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        wordAnimation: 'drop-in'
      }))
    }, 50) // Small delay to ensure state update
  }

  const connectWebSocket = () => {
    const ws = new WebSocket(config.websocket.url(lobbyId))
    console.log('Connecting to WebSocket:', config.websocket.url(lobbyId), 'Player ID:', playerId, 'Is Host:', isHost)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('WebSocket connected', 'Player ID:', playerId, 'Is Host:', isHost)
      // Send player identification message
      if (playerId) {
        ws.send(JSON.stringify({
          type: 'player_connect',
          player_id: playerId
        }))
      }
      // Send a test message to verify connection
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'ping'
          }))
        }
      }, 1000)
    }

    ws.onmessage = (event) => {
      console.log('Raw WebSocket message received:', event.data, 'Player ID:', playerId, 'Is Host:', isHost)
      try {
        const data = JSON.parse(event.data)
        console.log('Parsed WebSocket message:', data, 'Player ID:', playerId, 'Is Host:', isHost)
        handleWebSocketMessage(data)
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  const handleWebSocketMessage = (data: any) => {
    console.log('Received WebSocket message:', data)
    switch (data.type) {
      case 'player_joined':
        console.log('=== PLAYER JOINED HANDLER START ===')
        console.log('Received player data:', data.player)
        console.log('Current player ID:', playerId, 'Is Host:', isHost)
        
        setLobby(prevLobby => {
          if (!prevLobby) {
            console.log('ERROR: Lobby is null/undefined in player_joined handler')
            return prevLobby
          }
          
          console.log('Previous lobby state:', prevLobby)
          console.log('Previous lobby players count:', prevLobby.players?.length || 0)
          console.log('Previous lobby players:', prevLobby.players)
          
          // Check if player already exists to avoid duplicates
          const playerExists = prevLobby.players.some(p => p.id === data.player.id)
          if (playerExists) {
            console.log('Player already exists in lobby, skipping update')
            return prevLobby
          }
          
          const updatedLobby = {
            ...prevLobby,
            players: [...prevLobby.players, data.player]
          }
          console.log('Updated lobby object:', updatedLobby)
          console.log('Updated lobby players count:', updatedLobby.players.length)
          console.log('Updated lobby players:', updatedLobby.players)
          
          console.log('setLobby functional update called successfully')
          return updatedLobby
        })
        console.log('=== PLAYER JOINED HANDLER END ===')
        break
      case 'player_ready_changed':
        console.log('=== PLAYER READY CHANGED HANDLER START ===')
        console.log('Received ready change data:', data)
        
        setLobby(prevLobby => {
          if (!prevLobby) {
            console.log('ERROR: Lobby is null/undefined in player_ready_changed handler')
            return prevLobby
          }
          
          console.log('Previous lobby state:', prevLobby)
          console.log('Previous lobby players count:', prevLobby.players?.length || 0)
          console.log('Previous lobby players:', prevLobby.players)
          
          console.log('Processing ready change for player_id:', data.player_id)
          console.log('Looking for player in lobby players array...')
          
          const updatedPlayers = prevLobby.players.map(p => {
            console.log('Checking player:', p.id, 'against:', data.player_id, 'match:', p.id === data.player_id)
            if (p.id === data.player_id) {
              console.log('Found matching player, updating ready status from', p.ready, 'to', data.ready)
              return { ...p, ready: data.ready }
            }
            return p
          })
          
          console.log('Updated players array:', updatedPlayers)
          console.log('Updated players count:', updatedPlayers.length)
          
          const updatedLobby = {
            ...prevLobby,
            players: updatedPlayers
          }
          console.log('Updated lobby object:', updatedLobby)
          
          console.log('setLobby functional update called successfully')
          return updatedLobby
        })
        console.log('=== PLAYER READY CHANGED HANDLER END ===')
        break
      case 'difficulty_changed':
        setLobby(prevLobby => prevLobby ? { ...prevLobby, difficulty: data.difficulty } : prevLobby)
        setSelectedDifficulty(data.difficulty)
        break
      case 'max_score_changed':
        setLobby(prevLobby => prevLobby ? { ...prevLobby, max_score: data.max_score } : prevLobby)
        setSelectedMaxScore(data.max_score)
        break
      case 'game_started':
        setCurrentPage('game')
        const initialWordKey = `${Date.now()}-${Math.random()}`
        setGameState(prev => ({ 
          ...prev, 
          isGameActive: true,
          currentWord: data.current_word,
          currentWordLanguage: data.current_word_language,
          currentWordTranslations: data.current_word_translations,
          wordKey: initialWordKey
        }))
        // Initialize player positions for overtake detection
        if (lobby) {
          const sortedPlayers = lobby.players.sort((a, b) => (b.score || 0) - (a.score || 0))
          const initialPositions = new Map<string, number>()
          sortedPlayers.forEach((player, index) => {
            initialPositions.set(player.id, index)
          })
          setPreviousPlayerPositions(initialPositions)
        }
        break
      case 'translation_correct': {
        console.log('🎯 TRANSLATION CORRECT HANDLER START')
        console.log('Received data:', data)
        
        // Update player score
        setLobby(prevLobby => {
          if (!prevLobby) return prevLobby
          const updatedLobby = {
            ...prevLobby,
            players: prevLobby.players.map(p => 
              p.id === data.player_id 
                ? { ...p, score: data.score }
                : p
            )
          }
          console.log('Updated lobby players:', updatedLobby.players)
          console.log('Calling detectOvertakes with players:', updatedLobby.players)
          // Detect overtakes after updating scores
          detectOvertakes(updatedLobby.players)
          return updatedLobby
        })
        
        // Hide fuse bar during animation sequence
        setShowFuseBar(false)
        
        // Store new word data for after animation completes
        const newWordData = {
          currentWord: data.new_word,
          currentWordLanguage: data.new_word_language,
          currentWordTranslations: data.new_word_translations
        }
        
        // Generate new word key for the new word
        const newWordKey = `${Date.now()}-${Math.random()}`
        
        // Only update animation, keep current word visible during animation
        console.log('🎯 Starting animation with current word, new word data:', newWordData)
        if (data.player_id === playerId) {
          setGameState(prev => {
            const newState: GameState = {
              ...prev,
              wordAnimation: 'fly-out' as const,
              lastWinner: data.player_id,
              pendingWordData: { ...newWordData, wordKey: newWordKey }
            }
            console.log('🎯 Updated game state (winner) - animation only:', newState)
            return newState
          })
        } else {
          setGameState(prev => {
            const newState: GameState = {
              ...prev,
              wordAnimation: 'drop-down' as const,
              lastWinner: data.player_id,
              pendingWordData: { ...newWordData, wordKey: newWordKey }
            }
            console.log('🎯 Updated game state (non-winner) - animation only:', newState)
            return newState
          })
        }
        break
      }
      case 'translation_incorrect': {
        if (data.player_id === playerId) {
          setIsInputShaking(true)
          setTranslationInput('')
          setTimeout(() => setIsInputShaking(false), 500)
        }
        break
      }
      case 'word_timeout': {
        // Hide fuse bar during animation sequence
        setShowFuseBar(false)
        
        // Generate new word key for the new word
        const newWordKey = `${Date.now()}-${Math.random()}`
        
        // Handle timeout - all players get drop-down animation
        const newWordData = {
          currentWord: data.new_word,
          currentWordLanguage: data.new_word_language,
          currentWordTranslations: data.new_word_translations,
          wordKey: newWordKey
        }
        
        console.log('🎯 Word timeout - starting drop-down animation with current word, new word data:', newWordData)
        setGameState(prev => ({
          ...prev,
          wordAnimation: 'drop-down' as const,
          pendingWordData: newWordData
        }))
        break
      }

      case 'chat':
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          player: data.player_name,
          message: data.message,
          timestamp: data.timestamp
        }])
        break
      case 'pong':
        console.log('Received pong from server')
        break
      case 'game_ended':
        setGameSummary(data)
        setCurrentPage('game_summary')
        break
      case 'play_again':
        setLobby(prevLobby => prevLobby ? { ...prevLobby, players: data.players } : prevLobby)
        setGameSummary(null)
        setCurrentPage('lobby')
        break
      case 'player_left':
        if (lobby) {
          console.log('Player left:', data.player_id, 'name:', data.player_name)
          setLobby({
            ...lobby,
            players: lobby.players.filter(p => p.id !== data.player_id)
          })
        }
        break
    }
  }

  const createLobby = async () => {
    try {
      const response = await fetch(config.api.endpoints.createLobby, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `player_name=${encodeURIComponent(playerName)}&language=${encodeURIComponent(selectedLanguage)}`
      })
      
      if (response.ok) {
        const data = await response.json()
        setLobbyId(data.lobby_id)
        setPlayerId(data.player_id)
        setInviteCode(data.invite_code)
        setLobby(data.lobby)
        setIsHost(true)
        setSelectedDifficulty(data.lobby.difficulty)
        setSelectedMaxScore(data.lobby.max_score || 10)
        setCurrentPage('lobby')
        
        // Update URL
        window.history.pushState({}, '', `?lobby=${data.lobby_id}`)
      }
    } catch (error) {
      console.error('Error creating lobby:', error)
    }
  }

  const joinLobby = async () => {
    try {
      const response = await fetch(config.api.endpoints.joinLobby(lobbyId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `player_name=${encodeURIComponent(playerName)}&language=${encodeURIComponent(selectedLanguage)}`
      })
      
      if (response.ok) {
        const data = await response.json()
        setPlayerId(data.player_id)
        setLobby(data.lobby)
        setIsHost(false)
        setSelectedDifficulty(data.lobby.difficulty)
        setSelectedMaxScore(data.lobby.max_score || 10)
        setCurrentPage('lobby')
      } else {
        const errorData = await response.json()
        alert(errorData.detail || 'Failed to join lobby')
      }
    } catch (error) {
      console.error('Error joining lobby:', error)
    }
  }

  const loadLobby = async () => {
    try {
      const response = await fetch(config.api.endpoints.getLobby(lobbyId))
      if (response.ok) {
        const data = await response.json()
        setLobby(data)
        setSelectedDifficulty(data.difficulty)
        setSelectedMaxScore(data.max_score || 10)
      }
    } catch (error) {
      console.error('Error loading lobby:', error)
    }
  }

  const toggleReady = async () => {
    try {
      const response = await fetch(config.api.endpoints.toggleReady(lobbyId, playerId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      })
      if (response.ok) {
        const data = await response.json()
        setLobby(prevLobby => {
          if (!prevLobby) return prevLobby
          return {
            ...prevLobby,
            players: prevLobby.players.map(p => 
              p.id === playerId ? { ...p, ready: data.ready } : p
            )
          }
        })
      }
    } catch (error) {
      console.error('Error toggling ready:', error)
    }
  }

  const updateDifficulty = async (difficulty: number) => {
    try {
      const response = await fetch(config.api.endpoints.updateDifficulty(lobbyId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `player_id=${encodeURIComponent(playerId)}&difficulty=${difficulty}`
      })
      if (response.ok) {
        setSelectedDifficulty(difficulty)
      }
    } catch (error) {
      console.error('Error updating difficulty:', error)
    }
  }

  const updateMaxScore = async (maxScore: number) => {
    try {
      const response = await fetch(config.api.endpoints.updateMaxScore(lobbyId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `player_id=${encodeURIComponent(playerId)}&max_score=${maxScore}`
      })
      if (response.ok) {
        setSelectedMaxScore(maxScore)
      }
    } catch (error) {
      console.error('Error updating max score:', error)
    }
  }

  const startGame = async () => {
    try {
      const response = await fetch(config.api.endpoints.startGame(lobbyId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `player_id=${encodeURIComponent(playerId)}`
      })
      if (response.ok) {
        setCurrentPage('game')
      } else {
        const errorData = await response.json()
        alert(errorData.detail || 'Failed to start game')
      }
    } catch (error) {
      console.error('Error starting game:', error)
    }
  }

  const sendChatMessage = () => {
    if (chatMessage.trim() && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        player_id: playerId,
        message: chatMessage.trim()
      }))
      setChatMessage('')
    }
  }

  const copyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}?lobby=${lobbyId}`
    try {
      await navigator.clipboard.writeText(inviteUrl)
      // No alert - just silently copy
    } catch (error) {
      console.error('Failed to copy invite link:', error)
    }
  }

  const playAgain = async () => {
    try {
      const response = await fetch(config.api.endpoints.playAgain(lobbyId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `player_id=${encodeURIComponent(playerId)}`
      })
      if (response.ok) {
        setCurrentPage('lobby')
        setGameSummary(null)
      }
    } catch (error) {
      console.error('Error restarting game:', error)
    }
  }

  // Simple overtake detection
  const detectOvertakes = (currentPlayers: Player[]) => {
    console.log('🚨 DETECT OVERTAKES FUNCTION CALLED!')
    console.log('🔍 DETECT OVERTAKES CALLED')
    console.log('Current players:', currentPlayers)
    console.log('Previous positions from ref:', previousPositionsRef.current)
    
    // Clear any existing animations immediately to prevent conflicts
    setOvertakeAnimation('none')
    setOvertakingPlayerId('')
    setOvertakenPlayerId('')
    setIsOvertakeAnimating(false)
    
    const sortedPlayers = currentPlayers.sort((a, b) => (b.score || 0) - (a.score || 0))
    
    // Get current positions
    const currentPositions = new Map<string, number>()
    sortedPlayers.forEach((player, index) => {
      currentPositions.set(player.id, index)
    })
    
    // Skip overtake detection if this is the first time (no previous positions)
    if (previousPositionsRef.current.size === 0) {
      console.log('🔄 First time detecting overtakes, skipping animation')
      previousPositionsRef.current = new Map(currentPositions)
      setPreviousPlayerPositions(currentPositions)
      return
    }
    
    // Skip overtake detection if all scores are equal (no overtakes possible)
    const allScoresEqual = sortedPlayers.every(player => (player.score || 0) === (sortedPlayers[0].score || 0))
    if (allScoresEqual) {
      console.log('🔄 All scores are equal, skipping overtake detection')
      previousPositionsRef.current = new Map(currentPositions)
      setPreviousPlayerPositions(currentPositions)
      return
    }
    
    // Find the first overtake (simplified - only handle one overtake at a time)
    let foundOvertake = false
    sortedPlayers.forEach((player, newIndex) => {
      if (foundOvertake) return // Only handle first overtake
      
      const previousIndex = previousPositionsRef.current.get(player.id)
      console.log(`Player ${player.name} (${player.id}): previous=${previousIndex}, current=${newIndex}`)
      
      if (previousIndex !== undefined && newIndex !== previousIndex) {
        if (newIndex < previousIndex) {
          // Player moved up (overtake)
          console.log(`🎉 ${player.name} OVERTAKES! Moving from ${previousIndex} to ${newIndex}`)
          setOvertakingPlayerId(player.id)
          setOvertakeAnimation('slide-up')
          setIsOvertakeAnimating(true)
          foundOvertake = true
        } else if (newIndex > previousIndex) {
          // Player moved down (overtaken)
          console.log(`📉 ${player.name} OVERTAKEN! Moving from ${previousIndex} to ${newIndex}`)
          setOvertakenPlayerId(player.id)
          setOvertakeAnimation('slide-down')
          setIsOvertakeAnimating(true)
          foundOvertake = true
        }
      }
    })
    
    // Update previous positions in ref for next comparison
    previousPositionsRef.current = new Map(currentPositions)
    setPreviousPlayerPositions(currentPositions)
    
    console.log('Overtake animation:', overtakeAnimation)
    console.log('Overtaking player:', overtakingPlayerId)
    console.log('Overtaken player:', overtakenPlayerId)
  }

  // Load lobby data when entering lobby
  useEffect(() => {
    if (currentPage === 'lobby' && lobbyId && !lobby) {
      loadLobby()
    }
  }, [currentPage, lobbyId])

  // Sort players by score for scoreboard
  const sortedPlayers = lobby?.players.sort((a, b) => (b.score || 0) - (a.score || 0)) || []

  if (currentPage === 'game') {
    const backgroundImage = selectedLanguage === 'fr' ? '/fr_bg.webp' : '/sv_bg.webp'
    const fusePercentage = (gameState.fuseTime / gameState.fuseMaxTime) * 100
    
    // Get the word to display based on player language
    const getDisplayWord = () => {
      if (!lobby) return gameState.currentWord
      
      // Find current player
      const currentPlayer = lobby.players.find(p => p.id === playerId)
      if (!currentPlayer) return gameState.currentWord
      
      // For French player, show French translation, for Swedish player, show Swedish translation
      if (currentPlayer.language === 'fr' && gameState.currentWordTranslations?.fr) {
        console.log('🎯 Displaying French word:', gameState.currentWordTranslations.fr)
        return gameState.currentWordTranslations.fr
      } else if (currentPlayer.language === 'sv' && gameState.currentWordTranslations?.sv) {
        console.log('🎯 Displaying Swedish word:', gameState.currentWordTranslations.sv)
        return gameState.currentWordTranslations.sv
      }
      
      console.log('🎯 Displaying English word:', gameState.currentWord)
      return gameState.currentWord
    }
    
    // Sort players by score (highest first)
    const sortedPlayers = lobby?.players.sort((a, b) => (b.score || 0) - (a.score || 0)) || []
    
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-no-repeat flex flex-col"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        {/* Scoreboard */}
        <div className="p-6">
          <div className="relative max-w-xs" style={{ height: `${sortedPlayers.length * 48}px` }}>
            {(() => {
              console.log('🎨 RENDERING LEADERBOARD')
              console.log('Current overtakeAnimation:', overtakeAnimation)
              console.log('Overtaking player:', overtakingPlayerId)
              console.log('Overtaken player:', overtakenPlayerId)
              console.log('Sorted players:', sortedPlayers)
              return sortedPlayers.map((player, index) => {
                const isOvertaking = player.id === overtakingPlayerId && overtakeAnimation === 'slide-up'
                const isOvertaken = player.id === overtakenPlayerId && overtakeAnimation === 'slide-down'
                console.log(`🎨 Rendering player ${player.name}: isOvertaking=${isOvertaking}, isOvertaken=${isOvertaken}, position=${index}`)
                return (
                  <div 
                    key={player.id} 
                    className={`absolute left-0 right-0 flex justify-between items-center px-4 py-2 rounded-lg transition-all duration-500 ease-out ${
                      index === 0 ? 'bg-gray-800/80' : 
                      index === 1 ? 'bg-gray-700/80' : 
                      'bg-gray-600/80'
                    } ${isOvertaking ? 'animate-overtake-slide-up' : ''} ${isOvertaken ? 'animate-overtake-slide-down' : ''}`}
                    style={{
                      top: `${index * 48}px`,
                      zIndex: isOvertaking ? 10 : isOvertaken ? 1 : 1
                    }}
                    onAnimationEnd={(event) => {
                      const animationName = event.animationName
                      if (animationName === 'overtake-slide-up') {
                        handleOvertakeSlideUpEnd()
                      } else if (animationName === 'overtake-slide-down') {
                        handleOvertakeSlideDownEnd()
                      }
                    }}
                  >
                    <span className="text-white font-medium">{player.name}</span>
                    <span className="text-white font-bold">{player.score || 0}</span>
                  </div>
                )
              })
            })()}
          </div>
        </div>

        {/* Floating word */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center">
            {(
              <h1 
                key={`word-${gameState.wordKey}-${gameState.wordAnimation}`}
                className={`text-8xl md:text-9xl font-bold text-white mb-8 drop-shadow-2xl ${
                  gameState.wordAnimation === 'fly-out' ? 'animate-word-fly-out' :
                  gameState.wordAnimation === 'drop-down' ? 'animate-word-drop-down' :
                  gameState.wordAnimation === 'drop-in' ? 'animate-drop-in' :
                  gameState.wordAnimation === 'hidden' ? 'animate-hidden' :
                  ''
                }`}
                onAnimationEnd={(event) => {
                  const animationName = event.animationName
                  console.log('🎬 Animation ended:', animationName)
                  console.log('🔍 Current wordAnimation state:', gameState.wordAnimation)
                  if (animationName === 'word-fly-out') {
                    handleWordFlyOutEnd()
                  } else if (animationName === 'word-drop-down') {
                    handleWordDropDownEnd()
                  } else if (animationName === 'drop-in') {
                    handleWordDropInEnd()
                  }
                }}
              >
                {getDisplayWord()}
              </h1>
            )}
            {/* Fuse timer - thin white line under the word, burning from both ends toward the center */}
            {showFuseBar && (
              <div className="relative w-full max-w-2xl mx-auto mt-2">
                <div className="relative h-1 flex items-center justify-center">
                  <div
                    ref={fuseBarRef}
                    className="absolute left-0 top-0 h-1 w-full bg-white rounded transition-transform"
                    style={{
                      transformOrigin: 'center',
                      transform: 'scaleX(1)',
                    }}
                    onTransitionEnd={handleFuseTransitionEnd}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Translation input */}
        <div className="mt-0 mb-16 flex justify-center">
          <div className="w-full max-w-2xl">
            <input
              type="text"
              placeholder={selectedLanguage === 'fr' ? 'översätt till svenska' : 'traduire en français'}
              value={translationInput}
              onChange={(e) => setTranslationInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleTranslationSubmit()}
              className={`w-full bg-white/80 border-2 border-white/40 text-gray-900 placeholder-gray-500 py-4 px-8 rounded-lg text-xl focus:outline-none focus:border-white/60 transition-all duration-200 shadow-lg ${
                isInputShaking ? 'animate-shake' : ''
              }`}
            />
          </div>
        </div>
      </div>
    )
  }

  if (currentPage === 'lobby') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
        {/* Main container */}
        <div className="w-full max-w-4xl h-96 bg-gray-800 rounded-lg flex relative">
          {/* Chat section (left side) */}
          <div className="flex-1 p-6 flex flex-col">
            {/* Chat messages */}
            <div className="flex-1 space-y-3 mb-4 overflow-y-auto">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="flex items-start space-x-3">
                  <span className="text-gray-400 text-sm font-medium">{msg.player}:</span>
                  <span className="text-white text-sm">{msg.message}</span>
                </div>
              ))}
            </div>
            {/* Chat input */}
            <div className="border-b-2 border-gray-600">
              <input
                type="text"
                placeholder="Type a message..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                className="w-full bg-transparent text-white placeholder-gray-400 py-2 px-0 text-sm focus:outline-none focus:border-white transition-colors duration-200"
              />
            </div>
          </div>
          {/* Vertical divider */}
          <div className="w-px bg-gray-600"></div>
          {/* Player list section (right side) */}
          <div className="w-48 bg-gray-750 p-6 flex flex-col">
            {/* Player list */}
            <div className="flex-1 space-y-2">
              {lobby?.players.map((player) => (
                <div key={player.id} className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-4 h-4">
                    {player.ready ? (
                      <span className="text-green-400 text-xs">✓</span>
                    ) : (
                      <span className="text-gray-500 text-xs">○</span>
                    )}
                  </div>
                  <span className="text-white text-sm">{player.name}</span>
                  <span className="text-lg">
                    {player.language === 'sv' ? '🇸🇪' : player.language === 'fr' ? '🇫🇷' : ''}
                  </span>
                  {player.is_host && (
                    <span className="text-xs text-gray-400">(host)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Controls section below chat */}
          <div className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 flex items-center space-x-8">
            {/* Ready toggle (non-hosts only) */}
            {!isHost && (
              <div className="flex flex-col items-center">
                <button
                  onClick={toggleReady}
                  className={`relative w-14 h-6 bg-gray-600 rounded-full transition-all duration-200 ease-out ${
                    lobby?.players.find(p => p.id === playerId)?.ready
                      ? 'bg-green-600' 
                      : 'bg-gray-600'
                  }`}
                  title="Toggle Ready"
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-200 ease-out ${
                    lobby?.players.find(p => p.id === playerId)?.ready
                      ? 'left-9' 
                      : 'left-0.5'
                  }`} />
                </button>
                <div className="text-xs text-gray-400 mt-1">ready</div>
              </div>
            )}
            {/* Difficulty dropdown (host only) */}
            {isHost && (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="bg-transparent text-white py-2 px-0 text-sm focus:outline-none transition-colors duration-200 flex items-center space-x-2"
                >
                  <span>{difficulties.find(d => d.value === selectedDifficulty)?.label || 'Select difficulty'}</span>
                  <svg 
                    className={`w-3 h-3 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="text-xs text-gray-400 mt-1">difficulty</div>
                {isDropdownOpen && (
                  <div className="absolute bottom-full left-0 right-0 bg-gray-700 border border-gray-600 rounded-lg mb-1 z-10 min-w-32">
                    {difficulties.map((difficulty) => (
                      <button
                        key={difficulty.value}
                        onClick={() => {
                          updateDifficulty(difficulty.value)
                          setIsDropdownOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 text-white hover:bg-gray-600 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg text-sm"
                      >
                        {difficulty.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Max Score dropdown (host only) */}
            {isHost && (
              <div className="relative">
                <button
                  onClick={() => setIsMaxScoreDropdownOpen(!isMaxScoreDropdownOpen)}
                  className="bg-transparent text-white py-2 px-0 text-sm focus:outline-none transition-colors duration-200 flex items-center space-x-2"
                >
                  <span>{maxScoreOptions.find(m => m.value === selectedMaxScore)?.label || 'Select max score'}</span>
                  <svg 
                    className={`w-3 h-3 transition-transform duration-200 ${isMaxScoreDropdownOpen ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="text-xs text-gray-400 mt-1">max score</div>
                {isMaxScoreDropdownOpen && (
                  <div className="absolute bottom-full left-0 right-0 bg-gray-700 border border-gray-600 rounded-lg mb-1 z-10 min-w-32">
                    {maxScoreOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          updateMaxScore(option.value)
                          setIsMaxScoreDropdownOpen(false)
                        }}
                        className="w-full text-left px-4 py-2 text-white hover:bg-gray-600 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg text-sm"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Start game button (host only) */}
            {isHost && (
              <div className="flex flex-col items-center">
                <button
                  onClick={startGame}
                  disabled={!lobby?.players.every(p => p.ready)}
                  className={`w-10 h-10 rounded-full border transition-all duration-150 ease-out flex items-center justify-center ${
                    lobby?.players.every(p => p.ready)
                      ? 'border-gray-600 text-white hover:border-white hover:scale-105'
                      : 'border-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                  title="Start Game"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div className="text-xs text-gray-400 mt-1">start</div>
              </div>
            )}
            {/* Invite button (host only, icon only) */}
            {isHost && (
              <div className="flex flex-col items-center">
                <button
                  onClick={copyInviteLink}
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-600 bg-gray-800 hover:border-white transition-all duration-150"
                  title="Copy Invite Link"
                >
                  <FiLink className="w-5 h-5 text-white" />
                </button>
                <div className="text-xs text-gray-400 mt-1">invite</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (currentPage === 'game_summary' && gameSummary) {
    const backgroundImage = selectedLanguage === 'fr' ? '/fr_bg.webp' : '/sv_bg.webp'
    
    return (
      <div 
        className="min-h-screen bg-cover bg-center bg-no-repeat flex flex-col"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        {/* Game Summary Overlay */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-8 max-w-2xl w-full">
            {/* Winner Section */}
            <div className="text-center mb-8">
              <div className="text-3xl font-bold text-white mb-2">
                {gameSummary.winner} wins!
              </div>
            </div>

            {/* Word History Section */}
            <div className="bg-gray-700/50 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold text-white mb-4">Game History</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {gameSummary.word_history.map((wordData, index) => (
                  <div 
                    key={index} 
                    className={`py-2 px-3 rounded flex justify-between items-center ${
                      wordData.status === 'correct' 
                        ? index % 2 === 0 ? 'bg-green-600/20' : 'bg-green-600/10'
                        : index % 2 === 0 ? 'bg-red-600/20' : 'bg-red-600/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-400 w-8">#{index + 1}</span>
                      <span className="text-white font-medium">{wordData.word}</span>
                      {wordData.winner && (
                        <span className="text-green-400 text-sm">✓ {wordData.winner}</span>
                      )}
                      {wordData.status === 'timeout' && (
                        <span className="text-red-400 text-sm">⏰ Timeout</span>
                      )}
                    </div>
                    <div className="flex space-x-6 text-xs">
                      <span className="text-gray-300 w-20 text-left">{wordData.translations.sv}</span>
                      <span className="text-gray-300 w-20 text-right">{wordData.translations.fr}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Final Scores */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">Final Scores</h3>
              <div className="space-y-2">
                {gameSummary.players
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div 
                      key={player.id} 
                      className={`flex justify-between items-center p-3 rounded ${
                        player.id === gameSummary.winner_id 
                          ? 'bg-green-600/30 border border-green-500/50' 
                          : 'bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                        <span className="text-white font-medium">{player.name}</span>
                        <span className="text-sm text-gray-400">
                          {player.language === 'sv' ? '🇸🇪' : player.language === 'fr' ? '🇫🇷' : ''}
                        </span>
                      </div>
                      <span className="text-white font-bold text-lg">{player.score}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Play Again Button (Host Only) */}
            {isHost && (
              <div className="flex flex-col items-center">
                <button
                  onClick={playAgain}
                  className="w-10 h-10 rounded-full border border-gray-600 bg-gray-800 hover:border-white transition-all duration-150 flex items-center justify-center"
                  title="Play Again"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <div className="text-xs text-gray-400 mt-1">play again</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (currentPage === 'setup') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto w-full">
          {/* Name input */}
          <div className="mb-8">
            <input
              type="text"
              placeholder="name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full bg-transparent border-b-2 border-gray-600 text-white placeholder-gray-400 py-3 px-0 text-lg focus:outline-none focus:border-white transition-colors duration-200"
            />
          </div>
          
          {/* Language dropdown */}
          <div className="mb-12 relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`w-full bg-transparent border-b-2 border-gray-600 text-left py-3 px-0 text-lg focus:outline-none focus:border-white transition-colors duration-200 ${
                selectedLanguage ? 'text-white' : 'text-gray-400'
              }`}
            >
              {selectedLanguage ? languages.find(l => l.code === selectedLanguage)?.name : 'Select the language you want to practise'}
            </button>
            
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 bg-gray-800 border border-gray-600 rounded-lg mt-1 z-10">
                {languages.map((language) => (
                  <button
                    key={language.code}
                    onClick={() => {
                      setSelectedLanguage(language.code)
                      setIsDropdownOpen(false)
                    }}
                    className="w-full text-left px-4 py-3 text-white hover:bg-gray-700 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {language.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Continue button */}
          <div className="h-16 flex items-center justify-center">
            <button
              onClick={lobbyId ? joinLobby : createLobby}
              disabled={!canContinue}
              className={`
                w-12 h-12 rounded-full border border-gray-600 flex items-center justify-center transition-all duration-150 ease-out
                ${canContinue 
                  ? 'text-white hover:border-white hover:scale-105' 
                  : 'text-gray-500 cursor-not-allowed'
                }
              `}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      {/* Main content container */}
      <div className="text-center max-w-2xl mx-auto">
        {/* Game title */}
        <h1 className="text-6xl md:text-8xl font-bold text-white mb-8 tracking-tight">
          motord
        </h1>
        
        {/* Description */}
        <p className="text-gray-300 text-lg md:text-xl mb-12 leading-relaxed max-w-lg mx-auto">
          Translate English words into Swedish or French. Race against time and other players to be the first to guess correctly and earn points.
        </p>
        
        {/* Button container with fixed height to prevent layout shifts */}
        <div className="h-16 flex items-center justify-center">
          <button
            onClick={() => setCurrentPage('setup')}
            className="w-12 h-12 rounded-full border border-gray-600 text-white hover:border-white hover:scale-105 transition-all duration-150 ease-out flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default App 