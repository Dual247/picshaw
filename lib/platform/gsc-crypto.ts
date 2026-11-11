import 'server-only'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
export const randomSecret = () => randomBytes(32).toString('base64url')
export const challenge = (value: string) => createHash('sha256').update(value).digest('base64url')
export function tokenCipher(key: string) {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(key) || Buffer.from(key, 'base64').length !== 32) throw Error('Invalid encryption configuration')
  const bytes = Buffer.from(key, 'base64')
  return {
    seal(value: string, context: string) {
      const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', bytes, nonce)
      cipher.setAAD(Buffer.from(context))
      const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
      return ['v1', nonce.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
    },
    open(value: string, context: string) {
      const [version, nonce, tag, ciphertext, extra] = value.split('.')
      if (version !== 'v1' || !nonce || !tag || !ciphertext || extra || value.length > 24000) throw Error('Invalid encrypted record')
      if ([nonce, tag, ciphertext].some(part => !/^[A-Za-z0-9_-]+$/.test(part) || Buffer.from(part, 'base64url').toString('base64url') !== part)) throw Error('Invalid encrypted record')
      const decipher = createDecipheriv('aes-256-gcm', bytes, Buffer.from(nonce, 'base64url'))
      decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(Buffer.from(tag, 'base64url'))
      return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8')
    },
  }
}
