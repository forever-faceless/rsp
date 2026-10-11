"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { IG_STATES, IG_TOPICS, leads, type IgState, type IgTopic } from "@/lib/db/schema";
import type { ActionState } from "@/lib/forms";
import { checkConnection, syncMedia } from "@/lib/instagram/jobs";
import { sendToThread, subjectFor } from "@/lib/instagram/process";
import { getIgSettings, getThread, listIgMedia, saveIgSettings, updateMedia, updateThread, upsertMedia } from "@/lib/instagram/store";
import { TEMPLATE_KEYS } from "@/lib/instagram/templates";
import { isIndianMobile, normalisePhone } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;
const refresh = () => revalidatePath("/admin", "layout");

/** The office answers a conversation itself. From then on the automation stays out of it. */
export async function replyInThread(threadId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "Write a reply first." };
  if (text.length > 1000) return { error: "Instagram allows 1,000 characters in one message." };
  const found = await getThread(threadId);
  if (!found) return { error: "This conversation is gone." };
  const { thread } = found;
  if (!thread.lastInboundAt || Date.now() - thread.lastInboundAt.getTime() > DAY) {
    return { error: "Instagram only lets a business reply within 24 hours of their last message. Call or WhatsApp them if you have their number." };
  }
  const sent = await sendToThread(thread, text, "office", await getIgSettings());
  if (!sent.ok) return { error: `Instagram did not take the message: ${sent.error}` };
  await updateThread(threadId, { state: "replied", autoPaused: true, unread: 0 });
  refresh();
  return { success: "Sent." };
}

/** Where the conversation stands, what it is about, which property, and the office's notes. */
export async function saveThread(threadId: number, formData: FormData): Promise<void> {
  await requireAdmin();
  const found = await getThread(threadId);
  if (!found) return;
  const state = String(formData.get("state") ?? "");
  const topic = String(formData.get("topic") ?? "");
  const ref = String(formData.get("ref") ?? "").trim();
  const settings = await getIgSettings();
  const subject = ref ? await subjectFor(ref, settings) : null;
  await updateThread(threadId, {
    ...((IG_STATES as readonly string[]).includes(state) ? { state: state as IgState } : {}),
    ...((IG_TOPICS as readonly string[]).includes(topic) ? { topic: topic as IgTopic } : {}),
    notes: String(formData.get("notes") ?? "").slice(0, 2000),
    ...(subject ? { ref: subject.ref, ...subject.ids } : ref ? {} : { ref: "", propertyId: null, siteId: null, projectId: null }),
    ...(state && state !== "needs_you" ? { unread: 0 } : {}),
  });
  // "This reel is about this property": remembered, so the next person who shares it is answered at once.
  const reel = String(formData.get("rememberReel") ?? "");
  if (subject && reel) {
    const shared = found.messages.find((m) => String(m.id) === reel);
    if (shared?.mediaId) await upsertMedia({ mediaId: shared.mediaId, kind: shared.kind === "post" ? "post" : "reel", caption: shared.mediaTitle, ref: subject.ref, ...subject.ids });
  }
  refresh();
}

export async function setThreadState(threadId: number, state: IgState): Promise<void> {
  await requireAdmin();
  await updateThread(threadId, { state, ...(state === "needs_you" ? {} : { unread: 0 }) });
  refresh();
}

/** Lets the automation answer this person again. */
export async function resumeAutomation(threadId: number): Promise<void> {
  await requireAdmin();
  await updateThread(threadId, { autoPaused: false });
  refresh();
}

/** Makes a lead from a conversation, for a number given on a call or read off a photo. */
export async function leadFromThread(threadId: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const found = await getThread(threadId);
  if (!found) return { error: "This conversation is gone." };
  const { thread } = found;
  const raw = String(formData.get("phone") ?? "");
  if (!isIndianMobile(raw)) return { error: "Enter a 10-digit mobile number." };
  const phone = normalisePhone(raw);
  const db = await getDb();
  const values = {
    kind: thread.topic === "sell" ? ("sell" as const) : ("buy" as const),
    name: String(formData.get("name") ?? "").trim().slice(0, 80) || thread.name || (thread.username ? `@${thread.username}` : "Instagram enquiry"),
    phone,
    ref: thread.ref,
    purpose: "" as const,
    message: thread.username ? `From Instagram @${thread.username}` : "From Instagram",
    locale: "en" as const,
    source: `instagram:${thread.id}`,
    sent: true,
  };
  let leadId: number;
  try {
    [{ id: leadId }] = await db
      .insert(leads)
      .values({ ...values, propertyId: thread.propertyId, siteId: thread.siteId, projectId: thread.projectId })
      .returning({ id: leads.id });
  } catch {
    [{ id: leadId }] = await db.insert(leads).values(values).returning({ id: leads.id });
  }
  await updateThread(threadId, { leadId, phone });
  refresh();
  return { success: "Saved to Leads." };
}

/** The switches and the wording of the automatic replies. */
export async function saveInstagramSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const before = await getIgSettings();
  const commentAuto = formData.get("commentAuto") === "on";
  const templates: Record<string, string> = {};
  for (const key of TEMPLATE_KEYS) {
    const value = formData.get(`template.${key}`);
    if (typeof value !== "string") continue;
    // An empty box means the built-in text.
    if (value.trim()) templates[key] = value.slice(0, 1000);
  }
  await saveIgSettings({
    dmAuto: formData.get("dmAuto") === "on",
    commentAuto,
    commentAll: formData.get("commentAll") === "on",
    commentWords: String(formData.get("commentWords") ?? "").slice(0, 1000),
    linkLocale: formData.get("linkLocale") === "en" ? "en" : "kn",
    templates,
    // Comments made before the switch went on are never answered.
    ...(commentAuto && !before.commentAuto ? { commentSince: new Date() } : {}),
  });
  refresh();
  return { success: "Saved." };
}

export async function checkInstagram(): Promise<ActionState> {
  await requireAdmin();
  const result = await checkConnection();
  refresh();
  return result.ok ? { success: `Connected to @${result.username}.` } : { error: result.error };
}

export async function syncReels(): Promise<ActionState> {
  await requireAdmin();
  const result = await syncMedia();
  refresh();
  return result.ok ? { success: result.added ? `Brought in ${result.added} new ${result.added === 1 ? "post" : "posts"}.` : "Up to date." } : { error: result.error };
}

/** Says which property a reel or post is about. Blank unties it. */
export async function tieMedia(mediaRowId: number, formData: FormData): Promise<void> {
  await requireAdmin();
  const ref = String(formData.get("ref") ?? "").trim();
  const row = (await listIgMedia()).find((m) => m.id === mediaRowId);
  if (!row) return;
  const subject = ref ? await subjectFor(ref, await getIgSettings()) : null;
  await updateMedia(mediaRowId, subject ? { ref: subject.ref, ...subject.ids } : { ref: "", propertyId: null, siteId: null, projectId: null });
  refresh();
}
