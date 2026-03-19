import { query } from "../database/db.js";

const allowedUserStatuses = ["active", "suspended"];
const allowedUserRoles = ["user", "admin"];

export async function ensureAdminSchema() {
  await query(`
    ALTER TABLE users
    ADD COLUMN role ENUM('user', 'admin') NOT NULL DEFAULT 'user'
  `).catch(() => {});

  await query(`
    ALTER TABLE users
    ADD COLUMN status ENUM('active', 'suspended') NOT NULL DEFAULT 'active'
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      admin_user_id BIGINT UNSIGNED NOT NULL,
      action_type VARCHAR(80) NOT NULL,
      entity_type VARCHAR(80) NOT NULL,
      entity_id BIGINT UNSIGNED NULL,
      payload_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_admin_audit_logs_created (created_at),
      KEY idx_admin_audit_logs_admin (admin_user_id),
      CONSTRAINT fk_admin_audit_logs_admin
        FOREIGN KEY (admin_user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const admins = await query(
    `
      SELECT id
      FROM users
      WHERE role = 'admin'
      LIMIT 1
    `
  );

  if (admins.length === 0) {
    await query(
      `
        UPDATE users
        SET role = 'admin'
        ORDER BY id ASC
        LIMIT 1
      `
    );
  }
}

export async function logAdminAction(adminUserId, actionType, entityType, entityId = null, payload = null) {
  await query(
    `
      INSERT INTO admin_audit_logs (admin_user_id, action_type, entity_type, entity_id, payload_json)
      VALUES (?, ?, ?, ?, ?)
    `,
    [adminUserId, actionType, entityType, entityId, payload ? JSON.stringify(payload) : null]
  );
}

export async function getAdminOverview() {
  const [usersRows, debatesRows, commentsRows, friendshipsRows, chatsRows, notificationsRows] = await Promise.all([
    query(`
      SELECT
        COUNT(*) AS total_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS total_admins,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS total_suspended,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS new_users_24h
      FROM users
    `),
    query(`
      SELECT
        COUNT(*) AS total_debates,
        SUM(CASE WHEN day_date = CURDATE() THEN 1 ELSE 0 END) AS debates_today
      FROM debates
    `),
    query(`
      SELECT
        COUNT(*) AS total_comments,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS comments_24h
      FROM comments
    `),
    query(`
      SELECT
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted_friendships,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_friendships
      FROM friends
    `),
    query(`
      SELECT
        COUNT(*) AS total_conversations,
        (SELECT COUNT(*) FROM chat_messages) AS total_messages,
        (SELECT COUNT(*) FROM chat_messages WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) AS messages_24h
      FROM chat_conversations
    `),
    query(`
      SELECT
        COUNT(*) AS total_notifications,
        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread_notifications
      FROM user_notifications
    `)
  ]);

  return {
    totalUsers: Number(usersRows[0]?.total_users || 0),
    totalAdmins: Number(usersRows[0]?.total_admins || 0),
    totalSuspendedUsers: Number(usersRows[0]?.total_suspended || 0),
    newUsers24h: Number(usersRows[0]?.new_users_24h || 0),
    totalDebates: Number(debatesRows[0]?.total_debates || 0),
    debatesToday: Number(debatesRows[0]?.debates_today || 0),
    totalComments: Number(commentsRows[0]?.total_comments || 0),
    comments24h: Number(commentsRows[0]?.comments_24h || 0),
    acceptedFriendships: Number(friendshipsRows[0]?.accepted_friendships || 0),
    pendingFriendships: Number(friendshipsRows[0]?.pending_friendships || 0),
    totalConversations: Number(chatsRows[0]?.total_conversations || 0),
    totalMessages: Number(chatsRows[0]?.total_messages || 0),
    messages24h: Number(chatsRows[0]?.messages_24h || 0),
    totalNotifications: Number(notificationsRows[0]?.total_notifications || 0),
    unreadNotifications: Number(notificationsRows[0]?.unread_notifications || 0)
  };
}

export async function getRecentAdminActivity(limit = 20) {
  const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 50) : 20;
  const rows = await query(
    `
      (
        SELECT
          'comment' AS kind,
          c.id AS item_id,
          CONCAT('@', u.username, ' ha publicado un comentario') AS title,
          LEFT(c.content, 160) AS detail,
          c.created_at AS created_at
        FROM comments c
        INNER JOIN users u ON u.id = c.user_id
      )
      UNION ALL
      (
        SELECT
          'message' AS kind,
          m.id AS item_id,
          CONCAT('@', u.username, ' ha enviado un mensaje') AS title,
          LEFT(m.content, 160) AS detail,
          m.created_at AS created_at
        FROM chat_messages m
        INNER JOIN users u ON u.id = m.sender_id
      )
      UNION ALL
      (
        SELECT
          'friend_request' AS kind,
          f.id AS item_id,
          CONCAT('@', u.username, ' ha enviado una solicitud de amistad') AS title,
          f.status AS detail,
          f.created_at AS created_at
        FROM friends f
        INNER JOIN users u ON u.id = f.requester_id
      )
      UNION ALL
      (
        SELECT
          'debate' AS kind,
          d.id AS item_id,
          'Se ha publicado o actualizado un debate' AS title,
          d.title AS detail,
          d.created_at AS created_at
        FROM debates d
      )
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [safeLimit]
  );

  return rows.map((row) => ({
    kind: row.kind,
    itemId: Number(row.item_id),
    title: row.title,
    detail: row.detail || "",
    createdAt: row.created_at
  }));
}

