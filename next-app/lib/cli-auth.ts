import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { NextApiRequest } from 'next';
import { getPool } from './db';

export const DEVICE_CODE_TTL_SECONDS = 600;
export const ACCESS_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;

let schemaReady: Promise<void> | null = null;

export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function createSecret(prefix: string, bytes = 32): string {
  return `${prefix}_${randomBytes(bytes).toString('base64url')}`;
}

export function createUserCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  const characters = Array.from(bytes, (value) => alphabet[value % alphabet.length]);
  return `${characters.slice(0, 4).join('')}-${characters.slice(4).join('')}`;
}

function encryptionKey(): Buffer {
  const source = process.env.CLI_AUTH_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!source) throw new Error('CLI_AUTH_ENCRYPTION_KEY or NEXTAUTH_SECRET is required');
  return createHash('sha256').update(source).digest();
}

export function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
  };
}

export function decryptToken(ciphertext: string, iv: string, tag: string): string {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function bearerToken(req: NextApiRequest): string | null {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith('bearer ')) return null;
  const value = header.slice(7).trim();
  return value || null;
}

export function publicBaseUrl(req: NextApiRequest): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/+$/u, '');
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
  return `${protocol}://${host}`;
}

export async function ensureCliAuthSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cli_access_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          device_name TEXT NOT NULL,
          platform TEXT NOT NULL,
          cli_version TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_used_at TIMESTAMPTZ,
          expires_at TIMESTAMPTZ NOT NULL,
          revoked_at TIMESTAMPTZ
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cli_device_codes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          device_code_hash TEXT NOT NULL UNIQUE,
          user_code TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          access_token_id UUID REFERENCES cli_access_tokens(id) ON DELETE SET NULL,
          device_name TEXT NOT NULL,
          platform TEXT NOT NULL,
          cli_version TEXT NOT NULL,
          token_ciphertext TEXT,
          token_iv TEXT,
          token_tag TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL,
          approved_at TIMESTAMPTZ,
          consumed_at TIMESTAMPTZ
        )
      `);
      await pool.query('CREATE INDEX IF NOT EXISTS idx_cli_device_codes_expires_at ON cli_device_codes(expires_at)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_cli_access_tokens_user_id ON cli_access_tokens(user_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_cli_access_tokens_expires_at ON cli_access_tokens(expires_at)');
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function authenticatedCliUser(req: NextApiRequest) {
  await ensureCliAuthSchema();
  const token = bearerToken(req);
  if (!token) return null;
  const pool = getPool();
  const result = await pool.query(
    `SELECT t.id AS token_id, t.device_name, t.platform, t.cli_version, t.expires_at,
            u.id, u.email, u.display_name, u.avatar_url, u.role, u.current_xp
       FROM cli_access_tokens t
       JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1
        AND t.revoked_at IS NULL
        AND t.expires_at > NOW()
      LIMIT 1`,
    [hashSecret(token)]
  );
  if (!result.rowCount) return null;
  await pool.query('UPDATE cli_access_tokens SET last_used_at = NOW() WHERE id = $1', [result.rows[0].token_id]);
  return result.rows[0];
}
