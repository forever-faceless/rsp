import "server-only";

/**
 * Instagram's API (Instagram API with Instagram Login). Every call needs the account's access
 * token, which is only ever read on the server. Tests point IG_API_BASE at a stand-in.
 */
const base = () => (process.env.IG_API_BASE?.trim() || "https://graph.instagram.com/v25.0").replace(/\/$/, "");

export class IgError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | undefined>;

async function call<T>(token: string, path: string, opts: { method?: "GET" | "POST"; query?: Query; body?: unknown } = {}): Promise<T> {
  const url = new URL(`${base()}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new IgError(error instanceof Error ? error.message : "Instagram could not be reached", 0);
  }
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
  if (!res.ok || json.error) throw new IgError(json.error?.message ?? `Instagram answered ${res.status}`, res.status, json.error?.code);
  return json;
}

/** A message to someone who has written to the account in the last 24 hours. */
export function sendText(token: string, igUserId: string, text: string) {
  return call<{ message_id?: string; recipient_id?: string }>(token, "/me/messages", { method: "POST", body: { recipient: { id: igUserId }, message: { text } } });
}

/** The one private message Instagram allows in answer to a comment, within 7 days of it. */
export function sendPrivateReply(token: string, commentId: string, text: string) {
  return call<{ message_id?: string; recipient_id?: string }>(token, "/me/messages", { method: "POST", body: { recipient: { comment_id: commentId }, message: { text } } });
}

/** A public reply under a comment. */
export function replyToComment(token: string, commentId: string, text: string) {
  return call<{ id?: string }>(token, `/${commentId}/replies`, { method: "POST", query: { message: text } });
}

/** Name and username of someone who has messaged the account. */
export function getProfile(token: string, igUserId: string) {
  return call<{ name?: string; username?: string }>(token, `/${igUserId}`, { query: { fields: "name,username" } });
}

/** The connected account itself. */
export function getMe(token: string) {
  return call<{ user_id?: string; id?: string; username?: string }>(token, "/me", { query: { fields: "user_id,username" } });
}

export type ApiMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp?: string;
  comments_count?: number;
};

/** The account's own recent posts and reels. */
export function listMedia(token: string, limit = 50) {
  return call<{ data?: ApiMedia[] }>(token, "/me/media", { query: { fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,comments_count", limit } });
}

export type ApiComment = { id: string; text?: string; username?: string; timestamp?: string; from?: { id?: string; username?: string }; parent_id?: string };

/** Comments on one post or reel, newest first. */
export function listComments(token: string, mediaId: string, limit = 50) {
  return call<{ data?: ApiComment[] }>(token, `/${mediaId}/comments`, { query: { fields: "id,text,username,timestamp,from,parent_id", limit } });
}

/** Trades a long-lived token for a fresh one. Good for 60 days; refresh well before that. */
export function refreshToken(token: string) {
  return call<{ access_token?: string; expires_in?: number }>(token, "/refresh_access_token", { query: { grant_type: "ig_refresh_token", access_token: token } });
}
