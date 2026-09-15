export type Env = {
  Bindings: {
    DB: D1Database
    CACHE: KVNamespace
    SESSIONS: KVNamespace
    JWT_SECRET: string
    DISCORD_CLIENT_ID: string
    DISCORD_CLIENT_SECRET: string
  }
  Variables: {
    user: JWTPayload | null
    flash: FlashMessages
    pendingFlash: FlashMessages
  }
}

export type JWTPayload = {
  userId: number
  username: string
  permissionLevel: number
  sessionId: string
  exp: number
}

export type FlashMessages = {
  toasts: ToastNotification[]
}

export type ToastNotification = {
  type: 'success' | 'error' | 'achievement'
  message?: string
  name?: string
  description?: string
  icon?: string
}

export type User = {
  id: number
  username: string
  discord_id: string
  discord_username: string
  discord_avatar: string | null
  permission_level: number
  total_rage: number
  total_deaths: number
  quick_phrase_1: string | null
  quick_phrase_2: string | null
  quick_phrase_3: string | null
  created_at: string
}

export type Game = {
  id: number
  slug: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  is_active: number
  created_at: string
}

export type GameSession = {
  id: number
  user_id: number
  game_id: number
  name: string
  is_active: number
  created_at: string
  ended_at: string | null
}

export type RageLog = {
  id: number
  session_id: number
  user_id: number
  rage_level: number
  rage_phrase: string
  created_at: string
}

export type Achievement = {
  id: number
  game_id: number | null
  name: string
  description: string
  icon: string
  created_at: string
}
