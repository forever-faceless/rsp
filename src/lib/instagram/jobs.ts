import "server-only";
import { listRegions } from "@/lib/db/queries";
import type { IgSettings } from "@/lib/db/schema";
import { getMe, listComments, listMedia, refreshToken, type ApiMedia } from "./api";
import { handleComment, subjectFor } from "./process";
import { getIgSettings, listIgMedia, saveIgSettings, tokenOf, updateMedia, upsertMedia } from "./store";
import { findRefs } from "./understand";

/** Checks the token against Instagram and remembers whose account it is. */
export async function checkConnection(): Promise<{ ok: boolean; username?: string; error?: string }> {
  const settings = await getIgSettings();
  const token = tokenOf(settings);
  if (!token) return { ok: false, error: "No access token yet. Add IG_ACCESS_TOKEN in Vercel, then redeploy." };
  try {
    const me = await getMe(token);
    await saveIgSettings({
      accessToken: token,
      igUserId: me.user_id ?? me.id ?? "",
      igUsername: me.username ?? "",
      // A long-lived token lasts 60 days from when it was made; refreshed well before then.
      tokenExpiresAt: settings.tokenExpiresAt ?? new Date(Date.now() + 50 * 24 * 60 * 60 * 1000),
      lastError: "",
    });
    return { ok: true, username: me.username };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Instagram did not answer." };
  }
}

const kindOf = (m: ApiMedia) => (m.media_product_type === "REELS" || m.media_type === "VIDEO" ? "reel" : "post");

/**
 * Brings in the account's recent reels and posts. A new one whose caption carries a property
 * number is tied to that property straight away; the rest wait to be tied by hand.
 */
export async function syncMedia(settings?: IgSettings): Promise<{ ok: boolean; added: number; error?: string }> {
  const s = settings ?? (await getIgSettings());
  const token = tokenOf(s);
  if (!token) return { ok: false, added: 0, error: "Instagram is not connected yet." };
  let items: ApiMedia[];
  try {
    items = (await listMedia(token)).data ?? [];
  } catch (error) {
    return { ok: false, added: 0, error: error instanceof Error ? error.message : "Instagram did not answer." };
  }
  const known = new Map((await listIgMedia()).map((m) => [m.mediaId, m]));
  const prefixes = (await listRegions()).map((r) => r.code);
  let added = 0;
  for (const m of items) {
    const facts = { kind: kindOf(m), caption: (m.caption ?? "").slice(0, 2000), permalink: m.permalink ?? "", thumbnail: m.thumbnail_url ?? m.media_url ?? "", postedAt: m.timestamp ? new Date(m.timestamp) : null };
    const row = known.get(m.id);
    if (row) {
      await updateMedia(row.id, facts);
      continue;
    }
    const named = findRefs(m.caption ?? "", prefixes)[0];
    const subject = named ? await subjectFor(named, s) : null;
    // Comments already there when a reel is first seen are not answered: only new ones from here on.
    await upsertMedia({ mediaId: m.id, ...facts, commentsCount: m.comments_count ?? 0, ...(subject ? { ref: subject.ref, ...subject.ids } : {}) });
    added++;
  }
  return { ok: true, added };
}

/**
 * Looks for new comments by asking Instagram, for when it does not tell the site about them
 * itself. One request lists the reels with their comment counts; only a reel whose count has
 * grown is read.
 */
export async function pollComments(): Promise<number> {
  const settings = await getIgSettings();
  const token = tokenOf(settings);
  if (!settings.commentAuto || !token) return 0;
  const since = settings.commentSince?.getTime() ?? Date.now();
  const items = (await listMedia(token, 25)).data ?? [];
  const known = new Map((await listIgMedia()).map((m) => [m.mediaId, m]));
  let handled = 0;
  for (const m of items) {
    const row = known.get(m.id);
    const count = m.comments_count ?? 0;
    if (!row) {
      await upsertMedia({ mediaId: m.id, kind: kindOf(m), caption: (m.caption ?? "").slice(0, 2000), permalink: m.permalink ?? "", thumbnail: m.thumbnail_url ?? "", postedAt: m.timestamp ? new Date(m.timestamp) : null, commentsCount: count });
      continue;
    }
    if (count <= row.commentsCount) {
      if (count < row.commentsCount) await updateMedia(row.id, { commentsCount: count });
      continue;
    }
    const comments = (await listComments(token, m.id)).data ?? [];
    for (const c of comments.reverse()) {
      if (!c.timestamp || new Date(c.timestamp).getTime() < since) continue;
      const username = c.from?.username ?? c.username ?? "";
      await handleComment({ comment_id: c.id, text: c.text, parent_id: c.parent_id, from: { id: c.from?.id ?? (username ? `name:${username}` : ""), username }, media: { id: m.id } }, settings);
      handled++;
    }
    await updateMedia(row.id, { commentsCount: count });
  }
  return handled;
}

/** Renews the access token when it has under two weeks left. */
export async function refreshTokenIfDue(): Promise<boolean> {
  const settings = await getIgSettings();
  if (!settings.accessToken || !settings.tokenExpiresAt) return false;
  if (settings.tokenExpiresAt.getTime() - Date.now() > 14 * 24 * 60 * 60 * 1000) return false;
  const fresh = await refreshToken(settings.accessToken);
  if (!fresh.access_token) return false;
  await saveIgSettings({ accessToken: fresh.access_token, tokenExpiresAt: new Date(Date.now() + (fresh.expires_in ?? 60 * 24 * 60 * 60) * 1000) });
  return true;
}
