import { query } from "../database/db.js";

export async function findFriendRelation(userA, userB) {
  const rows = await query(
    `
      SELECT id, requester_id, addressee_id, status, created_at, responded_at
      FROM friends
      WHERE (requester_id = ? AND addressee_id = ?)
         OR (requester_id = ? AND addressee_id = ?)
      LIMIT 1
    `,
    [userA, userB, userB, userA]
  );
  return rows[0] || null;
}

export async function sendFriendRequest(requesterId, addresseeId) {
  await query(
    `
      INSERT INTO friends (requester_id, addressee_id, status)
      VALUES (?, ?, 'pending')
    `,
    [requesterId, addresseeId]
  );
  return findFriendRelation(requesterId, addresseeId);
}

export async function updateFriendRequestStatus(requesterId, addresseeId, status) {
  await query(
    `
      UPDATE friends
      SET status = ?, responded_at = NOW()
      WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'
    `,
    [status, requesterId, addresseeId]
  );

  return findFriendRelation(requesterId, addresseeId);
}

export async function deleteFriendRelation(userA, userB) {
  await query(
    `
      DELETE FROM friends
      WHERE (requester_id = ? AND addressee_id = ?)
         OR (requester_id = ? AND addressee_id = ?)
    `,
    [userA, userB, userB, userA]
  );
}

export async function listFriends(userId) {
  const rows = await query(
    `
      SELECT
        u.id,
        u.username,
        u.bio,
        u.avatar_url,
        u.location,
        u.reliability_score,
        f.created_at AS since
      FROM friends f
      INNER JOIN users u ON u.id = CASE
        WHEN f.requester_id = ? THEN f.addressee_id
        ELSE f.requester_id
      END
      WHERE (f.requester_id = ? OR f.addressee_id = ?)
        AND f.status = 'accepted'
      ORDER BY u.username ASC
    `,
    [userId, userId, userId]
  );

  return rows;
}

export async function listPendingRequests(userId) {
  const rows = await query(
    `
      SELECT
        f.id,
        f.requester_id,
        f.addressee_id,
        f.status,
        f.created_at,
        u.id AS user_id,
        u.username,
        u.bio,
        u.avatar_url,
        u.location,
        u.reliability_score
      FROM friends f
      INNER JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = ?
        AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `,
    [userId]
  );

  return rows;
}

export async function listFriendIds(userId) {
  const rows = await query(
    `
      SELECT
        CASE
          WHEN requester_id = ? THEN addressee_id
          ELSE requester_id
        END AS friend_id
      FROM friends
      WHERE status = 'accepted'
        AND (requester_id = ? OR addressee_id = ?)
    `,
    [userId, userId, userId]
  );
  return rows.map((row) => Number(row.friend_id));
}
