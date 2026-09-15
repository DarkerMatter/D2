import { sign, verify } from 'hono/jwt'
import type { JWTPayload } from '../types'

const TOKEN_EXPIRY = 24 * 60 * 60 // 24 hours. if you're still logged in after that, something is wrong with your life

export async function createToken(
  payload: Omit<JWTPayload, 'exp'>,
  secret: string
): Promise<string> {
  return sign(
    { ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY },
    secret,
    'HS256'
  )
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    return (await verify(token, secret, 'HS256')) as unknown as JWTPayload
  } catch {
    return null
  }
}

// discord oauth helpers because apparently we need 47 lines to say "who are you"

type DiscordTokenResponse = {
  access_token: string
  token_type: string
  scope: string
}

type DiscordUser = {
  id: string
  username: string
  global_name: string | null
  avatar: string | null
}

export async function exchangeDiscordCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<DiscordTokenResponse> {
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!res.ok) throw new Error(`Discord token exchange failed: ${res.status}`)
  return res.json()
}

export async function getDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Discord user fetch failed: ${res.status}`)
  return res.json()
}
