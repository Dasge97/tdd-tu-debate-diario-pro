import {
  addFavorite,
  getFavoritesByUserId,
  isFavorite,
  removeFavorite
} from "../services/favorites.service.js";

export async function listFavoritesController(req, res, next) {
  try {
    const favorites = await getFavoritesByUserId(req.auth.userId);
    res.json(favorites);
  } catch (error) {
    next(error);
  }
}

export async function addFavoriteController(req, res, next) {
  try {
    const debateId = Number(req.params.debateId);
    if (!Number.isInteger(debateId) || debateId <= 0) {
      return res.status(400).json({ error: "debateId no válido." });
    }

    await addFavorite(req.auth.userId, debateId);
    const favorite = await isFavorite(req.auth.userId, debateId);
    res.status(201).json({ ok: true, favorite });
  } catch (error) {
    next(error);
  }
}

export async function removeFavoriteController(req, res, next) {
  try {
    const debateId = Number(req.params.debateId);
    if (!Number.isInteger(debateId) || debateId <= 0) {
      return res.status(400).json({ error: "debateId no válido." });
    }

    await removeFavorite(req.auth.userId, debateId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
