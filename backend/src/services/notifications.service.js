import { query } from "../database/db.js";

export async function ensureNotificationsSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS user_notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(120) NOT NULL,
      body VARCHAR(255) NOT NULL,
      data_json JSON NULL,
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME NULL,
      PRIMARY KEY (id),
      KEY idx_user_notifications_user_read_created (user_id, is_read, created_at),
      CONSTRAINT fk_user_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function createNotification(userId, { type, title, body, data = null }) {
  const result = await query(
    `
      INSERT INTO user_notifications (user_id, type, title, body, data_json)
      VALUES (?, ?, ?, ?, ?)
    `,
    [userId, type, title, body, data ? JSON.stringify(data) : null]
  );

  const rows = await query(
    `
      SELECT id, user_id, type, title, body, data_json, is_read, created_at, read_at
      FROM user_notifications
      WHERE id = ?
      LIMIT 1
    `,
    [Number(result.insertId)]
  );
  return rows[0] || null;
}

export async function listNotificationsByUser(userId, limit = 20) {
  const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 100) : 20;
  const rows = await query(
    `
      SELECT id, user_id, type, title, body, data_json, is_read, created_at, read_at
      FROM user_notifications
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `,
    [userId, safeLimit]
  );
  return rows;
}

export async function markAllNotificationsAsRead(userId) {
  await query(
    `
      UPDATE user_notifications
      SET is_read = 1, read_at = NOW()
      WHERE user_id = ? AND is_read = 0
    `,
    [userId]
  );
}

export async function getUnreadNotificationsCount(userId) {
  const rows = await query(
    `
      SELECT COUNT(*) AS total
      FROM user_notifications
      WHERE user_id = ? AND is_read = 0
    `,
    [userId]
  );
  return Number(rows[0]?.total || 0);
}
