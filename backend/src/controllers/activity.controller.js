import { listRecentActivity } from "../services/activity.service.js";

export async function listRecentActivityController(req, res, next) {
  try {
    const items = await listRecentActivity({
      limit: Number(req.query.limit || 20)
    });

    res.json({ items });
  } catch (error) {
    next(error);
  }
}
