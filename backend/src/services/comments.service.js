import { query } from "../database/db.js";
import { logActivity } from "./activity.service.js";

export async function ensureCommentVotingSchema() {
  await query(`
    ALTER TABLE votes
    ADD COLUMN value TINYINT NOT NULL DEFAULT 1
  `).catch(() => {});

  await query(`
    UPDATE votes
    SET value = CASE
      WHEN value IS NULL OR value = 0 THEN 1
      ELSE value
    END
  `).catch(() => {});
}

export async function getCommentsByDebateId(debateId, currentUserId = null) {
  const rows = await query(
    `
      SELECT
        c.id,
        c.debate_id,
        c.user_id,
        c.parent_id,
        c.content,
        c.created_at,
        c.score,
        u.username,
        COALESCE(vt.upvotes, 0) AS upvotes,
        COALESCE(vt.downvotes, 0) AS downvotes,
        v.value AS current_user_vote
      FROM comments c
      INNER JOIN users u ON u.id = c.user_id
      LEFT JOIN (
        SELECT
          comment_id,
          SUM(CASE WHEN value > 0 THEN 1 ELSE 0 END) AS upvotes,
          SUM(CASE WHEN value < 0 THEN 1 ELSE 0 END) AS downvotes
        FROM votes
        GROUP BY comment_id
      ) vt ON vt.comment_id = c.id
      LEFT JOIN votes v ON v.comment_id = c.id AND v.user_id = ?
      WHERE c.debate_id = ?
      ORDER BY c.created_at ASC
    `,
    [currentUserId || null, debateId]
  );

  return rows.map((row) => ({
    id: Number(row.id),
    debateId: Number(row.debate_id),
    userId: Number(row.user_id),
    username: row.username,
    parentId: row.parent_id ? Number(row.parent_id) : null,
    content: row.content,
    createdAt: row.created_at,
    score: Number(row.score),
    upvotes: Number(row.upvotes || 0),
    downvotes: Number(row.downvotes || 0),
    currentUserVote: row.current_user_vote === null ? 0 : Number(row.current_user_vote)
  }));
}

export async function createComment({ debateId, userId, parentId, content }) {
  const result = await query(
    `
      INSERT INTO comments (debate_id, user_id, parent_id, content)
      VALUES (?, ?, ?, ?)
    `,
    [debateId, userId, parentId || null, content]
  );

  const insertedId = Number(result.insertId);
  const createdComment = await getCommentDetailById(insertedId, userId);

  await logActivity({
    userId,
    activityType: parentId ? "comment_replied" : "comment_created",
    entityType: "comment",
    entityId: insertedId,
    debateId,
    commentId: insertedId,
    metadata: {
      parentId: parentId || null
    }
  });

  return createdComment;
}

export async function getCommentById(commentId) {
  const rows = await query(
    `
      SELECT id, debate_id, user_id, parent_id, content, created_at, score
      FROM comments
      WHERE id = ?
      LIMIT 1
    `,
    [commentId]
  );
  return rows[0] || null;
}

export async function getCommentDetailById(commentId, currentUserId = null) {
  const rows = await query(
    `
      SELECT
        c.id,
        c.debate_id,
        c.user_id,
        c.parent_id,
        c.content,
        c.created_at,
        c.score,
        u.username,
        COALESCE(vt.upvotes, 0) AS upvotes,
        COALESCE(vt.downvotes, 0) AS downvotes,
        v.value AS current_user_vote
      FROM comments c
      INNER JOIN users u ON u.id = c.user_id
      LEFT JOIN (
        SELECT
          comment_id,
          SUM(CASE WHEN value > 0 THEN 1 ELSE 0 END) AS upvotes,
          SUM(CASE WHEN value < 0 THEN 1 ELSE 0 END) AS downvotes
        FROM votes
        GROUP BY comment_id
      ) vt ON vt.comment_id = c.id
      LEFT JOIN votes v ON v.comment_id = c.id AND v.user_id = ?
      WHERE c.id = ?
      LIMIT 1
    `,
    [currentUserId || null, commentId]
  );

  const row = rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    debateId: Number(row.debate_id),
    userId: Number(row.user_id),
    username: row.username,
    parentId: row.parent_id ? Number(row.parent_id) : null,
    content: row.content,
    createdAt: row.created_at,
    score: Number(row.score),
    upvotes: Number(row.upvotes || 0),
    downvotes: Number(row.downvotes || 0),
    currentUserVote: row.current_user_vote === null ? 0 : Number(row.current_user_vote)
  };
}

async function getExistingVote(commentId, userId) {
  const rows = await query(
    `
      SELECT id, value
      FROM votes
      WHERE comment_id = ? AND user_id = ?
      LIMIT 1
    `,
    [commentId, userId]
  );
  return rows[0] || null;
}

export async function voteComment({ commentId, userId, value }) {
  const comment = await getCommentById(commentId);
  if (!comment) {
    const err = new Error("Comentario no encontrado.");
    err.code = "COMMENT_NOT_FOUND";
    throw err;
  }
  if (Number(comment.user_id) === Number(userId)) {
    const err = new Error("No puedes votar tu propio comentario.");
    err.code = "OWN_COMMENT";
    throw err;
  }

  const normalizedValue = Number(value) < 0 ? -1 : 1;
  const existingVote = await getExistingVote(commentId, userId);
  const previousValue = existingVote ? Number(existingVote.value || 0) : 0;
  const delta = normalizedValue - previousValue;

  if (existingVote && previousValue === normalizedValue) {
    const err = new Error("Ya votaste este comentario.");
    err.code = "ALREADY_VOTED";
    throw err;
  }

  if (existingVote) {
    await query(
      `
        UPDATE votes
        SET value = ?, created_at = NOW()
        WHERE id = ?
      `,
      [normalizedValue, Number(existingVote.id)]
    );
  } else {
    await query(
      `
        INSERT INTO votes (user_id, comment_id, value)
        VALUES (?, ?, ?)
      `,
      [userId, commentId, normalizedValue]
    );
  }

  await query(
    `
      UPDATE comments
      SET score = score + ?
      WHERE id = ?
    `,
    [delta, commentId]
  );

  await query(
    `
      UPDATE users
      SET reliability_score = reliability_score + ?
      WHERE id = ?
    `,
    [delta, Number(comment.user_id)]
  );

  const updated = await getCommentDetailById(commentId, userId);

  await logActivity({
    userId,
    activityType: "comment_voted",
    entityType: "comment",
    entityId: commentId,
    debateId: Number(comment.debate_id),
    commentId,
    metadata: {
      value: normalizedValue,
      previousValue
    }
  });

  return updated;
}
