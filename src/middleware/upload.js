// Single-file multipart upload (field name "file") with size and type limits.
import multer from 'multer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { newStorageKey, uploadDir } from '../storage/localStorage.js';

// Documents and images people typically attach to tasks. Anything that a browser could
// execute (HTML, SVG, JS) is deliberately left out.
export const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

/** Browsers send file names as UTF-8, but busboy decodes them as latin1. */
function decodeName(name) {
  return Buffer.from(name, 'latin1').toString('utf8');
}

const uploader = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      file.originalname = decodeName(file.originalname);
      cb(null, newStorageKey(file.originalname));
    },
  }),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
    return cb(ApiError.unsupportedMediaType(`Files of type ${file.mimetype} are not allowed`));
  },
}).single('file');

/** Runs multer and turns its errors into our standard API errors. */
export function uploadSingleFile(req, res, next) {
  uploader(req, res, (err) => {
    if (!err) {
      if (!req.file) return next(ApiError.badRequest('Attach a file in the "file" form field'));
      return next();
    }
    if (err instanceof ApiError) return next(err);
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.payloadTooLarge(`Files can be at most ${env.MAX_UPLOAD_MB} MB`));
      }
      return next(ApiError.badRequest(`Upload rejected: ${err.message}`));
    }
    return next(err);
  });
}
