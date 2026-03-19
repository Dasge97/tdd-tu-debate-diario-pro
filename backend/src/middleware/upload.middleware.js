import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, "../../uploads/avatars");

fs.mkdirSync(uploadsRoot, { recursive: true });

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsRoot);
  },
  filename: (req, file, cb) => {
    const extension = file.mimetype === "image/png" ? ".png" : file.mimetype === "image/webp" ? ".webp" : ".jpg";
    const safeUserId = Number(req.auth?.userId || 0);
    const stamp = Date.now();
    cb(null, `avatar-${safeUserId}-${stamp}${extension}`);
  }
});

function fileFilter(_req, file, cb) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    cb(new Error("Solo se permiten imágenes JPG, PNG o WEBP."));
    return;
  }
  cb(null, true);
}

export const avatarUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

export function getAvatarPublicPath(filename) {
  return `/uploads/avatars/${filename}`;
}
