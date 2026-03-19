import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConnection, pool, query } from "../database/db.js";

const DEBATE_ALLOWED_CATEGORIES = [
  "politica",
  "economia",
  "tecnologia",
  "sociedad",
  "ciencia",
  "medio ambiente",
  "cultura",
  "internacional"
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sharedDir = process.env.OPENCODE_SHARED_DIR || path.resolve(__dirname, "../../../shared/jobs");
const inboxDir = path.join(sharedDir, "inbox");
const outboxDir = path.join(sharedDir, "outbox");
const MAX_NEWS_CONTENT_LENGTH = 1000;

const truncateText = (value, max) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return normalized.slice(0, max);
};

const buildPromptContract = ({
  jobId,
  targetDebates,
  candidateDebates,
  newsItems,
  resultFilePath
}) => ({
  job_id: jobId,
  target_debates: targetDebates,
  candidate_debates: candidateDebates,
  prompt_version: "tdd-batch-editorial-v1",
  expected_result_path: resultFilePath,
  rules: {
    language: "es",
    required_row_count: targetDebates,
    required_distinct_categories: targetDebates,
    candidate_output_count: candidateDebates,
    allowed_categories: DEBATE_ALLOWED_CATEGORIES,
    required_fields: [
      "newsItemId",
      "title",
      "question",
      "cardSummary",
      "debateContext",
      "category",
      "sourceName",
      "sourceUrl",
      "publishedAt",
      "generationSource",
      "generationModel",
      "rawGeneration"
    ]
  },
  news_items: newsItems.map((item, index) => ({
    position: index + 1,
    candidate_id: `candidate-${index + 1}`,
    news_item_id: item.id,
    import_id: item.import_id,
    source: item.source,
    title: item.title,
    summary: item.summary,
    url: item.url,
    category: item.category,
    published_at: item.published_at,
    metadata: item.metadata
  }))
});

const ensureDirectoryStructure = async () => {
  await fs.mkdir(inboxDir, { recursive: true });
  await fs.mkdir(outboxDir, { recursive: true });
};

export const sanitizeNewsItem = (item) => ({
  source: String(item?.source || "").trim(),
  source_key: item?.source_key ? String(item.source_key).trim() : null,
  title: String(item?.title || "").trim(),
  summary: String(item?.summary || "").trim(),
  url: String(item?.url || "").trim(),
  category: item?.category ? String(item.category).trim() : null,
  published_at: item?.published_at ? String(item.published_at).trim() : null,
  content: truncateText(item?.content, MAX_NEWS_CONTENT_LENGTH),
  metadata: typeof item?.metadata === "object" && item.metadata ? item.metadata : {}
});

export const validateNewsItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "items must be a non-empty array";
  }

  for (const rawItem of items) {
    const item = sanitizeNewsItem(rawItem);
    if (!item.source || !item.title || !item.summary || !item.url) {
      return "each item must include source, title, summary and url";
    }
  }

  return null;
};

