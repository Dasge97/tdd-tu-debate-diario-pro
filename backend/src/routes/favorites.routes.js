import { Router } from "express";
import {
  addFavoriteController,
  listFavoritesController,
  removeFavoriteController
} from "../controllers/favorites.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const favoritesRouter = Router();

favoritesRouter.get("/", requireAuth, listFavoritesController);
favoritesRouter.post("/:debateId", requireAuth, addFavoriteController);
favoritesRouter.delete("/:debateId", requireAuth, removeFavoriteController);

export default favoritesRouter;
