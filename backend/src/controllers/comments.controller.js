import { createComment, getCommentsByDebateId, voteComment } from "../services/comments.service.js";
import { createNotification } from "../services/notifications.service.js";
import { emitToUser } from "../realtime/realtime.hub.js";

const parseData = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

export async function getCommentsByDebateIdController(req, res, next) {
  try {
    const debateId = Number(req.params.debateId);
    if (!Number.isInteger(debateId) || debateId <= 0) {
      return res.status(400).json({ error: "El id del debate no es válido." });
    }

    const comments = await getCommentsByDebateId(debateId, req.auth?.userId || null);
    res.json(comments);
  } catch (error) {
    next(error);
  }
}

export async function createCommentController(req, res, next) {
  try {
    const { debateId, parentId = null, content } = req.body;
    const userId = req.auth.userId;

    if (!Number.isInteger(Number(debateId)) || Number(debateId) <= 0) {
      return res.status(400).json({ error: "debateId es obligatorio y debe ser numérico." });
    }
    if (parentId !== null && (!Number.isInteger(Number(parentId)) || Number(parentId) <= 0)) {
      return res.status(400).json({ error: "parentId debe ser null o numérico." });
    }
    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ error: "content es obligatorio." });
    }

    const comment = await createComment({
      debateId: Number(debateId),
      userId: Number(userId),
      parentId: parentId === null ? null : Number(parentId),
      content: content.trim()
    });

    res.status(201).json({
      id: Number(comment.id),
      debateId: Number(comment.debateId),
      userId: Number(comment.userId),
      username: comment.username,
      parentId: comment.parentId,
      content: comment.content,
      createdAt: comment.createdAt,
      score: Number(comment.score),
      upvotes: Number(comment.upvotes || 0),
      downvotes: Number(comment.downvotes || 0),
      currentUserVote: Number(comment.currentUserVote || 0)
    });
  } catch (error) {
    next(error);
  }
}

export async function voteCommentController(req, res, next) {
  try {
    const commentId = Number(req.params.commentId);
    if (!Number.isInteger(commentId) || commentId <= 0) {
      return res.status(400).json({ error: "commentId no válido." });
    }

    const updated = await voteComment({
      commentId,
      userId: req.auth.userId,
      value: Number(req.body?.value || 1)
    });

    const ownerId = Number(updated.userId);
    if (ownerId !== Number(req.auth.userId)) {
      const voteValue = Number(req.body?.value || 1) < 0 ? -1 : 1;
      const notification = await createNotification(ownerId, {
        type: "comment_vote",
        title: voteValue > 0 ? "Nuevo voto positivo en tu comentario" : "Tu comentario ha recibido un voto negativo",
        body:
          voteValue > 0
            ? "Alguien ha valorado positivamente uno de tus comentarios."
            : "Un usuario ha valorado negativamente uno de tus comentarios.",
        data: {
          commentId: Number(updated.id),
          debateId: Number(updated.debateId),
          voterUserId: Number(req.auth.userId),
          value: voteValue
        }
      });

      if (notification) {
        emitToUser(ownerId, {
          type: "notification:new",
          notification: {
            id: Number(notification.id),
            userId: Number(notification.user_id),
            type: notification.type,
            title: notification.title,
            body: notification.body,
            data: parseData(notification.data_json),
            isRead: Boolean(notification.is_read),
            createdAt: notification.created_at,
            readAt: notification.read_at
          }
        });
      }
    }

    res.json({
      id: Number(updated.id),
      debateId: Number(updated.debateId),
      userId: Number(updated.userId),
      username: updated.username,
      parentId: updated.parentId,
      content: updated.content,
      createdAt: updated.createdAt,
      score: Number(updated.score),
      upvotes: Number(updated.upvotes || 0),
      downvotes: Number(updated.downvotes || 0),
      currentUserVote: Number(updated.currentUserVote || 0)
    });
  } catch (error) {
    if (error.code === "COMMENT_NOT_FOUND") {
      return res.status(404).json({ error: error.message });
    }
    if (error.code === "OWN_COMMENT" || error.code === "ALREADY_VOTED") {
      return res.status(409).json({ error: error.message });
    }
    return next(error);
  }
}
