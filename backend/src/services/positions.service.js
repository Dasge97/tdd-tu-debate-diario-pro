import { query } from "../database/db.js";
import { logActivity } from "./activity.service.js";

const allowedPositions = new Set(["support", "oppose", "neutral"]);

export function isValidPosition(position) {
  return allowedPositions.has(position);
}

async function getExistingPosition(userId, debateId) {
  const rows = await query(
    "SELECT id, user_id, debate_id, position FROM positions WHERE user_id = ? AND debate_id = ? LIMIT 1",
    [userId, debateId]
  );

  return rows[0] || null;
}

export async function upsertPosition({ userId, debateId, position }) {
  const existing = await getExistingPosition(userId, debateId);

  const result = await query(
    `
      INSERT INTO positions (user_id, debate_id, position)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE position = VALUES(position)
    `,
    [userId, debateId, position]
  );

  const rows = await query(
    "SELECT id, user_id, debate_id, position FROM positions WHERE user_id = ? AND debate_id = ?",
    [userId, debateId]
  );
  const saved = rows[0];

  if (!saved) {
    return null;
  }

  const previousPosition = existing?.position || null;
  const shouldLog = !previousPosition || previousPosition !== saved.position;

  if (shouldLog) {
    await logActivity({
      userId,
      activityType: previousPosition ? "position_changed" : "position_set",
      entityType: "position",
      entityId: Number(saved.id),
      debateId,
      metadata: {
        previousPosition,
        position: saved.position
      }
    });
  }

  return saved;
}
