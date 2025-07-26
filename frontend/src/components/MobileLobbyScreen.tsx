import React, { useState, useRef, useEffect } from 'react'
import { FiLink } from 'react-icons/fi'
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

interface MobileLobbyScreenProps {
  lobby: Lobby | null
  playerId: string
  isHost: boolean
  chatMessages: ChatMessage[]
  chatMessage: string
  setChatMessage: (value: string) => void
  sendChatMessage: () => void
  toggleReady: () => void
  selectedDifficulty: number
  updateDifficulty: (difficulty: number) => void
  selectedMaxWords: number
  updateMaxWords: (maxWords: number) => void
  startGame: () => void
  copyInviteLink: () => void
}

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

export const MobileLobbyScreen: React.FC<MobileLobbyScreenProps> = ({
  lobby,
  playerId,
  isHost,
  chatMessages,
  chatMessage,
  setChatMessage,
  sendChatMessage,
  toggleReady,
  selectedDifficulty,
  updateDifficulty,
  selectedMaxWords,
  updateMaxWords,
  startGame,
  copyInviteLink
}) => {
  const { isMobile } = useMobile()
  const [activeTab, setActiveTab] = useState<'chat' | 'players' | 'settings'>('players')
  const [isDifficultyOpen, setIsDifficultyOpen] = useState(false)
  const [isMaxWordsOpen, setIsMaxWordsOpen] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const amber = '#f59e0b'
  const [inviteCopied, setInviteCopied] = useState(false)

  // iOS Safari white space fix - from DEV article
  useEffect(() => {
    const adjustHeight = () => {
      document.body.style.height = `${window.innerHeight}px`
    }
    
    // Handle both resize and visual viewport changes
    const handleViewportChange = () => {
      adjustHeight()
      // Force scroll to top to prevent white space
      window.scrollTo(0, 0)
    }

    // Apply initial height
    adjustHeight()

    // Listen for resize events (works on most browsers)
    window.addEventListener('resize', handleViewportChange)
    
    // Visual Viewport API for better mobile support
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

  // Separate keyboard detection just for input positioning
  useEffect(() => {
    const detectKeyboardForInput = () => {
      if (window.visualViewport) {
        const viewport = window.visualViewport
        const keyboardHeight = Math.max(0, window.innerHeight - viewport.height)
        setKeyboardHeight(keyboardHeight)
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', detectKeyboardForInput)
      detectKeyboardForInput() // Initial check
      
      return () => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', detectKeyboardForInput)
        }
      }
    } else {
      // Fallback for browsers without Visual Viewport API
      const handleResize = () => {
        const heightDifference = screen.height - window.innerHeight
        setKeyboardHeight(heightDifference > 150 ? heightDifference : 0)
      }
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current && activeTab === 'chat') {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatMessages, activeTab])

  if (!isMobile) {
    return null // This component is only for mobile
  }

  const handleShare = async () => {
    const inviteUrl = `${window.location.origin}?lobby=${lobby?.id}`
    
    // Check if Web Share API is supported (mobile browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join my Motord game!',
          text: 'Come play word translation with me',
          url: inviteUrl
        })
      } catch (error) {
        // User cancelled or error occurred, fallback to copy
        await navigator.clipboard.writeText(inviteUrl)
      }
    } else {
      // Fallback for browsers without Web Share API
      await navigator.clipboard.writeText(inviteUrl)
    }
  }

  const handleSendMessage = () => {
    sendChatMessage()
    // Auto-scroll after sending
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
      }
    }, 100)
  }

  const handleCopyInvite = async () => {
    const inviteUrl = `${window.location.origin}?lobby=${lobby?.id}`
    let copied = false
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(inviteUrl)
        copied = true
      } catch {}
    }
    if (!copied) {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = inviteUrl
      document.body.appendChild(input)
      input.select()
      try {
        document.execCommand('copy')
        copied = true
      } catch {}
      document.body.removeChild(input)
    }
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 1500)
  }

  return (
    <>
      {/* Independent Fixed Header - Tab Navigation */}
      <div 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '48px',
          zIndex: 9999,
          backgroundColor: '#1f2937',
          borderBottom: '1px solid #374151'
        }}
      >
        <div style={{ display: 'flex', height: '100%' }}>
          {['players', 'chat', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '14px',
                fontWeight: '500',
                textTransform: 'capitalize',
                position: 'relative',
                backgroundColor: 'transparent',
                border: 'none',
                color: activeTab === tab ? '#ffffff' : '#9ca3af',
                cursor: 'pointer'
              }}
            >
              {tab}
              {activeTab === tab && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  backgroundColor: '#f59e0b'
                }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Independent Fixed Action buttons */}
      <div 
        style={{ 
          position: 'fixed',
          top: '48px',
          left: 0,
          right: 0,
          height: '92px',
          zIndex: 9998,
          backgroundColor: '#1f2937',
          padding: '16px',
          borderBottom: '1px solid #374151'
        }}
      >
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          {!isHost && (
            <button
              onClick={toggleReady}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '8px',
                fontWeight: '500',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: lobby?.players.find(p => p.id === playerId)?.ready ? amber : '#4b5563',
                color: '#ffffff',
                transition: 'all 0.2s'
              }}
            >
              {lobby?.players.find(p => p.id === playerId)?.ready ? 'Ready ✓' : 'Ready?'}
            </button>
          )}
          
          {isHost && (
            <button
              onClick={startGame}
              disabled={!lobby?.players.every(p => p.ready)}
              style={{
                flex: '0 0 110px',
                padding: '12px 0',
                borderRadius: '8px',
                fontWeight: '500',
                border: 'none',
                cursor: lobby?.players.every(p => p.ready) ? 'pointer' : 'not-allowed',
                backgroundColor: lobby?.players.every(p => p.ready) ? amber : '#4b5563',
                color: lobby?.players.every(p => p.ready) ? '#fff' : '#9ca3af',
                opacity: lobby?.players.every(p => p.ready) ? 1 : 0.6,
                transition: 'all 0.2s',
                fontSize: '15px',
                height: '44px',
                lineHeight: 1,
              }}
            >
              Start Game
            </button>
          )}
          
          {isHost && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                onClick={handleCopyInvite}
                style={{
                  backgroundColor: '#4b5563',
                  color: '#ffffff',
                  padding: '12px 10px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                  fontSize: '15px',
                  minWidth: '0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  height: '44px',
                  lineHeight: 1,
                }}
                title="Invite Players"
              >
                <FiLink style={{ width: '20px', height: '20px', verticalAlign: 'middle' }} />
                Invite Players
              </button>
              {inviteCopied && (
                <span style={{
                  position: 'absolute',
                  left: '50%',
                  top: '110%',
                  transform: 'translateX(-50%)',
                  background: '#222',
                  color: amber,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  zIndex: 10,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  display: 'block',
                  pointerEvents: 'none',
                }}>Link copied!</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Move the scoreboard to the top, above the action buttons, and make it sticky/fixed */}
      {lobby && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1001,
          background: 'rgba(20,20,20,0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 0,
          padding: '4px 0',
          maxWidth: 420,
          margin: '0 auto',
        }}>
          {lobby.players.sort((a, b) => (b.score || 0) - (a.score || 0)).map((player, index) => (
            <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 16px', background: index % 2 === 0 ? 'rgba(55,65,81,0.7)' : 'rgba(31,41,55,0.7)', borderRadius: 6, margin: '2px 0' }}>
              <span style={{ color: '#fff', fontWeight: 500, fontSize: 13 }}>{player.name}</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{player.score || 0}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main Container */}
      <div style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#111827', 
        overflow: 'hidden'
      }}>
        {/* Tab Content - Account for fixed headers */}
        <div style={{ 
          position: 'absolute',
          top: '140px', // Account for header + action buttons
          left: 0,
          right: 0,
          bottom: activeTab === 'chat' ? (keyboardHeight > 0 ? `${80 + keyboardHeight}px` : '80px') : 0,
          backgroundColor: '#111827',
          overflow: 'hidden'
        }}>
        {/* Players Tab */}
        {activeTab === 'players' && (
          <div style={{ height: '100%', padding: '16px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {lobby?.players.map((player) => (
                <div 
                  key={player.id} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    backgroundColor: '#1f2937',
                    borderRadius: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: player.ready ? amber : '#6b7280', fontSize: '14px' }}>
                        {player.ready ? '✓' : '○'}
                      </span>
                    </div>
                    <span style={{ color: '#ffffff', fontWeight: '500' }}>{player.name}</span>
                    {player.is_host && (
                      <span style={{
                        fontSize: '12px',
                        color: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                        padding: '4px 8px',
                        borderRadius: '4px'
                      }}>
                        host
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '24px' }}>
                    {player.language === 'sv' ? '🇸🇪' : player.language === 'fr' ? '🇫🇷' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div 
              ref={chatContainerRef}
              style={{ 
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                paddingBottom: keyboardHeight > 0 ? '16px' : '80px'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {chatMessages.map((msg) => {
                  const isOwn = msg.player === lobby?.players.find(p => p.id === playerId)?.name
                  return (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'end', gap: '8px', flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                        <div style={{ maxWidth: '95%', width: '95%' }}>
                          <div style={{
                            backgroundColor: isOwn ? '#f59e0b' : '#374151',
                            color: isOwn ? '#fff' : '#fff',
                            borderRadius: '16px',
                            borderBottomRightRadius: isOwn ? '4px' : '16px',
                            borderBottomLeftRadius: isOwn ? '16px' : '4px',
                            padding: '8px 12px',
                            marginBottom: '4px',
                            alignSelf: isOwn ? 'flex-end' : 'flex-start',
                            textAlign: 'left',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            boxShadow: isOwn ? '0 1px 4px rgba(245,158,11,0.10)' : '0 1px 4px rgba(55,65,81,0.10)'
                          }}>
                            <span style={{ fontSize: '16px' }}>{msg.message}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: isOwn ? 0 : '12px', paddingRight: isOwn ? '12px' : 0, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
                            <span style={{ color: '#f59e0b', fontSize: '12px', fontWeight: '500' }}>{msg.player}</span>
                            <span style={{ color: '#6b7280', fontSize: '12px' }}>
                              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div style={{ height: '100%', padding: '16px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Difficulty Setting */}
              <div>
                <label style={{ display: 'block', color: '#ffffff', fontWeight: '500', marginBottom: '8px' }}>Difficulty</label>
                {isHost ? (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setIsDifficultyOpen(!isDifficultyOpen)}
                      style={{
                        width: '100%',
                        backgroundColor: '#1f2937',
                        border: '1px solid #4b5563',
                        color: '#ffffff',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <span>{difficulties.find(d => d.value === selectedDifficulty)?.label}</span>
                      <svg 
                        style={{ 
                          width: '20px', 
                          height: '20px',
                          transform: isDifficultyOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s'
                        }} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isDifficultyOpen && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#1f2937',
                        border: '1px solid #4b5563',
                        borderRadius: '8px',
                        marginTop: '4px',
                        zIndex: 10
                      }}>
                        {difficulties.map((difficulty) => (
                          <button
                            key={difficulty.value}
                            onClick={() => {
                              updateDifficulty(difficulty.value)
                              setIsDifficultyOpen(false)
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '12px 16px',
                              color: '#ffffff',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              borderRadius: difficulty === difficulties[0] ? '8px 8px 0 0' : 
                                          difficulty === difficulties[difficulties.length - 1] ? '0 0 8px 8px' : '0'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {difficulty.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    width: '100%',
                    backgroundColor: '#1f2937',
                    border: '1px solid #4b5563',
                    color: '#9ca3af',
                    padding: '12px 16px',
                    borderRadius: '8px'
                  }}>
                    {difficulties.find(d => d.value === selectedDifficulty)?.label}
                  </div>
                )}
              </div>

              {/* Max Words Setting */}
              <div>
                <label style={{ display: 'block', color: '#ffffff', fontWeight: '500', marginBottom: '8px' }}>Max Words</label>
                {isHost ? (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setIsMaxWordsOpen(!isMaxWordsOpen)}
                      style={{
                        width: '100%',
                        backgroundColor: '#1f2937',
                        border: '1px solid #4b5563',
                        color: '#ffffff',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <span>{maxWordsOptions.find(m => m.value === selectedMaxWords)?.label}</span>
                      <svg 
                        style={{ 
                          width: '20px', 
                          height: '20px',
                          transform: isMaxWordsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s'
                        }} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {isMaxWordsOpen && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#1f2937',
                        border: '1px solid #4b5563',
                        borderRadius: '8px',
                        marginTop: '4px',
                        zIndex: 10
                      }}>
                        {maxWordsOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => {
                              updateMaxWords(option.value)
                              setIsMaxWordsOpen(false)
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '12px 16px',
                              color: '#ffffff',
                              backgroundColor: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              borderRadius: option === maxWordsOptions[0] ? '8px 8px 0 0' : 
                                          option === maxWordsOptions[maxWordsOptions.length - 1] ? '0 0 8px 8px' : '0'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#374151'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    width: '100%',
                    backgroundColor: '#1f2937',
                    border: '1px solid #4b5563',
                    color: '#9ca3af',
                    padding: '12px 16px',
                    borderRadius: '8px'
                  }}>
                    {maxWordsOptions.find(m => m.value === selectedMaxWords)?.label}
                  </div>
                )}
              </div>
            </div>
            {activeTab === 'settings' && !isHost && (
              <div style={{ color: '#f59e0b', fontSize: '13px', marginBottom: 8, textAlign: 'center' }}>
                Only the host can change game settings.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed input for chat */}
      {activeTab === 'chat' && (
        <div 
          style={{ 
            position: 'fixed',
            bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : 0,
            left: 0,
            right: 0,
            height: '80px',
            backgroundColor: '#1f2937',
            padding: '16px',
            borderTop: '1px solid #374151',
            zIndex: 1000,
            transition: 'bottom 0.2s ease-in-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="text"
              placeholder="Type a message"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              style={{
                flex: 1,
                backgroundColor: '#374151',
                border: '1px solid #4b5563',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '16px',
                outline: 'none'
              }}
            />
          </div>
        </div>
      )}
      </div>
    </>
  )
} 