import React, { useRef, useEffect, useState, useLayoutEffect } from 'react'
import { useMobile } from '../hooks/useMobile'

interface Player {
  id: string
  name: string
  language: string
  is_host: boolean
  ready: boolean
  joined_at: string
  score?: number
  streak?: number
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
  wordKey: string
  pendingWordData?: {
    currentWord: string
    currentWordLanguage: string
    currentWordTranslations?: { sv: string, fr: string }
    wordKey: string
  }
}

interface MobileGameScreenProps {
  gameState: GameState
  lobby: { players: Player[] } | null
  playerId: string
  selectedLanguage: string
  translationInput: string
  setTranslationInput: (value: string) => void
  handleTranslationSubmit: () => void
  isInputShaking: boolean
  showFuseBar: boolean
  fuseBarRef: React.RefObject<HTMLDivElement | null>
  handleFuseTransitionEnd: () => void
  onWordAnimationEnd: (animationName: string) => void
  overtakeAnimation: 'none' | 'slide-up' | 'slide-down'
  overtakingPlayerId: string
  overtakenPlayerId: string
  onOvertakeAnimationEnd: (animationName: string) => void
  showCountdown: boolean | 'fading'
  dummyWordReady: boolean
  skipDummyWord: boolean
}

export const MobileGameScreen: React.FC<MobileGameScreenProps> = ({
  gameState,
  lobby,
  playerId,
  selectedLanguage,
  translationInput,
  setTranslationInput,
  handleTranslationSubmit,
  isInputShaking,
  showFuseBar,
  fuseBarRef,
  handleFuseTransitionEnd,
  onWordAnimationEnd,
  overtakeAnimation,
  overtakingPlayerId,
  overtakenPlayerId,
  onOvertakeAnimationEnd,
  showCountdown,
  dummyWordReady,
  skipDummyWord
}) => {
  const { isMobile, orientation } = useMobile()
  const inputRef = useRef<HTMLInputElement>(null)
  const wordRef = useRef<HTMLHeadingElement>(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [wordWidth, setWordWidth] = useState<number | undefined>(undefined)
  const [showBgImage, setShowBgImage] = useState(false);

  // Add overtake animation CSS
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
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
      
      .animate-word-fly-out {
        animation: word-fly-out 0.6s ease-in forwards;
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
      
      .animate-word-drop-down {
        animation: word-drop-down 0.6s ease-out forwards;
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
      
      .animate-drop-in {
        animation: drop-in 0.6s ease-out forwards;
      }
      
      @keyframes drop-in {
        0% { 
          transform: translateY(-50px) scale(0.9);
        }
        100% { 
          transform: translateY(0) scale(1);
        }
      }
      
      .animate-hidden {
        animation: hidden 0.3s ease-out forwards;
      }
      
      @keyframes hidden {
        0% { 
          opacity: 1;
          transform: scale(1);
        }
        100% { 
          opacity: 0;
          transform: scale(0.8);
        }
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
      
      .animate-word-fly-out-streak {
        animation: word-fly-out-streak 0.6s ease-in forwards;
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
      
      .animate-word-drop-down-streak {
        animation: word-drop-down-streak 0.6s ease-out forwards;
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
      
      .animate-drop-in-streak {
        animation: drop-in-streak 0.6s ease-out forwards;
      }
      
      @keyframes drop-in-streak {
        0% { 
          transform: translateY(-50px) scale(0.9);
          text-shadow: 0 0 10px #f59e0b, 0 0 20px #f59e0b, 0 0 30px #f59e0b;
        }
        100% { 
          transform: translateY(0) scale(1);
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

  // iOS Safari white space fix - from DEV article (same as chat)
  useEffect(() => {
    const adjustHeight = () => {
      document.body.style.height = `${window.innerHeight}px`
    }
    const handleViewportChange = () => {
      adjustHeight()
      window.scrollTo(0, 0)
    }
    adjustHeight()
    window.addEventListener('resize', handleViewportChange)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange)
    }
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange)
      }
    }
  }, [])

  // Keyboard detection for input positioning (same as chat)
  useEffect(() => {
    const detectKeyboard = () => {
      if (window.visualViewport) {
        const viewport = window.visualViewport
        if (viewport) {
          const keyboardHeight = Math.max(0, window.innerHeight - viewport.height)
          setKeyboardHeight(keyboardHeight)
        }
      }
    }
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', detectKeyboard)
      detectKeyboard()
      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', detectKeyboard)
        }
      }
    } else {
      const handleResize = () => {
        const heightDifference = screen.height - window.innerHeight
        setKeyboardHeight(heightDifference > 150 ? heightDifference : 0)
      }
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Measure word width for fuse bar using useLayoutEffect for perfect timing
  useLayoutEffect(() => {
    if (wordRef.current) {
      setWordWidth(wordRef.current.offsetWidth)
    }
  }, [gameState.currentWord, gameState.wordKey, gameState.wordAnimation])

  // Animate the fuse bar after it is rendered and measured
  useEffect(() => {
    if (showFuseBar && fuseBarRef.current && wordWidth && wordWidth > 0) {
      fuseBarRef.current.style.transition = 'none'
      fuseBarRef.current.style.transform = 'scaleX(1)'
      setTimeout(() => {
        if (fuseBarRef.current) {
          fuseBarRef.current.style.transition = `transform linear ${gameState.fuseMaxTime}s`
          fuseBarRef.current.style.transform = 'scaleX(0)'
        }
      }, 20)
    }
  }, [showFuseBar, gameState.wordKey, wordWidth])

  const getDisplayWord = () => {
    if (!lobby) return gameState.currentWord
    const currentPlayer = lobby.players.find(p => p.id === playerId)
    if (!currentPlayer) return gameState.currentWord
    if (currentPlayer.language === 'fr' && gameState.currentWordTranslations?.fr) {
      return gameState.currentWordTranslations.fr
    } else if (currentPlayer.language === 'sv' && gameState.currentWordTranslations?.sv) {
      return gameState.currentWordTranslations.sv
    }
    return gameState.currentWord
  }

  const sortedPlayers = lobby?.players.sort((a, b) => (b.score || 0) - (a.score || 0)) || []
  const backgroundImage = selectedLanguage === 'fr' ? '/fr_bg.webp' : '/sv_bg.webp'

  // Fixed heights
  const headerHeight = 48
  const inputHeight = 56

  // Debug logging for countdown/dummy word state
  useEffect(() => {
    console.log('[MOBILE] showCountdown:', showCountdown, 'dummyWordReady:', dummyWordReady, 'skipDummyWord:', skipDummyWord)
  }, [showCountdown, dummyWordReady, skipDummyWord])

  useEffect(() => {
    if (showCountdown === false) {
      const timeout = setTimeout(() => setShowBgImage(true), 150);
      return () => clearTimeout(timeout);
    } else {
      setShowBgImage(false);
    }
  }, [showCountdown]);

  // Only render solid background before countdown starts or before delay
  if (showCountdown !== false || !showBgImage) {
    return <div className="min-h-screen bg-gray-900" />;
  }

  // Render game UI as soon as countdown starts and delay has passed (covered by overlay)
  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {/* Scoreboard at the top for mobile (hide during countdown) */}
      {lobby && showCountdown === false && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: '15%',
          right: '15%',
          zIndex: 1001,
          background: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 0,
          padding: '4px 0',
          maxWidth: 420,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}>
          {lobby.players.sort((a, b) => (b.score || 0) - (a.score || 0)).map((player, index) => {
            const isOvertaking = player.id === overtakingPlayerId && overtakeAnimation === 'slide-up'
            const isOvertaken = player.id === overtakenPlayerId && overtakeAnimation === 'slide-down'
            return (
              <div 
                key={player.id} 
                className={`${isOvertaking ? 'animate-overtake-slide-up' : ''} ${isOvertaken ? 'animate-overtake-slide-down' : ''} ${(player.streak || 0) >= 2 ? 'scoreboard-streak-glow' : ''}`}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '6px 16px', 
                  background: index % 2 === 0 ? 'rgba(55,65,81,0.7)' : 'rgba(31,41,55,0.7)', 
                  borderRadius: 6, 
                  margin: '2px 0',
                  zIndex: isOvertaking ? 10 : isOvertaken ? 1 : 1
                }}
                onAnimationEnd={(event) => {
                  const animationName = event.animationName
                  if (animationName === 'overtake-slide-up') {
                    onOvertakeAnimationEnd('overtake-slide-up')
                  } else if (animationName === 'overtake-slide-down') {
                    onOvertakeAnimationEnd('overtake-slide-down')
                  }
                }}
              >
                <span style={{ color: '#fff', fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {player.name}
                  {(player.streak || 0) >= 2 && (
                    <span style={{ color: '#f59e0b', fontSize: 11, fontWeight: 700 }}>
                      🔥 {player.streak}
                    </span>
                  )}
                </span>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{player.score || 0}</span>
              </div>
            )
          })}
        </div>
      )}
      {/* Main Container: word/fuse centered in available space */}
      {showCountdown === false && (
        <div
          style={{
            position: 'fixed',
            top: headerHeight,
            left: 0,
            right: 0,
            bottom: inputHeight + keyboardHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          <div style={{ width: '100%', textAlign: 'center', pointerEvents: 'auto' }}>
            {(!skipDummyWord || showCountdown !== false) ? (
              <div style={{ height: 64 }} /> // Blocked: render empty space for layout
            ) : (
              <>
                <h1 
                  ref={wordRef}
                  key={`word-${gameState.wordKey}-${gameState.wordAnimation}`}
                  className={`font-bold text-white drop-shadow-2xl break-words ${
                    isMobile 
                      ? orientation === 'portrait' 
                        ? 'text-4xl sm:text-5xl' 
                        : 'text-3xl' 
                      : 'text-6xl md:text-7xl'
                  } ${
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
                  onAnimationEnd={(event) => {
                    const animationName = event.animationName
                    onWordAnimationEnd(animationName)
                  }}
                  style={{ display: 'inline-block' }}
                >
                  {getDisplayWord()}
                </h1>
                {/* Fuse timer - matches word width */}
                {showFuseBar && wordWidth && wordWidth > 0 && (
                  <div className="relative mx-auto mt-2" style={{ width: wordWidth }}>
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
      )}

      {/* Input Area - Fixed at bottom with mobile keyboard considerations */}
      {showCountdown === false && (
        <div 
          className="p-2"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            height: inputHeight,
            bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : 0,
            zIndex: 1000,
            transition: 'bottom 0.2s ease-in-out',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div className="max-w-md mx-auto w-full">
            <input
              ref={inputRef}
              type="text"
              placeholder={selectedLanguage === 'fr' ? 'översätt till svenska' : 'traduire en français'}
              value={translationInput}
              onChange={(e) => setTranslationInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleTranslationSubmit()}
              className={`w-full bg-white/90 border-2 border-white/40 text-gray-900 placeholder-gray-600 rounded-xl text-base font-medium focus:outline-none focus:border-white/80 focus:bg-white transition-all duration-200 shadow-lg ${
                isMobile 
                  ? 'py-2 px-4 text-base' 
                  : 'py-3 px-4'
              } ${
                isInputShaking ? 'animate-shake' : ''
              }`}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              inputMode="text"
            />
          </div>
        </div>
      )}
    </div>
  )
} 