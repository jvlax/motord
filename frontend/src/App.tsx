import React, { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { FiLink, FiCheck } from 'react-icons/fi';
import { config } from './config';
import { useMobile } from './hooks/useMobile';
import { MobileGameScreen } from './components/MobileGameScreen';
import { MobileLobbyScreen } from './components/MobileLobbyScreen';
import { MobileSetupScreen } from './components/MobileSetupScreen';
import { MobileGameSummary } from './components/MobileGameSummary';

interface Player {
  id: string
  name: string
  language: string
  is_host: boolean
  ready: boolean
  joined_at: string
  score?: number
  streak?: number
  highest_streak?: number
  fastest_guess?: number
}

interface Lobby {
  id: string
  host_id: string
  players: Player[]
  difficulty: number
  max_words: number
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
  max_words: number
  word_history: Array<{
    word: string
    translations: { sv: string, fr: string }
    winner?: string
    winner_id?: string
    time_taken: number
    status: 'correct' | 'timeout' | 'incorrect'
    points_earned?: number
    points_lost?: number
    streak?: number
    time_bonus?: number
    streak_multiplier?: number
  }>
  players: Array<{
    id: string
    name: string
    score: number
    language: string
    highest_streak: number
    fastest_guess: number
  }>
}

function App() {
  const { isMobile } = useMobile()
  
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
      
      @keyframes word-fly-out-streak {
        0% { 
          transform: translateX(0);
          opacity: 1;
          text-shadow: 0 0 10px #f59e0b, 0 0 20px #f59e0b, 0 0 30px #f59e0b;
        }
        50% {
          text-shadow: 0 0 15px #f59e0b, 0 0 25px #f59e0b, 0 0 35px #f59e0b;
        }
        100% { 
          transform: translateX(100%);
          opacity: 0;
          text-shadow: 0 0 10px #f59e0b, 0 0 20px #f59e0b, 0 0 30px #f59e0b;
        }
      }
      .animate-word-fly-out-streak {
        animation: word-fly-out-streak 0.6s ease-out forwards;
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
      
      @keyframes word-drop-down-streak {
        0% { 
          transform: translateY(0);
          opacity: 1;
          text-shadow: 0 0 10px #f59e0b, 0 0 20px #f59e0b, 0 0 30px #f59e0b;
        }
        50% {
          text-shadow: 0 0 15px #f59e0b, 0 0 25px #f59e0b, 0 0 35px #f59e0b;
        }
        100% { 
          transform: translateY(100%);
          opacity: 0;
          text-shadow: 0 0 10px #f59e0b, 0 0 20px #f59e0b, 0 0 30px #f59e0b;
        }
      }
      .animate-word-drop-down-streak {
        animation: word-drop-down-streak 0.6s ease-out forwards;
      }
      
      @keyframes drop-in-streak {
        0% { 
          transform: translateY(-100px);
          opacity: 0;
          text-shadow: 0 0 10px #f59e0b, 0 0 20px #f59e0b, 0 0 30px #f59e0b;
        }
        100% { 
          transform: translateY(0);
          opacity: 1;
          text-shadow: 0 0 10px #f59e0b, 0 0 20px #f59e0b, 0 0 30px #f59e0b;
        }
      }
      .animate-drop-in-streak {
        animation: drop-in-streak 0.5s ease-out;
      }
      
      .animate-hidden {
        opacity: 0 !important;
        visibility: hidden !important;
        transform: translateY(0) !important;
      }
      
      .streak-glow {
        text-shadow: 0 0 10px #f59e0b, 0 0 20px #f59e0b, 0 0 30px #f59e0b;
        animation: streak-pulse 2s ease-in-out infinite;
      }
      
      @keyframes streak-pulse {
        0%, 100% { 
          text-shadow: 0 0 10px #f59e0b, 0 0 20px #f59e0b, 0 0 30px #f59e0b;
        }
        50% { 
          text-shadow: 0 0 15px #f59e0b, 0 0 25px #f59e0b, 0 0 35px #f59e0b;
        }
      }
      
      .scoreboard-streak-glow {
        box-shadow: 0 0 10px #f59e0b, 0 0 20px #f59e0b, 0 0 30px #f59e0b;
        animation: scoreboard-streak-pulse 2s ease-in-out infinite;
      }
      
      @keyframes scoreboard-streak-pulse {
        0%, 100% { 
          box-shadow: 0 0 10px #f59e0b, 0 0 20px #f59e0b, 0 0 30px #f59e0b;
        }
        50% { 
          box-shadow: 0 0 15px #f59e0b, 0 0 25px #f59e0b, 0 0 35px #f59e0b;
        }
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
  const [isMaxWordsDropdownOpen, setIsMaxWordsDropdownOpen] = useState(false)
  const [selectedDifficulty, setSelectedDifficulty] = useState(2)
  const [selectedMaxWords, setSelectedMaxWords] = useState(10)
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

  const maxWordsOptions = [
    { value: 5, label: '5 words' },
    { value: 10, label: '10 words' },
    { value: 15, label: '15 words' },
    { value: 20, label: '20 words' },
    { value: 25, label: '25 words' }
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
    console.log('🎬 Current game state before update:', gameState)
    // After fly-out, hide the word and apply new word content (but keep old wordKey)
    setGameState(prev => {
      console.log('🎬 Previous state in fly-out handler:', prev)
      if (prev.pendingWordData) {
        console.log('🎯 Applying pending word data after fly-out:', prev.pendingWordData)
        // Generate a new wordKey for the new word
        const newWordKey = `${Date.now()}-${Math.random()}`
        const newState = {
          ...prev,
          currentWord: prev.pendingWordData.currentWord,
          currentWordLanguage: prev.pendingWordData.currentWordLanguage,
          currentWordTranslations: prev.pendingWordData.currentWordTranslations,
          wordAnimation: 'hidden' as const,
          pendingWordData: undefined,
          wordKey: newWordKey
        }
        console.log('🎬 New state after fly-out:', newState)
        return newState
      }
      console.log('🎬 No pending word data, just hiding')
      return {
        ...prev,
        wordAnimation: 'hidden' as const
      }
    })
    
    // After a brief delay, trigger drop-in animation
    setTimeout(() => {
      console.log('🎬 Triggering drop-in animation after fly-out')
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
        // Generate a new wordKey for the new word
        const newWordKey = `${Date.now()}-${Math.random()}`
        return {
          ...prev,
          currentWord: prev.pendingWordData.currentWord,
          currentWordLanguage: prev.pendingWordData.currentWordLanguage,
          currentWordTranslations: prev.pendingWordData.currentWordTranslations,
          wordAnimation: 'hidden' as const,
          pendingWordData: undefined,
          wordKey: newWordKey
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
    // Always generate a new wordKey for the visible word
    setGameState(prev => ({
      ...prev,
      wordAnimation: 'none',
      wordKey: `${Date.now()}-${Math.random()}`
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

  // Deep-dive fuse bar effect for all words after the first
  useEffect(() => {
    if (!gameState.isGameActive) return
    if (!fuseBarRef.current) return
    if (!showFuseBar) return
    // Deep-dive debug logging
    const now = Date.now()
    const fuseBar = fuseBarRef.current
    const parent = fuseBar.parentElement
    const wordContainer = document.querySelector('.word-container')
    const fuseBarRect = fuseBar.getBoundingClientRect()
    const parentRect = parent ? parent.getBoundingClientRect() : null
    const wordRect = wordContainer ? wordContainer.getBoundingClientRect() : null
    const computedStyle = window.getComputedStyle(fuseBar)
    console.log('[FUSEBAR-DEBUG] useEffect triggered', { now, currentWord: gameState.currentWord, wordKey: gameState.wordKey, showFuseBar, fuseBarRect, parentRect, wordRect, computedStyle, fuseBar, parent, wordContainer })
    // Instantly reset bar to full width, no transition
    fuseBar.style.transition = 'none'
    fuseBar.style.transform = 'scaleX(1)'
    const computedStyleAfterReset = window.getComputedStyle(fuseBar)
    console.log('[FUSEBAR-DEBUG] After reset', { now: Date.now(), style: computedStyleAfterReset, fuseBarRect: fuseBar.getBoundingClientRect() })
    setTimeout(() => {
      if (!fuseBarRef.current) return
      const now2 = Date.now()
      const computedStyleBeforeAnim = window.getComputedStyle(fuseBarRef.current)
      console.log('[FUSEBAR-DEBUG] Before animation', { now: now2, style: computedStyleBeforeAnim, fuseBarRect: fuseBarRef.current.getBoundingClientRect() })
      fuseBarRef.current.style.transition = `transform linear ${gameState.fuseMaxTime}s`
      fuseBarRef.current.style.transform = 'scaleX(0)'
      setTimeout(() => {
        if (!fuseBarRef.current) return
        const now3 = Date.now()
        const computedStyleAfterAnim = window.getComputedStyle(fuseBarRef.current)
        console.log('[FUSEBAR-DEBUG] After animation', { now: now3, style: computedStyleAfterAnim, fuseBarRect: fuseBarRef.current.getBoundingClientRect() })
      }, 10)
    }, 20)
  }, [gameState.currentWord, showFuseBar])

  // Guarantee fuse bar animation runs for the first word
  React.useLayoutEffect(() => {
    if (!gameState.isGameActive) return
    if (!fuseBarRef.current) return
    if (!showFuseBar) return
    // Only run if this is the first word (wordKey is set but effect hasn't run yet)
    if (gameState.wordKey && gameState.currentWord) {
      const now = Date.now()
      const fuseBar = fuseBarRef.current
      const parent = fuseBar.parentElement
      const wordContainer = document.querySelector('.word-container')
      const fuseBarRect = fuseBar.getBoundingClientRect()
      const parentRect = parent ? parent.getBoundingClientRect() : null
      const wordRect = wordContainer ? wordContainer.getBoundingClientRect() : null
      const computedStyle = window.getComputedStyle(fuseBar)
      console.log('[FUSEBAR-DEBUG-FIRSTWORD] useLayoutEffect triggered', { now, currentWord: gameState.currentWord, wordKey: gameState.wordKey, showFuseBar, fuseBarRect, parentRect, wordRect, computedStyle, fuseBar, parent, wordContainer })
      // Instantly reset bar to full width, no transition
      fuseBar.style.transition = 'none'
      fuseBar.style.transform = 'scaleX(1)'
      const computedStyleAfterReset = window.getComputedStyle(fuseBar)
      console.log('[FUSEBAR-DEBUG-FIRSTWORD] After reset', { now: Date.now(), style: computedStyleAfterReset, fuseBarRect: fuseBar.getBoundingClientRect() })
      setTimeout(() => {
        if (!fuseBarRef.current) return
        const now2 = Date.now()
        const computedStyleBeforeAnim = window.getComputedStyle(fuseBarRef.current)
        console.log('[FUSEBAR-DEBUG-FIRSTWORD] Before animation', { now: now2, style: computedStyleBeforeAnim, fuseBarRect: fuseBarRef.current.getBoundingClientRect() })
        fuseBarRef.current.style.transition = `transform linear ${gameState.fuseMaxTime}s`
        fuseBarRef.current.style.transform = 'scaleX(0)'
        setTimeout(() => {
          if (!fuseBarRef.current) return
          const now3 = Date.now()
          const computedStyleAfterAnim = window.getComputedStyle(fuseBarRef.current)
          console.log('[FUSEBAR-DEBUG-FIRSTWORD] After animation', { now: now3, style: computedStyleAfterAnim, fuseBarRect: fuseBarRef.current.getBoundingClientRect() })
        }, 10)
      }, 20)
    }
  }, [])

  const handleFuseTransitionEnd = () => {
    console.log('[FUSEBAR] Transition end. showFuseBar:', showFuseBar, 'fuseBarRef:', fuseBarRef.current)
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

  // Add debug log for fuseBarRef assignment
  useEffect(() => {
    if (fuseBarRef.current) {
      console.log('[FUSEBAR] fuseBarRef assigned:', fuseBarRef.current)
    }
  }, [fuseBarRef.current])

  // Add debug log for word/animation state changes
  useEffect(() => {
    console.log('[FUSEBAR] gameState.currentWord changed:', gameState.currentWord, 'wordKey:', gameState.wordKey)
  }, [gameState.currentWord, gameState.wordKey])


  const handleTranslationSubmit = async () => {
    if (!translationInput.trim() || !gameState.isGameActive) return;
    if (!lobbyId || !playerId) return;

    try {
      const response = await fetch(config.api.endpoints.translate(lobbyId, playerId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ translation: translationInput })
      });
      if (!response.ok) {
        setIsInputShaking(true);
        setTranslationInput('');
        setTimeout(() => setIsInputShaking(false), 500);
        return;
      }
      const data = await response.json();
      if (data.correct) {
        setTranslationInput('');
        // The backend will broadcast the new word and update scores via WebSocket
      } else {
        setIsInputShaking(true);
        setTranslationInput('');
        setTimeout(() => setIsInputShaking(false), 500);
      }
    } catch (err) {
      setIsInputShaking(true);
      setTranslationInput('');
      setTimeout(() => setIsInputShaking(false), 500);
    }
  };

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

  // Add state for countdown
  const [showCountdown, setShowCountdown] = useState<boolean | 'fading'>(false);
  const [countdownValue, setCountdownValue] = useState<number>(3);
  const [gameReady, setGameReady] = useState(false);
  const countdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownFadeRef = useRef<NodeJS.Timeout | null>(null);
  const [countdownProgress, setCountdownProgress] = useState(1); // 1 = full, 0 = empty
  const fuseBarFirstWordTriggerRef = useRef(false);
  const [zoomKey, setZoomKey] = useState<number>(0); // To force re-animation

  // Countdown logic
  const startCountdown = () => {
    setShowCountdown(true);
    setCountdownValue(3);
    setZoomKey(Math.random());
    let count = 3;
    const tick = () => {
      if (count > 1) {
        count -= 1;
        setCountdownValue(count);
        setZoomKey(Math.random());
        countdownTimeoutRef.current = setTimeout(tick, 1000);
      } else {
        setShowCountdown('fading');
        setTimeout(() => setShowCountdown(false), 200);
      }
    };
    countdownTimeoutRef.current = setTimeout(tick, 1000);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (countdownTimeoutRef.current) clearTimeout(countdownTimeoutRef.current);
      if (countdownFadeRef.current) clearTimeout(countdownFadeRef.current);
    };
  }, []);

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
      case 'max_words_changed':
        setLobby(prevLobby => prevLobby ? { ...prevLobby, max_words: data.max_words } : prevLobby)
        setSelectedMaxWords(data.max_words)
        break
      case 'game_started':
        setCurrentPage('game');
        handleGameStarted(data);
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
        
        // Update player score and streak
        setLobby(prevLobby => {
          if (!prevLobby) return prevLobby
          
          // If the backend sent updated players data, use that
          if (data.players) {
            const updatedLobby = {
              ...prevLobby,
              players: prevLobby.players.map(p => {
                const updatedPlayer = (data.players as any[]).find((dp: any) => dp.id === p.id)
                return updatedPlayer ? {
                  ...p,
                  score: updatedPlayer.score,
                  streak: updatedPlayer.streak,
                  highest_streak: updatedPlayer.highest_streak,
                  fastest_guess: updatedPlayer.fastest_guess
                } : p
              })
            }
            console.log('Updated lobby players from backend data:', updatedLobby.players)
            console.log('Calling detectOvertakes with players:', updatedLobby.players)
            // Detect overtakes after updating scores
            detectOvertakes(updatedLobby.players)
            return updatedLobby
          }
          
          // Fallback to old behavior (only update the winning player)
          const updatedLobby = {
            ...prevLobby,
            players: prevLobby.players.map(p => 
              p.id === data.player_id 
                ? { 
                    ...p, 
                    score: data.score,
                    streak: data.streak,
                    highest_streak: Math.max(p.highest_streak || 0, data.streak)
                  }
                : p
            )
          }
          console.log('Updated lobby players (fallback):', updatedLobby.players)
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
        console.log('🎯 Current game state before animation:', gameState)
        console.log('🎯 Animation state that will be set:', data.player_id === playerId ? 'fly-out' : 'drop-down')
        if (data.player_id === playerId) {
          // This player won - show fly-out animation
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
          // This player didn't win - show drop-down animation
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
        // Update player score and reset streak
        setLobby(prevLobby => {
          if (!prevLobby) return prevLobby
          const updatedLobby = {
            ...prevLobby,
            players: prevLobby.players.map(p => 
              p.id === data.player_id 
                ? { 
                    ...p, 
                    score: data.score,
                    streak: data.streak
                  }
                : p
            )
          }
          return updatedLobby
        })
        
        if (data.player_id === playerId) {
          setIsInputShaking(true)
          setTranslationInput('')
          setTimeout(() => setIsInputShaking(false), 500)
        }
        break
      }
      case 'timeout': {
        // Reset all player streaks on timeout
        setLobby(prevLobby => {
          if (!prevLobby) return prevLobby
          const updatedLobby = {
            ...prevLobby,
            players: prevLobby.players.map(p => ({ ...p, streak: 0 }))
          }
          return updatedLobby
        })
        
        // Hide fuse bar during animation sequence
        setShowFuseBar(false)
        
        // Generate new word key for the new word
        const newWordKey = `${Date.now()}-${Math.random()}`
        
        // Handle timeout - all players get drop-down animation
        const newWordData = {
          currentWord: data.new_word,
          currentWordLanguage: data.new_word_language,
          currentWordTranslations: data.new_word_translations
        }
        
        setGameState(prev => {
          const newState: GameState = {
            ...prev,
            wordAnimation: 'drop-down' as const,
            pendingWordData: { ...newWordData, wordKey: newWordKey }
          }
          console.log('🎯 Updated game state (timeout) - animation only:', newState)
          return newState
        })
        break
      }
      case 'game_ended': {
        console.log('🎯 GAME ENDED HANDLER START')
        console.log('Received game end data:', data)
        
        // Update final player data with streaks and fastest guesses
        setLobby(prevLobby => {
          if (!prevLobby) return prevLobby
          const updatedLobby = {
            ...prevLobby,
            players: prevLobby.players.map(p => {
              const finalPlayerData = data.players.find((fp: any) => fp.id === p.id)
              return finalPlayerData ? {
                ...p,
                score: finalPlayerData.score,
                highest_streak: finalPlayerData.highest_streak,
                fastest_guess: finalPlayerData.fastest_guess
              } : p
            })
          }
          return updatedLobby
        })
        
        // Set game summary
        setGameSummary({
          winner: data.winner,
          winner_id: data.winner_id,
          max_words: data.max_words,
          word_history: data.word_history,
          players: data.players
        })
        
        setCurrentPage('game_summary')
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
        setSelectedMaxWords(data.lobby.max_words || 10)
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
        setSelectedMaxWords(data.lobby.max_words || 10)
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
        setSelectedMaxWords(data.max_words || 10)
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

  const updateMaxWords = async (maxWords: number) => {
    try {
      const response = await fetch(config.api.endpoints.updateMaxWords(lobbyId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `player_id=${encodeURIComponent(playerId)}&max_words=${maxWords}`
      })
      if (response.ok) {
        setSelectedMaxWords(maxWords)
      }
    } catch (error) {
      console.error('Error updating max words:', error)
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

  // Only start fuse bar/game logic after countdown is done
  useEffect(() => {
    if (gameReady) {
      setGameState(prev => ({ ...prev, isGameActive: true }));
      // Explicitly trigger fuse bar reset/animation for first word
      fuseBarFirstWordTriggerRef.current = true;
    }
  }, [gameReady]);

  // In the fuse bar effect, if fuseBarFirstWordTriggerRef.current is true, force the animation
  useEffect(() => {
    if (!gameReady) return;
    if (!gameState.isGameActive) return;
    if (!fuseBarRef.current) return;
    if (!showFuseBar) return;
    if (fuseBarFirstWordTriggerRef.current) {
      // Force fuse bar reset/animation for first word
      fuseBarRef.current.style.transition = 'none';
      fuseBarRef.current.style.transform = 'scaleX(1)';
      setTimeout(() => {
        if (!fuseBarRef.current) return;
        fuseBarRef.current.style.transition = `transform linear ${gameState.fuseMaxTime}s`;
        fuseBarRef.current.style.transform = 'scaleX(0)';
      }, 20);
      fuseBarFirstWordTriggerRef.current = false;
    }
  }, [gameReady, gameState.isGameActive, showFuseBar]);

  // Add state for dummy word logic
  const [dummyWordReady, setDummyWordReady] = useState(false);
  const [realFirstWord, setRealFirstWord] = useState<any>(null);
  const [skipDummyWord, setSkipDummyWord] = useState(false);

  // On game start (game_started event):
  const handleGameStarted = (data: any) => {
    console.log('[HANDLE_GAME_STARTED] called with data:', data)
    setDummyWordReady(false);
    setSkipDummyWord(false);
    console.log('[HANDLE_GAME_STARTED] setDummyWordReady(false), setSkipDummyWord(false)')
    // Roll a dummy word (simulate as if it's the first word)
    const dummyWord = { ...data, currentWord: '__DUMMY__', wordKey: `dummy-${Date.now()}` };
    setGameState({ ...dummyWord, isGameActive: false });
    console.log('[HANDLE_GAME_STARTED] setGameState to dummy word:', dummyWord)
    // Trigger fuse bar logic for dummy word (simulate a word change)
    setTimeout(() => {
      setDummyWordReady(true);
      setRealFirstWord({
        currentWord: data.current_word,
        currentWordLanguage: data.current_word_language,
        currentWordTranslations: data.current_word_translations,
        fuseTime: 30,
        fuseMaxTime: 30,
        isGameActive: true,
        wordAnimation: 'drop-in',
        wordKey: `${Date.now()}-${Math.random()}`
      });
      console.log('[HANDLE_GAME_STARTED] setDummyWordReady(true), setRealFirstWord (GameState shape)')
    }, 100); // Give the DOM a tick to measure, can be tuned
  };

  // After dummy word is ready and countdown is done, show the real first word
  useEffect(() => {
    console.log('[DUMMYWORD EFFECT] showCountdown:', showCountdown, 'dummyWordReady:', dummyWordReady, 'realFirstWord:', realFirstWord, 'skipDummyWord:', skipDummyWord)
    if (dummyWordReady && showCountdown === false && realFirstWord) {
      console.log('[DUMMYWORD EFFECT] Swapping in real first word and unblocking UI')
      setGameState(prev => ({
        ...prev,
        ...realFirstWord,
        isGameActive: true,
        wordAnimation: 'drop-in',
      }));
      setSkipDummyWord(true);
      setDummyWordReady(false);
      setRealFirstWord(null);
      // Desktop: force fuse bar to reset and animate for first word
      setShowFuseBar(false);
      setTimeout(() => setShowFuseBar(true), 10);
    }
  }, [dummyWordReady, showCountdown, realFirstWord]);

  // Add debug logs for all state transitions
  useEffect(() => { console.log('[STATE] dummyWordReady:', dummyWordReady); }, [dummyWordReady]);
  useEffect(() => { console.log('[STATE] realFirstWord:', realFirstWord); }, [realFirstWord]);
  useEffect(() => { console.log('[STATE] skipDummyWord:', skipDummyWord); }, [skipDummyWord]);
  useEffect(() => { console.log('[STATE] showCountdown:', showCountdown); }, [showCountdown]);

  // On game start, trigger countdown (and dummy word logic if present)
  // ... existing dummy word logic ...
  // After dummy word is ready, start countdown if not already started
  useEffect(() => {
    if (dummyWordReady && !showCountdown) {
      startCountdown();
    }
  }, [dummyWordReady]);

  // After countdown is done, show the real first word and start fuse bar
  useEffect(() => {
    if (showCountdown === false && dummyWordReady && realFirstWord) {
      setGameState({ ...realFirstWord, isGameActive: true });
      setSkipDummyWord(true);
      setDummyWordReady(false);
      setRealFirstWord(null);
    }
  }, [showCountdown, dummyWordReady, realFirstWord]);

  // Countdown overlay (always rendered at top level)
  const CountdownOverlay = () => (
    showCountdown !== false ? (
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-gray-900 transition-opacity duration-200 ${showCountdown === 'fading' ? 'opacity-0' : 'opacity-100'}`}
        style={{ pointerEvents: 'all' }}
      >
        <span
          key={zoomKey}
          style={{
            color: '#f59e0b',
            fontWeight: 900,
            fontSize: '20vw',
            lineHeight: 1,
            textAlign: 'center',
            display: 'block',
            transform: 'scale(0.8)',
            animation: 'zoomInOut 1s cubic-bezier(0.4,0,0.2,1) forwards',
          }}
        >
          {countdownValue}
        </span>
        <style>{`
          @keyframes zoomInOut {
            0% { transform: scale(0.8); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
          }
        `}</style>
      </div>
    ) : null
  );

  // Add at the top of App component
  const wordRef = useRef<HTMLHeadingElement>(null);
  const [wordWidth, setWordWidth] = useState<number | undefined>(undefined);

  // Measure word width for fuse bar using useLayoutEffect for perfect timing (desktop)
  useLayoutEffect(() => {
    if (wordRef.current) {
      setWordWidth(wordRef.current.offsetWidth);
    }
  }, [gameState.currentWord, gameState.wordKey, gameState.wordAnimation]);

  // Animate the fuse bar after it is rendered and measured (desktop)
  useEffect(() => {
    console.log('[DESKTOP FUSEBAR] wordWidth:', wordWidth, 'showFuseBar:', showFuseBar, 'word:', gameState.currentWord, 'wordKey:', gameState.wordKey);
    if (showFuseBar && fuseBarRef.current && (wordWidth === undefined || wordWidth > 0)) {
      fuseBarRef.current.style.transition = 'none';
      fuseBarRef.current.style.transform = 'scaleX(1)';
      setTimeout(() => {
        if (fuseBarRef.current) {
          fuseBarRef.current.style.transition = `transform linear ${gameState.fuseMaxTime}s`;
          fuseBarRef.current.style.transform = 'scaleX(0)';
        }
      }, 20);
    }
  }, [showFuseBar, gameState.wordKey, wordWidth]);

  const [showBgImage, setShowBgImage] = useState(false);

  useEffect(() => {
    if (showCountdown === false) {
      const timeout = setTimeout(() => setShowBgImage(true), 150);
      return () => clearTimeout(timeout);
    } else {
      setShowBgImage(false);
    }
  }, [showCountdown]);

  const [inviteCopied, setInviteCopied] = useState(false);

  const handleCopyInvite = async () => {
    const inviteUrl = `${window.location.origin}?lobby=${lobbyId}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1500);
    } catch (error) {
      console.error('Failed to copy invite link:', error);
    }
  };

  if (currentPage === 'game') {
    // Use mobile game screen on mobile devices
    if (isMobile) {
      // MobileGameScreen must block word/fuse bar rendering until countdown is done and dummy word is skipped.
      // TODO: In MobileGameScreen, add debug logging and logic to only show the real word/fuse bar after countdown.
      return (
        <>
          <CountdownOverlay />
          <MobileGameScreen
            gameState={gameState}
            lobby={lobby}
            playerId={playerId}
            selectedLanguage={selectedLanguage}
            translationInput={translationInput}
            setTranslationInput={setTranslationInput}
            handleTranslationSubmit={handleTranslationSubmit}
            isInputShaking={isInputShaking}
            showFuseBar={showFuseBar}
            fuseBarRef={fuseBarRef}
            handleFuseTransitionEnd={handleFuseTransitionEnd}
            onWordAnimationEnd={(animationName) => {
              console.log('🎬 Animation ended:', animationName)
              console.log('🔍 Current wordAnimation state:', gameState.wordAnimation)
              if (animationName === 'word-fly-out' || animationName === 'word-fly-out-streak') {
                handleWordFlyOutEnd()
              } else if (animationName === 'word-drop-down' || animationName === 'word-drop-down-streak') {
                handleWordDropDownEnd()
              } else if (animationName === 'drop-in' || animationName === 'drop-in-streak') {
                handleWordDropInEnd()
              }
            }}
            overtakeAnimation={overtakeAnimation}
            overtakingPlayerId={overtakingPlayerId}
            overtakenPlayerId={overtakenPlayerId}
            onOvertakeAnimationEnd={(animationName) => {
              if (animationName === 'overtake-slide-up') {
                handleOvertakeSlideUpEnd()
              } else if (animationName === 'overtake-slide-down') {
                handleOvertakeSlideDownEnd()
              }
            }}
            showCountdown={showCountdown}
            dummyWordReady={dummyWordReady}
            skipDummyWord={skipDummyWord}
          />
        </>
      )
    }

    // Desktop game screen (original)
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
    
    if (showCountdown !== false || !showBgImage) {
      return (
        <>
          <CountdownOverlay />
          <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1f2937' }} />
        </>
      );
    }
    return (
      <>
        <CountdownOverlay />
        <div 
          className="min-h-screen bg-cover bg-center bg-no-repeat flex flex-col"
          style={{ backgroundImage: `url(${backgroundImage})`, backgroundColor: '#1f2937' }}
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
                      } ${isOvertaking ? 'animate-overtake-slide-up' : ''} ${isOvertaken ? 'animate-overtake-slide-down' : ''} ${(player.streak || 0) >= 2 ? 'scoreboard-streak-glow' : ''}`}
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
                      <div className="flex items-center space-x-2">
                        <span className="text-white font-medium">{player.name}</span>
                        {(player.streak || 0) >= 2 && (
                          <span className="text-amber-400 text-sm font-bold">
                            🔥 {player.streak}
                          </span>
                        )}
                      </div>
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
              {(!skipDummyWord || showCountdown !== false) ? (
                <div style={{ height: 64 }} /> // Blocked: render empty space for layout
              ) : (
                <>
                  <h1
                    ref={wordRef}
                    key={`word-${gameState.wordKey}-${gameState.wordAnimation}`}
                    className={`font-bold text-white drop-shadow-2xl break-words text-4xl sm:text-5xl md:text-6xl lg:text-7xl ${
                      (() => {
                        // Check if current player has a streak
                        const hasStreak = lobby && playerId && (() => {
                          const currentPlayer = lobby.players.find(p => p.id === playerId)
                          return (currentPlayer?.streak || 0) >= 2  // Streak starts at 2
                        })()
                        
                        if (gameState.wordAnimation === 'fly-out') {
                          return hasStreak ? 'animate-word-fly-out-streak' : 'animate-word-fly-out'
                        } else if (gameState.wordAnimation === 'drop-down') {
                          return hasStreak ? 'animate-word-drop-down-streak' : 'animate-word-drop-down'
                        } else if (gameState.wordAnimation === 'drop-in') {
                          return hasStreak ? 'animate-drop-in-streak' : 'animate-drop-in'
                        } else if (gameState.wordAnimation === 'hidden') {
                          return 'animate-hidden'
                        }
                        return ''
                      })()
                    } ${(() => {
                      // Apply streak glow only when no animation is running
                      if (lobby && playerId && gameState.wordAnimation === 'none') {
                        const currentPlayer = lobby.players.find(p => p.id === playerId)
                        return (currentPlayer?.streak || 0) >= 2 ? 'streak-glow' : ''  // Streak starts at 2
                      }
                      return ''
                    })()}`}
                    onAnimationStart={(event) => {
                      const animationName = event.animationName;
                      console.log('🎬 Animation started:', animationName);
                      console.log('🎬 Element classes:', (event.target as HTMLElement).className);
                    }}
                    onAnimationEnd={(event) => {
                      const animationName = event.animationName;
                      console.log('🎬 Animation ended:', animationName);
                      console.log('🎬 Element classes:', (event.target as HTMLElement).className);
                      // Use the same handler as mobile
                      if (animationName === 'word-fly-out' || animationName === 'word-fly-out-streak') {
                        console.log('🎬 Calling handleWordFlyOutEnd');
                        handleWordFlyOutEnd();
                      } else if (animationName === 'word-drop-down' || animationName === 'word-drop-down-streak') {
                        console.log('🎬 Calling handleWordDropDownEnd');
                        handleWordDropDownEnd();
                      } else if (animationName === 'drop-in' || animationName === 'drop-in-streak') {
                        console.log('🎬 Calling handleWordDropInEnd');
                        handleWordDropInEnd();
                      }
                    }}
                    style={{ display: 'inline-block', minWidth: 1 }}
                  >
                    {getDisplayWord()}
                  </h1>
                  {/* Fuse timer - matches word width, fallback to 100% if needed */}
                  {showFuseBar && (
                    <div className="relative mx-auto mt-2" style={{ width: wordWidth && wordWidth > 0 ? wordWidth : '100%' }}>
                      <div className="relative h-0.5 flex items-center justify-center">
                        <div
                          ref={fuseBarRef}
                          className="absolute left-0 top-0 h-0.5 w-full bg-white rounded-full transition-transform"
                          style={{
                            transformOrigin: 'center',
                            transform: 'scaleX(1)',
                          }}
                          onTransitionEnd={handleFuseTransitionEnd}
                        />
                      </div>
                    </div>
                  )}
                </>
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
      </>
    )
  }

  if (currentPage === 'lobby') {
    // Use mobile lobby screen on mobile devices
    if (isMobile) {
      return (
        <MobileLobbyScreen
          lobby={lobby}
          playerId={playerId}
          isHost={isHost}
          chatMessages={chatMessages}
          chatMessage={chatMessage}
          setChatMessage={setChatMessage}
          sendChatMessage={sendChatMessage}
          toggleReady={toggleReady}
          selectedDifficulty={selectedDifficulty}
          updateDifficulty={updateDifficulty}
          selectedMaxWords={selectedMaxWords}
          updateMaxWords={updateMaxWords}
          startGame={startGame}
          copyInviteLink={copyInviteLink}
        />
      )
    }

    // Desktop lobby screen (original)
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8">
        {/* Main container: chat and player list side by side */}
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
                    <span className="text-xs" style={{ color: player.ready ? '#f59e0b' : '#6b7280' }}>{player.ready ? '✓' : '○'}</span>
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
            {/* Ready toggle for non-host player */}
            {!isHost && lobby && (
              <button
                onClick={toggleReady}
                className={`mt-6 w-full py-2 rounded-lg font-semibold text-base transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-md ${
                  lobby.players.find(p => p.id === playerId)?.ready
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {lobby.players.find(p => p.id === playerId)?.ready ? 'Unready' : 'Ready'}
              </button>
            )}
          </div>
        </div>
        {/* Host settings box below main container */}
        {isHost && (
          <div className="w-full max-w-4xl mx-auto mt-6 bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col gap-4">
            {/* Row 1: Buttons */}
            <div className="flex gap-4 mb-2">
              <button
                onClick={startGame}
                disabled={!lobby?.players.every(p => p.ready)}
                className={`flex-1 h-12 py-3 rounded-lg font-semibold text-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-md ${
                  lobby?.players.every(p => p.ready)
                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                    : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                }`}
                style={{ minHeight: 48, maxHeight: 48 }}
              >
                Start Game
              </button>
              <div className="flex-1 flex flex-col items-center" style={{ minHeight: 48, maxHeight: 48, position: 'relative' }}>
                <button
                  onClick={handleCopyInvite}
                  className="w-full h-12 py-3 rounded-lg font-semibold text-lg bg-[#23272e] text-white hover:bg-[#2d323b] transition-all duration-150 focus:outline-none shadow-md flex items-center justify-center"
                  style={{ minHeight: 48, maxHeight: 48 }}
                >
                  <FiLink className="inline-block mr-2 -mt-0.5" /> Invite Players
                </button>
                {inviteCopied && (
                  <div className="text-xs text-amber-400 mt-1 text-center w-full absolute left-0 right-0" style={{ top: '100%' }}>Link copied!</div>
                )}
              </div>
            </div>
            {/* Row 2: Dropdowns */}
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-white font-semibold mb-2">Difficulty</label>
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full bg-[#23272e] border border-gray-700 text-white py-2 px-4 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors duration-200 hover:bg-[#2d323b]"
                  >
                    {difficulties.find(d => d.value === selectedDifficulty)?.label || 'Select difficulty'}
                    <svg className={`w-4 h-4 absolute right-4 top-1/2 transform -translate-y-1/2 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute left-0 right-0 bg-[#23272e] border border-gray-700 rounded-lg mt-1 z-10 shadow-lg">
                      {difficulties.map((difficulty) => (
                        <button
                          key={difficulty.value}
                          onClick={() => {
                            updateDifficulty(difficulty.value)
                            setIsDropdownOpen(false)
                          }}
                          className="w-full text-left px-4 py-2 text-white hover:bg-[#2d323b] transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg text-sm"
                        >
                          {difficulty.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-white font-semibold mb-2">Max Words</label>
                <div className="relative">
                  <button
                    onClick={() => setIsMaxWordsDropdownOpen(!isMaxWordsDropdownOpen)}
                    className="w-full bg-[#23272e] border border-gray-700 text-white py-2 px-4 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors duration-200 hover:bg-[#2d323b]"
                  >
                    {maxWordsOptions.find(m => m.value === selectedMaxWords)?.label || 'Select max words'}
                    <svg className={`w-4 h-4 absolute right-4 top-1/2 transform -translate-y-1/2 transition-transform duration-200 ${isMaxWordsDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isMaxWordsDropdownOpen && (
                    <div className="absolute left-0 right-0 bg-[#23272e] border border-gray-700 rounded-lg mt-1 z-10 shadow-lg">
                      {maxWordsOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            updateMaxWords(option.value)
                            setIsMaxWordsDropdownOpen(false)
                          }}
                          className="w-full text-left px-4 py-2 text-white hover:bg-[#2d323b] transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg text-sm"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (currentPage === 'game_summary' && gameSummary) {
    if (isMobile) {
      return <MobileGameSummary gameSummary={gameSummary} isHost={isHost} playAgain={playAgain} selectedLanguage={selectedLanguage} />
    }
    const backgroundImage = selectedLanguage === 'fr' ? '/fr_bg.webp' : '/sv_bg.webp'
    const amber = '#f59e0b'
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
              <div className="text-3xl font-bold text-white mb-2" style={{ color: amber }}>
                {gameSummary.winner} wins!
              </div>
            </div>

            {/* Word History Section */}
            <div className="bg-gray-700/50 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold text-white mb-4">Game History</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto overflow-x-auto">
                {gameSummary.word_history.map((wordData, index) => (
                  <div 
                    key={index} 
                    className={`py-2 px-3 rounded flex flex-wrap justify-between items-center ${
                      wordData.status === 'correct' 
                        ? index % 2 === 0 ? 'bg-amber-500/20' : 'bg-amber-500/10'
                        : index % 2 === 0 ? 'bg-red-600/20' : 'bg-red-600/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <span className="text-sm text-gray-400 w-8">#{index + 1}</span>
                      <span className="text-white font-medium truncate max-w-[80px]">{wordData.word}</span>
                      {wordData.winner && (
                        <span className="text-sm" style={{ color: amber }}>✓ {wordData.winner}</span>
                      )}
                      {wordData.status === 'timeout' && (
                        <span className="text-red-400 text-sm">⏰ Timeout</span>
                      )}
                      {wordData.status === 'correct' && wordData.time_taken && (
                        <span className="text-xs text-gray-400">⚡ {wordData.time_taken.toFixed(1)}s</span>
                      )}
                    </div>
                    <div className="flex flex-1 min-w-0 space-x-2 text-xs justify-end">
                      <span className="text-gray-300 flex-1 truncate text-left w-auto max-w-[100px]">{wordData.translations.sv}</span>
                      <span className="text-gray-300 flex-1 truncate text-right w-auto max-w-[100px]">{wordData.translations.fr}</span>
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
                          ? 'bg-amber-500/30 border' 
                          : 'bg-gray-700/50'
                      }`}
                      style={player.id === gameSummary.winner_id ? { borderColor: amber } : {}}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                        <span className="text-white font-medium">{player.name}</span>
                        <span className="text-sm text-gray-400">
                          {player.language === 'sv' ? '🇸🇪' : player.language === 'fr' ? '🇫🇷' : ''}
                        </span>
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        <span className="text-white font-bold text-lg">{player.score}</span>
                        <div className="flex space-x-2 text-xs text-gray-400">
                          <span>🔥 {player.highest_streak}</span>
                        </div>
                      </div>
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
    // Use mobile setup screen on mobile devices
    if (isMobile) {
      return (
        <MobileSetupScreen
          playerName={playerName}
          setPlayerName={setPlayerName}
          selectedLanguage={selectedLanguage}
          setSelectedLanguage={setSelectedLanguage}
          onContinue={() => lobbyId ? joinLobby() : createLobby()}
          canContinue={!!canContinue}
        />
      )
    }

    // Desktop setup screen (original)
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