import {
  getPublicUserById,
  getPublicUserByUsername,
  searchPublicUsers,
  getTopUsers,
  getUserById,
  updateUserProfile,
  updateUserAvatar
} from "../services/users.service.js";
import { getAvatarPublicPath } from "../middleware/upload.middleware.js";

const parseTraits = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

const toSafeUser = (user) => ({
  id: Number(user.id),
  username: user.username,
  email: user.email,
  bio: user.bio || "",
  avatarUrl: user.avatar_url || "",
  location: user.location || "",
  profileTagline: user.profile_tagline || "",
  profileTraits: parseTraits(user.profile_traits_json),
  reliabilityScore: Number(user.reliability_score || 0),
  role: user.role || "user",
  status: user.status || "active",
  isAdmin: (user.role || "user") === "admin",
  createdAt: user.created_at,
  updatedAt: user.updated_at
});

const toPublicUser = (user) => ({
  id: Number(user.id),
  username: user.username,
  bio: user.bio || "",
  avatarUrl: user.avatar_url || "",
  location: user.location || "",
  profileTagline: user.profile_tagline || "",
  profileTraits: parseTraits(user.profile_traits_json),
  reliabilityScore: Number(user.reliability_score || 0),
  createdAt: user.created_at,
  updatedAt: user.updated_at
});

export async function getMeController(req, res, next) {
  try {
    const user = await getUserById(req.auth.userId);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    res.json(toSafeUser(user));
  } catch (error) {
    next(error);
  }
}

export async function updateMeController(req, res, next) {
  try {
    const { bio = "", avatarUrl = "", location = "", profileTagline = "", profileTraits = [] } = req.body;
    if (typeof bio !== "string" || bio.length > 280) {
      return res.status(400).json({ error: "bio debe ser texto de máximo 280 caracteres." });
    }
    if (typeof avatarUrl !== "string" || avatarUrl.length > 255) {
      return res.status(400).json({ error: "avatarUrl no válido." });
    }
    if (typeof location !== "string" || location.length > 120) {
      return res.status(400).json({ error: "location no válida." });
    }
    if (typeof profileTagline !== "string" || profileTagline.length > 160) {
      return res.status(400).json({ error: "profileTagline debe ser texto de máximo 160 caracteres." });
    }
    if (!Array.isArray(profileTraits) || profileTraits.some((item) => typeof item !== "string" || item.length > 40)) {
      return res.status(400).json({ error: "profileTraits debe ser una lista de textos cortos." });
    }

    const user = await updateUserProfile(req.auth.userId, {
      bio: bio.trim(),
      avatarUrl: avatarUrl.trim(),
      location: location.trim(),
      profileTagline: profileTagline.trim(),
      profileTraits: profileTraits.map((item) => item.trim()).filter(Boolean).slice(0, 8)
    });

    res.json(toSafeUser(user));
  } catch (error) {
    next(error);
  }
}

export async function uploadMyAvatarController(req, res, next) {
  try {
    if (!req.file?.filename) {
      return res.status(400).json({ error: "Debes seleccionar una imagen." });
    }

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const avatarUrl = `${baseUrl}${getAvatarPublicPath(req.file.filename)}`;
    const user = await updateUserAvatar(req.auth.userId, avatarUrl);
    res.json(toSafeUser(user));
  } catch (error) {
    next(error);
  }
}

export async function getUserByIdController(req, res, next) {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: "id de usuario no válido." });
    }

    const user = await getPublicUserById(userId);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    res.json(toPublicUser(user));
  } catch (error) {
    next(error);
  }
}

export async function getUserByUsernameController(req, res, next) {
  try {
    const username = String(req.params.username || "").trim().toLowerCase();
    if (!username) {
      return res.status(400).json({ error: "username no válido." });
    }

    const user = await getPublicUserByUsername(username);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    res.json(toPublicUser(user));
  } catch (error) {
    next(error);
  }
}

export async function getTopUsersController(req, res, next) {
  try {
    const limit = Number(req.query.limit || 6);
    const users = await getTopUsers(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 20) : 6);
    res.json(users.map(toPublicUser));
  } catch (error) {
    next(error);
  }
}

export async function searchUsersController(req, res, next) {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Number(req.query.limit || 20);
    const page = Number(req.query.page || 1);
    const result = await searchPublicUsers({
      q,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50) : 20,
      page: Number.isFinite(page) ? Math.max(page, 1) : 1
    });
    res.json({
      ...result,
      items: result.items.map(toPublicUser)
    });
  } catch (error) {
    next(error);
  }
}
