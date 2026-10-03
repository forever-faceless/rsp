import type { NextRequest } from "next/server";
import { saveCardProgress } from "@/lib/enquiries";
import { cardProgressSchema } from "@/lib/validation";

/**
 * Saves what the quick enquiry card holds so far. The card calls this as the number is typed
 * and as the questions are answered, and once more as the page is closed or put away, so a
 * number is kept even when the visitor never presses send. Always answers 204: the card has
 * nothing to show for it either way.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 204 });
  }
  const parsed = cardProgressSchema.safeParse(body);
  if (parsed.success) {
    const ip = (request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "local").split(",")[0].trim();
    try {
      await saveCardProgress(parsed.data, ip);
    } catch (error) {
      console.error("enquiry progress failed", error);
    }
  }
  return new Response(null, { status: 204 });
}
