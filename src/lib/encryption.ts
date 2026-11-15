import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const DEFAULT_DEV_KEY = 'default-super-secret-key-32-chars!!';
const MIN_KEY_LENGTH = 16;

/**
 * Returns a 32-byte Buffer derived from TOKEN_ENCRYPTION_KEY or a custom override key.
 * In production (NODE_ENV === 'production'), fails closed if the key is missing, empty, or default.
 */
export function getEncryptionKey(overrideKey?: string): Buffer {
  let secret: string;

  if (overrideKey !== undefined) {
    secret = overrideKey.trim();
    if (!secret || secret.length < MIN_KEY_LENGTH) {
      throw new Error(`TOKEN_ENCRYPTION_KEY must be at least ${MIN_KEY_LENGTH} characters long.`);
    }
  } else {
    const rawSecret = process.env.TOKEN_ENCRYPTION_KEY;
    const isProd = process.env.NODE_ENV === 'production';

    if (isProd) {
      if (!rawSecret || !rawSecret.trim() || rawSecret.trim() === DEFAULT_DEV_KEY) {
        throw new Error('FATAL: TOKEN_ENCRYPTION_KEY environment variable is missing or invalid in production.');
      }
      if (rawSecret.trim().length < MIN_KEY_LENGTH) {
        throw new Error(`FATAL: TOKEN_ENCRYPTION_KEY must be at least ${MIN_KEY_LENGTH} characters long in production.`);
      }
      secret = rawSecret.trim();
    } else {
      secret = rawSecret?.trim() || DEFAULT_DEV_KEY;
    }
  }

  // Use sha256 to guarantee exact 32 bytes (256 bits) for AES-256
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts plain text string with AES-256-GCM.
 * Output format: iv_hex:authTag_hex:ciphertext_hex
 */
export function encryptToken(text: string, customKey?: string): string {
  if (!text) return '';
  const key = getEncryptionKey(customKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts AES-256-GCM encrypted string.
 */
export function decryptToken(encryptedData: string, customKey?: string): string {
  if (!encryptedData) return '';
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKey(customKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

