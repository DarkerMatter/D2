import { sign, verify } from 'hono/jwt'
import * as bcrypt from 'bcryptjs'
import type { JWTPayload } from '../types'

const SALT_ROUNDS = 10
const TOKEN_EXPIRY = 24 * 60 * 60 // 24 hours. if you're still logged in after that, something is wrong with your life

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

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
