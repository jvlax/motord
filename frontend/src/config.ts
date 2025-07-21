// API Configuration
const getApiBaseUrl = () => {
  // Check if we're in production by looking at the hostname
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.origin
  }
  
  // In development, use localhost
  return 'http://localhost:8000'
}

const getWebSocketUrl = () => {
  // Check if we're in production by looking at the hostname
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}`
  }
  
  // In development, use localhost
  return 'ws://localhost:8000'
}

export const API_BASE_URL = getApiBaseUrl()
export const WS_BASE_URL = getWebSocketUrl()

export const config = {
  api: {
    baseUrl: API_BASE_URL,
    endpoints: {
      createLobby: `${API_BASE_URL}/lobby/create`,
      joinLobby: (lobbyId: string) => `${API_BASE_URL}/lobby/${lobbyId}/join`,
      getLobby: (lobbyId: string) => `${API_BASE_URL}/lobby/${lobbyId}`,
      toggleReady: (lobbyId: string, playerId: string) => `${API_BASE_URL}/lobby/${lobbyId}/player/${playerId}/ready`,
      updateDifficulty: (lobbyId: string) => `${API_BASE_URL}/lobby/${lobbyId}/difficulty`,
      updateMaxScore: (lobbyId: string) => `${API_BASE_URL}/lobby/${lobbyId}/max_score`,
      startGame: (lobbyId: string) => `${API_BASE_URL}/lobby/${lobbyId}/start`,
      timeout: (lobbyId: string) => `${API_BASE_URL}/lobby/${lobbyId}/timeout`,
      translate: (lobbyId: string, playerId: string) => `${API_BASE_URL}/lobby/${lobbyId}/player/${playerId}/translate`,
      playAgain: (lobbyId: string) => `${API_BASE_URL}/lobby/${lobbyId}/play_again`,
    }
  },
  websocket: {
    baseUrl: WS_BASE_URL,
    url: (lobbyId: string) => `${WS_BASE_URL}/ws/${lobbyId}`
  }
} 