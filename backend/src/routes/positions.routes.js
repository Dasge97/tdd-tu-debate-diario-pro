import { Router } from "express";
import { createPositionController } from "../controllers/positions.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const positionsRouter = Router();

positionsRouter.post("/", requireAuth, createPositionController);

export default positionsRouter;
