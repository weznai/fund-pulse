import crypto from 'crypto'

const SALT_ROUNDS = 100000

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, SALT_ROUNDS, 64, 'sha512')
  return `${salt}:${hash.toString('hex')}`
}

export function verifyPassword(password: string, hashedPassword: string): boolean {
  if (!hashedPassword) return false
  
  const [salt, hash] = hashedPassword.split(':')
  if (!salt || !hash) return false
  
  const verifyHash = crypto.pbkdf2Sync(password, salt, SALT_ROUNDS, 64, 'sha512')
  
  if (hash.length === 128) {
    return hash === verifyHash.toString('hex')
  } else {
    return hash === verifyHash.toString()
  }
}

export function isOldPasswordHash(hashedPassword: string): boolean {
  return hashedPassword.length === 32
}

export function isOldBinaryPasswordHash(hashedPassword: string): boolean {
  if (!hashedPassword.includes(':')) return false
  const [, hash] = hashedPassword.split(':')
  return hash && hash.length < 128
}

export function verifyOldMD5Password(password: string, hashedPassword: string): boolean {
  const md5Hash = crypto.createHash('md5').update(password).digest('hex')
  return md5Hash === hashedPassword
}
