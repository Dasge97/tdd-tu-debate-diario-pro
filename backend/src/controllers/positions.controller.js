import { isValidPosition, upsertPosition } from "../services/positions.service.js";

export async function createPositionController(req, res, next) {
  try {
    const { debateId, position } = req.body;
    const userId = req.auth.userId;

    if (!Number.isInteger(Number(debateId)) || Number(debateId) <= 0) {
      return res.status(400).json({ error: "debateId es obligatorio y debe ser numérico." });
    }
    if (!isValidPosition(position)) {
      return res
        .status(400)
        .json({ error: "position debe ser support, oppose o neutral." });
    }

    const savedPosition = await upsertPosition({
      userId: Number(userId),
      debateId: Number(debateId),
      position
    });

    res.status(201).json({
      id: Number(savedPosition.id),
      userId: Number(savedPosition.user_id),
      debateId: Number(savedPosition.debate_id),
      position: savedPosition.position
    });
  } catch (error) {
    next(error);
  }
}
