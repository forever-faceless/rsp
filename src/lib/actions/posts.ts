"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/lib/forms";
import { createPost, getPost, movePost, removePost } from "@/lib/instagram/posts";
import { subjectFor } from "@/lib/instagram/process";
import { getIgSettings } from "@/lib/instagram/store";
import { deleteStored, isStoredUrl, saveJpeg, UploadError } from "@/lib/storage";
import { parseIstInput } from "@/lib/utils";

const refresh = () => revalidatePath("/admin", "layout");
const DAY = 24 * 60 * 60 * 1000;
/** Instagram's own limits on a caption. */
const MAX_CAPTION = 2200;
const MAX_HASHTAGS = 30;

function checkCaption(caption: string): string | null {
  if (caption.length > MAX_CAPTION) return `Instagram allows ${MAX_CAPTION.toLocaleString("en-IN")} characters in a caption. This one has ${caption.length.toLocaleString("en-IN")}.`;
  if ((caption.match(/#[^\s#]+/g) ?? []).length > MAX_HASHTAGS) return `Instagram allows ${MAX_HASHTAGS} hashtags in a caption.`;
  return null;
}

/** When the post should go out: now, or the Indian time typed on the form. */
function checkWhen(formData: FormData): { at: Date } | { error: string } {
  if (formData.get("now") === "1") return { at: new Date() };
  const at = parseIstInput(String(formData.get("when") ?? ""));
  if (!at) return { error: "Choose the date and time it should go out." };
  if (at.getTime() < Date.now() - 5 * 60 * 1000) return { error: "That time has already passed. Choose a later one, or press Post now." };
  if (at.getTime() > Date.now() + 90 * DAY) return { error: "Choose a time within the next three months." };
  return { at: at.getTime() < Date.now() ? new Date() : at };
}

/** The listing a post is about, from the picker. Only a listing that is on the website has details to send. */
async function checkSubject(ref: string): Promise<{ ref: string; propertyId: number | null; siteId: number | null; projectId: number | null } | { error: string }> {
  const none = { ref: "", propertyId: null, siteId: null, projectId: null };
  if (!ref) return none;
  const subject = await subjectFor(ref, await getIgSettings());
  if (!subject) return { error: `${ref} is not published on the website yet, so there are no details to send for it. Publish it first, or choose "Not about one property".` };
  return { ref: subject.ref, ...subject.ids };
}

/**
 * Lines up a reel or a photo to go out on Instagram. A video has already been uploaded by the
 * browser and arrives as its address; a photo arrives as the file itself.
 */
export async function schedulePost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const caption = String(formData.get("caption") ?? "").trim();
  const captionError = checkCaption(caption);
  if (captionError) return { error: captionError };
  const when = checkWhen(formData);
  if ("error" in when) return { error: when.error };
  const subject = await checkSubject(String(formData.get("ref") ?? "").trim());
  if ("error" in subject) return { error: subject.error };

  const videoUrl = String(formData.get("videoUrl") ?? "").trim();
  const photo = formData.get("photo");
  let kind: "reel" | "photo";
  let fileUrl: string;
  if (videoUrl) {
    if (!isStoredUrl(videoUrl) || !/\.(mp4|mov)$/i.test(videoUrl.split("?")[0])) return { error: "Instagram takes MP4 or MOV videos. Upload the video again." };
    kind = "reel";
    fileUrl = videoUrl;
  } else if (photo instanceof File && photo.size > 0) {
    try {
      const saved = await saveJpeg(photo, "posts");
      const shape = saved.width / saved.height;
      // Instagram refuses a photo taller than 4:5 or wider than 1.91:1.
      if (shape < 0.79 || shape > 1.92) {
        await deleteStored(saved.url);
        return { error: `Instagram takes photos between 4:5 (upright) and 1.91:1 (wide). This one is too ${shape < 0.79 ? "tall" : "wide"}. Crop it and try again.` };
      }
      kind = "photo";
      fileUrl = saved.url;
    } catch (error) {
      if (error instanceof UploadError) return { error: error.message };
      throw error;
    }
  } else {
    return { error: "Choose a video or a photo first." };
  }

  await createPost({ kind, fileUrl, caption, scheduledAt: when.at, ...subject });
  refresh();
  return { success: formData.get("now") === "1" ? "On its way. It will be on Instagram in a minute or two." : "Scheduled." };
}

/** Changes the caption, the time or the property of a post that has not started going out. */
export async function changePost(id: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const caption = String(formData.get("caption") ?? "").trim();
  const captionError = checkCaption(caption);
  if (captionError) return { error: captionError };
  const when = checkWhen(formData);
  if ("error" in when) return { error: when.error };
  const subject = await checkSubject(String(formData.get("ref") ?? "").trim());
  if ("error" in subject) return { error: subject.error };
  const moved = await movePost(id, ["scheduled", "failed"], "scheduled", { caption, scheduledAt: when.at, ...subject, tries: 0, error: "", containerId: "" });
  refresh();
  return moved ? { success: "Saved." } : { error: "This post is already on its way, so it can no longer be changed." };
}

/** Sends a waiting post, or one that failed, at once. */
export async function postNow(id: number): Promise<void> {
  await requireAdmin();
  await movePost(id, ["scheduled", "failed"], "scheduled", { scheduledAt: new Date(), tries: 0, error: "", containerId: "" });
  refresh();
}

/** Takes a post off the list. One that is already on Instagram stays there; one on its way cannot be stopped. */
export async function deletePost(id: number): Promise<void> {
  await requireAdmin();
  const post = await getPost(id);
  if (!post || post.status === "processing" || post.status === "publishing") return;
  // Make sure it cannot start between being read and being removed.
  if (post.status === "scheduled" && !(await movePost(id, "scheduled", "failed", { error: "Removed." }))) return;
  await removePost(id);
  await deleteStored(post.fileUrl);
  refresh();
}
