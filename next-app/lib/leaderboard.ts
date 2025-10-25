import { getPool } from './db';

export interface LeaderboardEntry {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  current_xp: string;
}

export async function getTopUsers(limit = 10): Promise<LeaderboardEntry[]> {
  const clampedLimit = Number.isFinite(limit) ? Math.min(Math.max(Number(limit), 1), 50) : 10;
  const pool = getPool();
  const result = await pool.query<LeaderboardEntry>(
    `SELECT id, display_name, avatar_url, role, current_xp
       FROM users
      ORDER BY current_xp DESC, created_at ASC
      LIMIT $1`,
    [clampedLimit]
  );
  return result.rows;
}
