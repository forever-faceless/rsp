"use server";

import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { getProjectById, getPropertyById, getSiteById } from "@/lib/db/queries";
import { projects, properties, sites, type VideoItem } from "@/lib/db/schema";
import type { ActionState } from "@/lib/forms";
import { deleteStored, isStoredUrl } from "@/lib/storage";
import { revalidateAll } from "./shared";

export type MediaOwner = { kind: "project" | "property" | "site"; id: number };

const MAX_VIDEOS = 12;

async function readVideos(owner: MediaOwner): Promise<VideoItem[] | null> {
  if (owner.kind === "project") return (await getProjectById(owner.id))?.videos ?? null;
  if (owner.kind === "property") return (await getPropertyById(owner.id))?.videos ?? null;
  return (await getSiteById(owner.id))?.videos ?? null;
}

async function writeVideos(owner: MediaOwner, videos: VideoItem[]): Promise<void> {
  const db = await getDb();
  const patch = { videos, updatedAt: new Date() };
  if (owner.kind === "project") await db.update(projects).set(patch).where(eq(projects.id, owner.id));
  else if (owner.kind === "property") await db.update(properties).set(patch).where(eq(properties.id, owner.id));
  else await db.update(sites).set(patch).where(eq(sites.id, owner.id));
  revalidateAll();
}

/** Adds a link to a video hosted elsewhere, such as YouTube or an Instagram reel. */
export async function addVideoLink(owner: MediaOwner, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const url = String(formData.get("url") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "Paste the full link, starting with https://" };
  }
  if (parsed.protocol !== "https:") return { error: "Only https links are accepted." };
  const videos = await readVideos(owner);
  if (!videos) return { error: "Listing not found." };
  if (videos.length >= MAX_VIDEOS) return { error: `A listing can hold at most ${MAX_VIDEOS} videos.` };
  if (videos.some((v) => v.url === parsed.href)) return { error: "That link is already attached." };
  await writeVideos(owner, [...videos, { url: parsed.href, title, kind: "link" }]);
  return { success: "Video link added." };
}

/** Records a video file after the browser has finished uploading it to storage. */
export async function attachUploadedVideo(owner: MediaOwner, url: string, title: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  if (!isStoredUrl(url)) return { ok: false, error: "Unexpected file location." };
  const videos = await readVideos(owner);
  if (!videos) {
    await deleteStored(url);
    return { ok: false, error: "Listing not found." };
  }
  if (videos.length >= MAX_VIDEOS) {
    await deleteStored(url);
    return { ok: false, error: `A listing can hold at most ${MAX_VIDEOS} videos.` };
  }
  await writeVideos(owner, [...videos, { url, title: title.trim().slice(0, 120), kind: "file" }]);
  return { ok: true };
}

export async function removeVideo(owner: MediaOwner, url: string): Promise<void> {
  await requireAdmin();
  const videos = await readVideos(owner);
  const item = videos?.find((v) => v.url === url);
  if (!videos || !item) return;
  await writeVideos(
    owner,
    videos.filter((v) => v.url !== url),
  );
  if (item.kind === "file") await deleteStored(url);
}
