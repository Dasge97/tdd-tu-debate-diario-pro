import { query } from "../database/db.js";

const toPercent = (value, total) => (total > 0 ? Math.round((value * 100) / total) : 0);

const mapDebate = (row) => {
  const support = Number(row.support_count || 0);
  const oppose = Number(row.oppose_count || 0);
  const neutral = Number(row.neutral_count || 0);
  const total = support + oppose + neutral;

  return {
    id: Number(row.id),
    title: row.title,
    context: row.context,
    createdAt: row.created_at,
    dayDate: row.day_date,
    createdBy: row.created_by,
    commentCount: Number(row.comment_count || 0),
    favoriteAt: row.favorite_at,
    positions: {
      favor: toPercent(support, total),
      contra: toPercent(oppose, total),
      neutral: toPercent(neutral, total)
    }
  };
};

export async function getFavoritesByUserId(userId) {
  const rows = await query(
    `
      SELECT
        d.id,
        d.title,
        d.context,
        d.created_at,
        d.day_date,
        d.created_by,
        f.created_at AS favorite_at,
        COUNT(DISTINCT c.id) AS comment_count,
        COUNT(DISTINCT CASE WHEN p.position = 'support' THEN p.id END) AS support_count,
        COUNT(DISTINCT CASE WHEN p.position = 'oppose' THEN p.id END) AS oppose_count,
        COUNT(DISTINCT CASE WHEN p.position = 'neutral' THEN p.id END) AS neutral_count
      FROM favorites f
      INNER JOIN debates d ON d.id = f.debate_id
      LEFT JOIN comments c ON c.debate_id = d.id
      LEFT JOIN positions p ON p.debate_id = d.id
      WHERE f.user_id = ?
      GROUP BY d.id, f.created_at
      ORDER BY f.created_at DESC
    `,
    [userId]
  );

  return rows.map(mapDebate);
}

export async function addFavorite(userId, debateId) {
  await query(
    `
      INSERT INTO favorites (user_id, debate_id)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE created_at = created_at
    `,
    [userId, debateId]
  );
}

export async function removeFavorite(userId, debateId) {
  await query(
    `
      DELETE FROM favorites
      WHERE user_id = ? AND debate_id = ?
    `,
    [userId, debateId]
  );
}

export async function isFavorite(userId, debateId) {
  const rows = await query(
    `
      SELECT id
      FROM favorites
      WHERE user_id = ? AND debate_id = ?
      LIMIT 1
    `,
    [userId, debateId]
  );
  return rows.length > 0;
}
