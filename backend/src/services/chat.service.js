import { query } from "../database/db.js";

const MAX_MESSAGE_LENGTH = 1000;

const toDmKey = (userA, userB) => {
  const a = Number(userA);
  const b = Number(userB);
  return a < b ? `${a}:${b}` : `${b}:${a}`;
};

export async function ensureChatSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      dm_key VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_chat_conversations_dm_key (dm_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      conversation_id BIGINT UNSIGNED NOT NULL,
      sender_id BIGINT UNSIGNED NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_chat_messages_conversation_id (conversation_id, id),
      CONSTRAINT fk_chat_messages_conversation
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_chat_messages_sender
        FOREIGN KEY (sender_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS chat_participants (
      conversation_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_read_message_id BIGINT UNSIGNED NULL,
      last_read_at DATETIME NULL,
      PRIMARY KEY (conversation_id, user_id),
      KEY idx_chat_participants_user (user_id),
      CONSTRAINT fk_chat_participants_conversation
        FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_chat_participants_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function areUsersFriends(userA, userB) {
  const rows = await query(
    `
      SELECT id
      FROM friends
      WHERE status = 'accepted'
        AND (
          (requester_id = ? AND addressee_id = ?)
          OR
          (requester_id = ? AND addressee_id = ?)
        )
      LIMIT 1
    `,
    [userA, userB, userB, userA]
  );
  return rows.length > 0;
}

export async function findOrCreateDirectConversation(userId, peerUserId) {
  const me = Number(userId);
  const peer = Number(peerUserId);
  if (!Number.isInteger(peer) || peer <= 0 || me === peer) {
    const err = new Error("Usuario destino no válido.");
    err.code = "INVALID_PEER";
    throw err;
  }

  const friends = await areUsersFriends(me, peer);
  if (!friends) {
    const err = new Error("Solo puedes chatear con amigos.");
    err.code = "NOT_FRIENDS";
    throw err;
  }

  const dmKey = toDmKey(me, peer);
  const insert = await query(
    `
      INSERT INTO chat_conversations (dm_key)
      VALUES (?)
      ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
    `,
    [dmKey]
  );
  const conversationId = Number(insert.insertId);

  await query(
    `
      INSERT IGNORE INTO chat_participants (conversation_id, user_id)
      VALUES (?, ?), (?, ?)
    `,
    [conversationId, me, conversationId, peer]
  );

  return getConversationByIdForUser(me, conversationId);
}

export async function listConversationsByUser(userId) {
  const rows = await query(
    `
      SELECT
        c.id,
        c.created_at,
        c.updated_at,
        u.id AS peer_id,
        u.username AS peer_username,
        u.avatar_url AS peer_avatar_url,
        u.bio AS peer_bio,
        lm.id AS last_message_id,
        lm.sender_id AS last_message_sender_id,
        lm.content AS last_message_content,
        lm.created_at AS last_message_created_at,
        (
          SELECT COUNT(*)
          FROM chat_messages um
          WHERE um.conversation_id = c.id
            AND um.id > IFNULL(cp_me.last_read_message_id, 0)
            AND um.sender_id <> ?
        ) AS unread_count
      FROM chat_participants cp_me
      INNER JOIN chat_conversations c ON c.id = cp_me.conversation_id
      INNER JOIN chat_participants cp_peer ON cp_peer.conversation_id = c.id AND cp_peer.user_id <> cp_me.user_id
      INNER JOIN users u ON u.id = cp_peer.user_id
      LEFT JOIN chat_messages lm ON lm.id = (
        SELECT m2.id
        FROM chat_messages m2
        WHERE m2.conversation_id = c.id
        ORDER BY m2.id DESC
        LIMIT 1
      )
      WHERE cp_me.user_id = ?
      ORDER BY COALESCE(lm.created_at, c.updated_at) DESC
    `,
    [userId, userId]
  );

  return rows;
}

export async function getConversationByIdForUser(userId, conversationId) {
  const rows = await query(
    `
      SELECT
        c.id,
        c.created_at,
        c.updated_at,
        u.id AS peer_id,
        u.username AS peer_username,
        u.avatar_url AS peer_avatar_url,
        u.bio AS peer_bio,
        lm.id AS last_message_id,
        lm.sender_id AS last_message_sender_id,
        lm.content AS last_message_content,
        lm.created_at AS last_message_created_at,
        (
          SELECT COUNT(*)
          FROM chat_messages um
          WHERE um.conversation_id = c.id
            AND um.id > IFNULL(cp_me.last_read_message_id, 0)
            AND um.sender_id <> ?
        ) AS unread_count
      FROM chat_conversations c
      INNER JOIN chat_participants cp_me
        ON cp_me.conversation_id = c.id AND cp_me.user_id = ?
      INNER JOIN chat_participants cp_peer
        ON cp_peer.conversation_id = c.id AND cp_peer.user_id <> cp_me.user_id
      INNER JOIN users u ON u.id = cp_peer.user_id
      LEFT JOIN chat_messages lm ON lm.id = (
        SELECT m2.id
        FROM chat_messages m2
        WHERE m2.conversation_id = c.id
        ORDER BY m2.id DESC
        LIMIT 1
      )
      WHERE c.id = ?
      LIMIT 1
    `,
    [userId, userId, conversationId]
  );
  return rows[0] || null;
}

export async function isUserInConversation(userId, conversationId) {
  const rows = await query(
    `
      SELECT 1
      FROM chat_participants
      WHERE user_id = ? AND conversation_id = ?
      LIMIT 1
    `,
    [userId, conversationId]
  );
  return rows.length > 0;
}

export async function getConversationParticipantIds(conversationId) {
  const rows = await query(
    `
      SELECT user_id
      FROM chat_participants
      WHERE conversation_id = ?
    `,
    [conversationId]
  );
  return rows.map((row) => Number(row.user_id));
}

export async function listConversationMessages(userId, conversationId, { limit = 40, beforeId = null } = {}) {
  const allowed = await isUserInConversation(userId, conversationId);
  if (!allowed) {
    const err = new Error("No tienes acceso a esta conversación.");
    err.code = "FORBIDDEN_CONVERSATION";
    throw err;
  }

  const safeLimit = Number(limit) > 0 ? Math.min(Number(limit), 80) : 40;
  const hasBefore = Number(beforeId) > 0;

  const rows = await query(
    `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        u.username AS sender_username,
        u.avatar_url AS sender_avatar_url,
        m.content,
        m.created_at
      FROM chat_messages m
      INNER JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = ?
        AND (? = 0 OR m.id < ?)
      ORDER BY m.id DESC
      LIMIT ?
    `,
    [conversationId, hasBefore ? 1 : 0, hasBefore ? Number(beforeId) : 0, safeLimit]
  );

  return rows.reverse();
}

export async function createMessage(userId, conversationId, content) {
  const normalized = String(content || "").trim();
  if (!normalized) {
    const err = new Error("El mensaje no puede estar vacío.");
    err.code = "INVALID_MESSAGE";
    throw err;
  }
  if (normalized.length > MAX_MESSAGE_LENGTH) {
    const err = new Error(`Máximo ${MAX_MESSAGE_LENGTH} caracteres.`);
    err.code = "INVALID_MESSAGE";
    throw err;
  }

  const allowed = await isUserInConversation(userId, conversationId);
  if (!allowed) {
    const err = new Error("No tienes acceso a esta conversación.");
    err.code = "FORBIDDEN_CONVERSATION";
    throw err;
  }

  const result = await query(
    `
      INSERT INTO chat_messages (conversation_id, sender_id, content)
      VALUES (?, ?, ?)
    `,
    [conversationId, userId, normalized]
  );

  await query(
    `
      UPDATE chat_conversations
      SET updated_at = NOW()
      WHERE id = ?
    `,
    [conversationId]
  );

  const rows = await query(
    `
      SELECT
        m.id,
        m.conversation_id,
        m.sender_id,
        u.username AS sender_username,
        u.avatar_url AS sender_avatar_url,
        m.content,
        m.created_at
      FROM chat_messages m
      INNER JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?
      LIMIT 1
    `,
    [Number(result.insertId)]
  );

  return rows[0] || null;
}

export async function markConversationAsRead(userId, conversationId, lastMessageId = null) {
  const allowed = await isUserInConversation(userId, conversationId);
  if (!allowed) {
    const err = new Error("No tienes acceso a esta conversación.");
    err.code = "FORBIDDEN_CONVERSATION";
    throw err;
  }

  let targetMessageId = Number(lastMessageId) || 0;
  if (targetMessageId <= 0) {
    const rows = await query(
      `
        SELECT id
        FROM chat_messages
        WHERE conversation_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [conversationId]
    );
    targetMessageId = Number(rows[0]?.id || 0);
  }

  await query(
    `
      UPDATE chat_participants
      SET
        last_read_message_id = ?,
        last_read_at = NOW()
      WHERE user_id = ? AND conversation_id = ?
    `,
    [targetMessageId || null, userId, conversationId]
  );

  return { conversationId: Number(conversationId), lastReadMessageId: targetMessageId || null };
}
