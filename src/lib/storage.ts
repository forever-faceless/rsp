import "server-only";
import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import sharp from "sharp";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_DOC_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic"]);

export const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};

export const UPLOAD_ROUTE_PREFIX = "/uploads/";
/** Folder prefix inside a shared blob store, so files from different sites never mix. */
const BLOB_NAMESPACE = "rsp-ventures";

export function uploadDir(): string {
  const configured = process.env.UPLOAD_DIR?.trim() || "./data/uploads";
  // The folder comes from configuration, so the bundler is told not to trace it.
  return path.isAbsolute(configured) ? configured : path.join(/*turbopackIgnore: true*/ process.cwd(), configured);
}

/** Vercel Blob is used when its token is present (set automatically when a Blob store is connected). */
export function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function blobPath(folder: string, filename: string): string {
  return `${BLOB_NAMESPACE}/${safeFolder(folder)}/${filename}`;
}

/** Serverless hosts have no persistent disk, so uploads there must go to a blob store. */
function assertStorageConfigured(): void {
  const serverless = process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (serverless && !blobEnabled()) {
    throw new UploadError("File storage is not configured on this host. Connect a Vercel Blob store, then redeploy.");
  }
}

async function putBlob(pathname: string, data: Buffer, contentType: string): Promise<string> {
  const { put } = await import("@vercel/blob");
  const blob = await put(pathname, data, { access: "public", contentType, addRandomSuffix: false });
  return blob.url;
}

function safeFolder(folder: string): string {
  return folder.replace(/[^a-z0-9_-]/gi, "").toLowerCase() || "misc";
}

export class UploadError extends Error {}

/**
 * Resizes and converts an uploaded image to WebP, then stores it on Vercel Blob
 * (when configured) or on local disk. Returns a URL usable in <Image>.
 */
export async function saveImage(file: File, folder: string): Promise<string> {
  assertStorageConfigured();
  if (!file || file.size === 0) throw new UploadError("Empty file.");
  if (file.size > MAX_IMAGE_BYTES) throw new UploadError("Image is larger than 15 MB.");
  if (file.type && !IMAGE_TYPES.has(file.type)) throw new UploadError(`Unsupported image type: ${file.type}`);

  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  try {
    output = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new UploadError("Could not read the image. Please upload a JPG, PNG or WebP file.");
  }

  const id = crypto.randomUUID();
  const dir = safeFolder(folder);

  if (blobEnabled()) return putBlob(blobPath(dir, `${id}.webp`), output, "image/webp");

  const target = path.join(/*turbopackIgnore: true*/ uploadDir(), dir);
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ target, `${id}.webp`), output);
  return `${UPLOAD_ROUTE_PREFIX}${dir}/${id}.webp`;
}

/** Stores a PDF brochure. */
export async function saveDocument(file: File, folder: string): Promise<string> {
  assertStorageConfigured();
  if (!file || file.size === 0) throw new UploadError("Empty file.");
  if (file.size > MAX_DOC_BYTES) throw new UploadError("File is larger than 25 MB.");
  if (file.type !== "application/pdf") throw new UploadError("Only PDF brochures are supported.");
  const data = Buffer.from(await file.arrayBuffer());
  const id = crypto.randomUUID();
  const dir = safeFolder(folder);

  if (blobEnabled()) return putBlob(blobPath(dir, `${id}.pdf`), data, "application/pdf");

  const target = path.join(/*turbopackIgnore: true*/ uploadDir(), dir);
  await fs.mkdir(target, { recursive: true });
  await fs.writeFile(path.join(/*turbopackIgnore: true*/ target, `${id}.pdf`), data);
  return `${UPLOAD_ROUTE_PREFIX}${dir}/${id}.pdf`;
}

/**
 * Streams a video straight to local disk without holding it in memory.
 * Only used when no blob store is configured; with Vercel Blob the browser uploads directly.
 */
export async function saveVideoStream(body: ReadableStream<Uint8Array>, contentType: string): Promise<string> {
  assertStorageConfigured();
  const ext = VIDEO_TYPES[contentType];
  if (!ext) throw new UploadError("Unsupported video type. Use MP4, MOV or WebM.");
  const dir = "videos";
  const target = path.join(/*turbopackIgnore: true*/ uploadDir(), dir);
  await fs.mkdir(target, { recursive: true });
  const name = `${crypto.randomUUID()}${ext}`;
  const abs = path.join(/*turbopackIgnore: true*/ target, name);

  let received = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > MAX_VIDEO_BYTES) callback(new UploadError("Video is larger than 300 MB."));
      else callback(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(body as unknown as NodeWebStream<Uint8Array>), limiter, createWriteStream(abs));
  } catch (error) {
    await fs.rm(abs, { force: true });
    if (error instanceof UploadError) throw error;
    throw new UploadError("The upload was interrupted. Please try again.");
  }
  if (received === 0) {
    await fs.rm(abs, { force: true });
    throw new UploadError("Empty file.");
  }
  return `${UPLOAD_ROUTE_PREFIX}${dir}/${name}`;
}

/** True for addresses this app stored itself, as opposed to arbitrary external links. */
export function isStoredUrl(url: string): boolean {
  return url.startsWith(UPLOAD_ROUTE_PREFIX) || /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url);
}

/** Best-effort removal of a previously stored file. Never throws. */
export async function deleteStored(url: string): Promise<void> {
  try {
    if (!url) return;
    if (url.startsWith(UPLOAD_ROUTE_PREFIX)) {
      const abs = resolveUploadPath(url.slice(UPLOAD_ROUTE_PREFIX.length).split("/"));
      if (abs) await fs.rm(abs, { force: true });
      return;
    }
    if (url.includes(".blob.vercel-storage.com") && blobEnabled()) {
      const { del } = await import("@vercel/blob");
      await del(url);
    }
  } catch {
    // ignore
  }
}

/** Resolves a /uploads/... request path to an absolute file inside the upload dir, or null. */
export function resolveUploadPath(segments: string[]): string | null {
  const root = path.resolve(uploadDir());
  const rel = segments.join("/");
  if (!rel || rel.includes("..") || rel.includes("\0")) return null;
  const abs = path.resolve(/*turbopackIgnore: true*/ root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) return null;
  return abs;
}
