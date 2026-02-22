import { NextApiRequest } from 'next';
import { getPool } from './db';

type Role = 'user' | 'admin' | 'premium' | 'tester';

export interface SessionUser {
  id: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  role?: Role;
}

export interface DbUserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: Role;
  current_xp: string; // bigint as string
  created_at: Date;
}

export async function getSessionUser(req: NextApiRequest): Promise<SessionUser | null> {
  // Integrate with your auth layer (e.g., NextAuth). For this example we assume
  // middleware attaches the session to req via req.headers or custom properties.
  const sessionUser = (req as any).user ?? null;
  if (sessionUser && typeof sessionUser.id === 'string') {
    return {
      id: sessionUser.id,
      email: sessionUser.email,
      displayName: sessionUser.name ?? sessionUser.displayName,
      avatarUrl: sessionUser.image ?? sessionUser.avatarUrl,
      role: sessionUser.role,
    };
  }

  const headerUserId = req.headers['x-user-id'];
  if (typeof headerUserId === 'string') {
    return {
      id: headerUserId,
      email: typeof req.headers['x-user-email'] === 'string' ? req.headers['x-user-email'] : undefined,
      displayName: typeof req.headers['x-user-name'] === 'string' ? req.headers['x-user-name'] : undefined,
      avatarUrl: typeof req.headers['x-user-avatar'] === 'string' ? req.headers['x-user-avatar'] : undefined,
      role: (typeof req.headers['x-user-role'] === 'string' ? req.headers['x-user-role'] : 'user') as Role,
    };
  }

  return null;
}

export async function getUserFromSession(req: NextApiRequest): Promise<SessionUser | null> {
  return getSessionUser(req);
}

export async function ensureUserRecord(session: SessionUser) {
  if (!session.email) {
    throw new Error('Session is missing email address; required for user record');
  }

  const pool = getPool();
  const result = await pool.query<DbUserProfile>(
    `INSERT INTO users (id, email, display_name, avatar_url, role)
     VALUES ($1, $2, $3, $4, COALESCE($5, 'user'))
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       display_name = COALESCE(EXCLUDED.display_name, users.display_name),
       avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
       role = COALESCE(users.role, EXCLUDED.role)
     RETURNING id, email, display_name, avatar_url, role, current_xp, created_at`,
    [session.id, session.email, session.displayName ?? null, session.avatarUrl ?? null, session.role ?? 'user']
  );

  return result.rows[0];
}

type AuthorizationCheck = (session: SessionUser | null, targetUserId: string) => boolean;

export const canMutateXp: AuthorizationCheck = (session, targetUserId) => {
  if (!session) return false;
  if (session.id === targetUserId) return true;
  if (session.role === 'admin') return true;
  return false;
};
