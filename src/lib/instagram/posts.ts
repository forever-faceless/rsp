import "server-only";
import { and, desc, eq, inArray, lte, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { igPosts, type IgPost } from "@/lib/db/schema";
import { siteUrl } from "@/lib/site-url";
import { deleteStored } from "@/lib/storage";
import { istInputValue } from "@/lib/utils";
import { containerStatus, createContainer, getMedia, IgError, listMedia, publishContainer } from "./api";
import { getIgSettings, tokenOf, upsertMedia } from "./store";

/**
 * Posts lined up to go out on Instagram, and the minute-by-minute work of sending them.
 * Instagram takes a post in two steps: it first fetches the file and prepares it, then the
 * prepared post is put up. A video takes a minute or two to prepare, so that starts a little
 * before the chosen time.
 */

/** How long before its time a post is handed to Instagram to prepare. */
const HEAD_START = 3 * 60 * 1000;
/** A video still not ready after this long is given up on. */
const GIVE_UP = 30 * 60 * 1000;
/** A post caught mid-way by a crash is looked at again after this long. */
const STUCK = 2 * 60 * 1000;
const MAX_TRIES = 3;

export async function listPosts(): Promise<IgPost[]> {
  const db = await getDb();
  return db.select().from(igPosts).orderBy(desc(igPosts.scheduledAt)).limit(200);
}

export async function getPost(id: number): Promise<IgPost | null> {
  const db = await getDb();
  const [row] = await db.select().from(igPosts).where(eq(igPosts.id, id));
  return row ?? null;
}

export async function createPost(values: typeof igPosts.$inferInsert): Promise<number> {
  const db = await getDb();
  const [row] = await db.insert(igPosts).values(values).returning({ id: igPosts.id });
  return row.id;
}

export async function updatePost(id: number, patch: Partial<typeof igPosts.$inferInsert>): Promise<void> {
  const db = await getDb();
  await db
    .update(igPosts)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(igPosts.id, id));
}

export async function removePost(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(igPosts).where(eq(igPosts.id, id));
}

/**
 * Moves a post from one stage to the next, and says whether this call was the one that moved
 * it. Two checks running at once both see the same post; only one of them may act on it, or
 * the same reel would go up twice.
 */
export async function movePost(id: number, from: IgPost["status"] | IgPost["status"][], to: IgPost["status"], patch: Partial<typeof igPosts.$inferInsert> = {}): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(igPosts)
    .set({ ...patch, status: to, updatedAt: new Date() })
    .where(and(eq(igPosts.id, id), inArray(igPosts.status, Array.isArray(from) ? from : [from])))
    .returning({ id: igPosts.id });
  return rows.length === 1;
}

/** How many posts are waiting or on their way. */
export async function countUpcomingPosts(): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ id: igPosts.id })
    .from(igPosts)
    .where(inArray(igPosts.status, ["scheduled", "processing", "publishing"]));
  return rows.length;
}

/**
 * The times the scheduling form works with, as its date box wants them (Indian time): the
 * earliest it allows, and the one it opens on, which is the next half hour at least an hour away.
 */
export function formTimes(now = Date.now()): { minWhen: string; defaultWhen: string } {
  const half = 30 * 60 * 1000;
  return { minWhen: istInputValue(new Date(now)), defaultWhen: istInputValue(new Date(Math.ceil((now + 2 * half) / half) * half)) };
}

/** True when the minute-by-minute check has not run for a while, so nothing scheduled would go out. */
export function checkAsleep(lastCronAt: Date | null, now = Date.now()): boolean {
  return now - (lastCronAt?.getTime() ?? 0) > 5 * 60 * 1000;
}

// ---------------------------------------------------------------- sending

/** The address Instagram fetches the file from. A file kept on this server needs the site's address in front. */
const reachable = (url: string) => (url.startsWith("/") ? `${siteUrl()}${url}` : url);

/** Trouble that may pass by itself: Instagram did not answer, or answered with a server error. */
const passing = (error: unknown) => error instanceof IgError && (error.status === 0 || error.status >= 500);
const reason = (error: unknown) => (error instanceof Error ? error.message : "Instagram did not accept it.");

async function fail(post: IgPost, why: string): Promise<void> {
  await updatePost(post.id, { status: "failed", error: why.slice(0, 500) });
}

/** It is up: note where, tie the reel to its property, and let go of the stored file. */
async function finish(post: IgPost, token: string, mediaId: string): Promise<void> {
  const now = new Date();
  const media = mediaId ? await getMedia(token, mediaId).catch(() => null) : null;
  await updatePost(post.id, { status: "published", mediaId, permalink: media?.permalink ?? "", publishedAt: now, error: "", fileUrl: "" });
  if (mediaId) {
    await upsertMedia({
      mediaId,
      kind: post.kind === "reel" ? "reel" : "post",
      caption: post.caption.slice(0, 2000),
      permalink: media?.permalink ?? "",
      thumbnail: media?.thumbnail_url ?? "",
      postedAt: now,
      ref: post.ref,
      propertyId: post.propertyId,
      siteId: post.siteId,
      projectId: post.projectId,
      commentsCount: 0,
    });
  }
  // Instagram has its own copy now.
  await deleteStored(post.fileUrl);
}

