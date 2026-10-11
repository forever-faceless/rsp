import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { handleWebhook } from "@/lib/instagram/process";

/**
 * Where Instagram tells the site about messages and comments.
 *
 * GET is Meta's one-time check that this address belongs to the app: it sends a challenge and
 * the word agreed at set-up, and gets the challenge back. POST carries the events, signed with
 * the app's secret; anything not signed with it is refused, so nobody else can post here.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const word = process.env.IG_VERIFY_TOKEN?.trim();
  if (word && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === word) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const secret = process.env.IG_APP_SECRET?.trim();
  if (!secret) return new Response("Not set up", { status: 503 });
  const raw = await request.text();
  const given = request.headers.get("x-hub-signature-256") ?? "";
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(raw).digest("hex")}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return new Response("Bad signature", { status: 401 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  try {
    await handleWebhook(body);
  } catch (error) {
    // Answer 200 all the same: a failure here is ours to fix, and Meta would only resend the same event.
    console.error("instagram webhook", error);
  }
  return new Response("EVENT_RECEIVED", { status: 200 });
}
