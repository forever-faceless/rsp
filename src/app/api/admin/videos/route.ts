import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { blobEnabled, MAX_VIDEO_BYTES, saveVideoStream, UploadError, VIDEO_TYPES } from "@/lib/storage";

export const maxDuration = 300;

/** Tells the uploader where videos go, so it can pick the right way to send them. */
export async function GET() {
  if (!(await getSession())) return Response.json({ error: "Not signed in." }, { status: 401 });
  return Response.json({ mode: blobEnabled() ? "blob" : "disk", maxBytes: MAX_VIDEO_BYTES, types: Object.keys(VIDEO_TYPES) });
}

/**
 * Receives a video as the raw request body and writes it to disk as it arrives.
 * Used when the site runs on its own server; with a blob store the browser uploads directly.
 */
export async function POST(request: NextRequest) {
  if (!(await getSession())) return Response.json({ error: "Not signed in." }, { status: 401 });
  // Same-origin only: the session cookie alone must not be enough for another site to post here.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return Response.json({ error: "Forbidden." }, { status: 403 });
  if (blobEnabled()) return Response.json({ error: "This server stores videos in the blob store." }, { status: 400 });

  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_VIDEO_BYTES) return Response.json({ error: "Video is larger than 300 MB." }, { status: 413 });
  if (!request.body) return Response.json({ error: "Empty upload." }, { status: 400 });

  try {
    const url = await saveVideoStream(request.body, type);
    return Response.json({ url });
  } catch (error) {
    if (error instanceof UploadError) return Response.json({ error: error.message }, { status: 400 });
    console.error("video upload failed", error);
    return Response.json({ error: "The upload failed. Please try again." }, { status: 500 });
  }
}
