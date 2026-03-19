import {
  createMessage,
  findOrCreateDirectConversation,
  listConversationMessages,
  listConversationsByUser,
  markConversationAsRead
} from "../services/chat.service.js";

const toConversation = (row) => ({
  id: Number(row.id),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  peer: {
    id: Number(row.peer_id),
    username: row.peer_username,
    avatarUrl: row.peer_avatar_url || "",
    bio: row.peer_bio || ""
  },
  lastMessage: row.last_message_id
    ? {
        id: Number(row.last_message_id),
        senderId: Number(row.last_message_sender_id),
        content: row.last_message_content,
        createdAt: row.last_message_created_at
      }
    : null,
  unreadCount: Number(row.unread_count || 0)
});

const toMessage = (row) => ({
  id: Number(row.id),
  conversationId: Number(row.conversation_id),
  senderId: Number(row.sender_id),
  senderUsername: row.sender_username,
  senderAvatarUrl: row.sender_avatar_url || "",
  content: row.content,
  createdAt: row.created_at
});

export async function listConversationsController(req, res, next) {
  try {
    const rows = await listConversationsByUser(req.auth.userId);
    res.json(rows.map(toConversation));
  } catch (error) {
    next(error);
  }
}

export async function openConversationController(req, res, next) {
  try {
    const peerUserId = Number(req.body.userId);
    const row = await findOrCreateDirectConversation(req.auth.userId, peerUserId);
    res.json(toConversation(row));
  } catch (error) {
    if (error.code === "INVALID_PEER" || error.code === "NOT_FRIENDS") {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
}

export async function listMessagesController(req, res, next) {
  try {
    const conversationId = Number(req.params.conversationId);
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return res.status(400).json({ error: "conversationId no válido." });
    }
    const limit = Number(req.query.limit || 40);
    const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null;
    const rows = await listConversationMessages(req.auth.userId, conversationId, { limit, beforeId });
    return res.json(rows.map(toMessage));
  } catch (error) {
    if (error.code === "FORBIDDEN_CONVERSATION") {
      return res.status(403).json({ error: error.message });
    }
    return next(error);
  }
}

export async function createMessageController(req, res, next) {
  try {
    const conversationId = Number(req.body.conversationId);
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return res.status(400).json({ error: "conversationId no válido." });
    }
    const message = await createMessage(req.auth.userId, conversationId, req.body.content);
    res.status(201).json(toMessage(message));
  } catch (error) {
    if (error.code === "FORBIDDEN_CONVERSATION") {
      return res.status(403).json({ error: error.message });
    }
    if (error.code === "INVALID_MESSAGE") {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
}

export async function markAsReadController(req, res, next) {
  try {
    const conversationId = Number(req.params.conversationId);
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return res.status(400).json({ error: "conversationId no válido." });
    }
    const lastMessageId = req.body?.lastMessageId ? Number(req.body.lastMessageId) : null;
    const result = await markConversationAsRead(req.auth.userId, conversationId, lastMessageId);
    res.json(result);
  } catch (error) {
    if (error.code === "FORBIDDEN_CONVERSATION") {
      return res.status(403).json({ error: error.message });
    }
    return next(error);
  }
}
