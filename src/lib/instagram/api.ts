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

async function call<T>(token: string, path: string, opts: { method?: "GET" | "POST"; query?: Query; body?: unknown; timeout?: number } = {}): Promise<T> {
  const url = new URL(`${base()}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, ...(opts.body ? { "Content-Type": "application/json" } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(opts.timeout ?? 10_000),
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

// ---------------------------------------------------------------- putting up a post

/**
 * Step one of posting: Instagram fetches the file from its address and prepares it in a
 * "container". A photo must be a JPEG; a reel an MP4 or MOV. The file has to be reachable
 * by anyone, which the blob store's addresses are.
 */
export function createContainer(token: string, post: { kind: "reel" | "photo"; url: string; caption: string }) {
  const body = post.kind === "reel" ? { media_type: "REELS", video_url: post.url, caption: post.caption, share_to_feed: true } : { image_url: post.url, caption: post.caption };
  return call<{ id?: string }>(token, "/me/media", { method: "POST", body, timeout: 30_000 });
}

/** How far Instagram has got with a container: IN_PROGRESS, FINISHED, PUBLISHED, ERROR or EXPIRED. */
export function containerStatus(token: string, containerId: string) {
  return call<{ status_code?: string; status?: string }>(token, `/${containerId}`, { query: { fields: "status_code,status" } });
}

/** Step two: the prepared container goes up on the account. A container can go up only once. */
export function publishContainer(token: string, containerId: string) {
  return call<{ id?: string }>(token, "/me/media_publish", { method: "POST", body: { creation_id: containerId }, timeout: 30_000 });
}

/** One post or reel of the account, for its address once it is up. */
export function getMedia(token: string, mediaId: string) {
  return call<ApiMedia>(token, `/${mediaId}`, { query: { fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,timestamp" } });
}

/** How many posts the account has put up through the site today. Only answers when the site is allowed to post. */
export function publishingLimit(token: string) {
  return call<{ data?: { quota_usage?: number }[] }>(token, "/me/content_publishing_limit", { query: { fields: "quota_usage" } });
}

/** Trades a long-lived token for a fresh one. Good for 60 days; refresh well before that. */
export function refreshToken(token: string) {
  return call<{ access_token?: string; expires_in?: number }>(token, "/refresh_access_token", { query: { grant_type: "ig_refresh_token", access_token: token } });
}
