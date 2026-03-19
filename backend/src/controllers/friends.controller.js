import {
  deleteFriendRelation,
  findFriendRelation,
  listFriends,
  listPendingRequests,
  sendFriendRequest,
  updateFriendRequestStatus
} from "../services/friends.service.js";
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

const mapFriend = (row) => ({
  id: Number(row.id),
  username: row.username,
  bio: row.bio || "",
  avatarUrl: row.avatar_url || "",
  location: row.location || "",
  reliabilityScore: Number(row.reliability_score || 0),
  since: row.since || row.created_at
});

const relationState = (relation, me, other) => {
  if (!relation) return "none";
  if (relation.status === "accepted") return "friends";
  if (relation.status === "rejected") return "rejected";
  if (relation.status === "pending") {
    if (Number(relation.requester_id) === me) return "pending_sent";
    if (Number(relation.addressee_id) === me && Number(relation.requester_id) === other) {
      return "pending_received";
    }
  }
  return "none";
};

export async function listFriendsController(req, res, next) {
  try {
    const rows = await listFriends(req.auth.userId);
    res.json(rows.map(mapFriend));
  } catch (error) {
    next(error);
  }
}

export async function listFriendRequestsController(req, res, next) {
  try {
    const rows = await listPendingRequests(req.auth.userId);
    res.json(
      rows.map((row) => ({
        id: Number(row.id),
        requesterId: Number(row.requester_id),
        status: row.status,
        createdAt: row.created_at,
        user: mapFriend(row)
      }))
    );
  } catch (error) {
    next(error);
  }
}

export async function getFriendStatusController(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "userId no válido." });
    }

    const relation = await findFriendRelation(req.auth.userId, userId);
    res.json({ status: relationState(relation, req.auth.userId, userId) });
  } catch (error) {
    next(error);
  }
}

export async function sendFriendRequestController(req, res, next) {
  try {
    const userId = Number(req.body.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "userId no válido." });
    }
    if (userId === req.auth.userId) {
      return res.status(400).json({ error: "No puedes enviarte solicitud a ti mismo." });
    }

    const existing = await findFriendRelation(req.auth.userId, userId);
    if (existing?.status === "accepted") {
      return res.status(409).json({ error: "Ya sois amigos." });
    }
    if (existing?.status === "pending") {
      const state = relationState(existing, req.auth.userId, userId);
      if (state === "pending_sent") {
        return res.status(409).json({ error: "Ya enviaste una solicitud." });
      }
      return res.status(409).json({ error: "Tienes una solicitud pendiente de ese usuario." });
    }

    const relation = await sendFriendRequest(req.auth.userId, userId);

    const notification = await createNotification(userId, {
      type: "friend_request",
      title: "Nueva solicitud de amistad",
      body: "Tienes una nueva solicitud de amistad pendiente.",
      data: {
        requesterId: Number(req.auth.userId)
      }
    });

    if (notification) {
      emitToUser(userId, {
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

    res.status(201).json({
      id: Number(relation.id),
      status: relation.status,
      requesterId: Number(relation.requester_id),
      addresseeId: Number(relation.addressee_id)
    });
  } catch (error) {
    next(error);
  }
}

export async function acceptFriendRequestController(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "userId no válido." });
    }

    const relation = await updateFriendRequestStatus(userId, req.auth.userId, "accepted");
    if (!relation || relation.status !== "accepted") {
      return res.status(404).json({ error: "Solicitud pendiente no encontrada." });
    }

    const notification = await createNotification(userId, {
      type: "friend_accepted",
      title: "Solicitud aceptada",
      body: "Han aceptado tu solicitud de amistad.",
      data: {
        userId: Number(req.auth.userId)
      }
    });

    if (notification) {
      emitToUser(userId, {
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

    res.json({ ok: true, status: "friends" });
  } catch (error) {
    next(error);
  }
}

export async function rejectFriendRequestController(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "userId no válido." });
    }

    const relation = await updateFriendRequestStatus(userId, req.auth.userId, "rejected");
    if (!relation || relation.status !== "rejected") {
      return res.status(404).json({ error: "Solicitud pendiente no encontrada." });
    }

    res.json({ ok: true, status: "rejected" });
  } catch (error) {
    next(error);
  }
}

export async function removeFriendController(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "userId no válido." });
    }

    await deleteFriendRelation(req.auth.userId, userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
