import jwt from "jsonwebtoken";
import { isTokenRevoked } from "../services/auth.service.js";
import { findUserById } from "../services/auth.service.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
const parseBearer = (authorization = "") => {
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
};

export async function requireAuth(req, res, next) {
  try {
    const token = parseBearer(req.headers.authorization || "");
    if (!token) {
      return res.status(401).json({ error: "Token no proporcionado." });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const revoked = await isTokenRevoked(payload.jti);
    if (revoked) {
      return res.status(401).json({ error: "Token revocado." });
    }

    const user = await findUserById(Number(payload.sub));
    if (!user) {
      return res.status(401).json({ error: "Usuario no encontrado." });
    }
    if (user.status === "suspended") {
      return res.status(403).json({ error: "Cuenta suspendida." });
    }

    req.auth = {
      token,
      userId: Number(payload.sub),
      jti: payload.jti,
      exp: payload.exp,
      role: user.role || "user",
      status: user.status || "active"
    };

    next();
  } catch (_error) {
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const token = parseBearer(req.headers.authorization || "");
    if (!token) {
      req.auth = null;
      return next();
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const revoked = await isTokenRevoked(payload.jti);
    if (revoked) {
      req.auth = null;
      return next();
    }

    const user = await findUserById(Number(payload.sub));
    if (!user || user.status === "suspended") {
      req.auth = null;
      return next();
    }

    req.auth = {
      token,
      userId: Number(payload.sub),
      jti: payload.jti,
      exp: payload.exp,
      role: user.role || "user",
      status: user.status || "active"
    };
    return next();
  } catch (_error) {
    req.auth = null;
    return next();
  }
}

export async function requireAdmin(req, res, next) {
  return requireAuth(req, res, async () => {
    if (req.auth?.role !== "admin") {
      return res.status(403).json({ error: "Acceso restringido a administradores." });
    }
    return next();
  });
}
