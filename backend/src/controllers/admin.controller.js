import {
  deleteAdminComment,
  deleteAdminDebate,
  getAdminOverview,
  getRecentAdminActivity,
  listAdminAuditLogs,
  listAdminComments,
  listAdminConversations,
  listAdminDebates,
  listAdminNotifications,
  listAdminUsers,
  logAdminAction,
  updateAdminComment,
  updateAdminDebate,
  updateAdminUser
} from "../services/admin.service.js";
import { createGenerationJobResponse, getImportNews, listLatestImports } from "../services/pipeline.service.js";
import { getOnlineUsersCount } from "../realtime/realtime.hub.js";

const parsePayload = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

export async function adminOverviewController(req, res, next) {
  try {
    const overview = await getAdminOverview();
    res.json({
      ...overview,
      activeSocketUsers: getOnlineUsersCount()
    });
  } catch (error) {
    next(error);
  }
}

export async function adminRecentActivityController(req, res, next) {
  try {
    const limit = Number(req.query.limit || 20);
    const items = await getRecentAdminActivity(limit);
    res.json(items);
  } catch (error) {
    next(error);
  }
}

export async function adminUsersController(req, res, next) {
  try {
    const data = await listAdminUsers({
      q: req.query.q || "",
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 12)
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateUserController(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "userId no válido." });
    }

    const updated = await updateAdminUser(userId, {
      role: req.body.role,
      status: req.body.status,
      reliabilityScore: req.body.reliabilityScore
    });

    await logAdminAction(req.auth.userId, "admin.user.update", "user", userId, req.body);
    res.json(updated);
  } catch (error) {
    if (error.message === "No hay cambios válidos para actualizar.") {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
}

export async function adminDebatesController(req, res, next) {
  try {
    const data = await listAdminDebates({
      q: req.query.q || "",
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 10)
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateDebateController(req, res, next) {
  try {
    const debateId = Number(req.params.debateId);
    if (!Number.isInteger(debateId) || debateId <= 0) {
      return res.status(400).json({ error: "debateId no válido." });
    }
    const { title, context, dayDate } = req.body;
    if (!title || !context || !dayDate) {
      return res.status(400).json({ error: "title, context y dayDate son obligatorios." });
    }

    const updated = await updateAdminDebate(debateId, { title, context, dayDate });
    await logAdminAction(req.auth.userId, "admin.debate.update", "debate", debateId, req.body);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function adminDeleteDebateController(req, res, next) {
  try {
    const debateId = Number(req.params.debateId);
    if (!Number.isInteger(debateId) || debateId <= 0) {
      return res.status(400).json({ error: "debateId no válido." });
    }
    await deleteAdminDebate(debateId);
    await logAdminAction(req.auth.userId, "admin.debate.delete", "debate", debateId, null);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function adminCommentsController(req, res, next) {
  try {
    const data = await listAdminComments({
      q: req.query.q || "",
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 12)
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function adminUpdateCommentController(req, res, next) {
  try {
    const commentId = Number(req.params.commentId);
    if (!Number.isInteger(commentId) || commentId <= 0) {
      return res.status(400).json({ error: "commentId no válido." });
    }
    const content = String(req.body.content || "").trim();
    if (!content) {
      return res.status(400).json({ error: "content es obligatorio." });
    }
    const updated = await updateAdminComment(commentId, content);
    await logAdminAction(req.auth.userId, "admin.comment.update", "comment", commentId, { content });
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function adminDeleteCommentController(req, res, next) {
  try {
    const commentId = Number(req.params.commentId);
    if (!Number.isInteger(commentId) || commentId <= 0) {
      return res.status(400).json({ error: "commentId no válido." });
    }
    await deleteAdminComment(commentId);
    await logAdminAction(req.auth.userId, "admin.comment.delete", "comment", commentId, null);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function adminConversationsController(req, res, next) {
  try {
    const data = await listAdminConversations({
      q: req.query.q || "",
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 10)
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function adminNotificationsController(req, res, next) {
  try {
    const data = await listAdminNotifications({
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 12)
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
}

export async function adminAuditLogsController(req, res, next) {
  try {
    const data = await listAdminAuditLogs({
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 15)
    });
    res.json({
      ...data,
      items: data.items.map((item) => ({
        ...item,
        payload: parsePayload(item.payload)
      }))
    });
  } catch (error) {
    next(error);
  }
}

export async function adminRunDailyCycleController(req, res, next) {
  try {
    const latestImports = await listLatestImports(1);
    const latestImport = latestImports[0] || null;

    if (!latestImport) {
      return res.status(404).json({ error: "No hay ningún stack importado para relanzar el ciclo." });
    }

    const requestedNewsCount = Number(req.body?.newsLimit || 20);
    const targetDebates = Number(req.body?.targetDebates || 5);
    const requestedCandidateDebates = Number(req.body?.candidateDebates || 10);
    const newsItems = await getImportNews({
      importId: latestImport.id,
      limit: requestedNewsCount
    });

    if (newsItems.length === 0) {
      return res.status(409).json({
        error: "El último stack no contiene noticias reutilizables para generar debates."
      });
    }

    if (newsItems.length < targetDebates) {
      return res.status(409).json({
        error: `El último stack solo tiene ${newsItems.length} noticias y no puede generar ${targetDebates} debates`,
        availableNews: newsItems.length,
        targetDebates
      });
    }

    const result = await createGenerationJobResponse({
      importId: latestImport.id,
      requestedNewsCount,
      targetDebates,
      requestedCandidateDebates,
      newsItems,
      markAssigned: false
    });

    await logAdminAction(req.auth.userId, "admin.daily-cycle.run", "generation_job", null, {
      jobId: result.jobId,
      importId: latestImport.id,
      requestedNewsCount,
      targetDebates,
      requestedCandidateDebates
    });

    res.status(201).json({
      ...result,
      importId: latestImport.id,
      relaunched: true
    });
  } catch (error) {
    next(error);
  }
}
