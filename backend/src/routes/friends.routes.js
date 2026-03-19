import { Router } from "express";
import {
  acceptFriendRequestController,
  getFriendStatusController,
  listFriendRequestsController,
  listFriendsController,
  rejectFriendRequestController,
  removeFriendController,
  sendFriendRequestController
} from "../controllers/friends.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const friendsRouter = Router();

friendsRouter.get("/", requireAuth, listFriendsController);
friendsRouter.get("/requests", requireAuth, listFriendRequestsController);
friendsRouter.get("/status/:userId", requireAuth, getFriendStatusController);
friendsRouter.post("/request", requireAuth, sendFriendRequestController);
friendsRouter.post("/:userId/accept", requireAuth, acceptFriendRequestController);
friendsRouter.post("/:userId/reject", requireAuth, rejectFriendRequestController);
friendsRouter.delete("/:userId", requireAuth, removeFriendController);

export default friendsRouter;
