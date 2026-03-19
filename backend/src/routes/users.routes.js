import { Router } from "express";
import {
  getMeController,
  searchUsersController,
  getTopUsersController,
  getUserByIdController,
  getUserByUsernameController,
  updateMeController,
  uploadMyAvatarController
} from "../controllers/users.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { avatarUpload } from "../middleware/upload.middleware.js";

const usersRouter = Router();

usersRouter.get("/top", getTopUsersController);
usersRouter.get("/search", searchUsersController);
usersRouter.get("/me", requireAuth, getMeController);
usersRouter.put("/me", requireAuth, updateMeController);
usersRouter.post("/me/avatar", requireAuth, avatarUpload.single("avatar"), uploadMyAvatarController);
usersRouter.get("/username/:username", getUserByUsernameController);
usersRouter.get("/:id", getUserByIdController);

export default usersRouter;
