// API Configuration
const getApiBaseUrl = () => {
  const hostname = window.location.hostname
  
  // Local development - localhost or 127.0.0.1
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000'
  }
  
  // Local network access (like 192.168.x.x) - use same IP but port 8000
  if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
    return `http://${hostname}:8000`
  }
  
  // Production (actual domain) - same origin
  return window.location.origin
}

const getWebSocketUrl = () => {
  const hostname = window.location.hostname
  
  // Local development - localhost or 127.0.0.1
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'ws://localhost:8000'
  }
  
  // Local network access (like 192.168.x.x) - use same IP but port 8000
  if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.')) {
    return `ws://${hostname}:8000`
  }
  
  // Production (actual domain) - same origin with WebSocket protocol
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}`
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
      updateMaxWords: (lobbyId: string) => `${API_BASE_URL}/lobby/${lobbyId}/max_words`,
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