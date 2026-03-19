import { query } from "../database/db.js";

const parseJsonArray = (value, fallback = []) => {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (_error) {
    return fallback;
  }
};

export async function getUserById(id) {
  const rows = await query(
    `
      SELECT id, username, email, bio, avatar_url, location, reliability_score, role, status, profile_tagline, profile_traits_json, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

export async function getPublicUserById(id) {
  const rows = await query(
    `
      SELECT id, username, bio, avatar_url, location, reliability_score, profile_tagline, profile_traits_json, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

export async function getPublicUserByUsername(username) {
  const rows = await query(
    `
      SELECT id, username, bio, avatar_url, location, reliability_score, profile_tagline, profile_traits_json, created_at, updated_at
      FROM users
      WHERE username = ?
      LIMIT 1
    `,
    [username]
  );
  return rows[0] || null;
}

export async function updateUserProfile(userId, { bio, avatarUrl, location, profileTagline, profileTraits }) {
  await query(
    `
      UPDATE users
      SET bio = ?, avatar_url = ?, location = ?, profile_tagline = ?, profile_traits_json = ?
      WHERE id = ?
    `,
    [
      bio || null,
      avatarUrl || null,
      location || null,
      profileTagline || null,
      JSON.stringify(Array.isArray(profileTraits) ? profileTraits : []),
      userId
    ]
  );
  return getUserById(userId);
}

export async function updateUserAvatar(userId, avatarUrl) {
  await query(
    `
      UPDATE users
      SET avatar_url = ?
      WHERE id = ?
    `,
    [avatarUrl || null, userId]
  );
  return getUserById(userId);
}

export async function getTopUsers(limit = 6) {
  const rows = await query(
    `
      SELECT id, username, bio, avatar_url, reliability_score, created_at
           , profile_tagline, profile_traits_json
      FROM users
      ORDER BY reliability_score DESC, created_at ASC
      LIMIT ?
    `,
    [Number(limit)]
  );

  return rows;
}

export async function searchPublicUsers({ q = "", limit = 20, page = 1 }) {
  const normalized = String(q || "").trim().toLowerCase();
  const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 50) : 20;
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const offset = (safePage - 1) * safeLimit;

  const whereSql = normalized
    ? `
      WHERE username LIKE ?
         OR bio LIKE ?
         OR location LIKE ?
    `
    : "";

  const whereParams = normalized
    ? [`%${normalized}%`, `%${normalized}%`, `%${normalized}%`]
    : [];

  const countRows = await query(
    `
      SELECT COUNT(*) AS total
      FROM users
      ${whereSql}
    `,
    whereParams
  );
  const total = Number(countRows[0]?.total || 0);

  const rows = await query(
    `
      SELECT id, username, bio, avatar_url, location, reliability_score, profile_tagline, profile_traits_json, created_at, updated_at
      FROM users
      ${whereSql}
      ORDER BY reliability_score DESC, username ASC
      LIMIT ? OFFSET ?
    `,
    [...whereParams, safeLimit, offset]
  );

  return {
    items: rows.map((row) => ({
      ...row,
      profile_traits_json: parseJsonArray(row.profile_traits_json, [])
    })),
    total,
    page: safePage,
    pageSize: safeLimit,
    totalPages: Math.max(1, Math.ceil(total / safeLimit))
  };
}
