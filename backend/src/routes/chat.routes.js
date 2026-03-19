import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  createMessageController,
  listConversationsController,
  listMessagesController,
  markAsReadController,
  openConversationController
} from "../controllers/chat.controller.js";

const chatRouter = Router();

chatRouter.get("/conversations", requireAuth, listConversationsController);
chatRouter.post("/conversations", requireAuth, openConversationController);
chatRouter.get("/conversations/:conversationId/messages", requireAuth, listMessagesController);
chatRouter.post("/messages", requireAuth, createMessageController);
chatRouter.post("/conversations/:conversationId/read", requireAuth, markAsReadController);

export default chatRouter;
