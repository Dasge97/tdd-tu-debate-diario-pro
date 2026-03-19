import {
  createUserDebateProposal,
  getAllowedDebateCategories,
  getDebateById,
  getTodayDebates,
  getTrendingDebates,
  searchDebates
} from "../services/debates.service.js";

export async function getTodayDebatesController(_req, res, next) {
  try {
    const debates = await getTodayDebates();
    res.json(debates);
  } catch (error) {
    next(error);
  }
}

export async function getDebateByIdController(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "El id del debate no es válido." });
    }

    const debate = await getDebateById(id);
    if (!debate) {
      return res.status(404).json({ error: "Debate no encontrado." });
    }

    res.json(debate);
  } catch (error) {
    next(error);
  }
}

export async function searchDebatesController(req, res, next) {
  try {
    const debates = await searchDebates({
      q: String(req.query.q || "").trim(),
      sort: String(req.query.sort || "new").trim(),
      from: String(req.query.from || "").trim(),
      to: String(req.query.to || "").trim(),
      position: String(req.query.position || "").trim(),
      category: String(req.query.category || "").trim(),
      authorType: String(req.query.authorType || "").trim()
    });

    res.json(debates);
  } catch (error) {
    next(error);
  }
}

export async function getTrendingDebatesController(req, res, next) {
  try {
    const limit = Number(req.query.limit || 10);
    const debates = await getTrendingDebates(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 30) : 10);
    res.json(debates);
  } catch (error) {
    next(error);
  }
}

export async function getDebateCategoriesController(_req, res, next) {
  try {
    res.json(getAllowedDebateCategories());
  } catch (error) {
    next(error);
  }
}

export async function createUserDebateProposalController(req, res, next) {
  try {
    const debate = await createUserDebateProposal({
      userId: req.auth?.userId,
      title: req.body?.title,
      question: req.body?.question,
      cardSummary: req.body?.cardSummary,
      context: req.body?.context,
      category: req.body?.category,
      sourceUrl: req.body?.sourceUrl
    });

    res.status(201).json(debate);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
}
