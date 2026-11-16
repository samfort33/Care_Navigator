import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384; // N
const SCRYPT_BLOCK_SIZE = 8; // r
const SCRYPT_PARALLELIZATION = 1; // p

/**
 * Hashes a plaintext password using standard Node.js scrypt with a random 16-byte salt.
 * Output format: `<saltHex>:<hashHex>`
 */
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: 32 * 1024 * 1024,
      },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
      }
    );
  });
}

/**
 * Verifies a plaintext password against a stored `<saltHex>:<hashHex>` string
 * using constant-time comparison to prevent timing attacks.
 */
export async function verifyPassword(password: string, combinedHash: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parts = combinedHash.split(':');
    if (parts.length !== 2) {
      return resolve(false);
    }
    const [saltHex, keyHex] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const expectedKey = Buffer.from(keyHex, 'hex');

    if (salt.length !== 16 || expectedKey.length !== SCRYPT_KEYLEN) {
      return resolve(false);
    }

    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: 32 * 1024 * 1024,
      },
      (err, derivedKey) => {
        if (err) return resolve(false);
        try {
          const match = crypto.timingSafeEqual(expectedKey, derivedKey);
          resolve(match);
        } catch {
          resolve(false);
        }
      }
    );
  });
}

/**
 * Generates a cryptographically strong random token for password resets or email verification.
 */
export function generateSecureToken(byteLength: number = 32): string {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Computes the SHA-256 hash of a raw token before storing in the database.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
