import { Router } from "express";
import { requireAdmin } from "../middleware/auth.middleware.js";
import {
  adminAuditLogsController,
  adminCommentsController,
  adminConversationsController,
  adminDebatesController,
  adminDeleteCommentController,
  adminDeleteDebateController,
  adminNotificationsController,
  adminOverviewController,
  adminRecentActivityController,
  adminRunDailyCycleController,
  adminUpdateCommentController,
  adminUpdateDebateController,
  adminUpdateUserController,
  adminUsersController
} from "../controllers/admin.controller.js";

const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get("/overview", adminOverviewController);
adminRouter.get("/activity", adminRecentActivityController);
adminRouter.post("/daily-cycle/run", adminRunDailyCycleController);
adminRouter.get("/users", adminUsersController);
adminRouter.patch("/users/:userId", adminUpdateUserController);
adminRouter.get("/debates", adminDebatesController);
adminRouter.patch("/debates/:debateId", adminUpdateDebateController);
adminRouter.delete("/debates/:debateId", adminDeleteDebateController);
adminRouter.get("/comments", adminCommentsController);
adminRouter.patch("/comments/:commentId", adminUpdateCommentController);
adminRouter.delete("/comments/:commentId", adminDeleteCommentController);
adminRouter.get("/conversations", adminConversationsController);
adminRouter.get("/notifications", adminNotificationsController);
adminRouter.get("/audit-logs", adminAuditLogsController);

export default adminRouter;
