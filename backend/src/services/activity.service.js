import { query } from "../database/db.js";

const allowedActivityTypes = new Set([
  "debate_created",
  "comment_created",
  "comment_replied",
  "comment_voted",
  "position_set",
  "position_changed"
]);

const safeJsonParse = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const buildActivityMessage = ({ type, metadata, debateTitle }) => {
  switch (type) {
    case "debate_created":
      return "ha publicado un debate";
    case "comment_created":
      return "ha publicado un comentario";
    case "comment_replied":
      return "ha respondido a un comentario";
    case "comment_voted":
      return Number(metadata?.value || 1) < 0
        ? "ha votado negativamente un comentario"
        : "ha votado positivamente un comentario";
    case "position_set":
      return debateTitle ? "ha tomado postura en un debate" : "ha emitido un voto";
    case "position_changed":
      return "ha cambiado su postura en un debate";
    default:
      return "ha realizado una actividad";
  }
};

export async function ensureActivitySchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS activity_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      activity_type VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id BIGINT UNSIGNED NULL,
      debate_id BIGINT UNSIGNED NULL,
      comment_id BIGINT UNSIGNED NULL,
      metadata_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_activity_events_created_at (created_at),
      KEY idx_activity_events_user_created (user_id, created_at),
      KEY idx_activity_events_type_created (activity_type, created_at),
      KEY idx_activity_events_debate_created (debate_id, created_at),
      CONSTRAINT fk_activity_events_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_activity_events_debate
        FOREIGN KEY (debate_id) REFERENCES debates(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_activity_events_comment
        FOREIGN KEY (comment_id) REFERENCES comments(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function logActivity({
  userId,
  activityType,
  entityType,
  entityId = null,
  debateId = null,
  commentId = null,
  metadata = null
}) {
  if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
    return null;
  }

  const normalizedType = String(activityType || "").trim();
  if (!allowedActivityTypes.has(normalizedType)) {
    throw new Error(`Unsupported activity type: ${normalizedType || "missing"}`);
  }

  await query(
    `
      INSERT INTO activity_events (
        user_id,
        activity_type,
        entity_type,
        entity_id,
        debate_id,
        comment_id,
        metadata_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      Number(userId),
      normalizedType,
      String(entityType || "").trim() || null,
      entityId == null ? null : Number(entityId),
      debateId == null ? null : Number(debateId),
      commentId == null ? null : Number(commentId),
      metadata ? JSON.stringify(metadata) : null
    ]
  );

  return true;
}

export async function listRecentActivity({ limit = 20 } = {}) {
  const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 100) : 20;

  const rows = await query(
    `
      SELECT
        ae.id,
        ae.user_id,
        ae.activity_type,
        ae.entity_type,
        ae.entity_id,
        ae.debate_id,
        ae.comment_id,
        ae.metadata_json,
        ae.created_at,
        u.username,
        u.avatar_url,
        d.title AS debate_title,
        c.content AS comment_content
      FROM activity_events ae
      INNER JOIN users u ON u.id = ae.user_id
      LEFT JOIN debates d ON d.id = ae.debate_id
      LEFT JOIN comments c ON c.id = ae.comment_id
      ORDER BY ae.created_at DESC, ae.id DESC
      LIMIT ?
    `,
    [safeLimit]
  );

  return rows.map((row) => {
    const metadata = safeJsonParse(row.metadata_json, {});

    return {
      id: Number(row.id),
      userId: Number(row.user_id),
      type: row.activity_type,
      entityType: row.entity_type,
      entityId: row.entity_id == null ? null : Number(row.entity_id),
      debateId: row.debate_id == null ? null : Number(row.debate_id),
      commentId: row.comment_id == null ? null : Number(row.comment_id),
      createdAt: row.created_at,
      user: {
        id: Number(row.user_id),
        username: row.username,
        avatarUrl: row.avatar_url || ""
      },
      message: buildActivityMessage({
        type: row.activity_type,
        metadata,
        debateTitle: row.debate_title || ""
      }),
      debateTitle: row.debate_title || "",
      commentPreview: String(row.comment_content || "").trim().slice(0, 140),
      metadata
    };
  });
}
