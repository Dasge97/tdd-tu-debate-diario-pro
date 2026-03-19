import {
  getUnreadNotificationsCount,
  listNotificationsByUser,
  markAllNotificationsAsRead
} from "../services/notifications.service.js";

const parseData = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const toNotification = (row) => ({
  id: Number(row.id),
  userId: Number(row.user_id),
  type: row.type,
  title: row.title,
  body: row.body,
  data: parseData(row.data_json),
  isRead: Boolean(row.is_read),
  createdAt: row.created_at,
  readAt: row.read_at
});

export async function listNotificationsController(req, res, next) {
  try {
    const limit = Number(req.query.limit || 20);
    const rows = await listNotificationsByUser(req.auth.userId, limit);
    res.json(rows.map(toNotification));
  } catch (error) {
    next(error);
  }
}

export async function unreadNotificationsCountController(req, res, next) {
  try {
    const unreadCount = await getUnreadNotificationsCount(req.auth.userId);
    res.json({ unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsAsReadController(req, res, next) {
  try {
    await markAllNotificationsAsRead(req.auth.userId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
