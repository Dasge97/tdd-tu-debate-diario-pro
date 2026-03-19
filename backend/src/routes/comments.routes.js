import { Router } from "express";
import {
  createCommentController,
  getCommentsByDebateIdController,
  voteCommentController
} from "../controllers/comments.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.middleware.js";

const commentsRouter = Router();

commentsRouter.get("/:debateId", optionalAuth, getCommentsByDebateIdController);
commentsRouter.post("/", requireAuth, createCommentController);
commentsRouter.post("/:commentId/vote", requireAuth, voteCommentController);

export default commentsRouter;
