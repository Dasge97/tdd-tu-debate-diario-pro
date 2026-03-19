import {
  createAuthToken,
  createUser,
  findUserByEmail,
  findUserByUsername,
  revokeToken,
  verifyPassword
} from "../services/auth.service.js";

const toSafeUser = (user) => ({
  id: Number(user.id),
  username: user.username,
  email: user.email,
  bio: user.bio || "",
  avatarUrl: user.avatar_url || "",
  location: user.location || "",
  profileTagline: user.profile_tagline || "",
  profileTraits: (() => {
    if (!user.profile_traits_json) return [];
    if (Array.isArray(user.profile_traits_json)) return user.profile_traits_json;
    try {
      const parsed = JSON.parse(user.profile_traits_json);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  })(),
  reliabilityScore: Number(user.reliability_score || 0),
  role: user.role || "user",
  status: user.status || "active",
  isAdmin: (user.role || "user") === "admin",
  createdAt: user.created_at,
  updatedAt: user.updated_at
});

export async function registerController(req, res, next) {
  try {
    const { username, email, password } = req.body;
    if (typeof username !== "string" || username.trim().length < 3) {
      return res.status(400).json({ error: "username debe tener al menos 3 caracteres." });
    }
    if (typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "email no válido." });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "password debe tener al menos 6 caracteres." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const existingByEmail = await findUserByEmail(normalizedEmail);
    if (existingByEmail) {
      return res.status(409).json({ error: "El email ya está registrado." });
    }
    const existingByUsername = await findUserByUsername(normalizedUsername);
    if (existingByUsername) {
      return res.status(409).json({ error: "El username ya está en uso." });
    }

    const user = await createUser({
      username: normalizedUsername,
      email: normalizedEmail,
      password
    });
    const { token } = createAuthToken(user.id);

    res.status(201).json({
      user: toSafeUser(user),
      token
    });
  } catch (error) {
    next(error);
  }
}

export async function loginController(req, res, next) {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "email y password son obligatorios." });
    }

    const user = await findUserByEmail(email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }

    const passwordOk = await verifyPassword(password, user.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: "Credenciales inválidas." });
    }
    if (user.status === "suspended") {
      return res.status(403).json({ error: "Tu cuenta está suspendida." });
    }

    const { token } = createAuthToken(user.id);
    res.json({
      user: toSafeUser(user),
      token
    });
  } catch (error) {
    next(error);
  }
}

export async function logoutController(req, res, next) {
  try {
    await revokeToken({ jti: req.auth.jti, exp: req.auth.exp });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
