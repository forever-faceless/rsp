import type { NextRequest } from "next/server";
import { pollComments, refreshTokenIfDue } from "@/lib/instagram/jobs";

/**
 * Run every minute by Vercel: looks for new comments to answer, and renews the Instagram
 * token before it runs out. Vercel sends CRON_SECRET with the call; without it, or for
 * anyone else, this does nothing.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const out = { comments: 0, refreshed: false, error: "" };
  try {
    out.comments = await pollComments();
    out.refreshed = await refreshTokenIfDue();
  } catch (error) {
    out.error = error instanceof Error ? error.message : "failed";
    console.error("instagram cron", error);
  }
  return Response.json(out);
}
