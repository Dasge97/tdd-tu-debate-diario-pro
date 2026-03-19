import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../database/db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

export async function findUserByEmail(email) {
  const rows = await query(
    `
      SELECT id, username, email, password_hash, bio, avatar_url, location, reliability_score, role, status, created_at, updated_at
           , profile_tagline, profile_traits_json
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email]
  );
  return rows[0] || null;
}

export async function findUserByUsername(username) {
  const rows = await query(
    `
      SELECT id, username
      FROM users
      WHERE username = ?
      LIMIT 1
    `,
    [username]
  );
  return rows[0] || null;
}

export async function createUser({ username, email, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    `
      INSERT INTO users (username, email, password_hash, reliability_score, role, status)
      VALUES (?, ?, ?, 0, 'user', 'active')
    `,
    [username, email, passwordHash]
  );

  const rows = await query(
    `
      SELECT id, username, email, bio, avatar_url, location, reliability_score, role, status, profile_tagline, profile_traits_json, created_at, updated_at
      FROM users
      WHERE id = ?
    `,
    [Number(result.insertId)]
  );
  return rows[0];
}

export async function findUserById(userId) {
  const rows = await query(
    `
      SELECT id, username, email, bio, avatar_url, location, reliability_score, role, status, profile_tagline, profile_traits_json, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId]
  );
  return rows[0] || null;
}

export async function verifyPassword(plainTextPassword, passwordHash) {
  return bcrypt.compare(plainTextPassword, passwordHash);
}

export function createAuthToken(userId) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({}, JWT_SECRET, {
    subject: String(userId),
    expiresIn: JWT_EXPIRES_IN,
    jwtid: jti
  });
  return { token, jti };
}

export async function revokeToken({ jti, exp }) {
  if (!jti || !exp) return;
  const expiresAt = new Date(exp * 1000);
  await query(
    `
      INSERT INTO revoked_tokens (token_jti, expires_at)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)
    `,
    [jti, expiresAt]
  );
}

export async function isTokenRevoked(jti) {
  if (!jti) return false;
  const rows = await query(
    `
      SELECT id
      FROM revoked_tokens
      WHERE token_jti = ?
      LIMIT 1
    `,
    [jti]
  );
  return rows.length > 0;
}
