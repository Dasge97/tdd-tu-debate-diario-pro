import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  listNotificationsController,
  markAllNotificationsAsReadController,
  unreadNotificationsCountController
} from "../controllers/notifications.controller.js";

const notificationsRouter = Router();

notificationsRouter.get("/", requireAuth, listNotificationsController);
notificationsRouter.get("/unread-count", requireAuth, unreadNotificationsCountController);
notificationsRouter.post("/read-all", requireAuth, markAllNotificationsAsReadController);

export default notificationsRouter;
