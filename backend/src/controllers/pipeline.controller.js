import {
  createGenerationJobResponse,
  createImport,
  getImportNews,
  getJob,
  getJobDebates,
  getJobNews,
  getPendingNews,
  listImports,
  listJobs,
  listLatestGeneratedDebates,
  listLatestImports,
  markJobFailed,
  validateNewsItems,
  sanitizeNewsItem,
  getImport as getImportRecord
} from "../services/pipeline.service.js";
import { assertEditorialDebatesPayload } from "../services/pipelineDebateOutputGuard.service.js";
import { pool } from "../database/db.js";

export async function importNewsController(req, res, next) {
  try {
    const triggerType = String(req.body?.triggerType || "manual").trim();
    const items = Array.isArray(req.body?.items) ? req.body.items.map(sanitizeNewsItem) : [];
    const validationError = validateNewsItems(items);

    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const result = await createImport({
      triggerType,
      rawPayload: req.body,
      items
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listImportsController(req, res, next) {
  try {
    const items = await listImports({
      limit: Number(req.query.limit || 50),
      createdFrom: req.query.created_from ? String(req.query.created_from) : null,
      createdTo: req.query.created_to ? String(req.query.created_to) : null
    });

    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function listLatestImportsController(req, res, next) {
  try {
    const items = await listLatestImports(Number(req.query.limit || 10));
    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function getImportController(req, res, next) {
  try {
    const importRecord = await getImportRecord(req.params.importId);
    if (!importRecord) {
      return res.status(404).json({ error: "Import not found" });
    }

    const items = await getImportNews({
      importId: req.params.importId,
      limit: Number(req.query.limit || 500)
    });

    res.json({
      ...importRecord,
      items
    });
  } catch (error) {
    next(error);
  }
}

export async function listPendingNewsController(req, res, next) {
  try {
    const items = await getPendingNews({
      importId: req.query.importId ? String(req.query.importId) : null,
      limit: Number(req.query.limit || 20)
    });

    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function createGenerationJobController(req, res, next) {
  try {
    const importId = req.body?.importId ? String(req.body.importId) : null;
    const requestedNewsCount = Number(req.body?.newsLimit || 20);
    const targetDebates = Number(req.body?.targetDebates || 5);
    const requestedCandidateDebates = Number(req.body?.candidateDebates || 10);
    const newsItems = await getPendingNews({
      importId,
      limit: requestedNewsCount
    });

    if (newsItems.length === 0) {
      return res.status(409).json({
        error: "There are no pending news items available for a new generation job"
      });
    }

    if (newsItems.length < targetDebates) {
      return res.status(409).json({
        error: `Not enough news items to generate ${targetDebates} debates`,
        availableNews: newsItems.length,
        targetDebates
      });
    }

    const result = await createGenerationJobResponse({
      importId,
      requestedNewsCount,
      targetDebates,
      requestedCandidateDebates,
      newsItems,
      markAssigned: true
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function relaunchLatestJobController(req, res, next) {
  try {
    const latestImports = await listLatestImports(1);
    const latestImport = latestImports[0] || null;
    if (!latestImport) {
      return res.status(404).json({ error: "There is no import available to relaunch" });
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
        error: "The latest import does not contain reusable news items"
      });
    }

    if (newsItems.length < targetDebates) {
      return res.status(409).json({
        error: `The latest import only has ${newsItems.length} news items and cannot generate ${targetDebates} debates`,
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

    res.status(201).json({
      ...result,
      importId: latestImport.id,
      relaunched: true
    });
  } catch (error) {
    next(error);
  }
}

export async function listJobsController(req, res, next) {
  try {
    const items = await listJobs({
      limit: Number(req.query.limit || 50),
      createdFrom: req.query.created_from ? String(req.query.created_from) : null,
      createdTo: req.query.created_to ? String(req.query.created_to) : null,
      status: req.query.status ? String(req.query.status) : null
    });

    res.json({ items });
  } catch (error) {
    next(error);
  }
}

export async function getJobController(req, res, next) {
  try {
    const job = await getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Generation job not found" });
    }

    const newsItems = await getJobNews(req.params.jobId);
    const generatedDebates = await getJobDebates(req.params.jobId);

    res.json({
      ...job,
      newsItems,
      generatedDebates
    });
  } catch (error) {
    next(error);
  }
}

export async function completeJobController(req, res, next) {
  const connection = await pool.getConnection();

  try {
    const job = await getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Generation job not found" });
    }

    const jobNews = await getJobNews(req.params.jobId);
    const debates = Array.isArray(req.body?.debates) ? req.body.debates : [];

    assertEditorialDebatesPayload(debates, {
      expectedRows: Number(job.target_debates || 5),
      requireDistinctCategories: true
    });

    const newsById = new Map(jobNews.map((item) => [String(item.id), item]));

    await connection.beginTransaction();

    await connection.query(`DELETE FROM debates WHERE generation_job_id = ?`, [req.params.jobId]);

    for (const debate of debates) {
      const sourceItem = newsById.get(String(debate.newsItemId));

      if (!sourceItem) {
        throw new Error(`Generated debate references unknown newsItemId: ${debate.newsItemId}`);
      }

      await connection.query(
        `INSERT INTO debates (
           title,
           question,
           card_summary,
           context,
           category,
           source_name,
           source_url,
           published_at,
           day_date,
           created_by,
           author_type,
           ai_persona_name,
           ai_persona_label,
           ai_persona_bio,
           ai_persona_focus,
           ai_persona_traits_json,
           generation_job_id,
           news_item_id,
           generation_source,
           generation_model,
           raw_generation
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), NULL, 'ai', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          debate.title,
          debate.question,
          debate.cardSummary,
          debate.debateContext,
          debate.category,
          debate.sourceName || sourceItem.source,
          debate.sourceUrl || sourceItem.url,
          debate.publishedAt ? new Date(debate.publishedAt) : null,
          'Redacción TDD',
          'Editor de debate diario',
          'Genera debates breves y claros a partir de la actualidad.',
          'Actualidad, criterio y conversación pública.',
          JSON.stringify(['claro', 'contextual', 'sereno']),
          req.params.jobId,
          sourceItem.id,
          debate.generationSource || 'opencode',
          debate.generationModel || null,
          JSON.stringify(debate.rawGeneration || {})
        ]
      );
    }

    await connection.query(
      `UPDATE generation_jobs
       SET status = 'applied',
           applied_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           error_message = NULL,
           meta = JSON_OBJECT('resultFilePath', ?)
       WHERE id = ?`,
      [req.body?.resultFilePath || job.result_file_path || null, req.params.jobId]
    );

    await connection.commit();

    res.json({
      jobId: req.params.jobId,
      status: "applied",
      resultFilePath: req.body?.resultFilePath || job.result_file_path || null,
      insertedDebates: debates.length
    });
  } catch (error) {
    await connection.rollback();
    await markJobFailed(req.params.jobId, error.message).catch(() => {});
    next(error);
  } finally {
    connection.release();
  }
}

export async function failJobController(req, res, next) {
  try {
    const job = await getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Generation job not found" });
    }

    const errorMessage = String(req.body?.errorMessage || "Unknown worker failure").trim();
    await markJobFailed(req.params.jobId, errorMessage);

    res.json({
      jobId: req.params.jobId,
      status: "failed",
      errorMessage
    });
  } catch (error) {
    next(error);
  }
}

export async function listLatestGeneratedDebatesController(req, res, next) {
  try {
    const items = await listLatestGeneratedDebates(Number(req.query.limit || 10));
    res.json({ items });
  } catch (error) {
    next(error);
  }
}