export async function listAdminUsers({ q = "", page = 1, limit = 12 }) {
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 50) : 12;
  const offset = (safePage - 1) * safeLimit;
  const normalized = String(q || "").trim();
  const whereSql = normalized ? "WHERE username LIKE ? OR email LIKE ? OR location LIKE ?" : "";
  const params = normalized ? [`%${normalized}%`, `%${normalized}%`, `%${normalized}%`] : [];

  const countRows = await query(
    `
      SELECT COUNT(*) AS total
      FROM users
      ${whereSql}
    `,
    params
  );

  const rows = await query(
    `
      SELECT
        id,
        username,
        email,
        role,
        status,
        location,
        reliability_score,
        created_at
      FROM users
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, safeLimit, offset]
  );

  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      username: row.username,
      email: row.email,
      role: row.role,
      status: row.status,
      location: row.location || "",
      reliabilityScore: Number(row.reliability_score || 0),
      createdAt: row.created_at
    })),
    total: Number(countRows[0]?.total || 0),
    page: safePage,
    pageSize: safeLimit
  };
}

export async function updateAdminUser(userId, changes) {
  const sets = [];
  const params = [];

  if (changes.role && allowedUserRoles.includes(changes.role)) {
    sets.push("role = ?");
    params.push(changes.role);
  }
  if (changes.status && allowedUserStatuses.includes(changes.status)) {
    sets.push("status = ?");
    params.push(changes.status);
  }
  if (Number.isFinite(changes.reliabilityScore)) {
    sets.push("reliability_score = ?");
    params.push(Number(changes.reliabilityScore));
  }

  if (sets.length === 0) {
    throw new Error("No hay cambios válidos para actualizar.");
  }

  await query(
    `
      UPDATE users
      SET ${sets.join(", ")}
      WHERE id = ?
    `,
    [...params, userId]
  );

  const rows = await query(
    `
      SELECT id, username, email, role, status, location, reliability_score, created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId]
  );
  return rows[0] || null;
}

export async function listAdminDebates({ q = "", page = 1, limit = 10 }) {
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 50) : 10;
  const offset = (safePage - 1) * safeLimit;
  const normalized = String(q || "").trim();
  const whereSql = normalized ? "WHERE d.title LIKE ? OR d.context LIKE ?" : "";
  const params = normalized ? [`%${normalized}%`, `%${normalized}%`] : [];

  const countRows = await query(
    `
      SELECT COUNT(*) AS total
      FROM debates d
      ${whereSql}
    `,
    params
  );

  const rows = await query(
    `
      SELECT
        d.id,
        d.title,
        d.context,
        d.day_date,
        d.created_at,
        d.created_by,
        COUNT(DISTINCT c.id) AS comment_count
      FROM debates d
      LEFT JOIN comments c ON c.debate_id = d.id
      ${whereSql}
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, safeLimit, offset]
  );

  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      context: row.context,
      dayDate: row.day_date,
      createdAt: row.created_at,
      createdBy: row.created_by ? Number(row.created_by) : null,
      commentCount: Number(row.comment_count || 0)
    })),
    total: Number(countRows[0]?.total || 0),
    page: safePage,
    pageSize: safeLimit
  };
}

export async function updateAdminDebate(debateId, { title, context, dayDate }) {
  await query(
    `
      UPDATE debates
      SET title = ?, context = ?, day_date = ?
      WHERE id = ?
    `,
    [title, context, dayDate, debateId]
  );

  const rows = await query(
    `
      SELECT id, title, context, day_date, created_at, created_by
      FROM debates
      WHERE id = ?
      LIMIT 1
    `,
    [debateId]
  );
  return rows[0] || null;
}

export async function deleteAdminDebate(debateId) {
  await query(
    `
      DELETE FROM debates
      WHERE id = ?
    `,
    [debateId]
  );
}

export async function listAdminComments({ q = "", page = 1, limit = 12 }) {
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 50) : 12;
  const offset = (safePage - 1) * safeLimit;
  const normalized = String(q || "").trim();
  const whereSql = normalized ? "WHERE c.content LIKE ? OR u.username LIKE ? OR d.title LIKE ?" : "";
  const params = normalized ? [`%${normalized}%`, `%${normalized}%`, `%${normalized}%`] : [];

  const countRows = await query(
    `
      SELECT COUNT(*) AS total
      FROM comments c
      INNER JOIN users u ON u.id = c.user_id
      INNER JOIN debates d ON d.id = c.debate_id
      ${whereSql}
    `,
    params
  );

  const rows = await query(
    `
      SELECT
        c.id,
        c.content,
        c.score,
        c.created_at,
        u.username,
        d.title AS debate_title
      FROM comments c
      INNER JOIN users u ON u.id = c.user_id
      INNER JOIN debates d ON d.id = c.debate_id
      ${whereSql}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, safeLimit, offset]
  );

  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      content: row.content,
      score: Number(row.score || 0),
      createdAt: row.created_at,
      username: row.username,
      debateTitle: row.debate_title
    })),
    total: Number(countRows[0]?.total || 0),
    page: safePage,
    pageSize: safeLimit
  };
}