/** It went up but the answer was lost on the way: find it among the account's newest posts. */
async function finishFromAccount(post: IgPost, token: string): Promise<void> {
  const since = (post.startedAt?.getTime() ?? 0) - 60_000;
  const recent = ((await listMedia(token, 5).catch(() => ({ data: [] }))).data ?? []).filter((m) => m.timestamp && new Date(m.timestamp).getTime() >= since);
  const match = recent.find((m) => (m.caption ?? "").trim() === post.caption.trim()) ?? recent[0];
  await finish(post, token, match?.id ?? "");
}

/** Hands a post to Instagram to prepare. */
async function start(post: IgPost, token: string): Promise<void> {
  if (!(await movePost(post.id, "scheduled", "processing", { startedAt: new Date(), tries: post.tries + 1, containerId: "", error: "" }))) return;
  try {
    const made = await createContainer(token, { kind: post.kind, url: reachable(post.fileUrl), caption: post.caption });
    if (!made.id) throw new IgError("Instagram did not say where it put the post.", 200);
    await updatePost(post.id, { containerId: made.id });
  } catch (error) {
    // Nothing can have gone up at this stage, so trying again cannot post it twice.
    if (passing(error) && post.tries + 1 < MAX_TRIES) await updatePost(post.id, { status: "scheduled" });
    else await fail(post, reason(error));
  }
}

type Outcome = "published" | "failed" | "waiting";

/** Looks at a post Instagram is preparing, and puts it up once it is ready and its time has come. */
async function advance(post: IgPost, token: string, now: Date): Promise<Outcome> {
  const age = now.getTime() - (post.startedAt?.getTime() ?? 0);
  if (!post.containerId) {
    // Handed over, but the answer saying where Instagram put it never arrived: start again.
    if (age < STUCK) return "waiting";
    if (post.tries >= MAX_TRIES) {
      await fail(post, "Instagram did not answer when the post was handed over.");
      return "failed";
    }
    await updatePost(post.id, { status: "scheduled" });
    return "waiting";
  }

  let status: { status_code?: string; status?: string };
  try {
    status = await containerStatus(token, post.containerId);
  } catch (error) {
    if (passing(error)) return "waiting";
    await fail(post, reason(error));
    return "failed";
  }
  // From here on something is written down or put up, so only one check may carry on with
  // this post. A post already marked "publishing" was left mid-way by a check that has died.
  const mine = () => post.status === "publishing" || movePost(post.id, "processing", "publishing");
  if (status.status_code === "PUBLISHED") {
    if (!(await mine())) return "waiting";
    await finishFromAccount(post, token);
    return "published";
  }
  if (status.status_code === "EXPIRED") {
    await fail(post, "Instagram held the post too long without it going up. Schedule it again.");
    return "failed";
  }
  if (status.status_code === "ERROR") {
    await fail(post, `Instagram could not use the file. ${status.status ?? ""}`.trim());
    return "failed";
  }
  if (status.status_code !== "FINISHED") {
    if (age > GIVE_UP) {
      await fail(post, "Instagram took too long to prepare the file. Try again, or use a smaller video.");
      return "failed";
    }
    return "waiting";
  }
  if (post.scheduledAt.getTime() > now.getTime()) return "waiting";

  // Ready, and it is time.
  if (!(await mine())) return "waiting";
  try {
    const up = await publishContainer(token, post.containerId);
    if (!up.id) throw new IgError("Instagram did not confirm the post.", 200);
    await finish(post, token, up.id);
    return "published";
  } catch (error) {
    // It may be up all the same. Ask Instagram before deciding anything.
    const after = await containerStatus(token, post.containerId).catch(() => null);
    if (after?.status_code === "PUBLISHED") {
      await finishFromAccount(post, token);
      return "published";
    }
    if (post.tries + 1 >= MAX_TRIES && !passing(error)) {
      await fail(post, reason(error));
      return "failed";
    }
    // Back in line: the next check asks Instagram again and carries on from what it says.
    await updatePost(post.id, { status: "processing", tries: post.tries + 1, error: reason(error).slice(0, 500) });
    return "waiting";
  }
}

/** Run every minute: starts the posts whose time is near and puts up the ones that are ready. */
export async function publishDue(now = new Date()): Promise<{ started: number; published: number; failed: number }> {
  const out = { started: 0, published: 0, failed: 0 };
  const token = tokenOf(await getIgSettings());
  if (!token) return out;
  const db = await getDb();

  const due = await db
    .select()
    .from(igPosts)
    .where(and(eq(igPosts.status, "scheduled"), lte(igPosts.scheduledAt, new Date(now.getTime() + HEAD_START))))
    .orderBy(igPosts.scheduledAt)
    .limit(5);
  for (const post of due) {
    await start(post, token);
    out.started++;
  }

  const moving = await db
    .select()
    .from(igPosts)
    .where(or(eq(igPosts.status, "processing"), and(eq(igPosts.status, "publishing"), lte(igPosts.updatedAt, new Date(now.getTime() - STUCK)))))
    .orderBy(igPosts.scheduledAt)
    .limit(10);
  for (const post of moving) {
    const result = await advance(post, token, now);
    if (result === "published") out.published++;
    if (result === "failed") out.failed++;
  }
  return out;
}