export const ensurePipelineSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS news_imports (
      id CHAR(36) NOT NULL PRIMARY KEY,
      trigger_type VARCHAR(100) NOT NULL,
      item_count INT NOT NULL DEFAULT 0,
      raw_payload JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS generation_jobs (
      id CHAR(36) NOT NULL PRIMARY KEY,
      source_import_id CHAR(36) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'awaiting-output',
      requested_news_count INT NOT NULL DEFAULT 0,
      selected_news_count INT NOT NULL DEFAULT 0,
      target_debates INT NOT NULL DEFAULT 5,
      prompt_file_path VARCHAR(1024) NULL,
      result_file_path VARCHAR(1024) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      applied_at DATETIME NULL,
      error_message TEXT NULL,
      meta JSON NULL,
      KEY idx_generation_jobs_created_at (created_at),
      KEY idx_generation_jobs_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS news_items (
      id CHAR(36) NOT NULL PRIMARY KEY,
      import_id CHAR(36) NOT NULL,
      source_name VARCHAR(255) NOT NULL,
      source_key VARCHAR(255) NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      url VARCHAR(1024) NOT NULL,
      category VARCHAR(80) NULL,
      published_at DATETIME NULL,
      content LONGTEXT NULL,
      metadata JSON NULL,
      assigned_generation_job_id CHAR(36) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_news_items_import_id (import_id),
      KEY idx_news_items_assigned_generation_job_id (assigned_generation_job_id),
      KEY idx_news_items_published_at (published_at),
      CONSTRAINT fk_news_items_import
        FOREIGN KEY (import_id) REFERENCES news_imports(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_news_items_assigned_job
        FOREIGN KEY (assigned_generation_job_id) REFERENCES generation_jobs(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS generation_job_news (
      job_id CHAR(36) NOT NULL,
      news_id CHAR(36) NOT NULL,
      position INT NOT NULL,
      PRIMARY KEY (job_id, news_id),
      KEY idx_generation_job_news_position (job_id, position),
      CONSTRAINT fk_generation_job_news_job
        FOREIGN KEY (job_id) REFERENCES generation_jobs(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_generation_job_news_news
        FOREIGN KEY (news_id) REFERENCES news_items(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    ALTER TABLE debates
    ADD COLUMN question VARCHAR(255) NULL
  `).catch(() => {});

  await query(`
    ALTER TABLE debates
    ADD COLUMN card_summary TEXT NULL
  `).catch(() => {});

  await query(`
    ALTER TABLE debates
    ADD COLUMN category VARCHAR(80) NULL
  `).catch(() => {});

  await query(`
    ALTER TABLE debates
    ADD COLUMN source_name VARCHAR(255) NULL
  `).catch(() => {});

  await query(`
    ALTER TABLE debates
    ADD COLUMN source_url VARCHAR(1024) NULL
  `).catch(() => {});

  await query(`
    ALTER TABLE debates
    ADD COLUMN published_at DATETIME NULL
  `).catch(() => {});

  await query(`
    ALTER TABLE debates
    ADD COLUMN generation_job_id CHAR(36) NULL
  `).catch(() => {});

  await query(`
    ALTER TABLE debates
    ADD COLUMN news_item_id CHAR(36) NULL
  `).catch(() => {});

  await query(`
    ALTER TABLE debates
    ADD COLUMN generation_source VARCHAR(80) NULL
  `).catch(() => {});

  await query(`
    ALTER TABLE debates
    ADD COLUMN generation_model VARCHAR(180) NULL
  `).catch(() => {});

  await query(`
    ALTER TABLE debates
    ADD COLUMN raw_generation JSON NULL
  `).catch(() => {});

  await query(`
    ALTER TABLE generation_jobs
    ADD COLUMN result_file_path VARCHAR(1024) NULL
  `).catch(() => {});

  await query(`
    UPDATE generation_jobs
    SET result_file_path = COALESCE(result_file_path, sql_file_path)
    WHERE result_file_path IS NULL
  `).catch(() => {});

  await query(`
    UPDATE generation_jobs
    SET status = 'awaiting-output'
    WHERE status = 'awaiting-sql'
  `).catch(() => {});

  await query(`
    ALTER TABLE generation_jobs
    DROP COLUMN sql_file_path
  `).catch(() => {});
};

export const createImport = async ({ triggerType, rawPayload, items }) => {
  const connection = await getConnection();
  const importId = crypto.randomUUID();

  try {
    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO news_imports (id, trigger_type, item_count, raw_payload)
       VALUES (?, ?, ?, ?)`,
      [importId, triggerType, items.length, JSON.stringify(rawPayload)]
    );

    for (const item of items) {
      await connection.query(
        `INSERT INTO news_items (
           id,
           import_id,
           source_name,
           source_key,
           title,
           summary,
           url,
           category,
           published_at,
           content,
           metadata
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          importId,
          item.source,
          item.source_key || null,
          item.title,
          item.summary,
          item.url,
          item.category || null,
          item.published_at ? new Date(item.published_at) : null,
          item.content || null,
          JSON.stringify(item.metadata || {})
        ]
      );
    }

    await connection.commit();

    return {
      importId,
      importedCount: items.length
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const listImports = async ({ limit = 50, createdFrom = null, createdTo = null } = {}) => {
  const params = [];
  const conditions = [];

  if (createdFrom) {
    params.push(createdFrom);
    conditions.push(`ni.created_at >= ?`);
  }

  if (createdTo) {
    params.push(createdTo);
    conditions.push(`ni.created_at <= ?`);
  }

  params.push(Number(limit));

  return query(
    `SELECT
       ni.id,
       ni.trigger_type,
       ni.item_count,
       ni.created_at,
       COUNT(DISTINCT n.id) AS stored_news_count,
       COUNT(DISTINCT gj.id) AS linked_jobs_count
     FROM news_imports ni
     LEFT JOIN news_items n ON n.import_id = ni.id
     LEFT JOIN generation_jobs gj ON gj.source_import_id = ni.id
     ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
     GROUP BY ni.id, ni.trigger_type, ni.item_count, ni.created_at
     ORDER BY ni.created_at DESC
     LIMIT ?`,
    params
  );
};

export const listLatestImports = async (limit = 10) =>
  query(
    `SELECT id, trigger_type, item_count, created_at
     FROM news_imports
     ORDER BY created_at DESC
     LIMIT ?`,
    [Number(limit)]
  );

export const getImport = async (importId) => {
  const rows = await query(
    `SELECT id, trigger_type, item_count, raw_payload, created_at
     FROM news_imports
     WHERE id = ?`,
    [importId]
  );

  const item = rows[0] || null;
  if (!item) return null;

  return {
    ...item,
    raw_payload:
      typeof item.raw_payload === "string" ? JSON.parse(item.raw_payload) : item.raw_payload
  };
};

export const getImportNews = async ({ importId, limit = 500 }) =>
  query(
    `SELECT
       id,
       import_id,
       source_name AS source,
       source_key,
       title,
       summary,
       url,
       category,
       published_at,
       content,
       metadata,
       created_at
     FROM news_items
     WHERE import_id = ?
     ORDER BY published_at DESC, created_at DESC
     LIMIT ?`,
    [importId, Number(limit)]
  );

export const getPendingNews = async ({ importId = null, limit = 20 }) => {
  const params = [];
  const conditions = ["assigned_generation_job_id IS NULL"];

  if (importId) {
    conditions.push("import_id = ?");
    params.push(importId);
  }

  params.push(Number(limit));

  return query(
    `SELECT
       id,
       import_id,
       source_name AS source,
       source_key,
       title,
       summary,
       url,
       category,
       published_at,
       content,
       metadata,
       created_at
     FROM news_items
     WHERE ${conditions.join(" AND ")}
     ORDER BY published_at DESC, created_at DESC
     LIMIT ?`,
    params
  );
};

export const listJobs = async ({ limit = 50, createdFrom = null, createdTo = null, status = null } = {}) => {
  const params = [];
  const conditions = [];

  if (createdFrom) {
    conditions.push("gj.created_at >= ?");
    params.push(createdFrom);
  }

  if (createdTo) {
    conditions.push("gj.created_at <= ?");
    params.push(createdTo);
  }

  if (status) {
    conditions.push("gj.status = ?");
    params.push(status);
  }

  params.push(Number(limit));

  return query(
    `SELECT
       gj.id,
       gj.source_import_id,
       gj.status,
       gj.requested_news_count,
       gj.selected_news_count,
       gj.target_debates,
       gj.created_at,
       gj.updated_at,
       gj.applied_at,
       gj.error_message,
       COUNT(DISTINCT gjn.news_id) AS source_news_count,
       COUNT(DISTINCT d.id) AS generated_debates_count
     FROM generation_jobs gj
     LEFT JOIN generation_job_news gjn ON gjn.job_id = gj.id
     LEFT JOIN debates d ON d.generation_job_id = gj.id
     ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
     GROUP BY
       gj.id,
       gj.source_import_id,
       gj.status,
       gj.requested_news_count,
       gj.selected_news_count,
       gj.target_debates,
       gj.created_at,
       gj.updated_at,
       gj.applied_at,
       gj.error_message
     ORDER BY gj.created_at DESC
     LIMIT ?`,
    params
  );
};

export const getJob = async (jobId) => {
  const rows = await query(
    `SELECT
       id,
       source_import_id,
       status,
       requested_news_count,
       selected_news_count,
       target_debates,
       prompt_file_path,
       result_file_path,
       created_at,
       updated_at,
       applied_at,
       error_message,
       meta
     FROM generation_jobs
     WHERE id = ?`,
    [jobId]
  );

  const item = rows[0] || null;
  if (!item) return null;

  return {
    ...item,
    meta: typeof item.meta === "string" ? JSON.parse(item.meta) : item.meta || {}
  };
};

export const getJobNews = async (jobId) =>
  query(
    `SELECT
       n.id,
       n.import_id,
       n.source_name AS source,
       n.source_key,
       n.title,
       n.summary,
       n.url,
       n.category,
       n.published_at,
       n.content,
       n.metadata,
       gjn.position
     FROM generation_job_news gjn
     JOIN news_items n ON n.id = gjn.news_id
     WHERE gjn.job_id = ?
     ORDER BY gjn.position ASC`,
    [jobId]
  );

export const getJobDebates = async (jobId) =>
  query(
    `SELECT
       id,
       generation_job_id,
       news_item_id,
       title,
       question,
       card_summary,
       context AS debate_context,
       category,
       source_name,
       source_url,
       published_at,
       created_at
     FROM debates
     WHERE generation_job_id = ?
     ORDER BY created_at ASC, id ASC`,
    [jobId]
  );

export const createGenerationJob = async ({
  importId,
  requestedNewsCount,
  targetDebates,
  promptFilePath,
  resultFilePath,
  newsItems,
  markAssigned = true
}) => {
  const connection = await getConnection();
  const jobId = crypto.randomUUID();

  try {
    await connection.beginTransaction();

    await connection.query(
      `INSERT INTO generation_jobs (
         id,
         source_import_id,
         status,
         requested_news_count,
         selected_news_count,
         target_debates,
         prompt_file_path,
         result_file_path
       ) VALUES (?, ?, 'awaiting-output', ?, ?, ?, ?, ?)`,
      [
        jobId,
        importId,
        requestedNewsCount,
        newsItems.length,
        targetDebates,
        promptFilePath,
        resultFilePath
      ]
    );

    for (const [index, item] of newsItems.entries()) {
      await connection.query(
        `INSERT INTO generation_job_news (job_id, news_id, position)
         VALUES (?, ?, ?)`,
        [jobId, item.id, index + 1]
      );

      if (markAssigned) {
        await connection.query(
          `UPDATE news_items
           SET assigned_generation_job_id = ?
           WHERE id = ?`,
          [jobId, item.id]
        );
      }
    }

    await connection.commit();
    return { jobId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const createJobPaths = (jobId) => ({
  promptFilePath: path.join(inboxDir, `${jobId}.json`),
  resultFilePath: path.join(outboxDir, `${jobId}.result.json`)
});

export const writePromptFile = async ({ jobId, targetDebates, candidateDebates, newsItems }) => {
  await ensureDirectoryStructure();
  const { promptFilePath, resultFilePath } = createJobPaths(jobId);
  const envelope = buildPromptContract({
    jobId,
    targetDebates,
    candidateDebates,
    newsItems,
    resultFilePath
  });

  await fs.writeFile(promptFilePath, JSON.stringify(envelope, null, 2));

  return { promptFilePath, resultFilePath };
};

export const readResultFile = async (jobId) => {
  const { resultFilePath } = createJobPaths(jobId);
  const resultText = await fs.readFile(resultFilePath, "utf8");
  return {
    resultFilePath,
    resultText,
    resultPayload: JSON.parse(resultText)
  };
};

export const updateJobFilePaths = async ({ jobId, promptFilePath, resultFilePath }) => {
  await query(
    `UPDATE generation_jobs
     SET prompt_file_path = ?, result_file_path = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [promptFilePath, resultFilePath, jobId]
  );
};

export const markJobFailed = async (jobId, errorMessage) => {
  await query(
    `UPDATE generation_jobs
     SET status = 'failed',
         error_message = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [errorMessage, jobId]
  );
};

export const markJobApplied = async ({ jobId, resultFilePath }) => {
  await query(
    `UPDATE generation_jobs
     SET status = 'applied',
         applied_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP,
         error_message = NULL,
         meta = JSON_OBJECT('resultFilePath', ?)
     WHERE id = ?`,
    [resultFilePath, jobId]
  );
};

export const listLatestGeneratedDebates = async (limit = 10) =>
  query(
    `SELECT
       id,
       generation_job_id,
       news_item_id,
       title,
       question,
       card_summary,
       context AS debate_context,
       category,
       source_name,
       source_url,
       published_at,
       created_at
     FROM debates
     WHERE generation_job_id IS NOT NULL
     ORDER BY created_at DESC
     LIMIT ?`,
    [Number(limit)]
  );

export const createGenerationJobResponse = async ({
  importId,
  requestedNewsCount,
  targetDebates,
  requestedCandidateDebates,
  newsItems,
  markAssigned = true
}) => {
  const candidateDebates = Math.max(
    Number(targetDebates),
    Math.min(Number(requestedCandidateDebates), newsItems.length)
  );

  const previewPaths = createJobPaths(crypto.randomUUID());
  const created = await createGenerationJob({
    importId,
    requestedNewsCount,
    targetDebates,
    promptFilePath: previewPaths.promptFilePath,
    resultFilePath: previewPaths.resultFilePath,
    newsItems,
    markAssigned
  });
  const filePaths = await writePromptFile({
    jobId: created.jobId,
    targetDebates,
    candidateDebates,
    newsItems
  });

  await updateJobFilePaths({
    jobId: created.jobId,
    promptFilePath: filePaths.promptFilePath,
    resultFilePath: filePaths.resultFilePath
  });

  return {
    jobId: created.jobId,
    status: "awaiting-output",
    promptFilePath: filePaths.promptFilePath,
    resultFilePath: filePaths.resultFilePath,
    selectedNewsCount: newsItems.length,
    candidateDebates,
    targetDebates,
    nextStep:
      "Si el worker opencode esta activo procesara el job automaticamente. Si no, genera el JSON final y llama a POST /generation/jobs/:jobId/complete"
  };
};

export { DEBATE_ALLOWED_CATEGORIES, sharedDir, inboxDir, outboxDir };
