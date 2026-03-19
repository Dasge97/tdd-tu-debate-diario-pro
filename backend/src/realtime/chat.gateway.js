import { URL } from "node:url";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";
import { isTokenRevoked } from "../services/auth.service.js";
import {
  createMessage,
  getConversationParticipantIds,
  isUserInConversation,
  markConversationAsRead
} from "../services/chat.service.js";
import { listFriendIds } from "../services/friends.service.js";
import {
  emitToUser,
  emitToUsers,
  isUserOnline,
  registerUserConnection,
  unregisterUserConnection
} from "./realtime.hub.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";

const safeJsonParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
};

export function setupChatGateway(server) {
  const wss = new WebSocketServer({ server, path: "/ws/chat" });

  wss.on("connection", async (ws, request) => {
    try {
      const requestUrl = new URL(request.url || "", "http://localhost");
      const token = requestUrl.searchParams.get("token");
      if (!token) {
        ws.close(1008, "Token requerido");
        return;
      }

      const payload = jwt.verify(token, JWT_SECRET);
      const revoked = await isTokenRevoked(payload.jti);
      if (revoked) {
        ws.close(1008, "Token revocado");
        return;
      }

      const userId = Number(payload.sub);
      ws.userId = userId;
      registerUserConnection(userId, ws);
      const friendIds = await listFriendIds(userId);

      emitToUser(userId, {
        type: "connected",
        userId,
        onlineFriendIds: friendIds.filter((friendId) => isUserOnline(friendId))
      });

      emitToUsers(friendIds, {
        type: "friend:presence",
        userId,
        isOnline: true
      });

      ws.on("message", async (raw) => {
        const message = safeJsonParse(String(raw || ""));
        if (!message || typeof message !== "object") return;

        try {
          if (message.type === "ping") {
            ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
            return;
          }

          if (message.type === "send_message") {
            const conversationId = Number(message.conversationId);
            const created = await createMessage(userId, conversationId, message.content);
            const participantIds = await getConversationParticipantIds(conversationId);
            emitToUsers(participantIds, {
              type: "new_message",
              message: {
                id: Number(created.id),
                conversationId: Number(created.conversation_id),
                senderId: Number(created.sender_id),
                senderUsername: created.sender_username,
                senderAvatarUrl: created.sender_avatar_url || "",
                content: created.content,
                createdAt: created.created_at
              }
            });
            return;
          }

          if (message.type === "typing") {
            const conversationId = Number(message.conversationId);
            const isTyping = Boolean(message.isTyping);
            const allowed = await isUserInConversation(userId, conversationId);
            if (!allowed) return;
            const participantIds = await getConversationParticipantIds(conversationId);
            emitToUsers(
              participantIds.filter((participantId) => Number(participantId) !== userId),
              {
                type: "typing",
                conversationId,
                userId,
                isTyping
              }
            );
            return;
          }

          if (message.type === "mark_read") {
            const conversationId = Number(message.conversationId);
            const lastMessageId = message.lastMessageId ? Number(message.lastMessageId) : null;
            const allowed = await isUserInConversation(userId, conversationId);
            if (!allowed) return;
            await markConversationAsRead(userId, conversationId, lastMessageId);
            ws.send(
              JSON.stringify({
                type: "read_ack",
                conversationId
              })
            );
          }
        } catch (error) {
          ws.send(
            JSON.stringify({
              type: "chat_error",
              error: error?.message || "Error en chat"
            })
          );
        }
      });

      ws.on("close", () => {
        unregisterUserConnection(userId, ws);
        const friendIdsPromise = listFriendIds(userId);
        friendIdsPromise
          .then((friendIds) => {
            if (isUserOnline(userId)) return;
            emitToUsers(friendIds, {
              type: "friend:presence",
              userId,
              isOnline: false
            });
          })
          .catch(() => {});
      });
    } catch (_error) {
      ws.close(1008, "No autorizado");
    }
  });

  return wss;
}
