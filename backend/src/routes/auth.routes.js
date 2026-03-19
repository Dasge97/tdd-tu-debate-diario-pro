import { Router } from "express";
import {
  loginController,
  logoutController,
  registerController
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const authRouter = Router();

authRouter.post("/register", registerController);
authRouter.post("/login", loginController);
authRouter.post("/logout", requireAuth, logoutController);

export default authRouter;
