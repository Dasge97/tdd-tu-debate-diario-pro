import { Router } from "express";
import {
  createUserDebateProposalController,
  getDebateCategoriesController,
  getDebateByIdController,
  getTodayDebatesController,
  getTrendingDebatesController,
  searchDebatesController
} from "../controllers/debates.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const debatesRouter = Router();

debatesRouter.get("/today", getTodayDebatesController);
debatesRouter.get("/categories", getDebateCategoriesController);
debatesRouter.get("/search", searchDebatesController);
debatesRouter.get("/trending", getTrendingDebatesController);
debatesRouter.post("/proposals", requireAuth, createUserDebateProposalController);
debatesRouter.get("/:id", getDebateByIdController);

export default debatesRouter;