export async function updateAdminComment(commentId, content) {
  await query(
    `
      UPDATE comments
      SET content = ?
      WHERE id = ?
    `,
    [content, commentId]
  );

  const rows = await query(
    `
      SELECT id, content, score, created_at
      FROM comments
      WHERE id = ?
      LIMIT 1
    `,
    [commentId]
  );
  return rows[0] || null;
}

export async function deleteAdminComment(commentId) {
  await query(
    `
      DELETE FROM comments
      WHERE id = ?
    `,
    [commentId]
  );
}

export async function listAdminConversations({ q = "", page = 1, limit = 10 }) {
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 50) : 10;
  const offset = (safePage - 1) * safeLimit;
  const normalized = String(q || "").trim();
  const filterSql = normalized ? "HAVING participants LIKE ?" : "";
  const filterParams = normalized ? [`%${normalized}%`] : [];

  const rows = await query(
    `
      SELECT
        c.id,
        c.created_at,
        c.updated_at,
        GROUP_CONCAT(u.username ORDER BY u.username SEPARATOR ', ') AS participants,
        (
          SELECT COUNT(*)
          FROM chat_messages cm
          WHERE cm.conversation_id = c.id
        ) AS message_count,
        (
          SELECT content
          FROM chat_messages cm2
          WHERE cm2.conversation_id = c.id
          ORDER BY cm2.id DESC
          LIMIT 1
        ) AS last_message
      FROM chat_conversations c
      INNER JOIN chat_participants cp ON cp.conversation_id = c.id
      INNER JOIN users u ON u.id = cp.user_id
      GROUP BY c.id
      ${filterSql}
      ORDER BY c.updated_at DESC
      LIMIT ? OFFSET ?
    `,
    [...filterParams, safeLimit, offset]
  );

  const countRows = await query(
    `
      SELECT COUNT(*) AS total
      FROM chat_conversations
    `
  );

  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      participants: row.participants || "",
      messageCount: Number(row.message_count || 0),
      lastMessage: row.last_message || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })),
    total: Number(countRows[0]?.total || 0),
    page: safePage,
    pageSize: safeLimit
  };
}

export async function listAdminNotifications({ page = 1, limit = 12 }) {
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 50) : 12;
  const offset = (safePage - 1) * safeLimit;

  const countRows = await query(`SELECT COUNT(*) AS total FROM user_notifications`);
  const rows = await query(
    `
      SELECT
        n.id,
        n.type,
        n.title,
        n.body,
        n.is_read,
        n.created_at,
        u.username
      FROM user_notifications n
      INNER JOIN users u ON u.id = n.user_id
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [safeLimit, offset]
  );

  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      username: row.username,
      type: row.type,
      title: row.title,
      body: row.body,
      isRead: Boolean(row.is_read),
      createdAt: row.created_at
    })),
    total: Number(countRows[0]?.total || 0),
    page: safePage,
    pageSize: safeLimit
  };
}

export async function listAdminAuditLogs({ page = 1, limit = 15 }) {
  const safePage = Number(page) > 0 ? Number(page) : 1;
  const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 50) : 15;
  const offset = (safePage - 1) * safeLimit;

  const countRows = await query(`SELECT COUNT(*) AS total FROM admin_audit_logs`);
  const rows = await query(
    `
      SELECT
        a.id,
        a.action_type,
        a.entity_type,
        a.entity_id,
        a.payload_json,
        a.created_at,
        u.username AS admin_username
      FROM admin_audit_logs a
      INNER JOIN users u ON u.id = a.admin_user_id
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?
    `,
    [safeLimit, offset]
  );

  return {
    items: rows.map((row) => ({
      id: Number(row.id),
      adminUsername: row.admin_username,
      actionType: row.action_type,
      entityType: row.entity_type,
      entityId: row.entity_id ? Number(row.entity_id) : null,
      payload: row.payload_json || null,
      createdAt: row.created_at
    })),
    total: Number(countRows[0]?.total || 0),
    page: safePage,
    pageSize: safeLimit
  };
}
