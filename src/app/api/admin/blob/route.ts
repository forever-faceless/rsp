import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { blobEnabled, MAX_VIDEO_BYTES, VIDEO_TYPES } from "@/lib/storage";

/**
 * Issues a short-lived token that lets a signed-in admin upload one video straight from
 * the browser to Vercel Blob. Serverless functions cap request bodies at a few megabytes,
 * so large files cannot pass through the server itself.
 */
export async function POST(request: NextRequest) {
  if (!blobEnabled()) return Response.json({ error: "No blob store is connected." }, { status: 400 });
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        // The completion callback comes from Vercel without a cookie; only token requests need a session.
        if (!(await getSession())) throw new Error("Not signed in.");
        if (!pathname.startsWith("rsp-ventures/videos/")) throw new Error("Unexpected upload path.");
        return {
          allowedContentTypes: Object.keys(VIDEO_TYPES),
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // The browser attaches the video to its listing once the upload returns.
      },
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Upload could not be authorised." }, { status: 400 });
  }
}
