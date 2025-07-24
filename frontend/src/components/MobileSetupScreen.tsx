import React, { useState } from 'react'

interface MobileSetupScreenProps {
  playerName: string
  setPlayerName: (name: string) => void
  selectedLanguage: string
  setSelectedLanguage: (language: string) => void
  onContinue: () => void
  canContinue: boolean
}

const languages = [
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' }
]

export const MobileSetupScreen: React.FC<MobileSetupScreenProps> = ({
  playerName,
  setPlayerName,
  selectedLanguage,
  setSelectedLanguage,
  onContinue,
  canContinue
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm mx-auto w-full">
        {/* Name Input */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className="w-full bg-gray-800 border-2 border-gray-600 text-white placeholder-gray-400 py-4 px-4 rounded-lg text-lg focus:outline-none focus:border-blue-500 transition-colors duration-200"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
          />
        </div>
        
        {/* Language Selection */}
        <div className="mb-12 relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full bg-gray-800 border-2 border-gray-600 text-white py-4 px-4 rounded-lg text-lg focus:outline-none focus:border-blue-500 transition-colors duration-200 flex items-center justify-between"
          >
            <span className="flex items-center space-x-3">
              {selectedLanguage && (
                <>
                  <span className="text-xl">
                    {languages.find(l => l.code === selectedLanguage)?.flag}
                  </span>
                  <span>{languages.find(l => l.code === selectedLanguage)?.name}</span>
                </>
              )}
              {!selectedLanguage && (
                <span className="text-gray-400">select language to practise</span>
              )}
            </span>
            <svg 
              className={`w-5 h-5 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 bg-gray-800 border-2 border-gray-600 rounded-lg mt-1 z-10 overflow-hidden">
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => {
                    setSelectedLanguage(language.code)
                    setIsDropdownOpen(false)
                  }}
                  className="w-full text-left px-4 py-4 text-white hover:bg-gray-700 transition-colors duration-150 flex items-center space-x-3"
                >
                  <span className="text-xl">{language.flag}</span>
                  <span>{language.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Continue Button - Circle with Arrow */}
        <div className="h-16 flex items-center justify-center">
          <button
            onClick={onContinue}
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