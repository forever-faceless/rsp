import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { handleWebhook } from "@/lib/instagram/process";

/**
 * Where Instagram tells the site about messages and comments.
 *
 * GET is Meta's one-time check that this address belongs to the app: it sends a challenge and
 * the word agreed at set-up, and gets the challenge back. POST carries the events, signed with
 * the app's secret; anything not signed with it is refused, so nobody else can post here.
 *
 * Meta's dashboard shows two secrets for one app: the Instagram app secret and the app's own.
 * Either may be the one that signs, so both are accepted when both are given
 * (IG_APP_SECRET and META_APP_SECRET).
 */
function secrets(): string[] {
  return [process.env.IG_APP_SECRET, process.env.META_APP_SECRET].map((s) => s?.trim() ?? "").filter(Boolean);
}

function signedBy(secret: string, raw: string, given: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(`sha256=${crypto.createHmac("sha256", secret).update(raw).digest("hex")}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const word = process.env.IG_VERIFY_TOKEN?.trim();
  if (word && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === word) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const known = secrets();
  if (!known.length) return new Response("Not set up", { status: 503 });
  const raw = await request.text();
  const given = request.headers.get("x-hub-signature-256") ?? "";
  if (!known.some((secret) => signedBy(secret, raw, given))) {
    // Says so in the logs, since a wrong secret looks from outside like Instagram going quiet.
    console.error("instagram webhook: signature did not match any known secret");
    return new Response("Bad signature", { status: 401 });
  }

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
