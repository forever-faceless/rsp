import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { resolveUploadPath } from "@/lib/storage";

const types: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
};

function stream(abs: string, start?: number, end?: number): ReadableStream<Uint8Array> {
  return Readable.toWeb(createReadStream(abs, start == null ? undefined : { start, end })) as unknown as ReadableStream<Uint8Array>;
}

/**
 * Serves files uploaded through the admin panel when local disk storage is used.
 * Byte ranges are honoured, which is what lets a browser seek inside a video.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/uploads/[...path]">) {
  const { path: segments } = await ctx.params;
  const abs = resolveUploadPath(segments);
  if (!abs) return new Response("Not found", { status: 404 });
  const type = types[path.extname(abs).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });

  let size: number;
  try {
    const info = await stat(abs);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    size = info.size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const common = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  };

  const range = request.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match && (match[1] || match[2])) {
    let start: number;
    let end: number;
    if (match[1] === "") {
      // "bytes=-500" asks for the last 500 bytes.
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    }
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(stream(abs, start, end), {
      status: 206,
      headers: { ...common, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  return new Response(stream(abs), { headers: { ...common, "Content-Length": String(size) } });
}
