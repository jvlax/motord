import React from 'react'

interface MobileGameSummaryProps {
  gameSummary: {
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
  isHost: boolean
  playAgain: () => void
  selectedLanguage: string
}

export const MobileGameSummary: React.FC<MobileGameSummaryProps> = ({
  gameSummary,
  isHost,
  playAgain,
  selectedLanguage
}) => {
  const amber = '#f59e0b'
  const backgroundImage = selectedLanguage === 'fr' ? '/fr_bg.webp' : '/sv_bg.webp'
  return (
    <div
      className="h-screen bg-cover bg-center bg-no-repeat flex flex-col"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-4" style={{ minHeight: 0, justifyContent: 'center' }}>
        {/* Unified Box */}
        <div className="bg-gray-800/90 rounded-lg p-4 w-full max-w-md flex flex-col h-[80vh] mt-[10vh] mb-[20vh]" style={{ minHeight: 0 }}>
          {/* Winner */}
          <div className="text-center mb-2">
            <div className="text-2xl font-bold text-white mb-1" style={{ color: amber }}>{gameSummary.winner} wins!</div>
          </div>
          {/* Main content: Game History, Final Scores, Play Again button */}
          <div className="flex flex-col h-full min-h-0">
            {/* Game History Section (60% of available space) */}
            <div className="flex flex-col min-h-0" style={{ flexBasis: '60%', flexShrink: 1, flexGrow: 1 }}>
              <h3 className="text-lg font-semibold text-white mb-1 flex-shrink-0">Game History</h3>
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 pr-1">
                {gameSummary.word_history.map((wordData, index) => (
                  <div key={index} className={`rounded-lg px-2 py-2 mb-1 ${
                    wordData.status === 'correct'
                      ? index % 2 === 0 ? 'bg-amber-500/20' : 'bg-amber-500/10'
                      : index % 2 === 0 ? 'bg-red-600/20' : 'bg-red-600/10'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">#{index + 1}</span>
                      <span className="text-white font-medium text-base flex-1 truncate">{wordData.word}</span>
                      {wordData.winner && (
                        <span className="text-xs font-semibold" style={{ color: amber }}>✓ {wordData.winner}</span>
                      )}
                      {wordData.status === 'timeout' && (
                        <span className="text-red-400 text-xs">Timeout</span>
                      )}
                      {wordData.status === 'correct' && wordData.time_taken && (
                        <span className="text-xs text-gray-400">⚡ {wordData.time_taken.toFixed(1)}s</span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-1 pl-6 text-xs text-gray-300 opacity-80">
                      <span className="truncate flex-1">{wordData.translations.sv}</span>
                      <span className="truncate flex-1 text-right">{wordData.translations.fr}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Final Scores Section (40% of available space) */}
            <div className="flex flex-col min-h-0" style={{ flexBasis: '40%', flexShrink: 1, flexGrow: 1 }}>
              <h3 className="text-lg font-semibold text-white mb-1 flex-shrink-0">Final Scores</h3>
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 mb-2">
                {gameSummary.players
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className={`flex justify-between items-center p-2 rounded-lg ${
                        player.id === gameSummary.winner_id
                          ? 'bg-amber-500/30 border'
                          : 'bg-gray-700/50'
                      }`}
                      style={player.id === gameSummary.winner_id ? { borderColor: amber, borderWidth: 1 } : {}}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-gray-400">#{index + 1}</span>
                        <span className="text-white font-medium text-sm">{player.name}</span>
                        <span className="text-lg">
                          {player.language === 'sv' ? '🇸🇪' : player.language === 'fr' ? '🇫🇷' : ''}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-white font-bold text-base">{player.score}</span>
                        <div className="flex gap-1 text-xs text-gray-400">
                          <span>🔥 {player.highest_streak}</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            {/* Play Again Button (fixed height, always visible at bottom) */}
            {isHost && (
              <div className="flex flex-col items-center justify-center mb-2" style={{ height: 64, minHeight: 64, maxHeight: 64 }}>
                <button
                  onClick={playAgain}
                  className="w-12 h-12 rounded-full border border-gray-600 bg-gray-800 hover:border-white transition-all duration-150 flex items-center justify-center"
                  title="Play Again"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: amber }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <div className="text-xs font-semibold mt-1" style={{ color: amber, textAlign: 'center' }}>play again</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 