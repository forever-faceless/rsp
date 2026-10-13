import type { NextRequest } from "next/server";
import { pollComments, refreshTokenIfDue } from "@/lib/instagram/jobs";
import { publishDue } from "@/lib/instagram/posts";
import { remindAboutPrice } from "@/lib/instagram/process";
import { saveIgSettings } from "@/lib/instagram/store";

// Putting a post up can take Instagram a good few seconds.
export const maxDuration = 120;

/**
 * Run every minute by Vercel: puts up the posts whose time has come, looks for new comments
 * to answer, sends the one reminder to someone who asked the price and went quiet, and renews
 * the Instagram token before it runs out. Vercel sends CRON_SECRET with
 * the call; without it, or for anyone else, this does nothing.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const out = { posts: { started: 0, published: 0, failed: 0 }, comments: 0, reminded: 0, refreshed: false, error: "" };
  const note = (error: unknown) => {
    out.error = error instanceof Error ? error.message : "failed";
    console.error("instagram cron", error);
  };
  // Each job stands alone: trouble with one must not hold up the others.
  await saveIgSettings({ lastCronAt: new Date() }).catch(note);
  try {
    out.posts = await publishDue();
  } catch (error) {
    note(error);
  }
  try {
    out.comments = await pollComments();
    out.refreshed = await refreshTokenIfDue();
  } catch (error) {
    note(error);
  }
  try {
    out.reminded = await remindAboutPrice();
  } catch (error) {
    note(error);
  }
  return Response.json(out);
}
