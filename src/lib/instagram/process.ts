import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { IgMessageKind, IgState, IgTopic } from "@/lib/db/enums";
import { getProjectBySlug, getSettings, listRegions } from "@/lib/db/queries";
import { leads, type IgSettings, type IgThread } from "@/lib/db/schema";
import { googleMapsLink } from "@/lib/geo";
import { pick } from "@/lib/i18n";
import { lookupListing } from "@/lib/listing-detail";
import { priceLine } from "@/lib/pricing";
import { formatPropertyNo } from "@/lib/refs";
import { siteUrl } from "@/lib/site-url";
import { formatArea, formatPhoneDisplay, normalisePhone } from "@/lib/utils";
import { getProfile, IgError, replyToComment, sendPrivateReply, sendText, type QuickReply } from "./api";
import { addMessage, createThread, findMedia, findRecentOwn, findThread, findThreadByUsername, getIgSettings, getMessage, lastSent, messageExists, recentAutoCount, saveIgSettings, tokenOf, updateMessage, updateThread } from "./store";
import { fillTemplate, INTEREST_BUTTONS, INTEREST_TYPED, templateText, type TemplateKey } from "./templates";
import { answerOf, commentAsks, DEFAULT_COMMENT_WORDS, findPhone, findRefs, splitWords, topicOf } from "./understand";

/**
 * What happens when Instagram tells the site about a message or a comment. Everything is
 * stored for the office's inbox. When automatic replies are on, a message the rules can
 * place is answered at once; anything else is handed to the office as "Needs you", with what
 * it seems to be about. The automation never guesses.
 */

/** At most this many automatic replies to one person in an hour, so two bots can never chatter. */
const AUTO_LIMIT = 6;

// ---------------------------------------------------------------- what Instagram sends

type Attachment = { type?: string; payload?: { url?: string; title?: string; reel_video_id?: string; id?: string; media_id?: string; ig_post_media_id?: string } };
type MessagingEvent = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; is_deleted?: boolean; attachments?: Attachment[]; reply_to?: { story?: { id?: string; url?: string } }; quick_reply?: { payload?: string } };
};
type CommentValue = {
  id?: string;
  comment_id?: string;
  parent_id?: string;
  text?: string;
  from?: { id?: string; username?: string };
  media?: { id?: string; media_product_type?: string };
};
type Entry = { id?: string; messaging?: MessagingEvent[]; changes?: { field?: string; value?: CommentValue }[] };

export async function handleWebhook(payload: unknown): Promise<void> {
  const body = payload as { object?: string; entry?: Entry[] };
  if (body?.object !== "instagram" || !Array.isArray(body.entry)) return;
  const settings = await getIgSettings();
  await saveIgSettings({ lastWebhookAt: new Date() });
  for (const entry of body.entry) {
    for (const event of entry.messaging ?? []) {
      try {
        await handleMessage(event, settings, entry.id ?? "");
      } catch (error) {
        await noteError(error);
      }
    }
    for (const change of entry.changes ?? []) {
      if (change.field !== "comments" || !change.value) continue;
      try {
        await handleComment(change.value, settings);
      } catch (error) {
        await noteError(error);
      }
    }
  }
}

async function noteError(error: unknown) {
  console.error("instagram", error);
  await saveIgSettings({ lastError: `${new Date().toISOString()} ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) }).catch(() => {});
}

// ---------------------------------------------------------------- the listing a reply is about

type Subject = {
  ref: string;
  title: string;
  facts: string;
  location: string;
  price: string;
  link: string;
  mapLink: string;
  ids: { propertyId: number | null; siteId: number | null; projectId: number | null };
};

/** What a reply says about one listing. Only published listings are found, so nothing private can be sent. */
export async function subjectFor(ref: string, settings: IgSettings): Promise<Subject | null> {
  if (!ref) return null;
  const locale = settings.linkLocale;
  const found = await lookupListing(ref);
  const base = `${siteUrl()}/${locale}`;
  if (found.type === "project") {
    const project = await getProjectBySlug(found.slug);
    if (!project) return null;
    const link = `${base}/projects/${project.slug}?from=instagram`;
    return {
      ref: formatPropertyNo(project.prefix, project.propertyNo),
      title: pick(project, "name", locale),
      facts: "",
      location: pick(project, "location", locale),
      price: project.callForPrice ? "Call for price" : project.pricePerSqft ? priceLine(null, project.pricePerSqft, "per sq ft") : "Call for price",
      link,
      mapLink: link,
      ids: { propertyId: null, siteId: null, projectId: project.id },
    };
  }
  if (found.type !== "listing") return null;
  const d = found.detail;
  const price = priceLine(d.price, d.pricePerSqft, "per sq ft") || "Call for price";
  const link = `${base}/properties/${d.slug}/interest?from=instagram`;
  return {
    ref: d.ref,
    title: pick(d, "title", locale),
    facts: [d.dimension ? `${d.dimension} ft` : "", d.areaSqft ? formatArea(d.areaSqft, d.areaUnit) : "", price].filter(Boolean).join(" · "),
    location: pick(d, "location", locale),
    price: d.negotiable && d.price ? `${price}, slightly negotiable` : price,
    link,
    mapLink: d.pin ? googleMapsLink(d.pin.lat, d.pin.lng) : `${base}/properties/${d.slug}?from=instagram`,
    ids: d.ids,
  };
}

async function compose(key: TemplateKey, settings: IgSettings, subject: Subject | null, extra: Record<string, string> = {}): Promise<string> {
  const site = await getSettings();
  const base = `${siteUrl()}/${settings.linkLocale}`;
  return fillTemplate(templateText(settings.templates, key), {
    ref: subject?.ref ?? "",
    title: subject?.title ?? "",
    facts: subject?.facts ?? "",
    location: subject?.location ?? "",
    price: subject?.price ?? "",
    link: subject?.link ?? `${base}/properties?from=instagram`,
    mapLink: subject?.mapLink ?? "",
    phone: formatPhoneDisplay(site.phonePrimary),
    // The bare ten digits: the spelling a phone most reliably turns into a number to tap and call.
    call: normalisePhone(site.phonePrimary),
    example: `${site.propertyPrefix}-0001`,
    listLink: `${base}/properties?from=instagram`,
    sellLink: `${base}/sell?from=instagram`,
    ...extra,
  });
}

/** Ready-made replies for the office to send with one tap, filled in for this conversation. */
export async function quickReplies(thread: IgThread, settings: IgSettings): Promise<{ label: string; text: string }[]> {
  const subject = thread.ref ? await subjectFor(thread.ref, settings) : null;
  const out: { label: string; text: string }[] = [];
  if (subject) {
    out.push({ label: `Details of ${subject.ref}`, text: await compose("property", settings, subject) });
    out.push({ label: "Price", text: await compose("price", settings, subject) });
    if (subject.location) out.push({ label: "Location", text: await compose("location", settings, subject) });
    out.push({ label: "Offer a visit", text: await compose("visit", settings, subject) });
  } else {
    out.push({ label: "Ask which property", text: await compose("askWhich", settings, null) });
  }
  out.push({ label: "Ask for their number", text: ["Please send your mobile number and we will call you.", "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಮೊಬೈಲ್ ನಂಬರ್ ಕಳುಹಿಸಿ, ನಾವು ಕಾಲ್ ಮಾಡುತ್ತೇವೆ."].join("\n") });
  return out;
}

// ---------------------------------------------------------------- sending

type SendWith = {
  /** Answers a comment: the one private message Instagram allows for it. */
  commentId?: string;
  /** Buttons under the message, and the words to send in its place should Instagram refuse them. */
  choices?: QuickReply[];
  plain?: string;
  /** The property this message asks "interested?" about, kept with it so a typed answer can be placed. */
  asks?: string;
};

/**
 * Sends a message and files it. The row is written before Instagram is called, because
 * Instagram echoes every sent message back and the echo must find it already there.
 */
export async function sendToThread(thread: IgThread, text: string, sender: "auto" | "office", settings: IgSettings, via: SendWith = {}): Promise<{ ok: boolean; error?: string }> {
  const token = tokenOf(settings);
  const row = await addMessage({ threadId: thread.id, direction: "out", kind: "text", sender, text, raw: via.asks ? JSON.stringify({ asks: via.asks }) : "" });
  if (!token) {
    if (row) await updateMessage(row.id, { failed: "Instagram is not connected yet." });
    return { ok: false, error: "Instagram is not connected yet." };
  }
  const send = (words: string, choices?: QuickReply[]) => (via.commentId ? sendPrivateReply(token, via.commentId, words, choices) : sendText(token, thread.igUserId, words, choices));
  let words = text;
  try {
    let sent: Awaited<ReturnType<typeof send>>;
    try {
      sent = await send(text, via.choices);
    } catch (error) {
      // Instagram answered and said no, so nothing went out, and the buttons may be what it
      // refused: the message goes once more in plain words. A call that got no answer at all
      // is never repeated, since the message may have gone.
      if (!via.choices?.length || !(error instanceof IgError) || error.status < 400 || error.status >= 500) throw error;
      words = via.plain ?? text;
      if (row) await updateMessage(row.id, { text: words, raw: JSON.stringify({ ...(via.asks ? { asks: via.asks } : {}), plain: true }) });
      sent = await send(words);
    }
    if (row && sent.message_id) await updateMessage(row.id, { mid: sent.message_id }).catch(() => {});
    // A private reply to a comment tells us who the commenter is in DMs, when it was not known.
    if (via.commentId && sent.recipient_id && sent.recipient_id !== thread.igUserId && !(await findThread(sent.recipient_id))) await updateThread(thread.id, { igUserId: sent.recipient_id });
    await updateThread(thread.id, { lastMessageAt: new Date(), lastText: words.slice(0, 200) });
    return { ok: true };
  } catch (error) {
    // No answer in time is not a refusal. When Instagram's echo of the message is already on
    // file, it went out, and saying otherwise would have the office send it a second time.
    if (row && error instanceof IgError && error.status === 0 && (await getMessage(row.id))?.mid) {
      await updateThread(thread.id, { lastMessageAt: new Date(), lastText: words.slice(0, 200) });
      return { ok: true };
    }
    const message = error instanceof IgError ? error.message : "Sending failed.";
    if (row) await updateMessage(row.id, { failed: message.slice(0, 300) });
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------- leads

/** Saves the number as a lead on the Leads page, or corrects the lead this conversation already made. */
async function captureLead(thread: IgThread, phone: string, text: string, topic: IgTopic): Promise<number> {
  const db = await getDb();
  const name = thread.name || (thread.username ? `@${thread.username}` : "Instagram enquiry");
  const message = `${thread.username ? `Instagram @${thread.username}: ` : "Instagram: "}${text}`.slice(0, 1500);
  if (thread.leadId) {
    const [lead] = await db.select({ id: leads.id }).from(leads).where(eq(leads.id, thread.leadId));
    if (lead) {
      await db.update(leads).set({ phone, message }).where(eq(leads.id, lead.id));
      return lead.id;
    }
  }
  const base = { kind: topic === "sell" ? ("sell" as const) : ("buy" as const), name, phone, ref: thread.ref, purpose: "" as const, message, locale: "en" as const, source: `instagram:${thread.id}`, sent: true };
  try {
    const [row] = await db
      .insert(leads)
      .values({ ...base, propertyId: thread.propertyId, siteId: thread.siteId, projectId: thread.projectId })
      .returning({ id: leads.id });
    return row.id;
  } catch {
    const [row] = await db.insert(leads).values(base).returning({ id: leads.id });
    return row.id;
  }
}

// ---------------------------------------------------------------- a direct message

async function threadFor(igUserId: string, settings: IgSettings, hint?: { username?: string }): Promise<IgThread> {
  const existing = await findThread(igUserId);
  if (existing && (existing.username || !tokenOf(settings))) return existing;
  let profile: { name?: string; username?: string } = { username: hint?.username };
  const token = tokenOf(settings);
  if (token && !hint?.username) profile = await getProfile(token, igUserId).catch(() => ({}));
  if (existing) {
    if (profile.username || profile.name) await updateThread(existing.id, { username: profile.username ?? existing.username, name: profile.name ?? existing.name });
    return { ...existing, username: profile.username ?? existing.username, name: profile.name ?? existing.name };
  }
  // A commenter is first known by the id Instagram gives in comments; when the same person
  // then writes a DM under another id, the two are joined by username.
  const sameName = profile.username ? await findThreadByUsername(profile.username) : null;
  if (sameName) {
    await updateThread(sameName.id, { igUserId, name: profile.name ?? sameName.name });
    return { ...sameName, igUserId };
  }
  return createThread({ igUserId, username: profile.username, name: profile.name });
}

function describe(message: NonNullable<MessagingEvent["message"]>): { kind: IgMessageKind; ids: string[]; url: string; title: string } {
  const a = (message.attachments ?? []).find((x) => x.type) ?? null;
  const p = a?.payload ?? {};
  const ids = [p.reel_video_id, p.ig_post_media_id, p.media_id, p.id].filter((v): v is string => Boolean(v));
  if (message.reply_to?.story) return { kind: "story", ids: [message.reply_to.story.id ?? ""].filter(Boolean), url: message.reply_to.story.url ?? "", title: "" };
  if (!a) return { kind: "text", ids: [], url: "", title: "" };
  const kind: IgMessageKind = a.type === "ig_reel" || a.type === "reel" ? "reel" : a.type === "ig_post" || a.type === "share" ? "post" : a.type === "story_mention" ? "story" : "media";
  return { kind, ids, url: p.url ?? "", title: p.title ?? "" };
}

async function handleMessage(event: MessagingEvent, settings: IgSettings, accountId: string): Promise<void> {
  const message = event.message;
  if (!message?.mid || message.is_deleted) return; // reactions, read receipts and the like
  const echo = message.is_echo === true;
  const them = echo ? event.recipient?.id : event.sender?.id;
  if (!them || them === accountId || (settings.igUserId && them === settings.igUserId)) return;
  if (await messageExists(message.mid)) return;

  const text = (message.text ?? "").trim();
  const thread = await threadFor(them, settings);
  const when = event.timestamp ? new Date(event.timestamp) : new Date();

  if (echo) {
    // Sent from this site a moment ago: only note Instagram's id for it.
    const own = text ? await findRecentOwn(thread.id, text) : null;
    if (own) {
      // The echo is proof that it arrived, even when the call that sent it got no answer in time.
      if (!own.mid || own.failed) await updateMessage(own.id, { mid: own.mid || message.mid, failed: "" }).catch(() => {});
      return;
    }
    // Sent from the Instagram app or another tool: someone else has answered, so the automation steps back.
    const stored = await addMessage({ threadId: thread.id, direction: "out", kind: "text", sender: "app", text, mid: message.mid, createdAt: when });
    if (stored) await updateThread(thread.id, { lastMessageAt: when, lastText: text.slice(0, 200), autoPaused: true, unread: 0, state: thread.state === "needs_you" ? "replied" : thread.state });
    return;
  }

  const what = describe(message);
  const media = what.kind === "reel" || what.kind === "post" ? await findMedia(what.ids, what.title) : null;
  const stored = await addMessage({
    threadId: thread.id,
    direction: "in",
    kind: what.kind,
    sender: "them",
    text,
    mid: message.mid,
    mediaId: media?.mediaId ?? what.ids[0] ?? "",
    mediaUrl: what.url,
    mediaTitle: what.title || media?.caption.slice(0, 200) || "",
    raw: JSON.stringify(message),
    createdAt: when,
  });
  if (!stored) return;

  // ----- what is it about
  const phone = findPhone(text);
  const refs = findRefs(text, (await listRegions()).map((r) => r.code));
  // Their answer to "Interested in this property?": a tap on Yes or Price, or the same typed
  // while that question is still the last thing said to them.
  const tapped = /^(details|price):(.+)$/.exec(message.quick_reply?.payload ?? "");
  let choice: { want: "details" | "price"; ref: string } | null = tapped ? { want: tapped[1] as "details" | "price", ref: tapped[2] } : null;
  if (!choice && what.kind === "text" && !phone && !refs.length) {
    const asked = askedIn(await lastSent(thread.id));
    const want = asked ? answerOf(text) : null;
    if (want) choice = { want, ref: asked };
  }
  let subject: Subject | null = null;
  if (what.kind === "reel" || what.kind === "post") subject = media?.ref ? await subjectFor(media.ref, settings) : null;
  if (!subject && refs.length) subject = await subjectFor(refs[0], settings);
  if (!subject && choice) subject = await subjectFor(choice.ref, settings);
  const said = topicOf(text);
  const topic: IgTopic = what.kind === "reel" || what.kind === "post" ? "reel" : phone ? "number" : refs.length ? "property" : choice ? (choice.want === "price" ? "price" : "property") : what.kind === "text" ? said : "other";
  const known = subject ?? (thread.ref ? await subjectFor(thread.ref, settings) : null);

  const patch: Partial<IgThread> = {
    lastInboundAt: when,
    lastMessageAt: when,
    lastText: (text || (what.kind === "reel" ? "Shared a reel" : what.kind === "post" ? "Shared a post" : what.kind === "story" ? "Replied to a story" : "Sent an attachment")).slice(0, 200),
    // A greeting or an unclear line does not overwrite what the conversation is already about.
    topic: topic === "other" || topic === "greeting" ? (thread.topic === "other" ? topic : thread.topic) : topic,
    ...(subject ? { ref: subject.ref, ...subject.ids } : {}),
  };
  const now: IgThread = { ...thread, ...patch };

  if (phone) {
    const leadId = await captureLead(now, phone, text, topic === "number" ? thread.topic : topic);
    patch.leadId = leadId;
    patch.phone = phone;
  }

  // ----- answer, or hand over
  const automatic = settings.dmAuto && !thread.autoPaused && thread.state !== "spam" && Boolean(tokenOf(settings)) && (await recentAutoCount(thread.id)) < AUTO_LIMIT;
  let reply: string | null = null;
  let offer: QuickReply[] | undefined;
  let state: IgState = "needs_you";
  if (automatic) {
    if (phone) {
      reply = await compose("number", settings, known, { number: formatPhoneDisplay(phone) });
      state = "auto";
    } else if (what.kind === "reel" || what.kind === "post") {
      if (subject) {
        reply = await compose("property", settings, subject);
        state = "auto";
      }
    } else if (what.kind !== "text") {
      // A story reply, a photo, a voice note: for a person to read.
    } else if (choice?.want === "price") {
      // The office gives the price on a call: ask for their number, with Instagram's own button for sending it.
      reply = await compose("askNumber", settings, known);
      offer = [{ phone: true }];
      state = "auto";
    } else if (choice && subject) {
      reply = await compose("property", settings, subject);
      state = "auto";
    } else if (refs.length) {
      if (subject) {
        reply = await compose("property", settings, subject);
        state = "auto";
      }
    } else if (said === "sell") {
      // Answered, and still shown to the office: an owner who wants to sell is worth a call.
      reply = await compose("sell", settings, null);
    } else if (said !== "other" && !known) {
      // A hello or a question before any property is known: ask which one they mean.
      reply = await compose("askWhich", settings, null);
      state = "auto";
    }
    // Anything else is the office's, and so is whatever they ask once they have a property's
    // details. Handed over: tell them once that a person will answer, not on every message.
    if (reply === null && thread.state !== "needs_you") reply = (await compose("holding", settings, known)) || null;
  }
  // Once a conversation is waiting for the office it stays there until the office has dealt
  // with it, even if a later line could be answered automatically. Spam stays spam.
  if (thread.state === "needs_you" || thread.state === "spam") state = thread.state;
  patch.unread = state === "auto" ? 0 : thread.unread + 1;

  await updateThread(thread.id, { ...patch, state });
  if (reply) {
    const sent = await sendToThread({ ...now, state }, reply, "auto", settings, { choices: offer });
    if (!sent.ok) await updateThread(thread.id, { state: "needs_you" });
  }
}

/** The property a sent message asked "interested?" about, or "" when it asked no such thing or never went out. */
function askedIn(message: { raw: string; failed: string } | null): string {
  if (!message?.raw || message.failed) return "";
  try {
    const asks = (JSON.parse(message.raw) as { asks?: unknown }).asks;
    return typeof asks === "string" ? asks : "";
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------- a comment on a reel or post

export async function handleComment(value: CommentValue, settings: IgSettings): Promise<void> {
  const commentId = value.comment_id ?? value.id;
  const from = value.from ?? {};
  const text = (value.text ?? "").trim();
  if (!settings.commentAuto || !commentId || !from.id || !text) return;
  // The account's own replies arrive as comments too, and replies between visitors are left alone.
  if (from.id === settings.igUserId || (settings.igUsername && from.username === settings.igUsername) || value.parent_id) return;
  const mid = `comment:${commentId}`;
  if (await messageExists(mid)) return;

  const token = tokenOf(settings);
  if (!token) return;

  const media = value.media?.id ? await findMedia([value.media.id]) : null;
  const subject = media?.ref ? await subjectFor(media.ref, settings) : null;
  // Every comment on a reel tied to a property is answered, unless the office has narrowed it
  // to its own words. On a reel about no one property only a comment that asks is answered.
  const own = splitWords(settings.commentWords);
  if (own.length ? !commentAsks(text, own) : !subject && !commentAsks(text, splitWords(DEFAULT_COMMENT_WORDS))) return;
  const byId = await findThread(from.id);
  const thread = byId ?? (await findThreadByUsername(from.username ?? "")) ?? (await createThread({ igUserId: from.id, username: from.username }));
  const stored = await addMessage({ threadId: thread.id, direction: "in", kind: "comment", sender: "them", text, mid, mediaId: value.media?.id ?? "", mediaTitle: media?.caption.slice(0, 200) ?? "", raw: JSON.stringify(value) });
  if (!stored) return;

  const phone = findPhone(text);
  const patch: Partial<IgThread> = {
    lastMessageAt: new Date(),
    lastText: `Comment: ${text}`.slice(0, 200),
    topic: phone ? "number" : "reel",
    ...(subject ? { ref: subject.ref, ...subject.ids } : {}),
  };
  if (phone) {
    patch.leadId = await captureLead({ ...thread, ...patch }, phone, text, thread.topic);
    patch.phone = phone;
  }

  // On a reel about a property the message is a question with two buttons, Yes and Price, and
  // what they press is answered as a message. It is only asked where that answer will come:
  // with message replies off, or the office already in the conversation, the details go at once.
  const ask = subject && !phone && settings.dmAuto && !thread.autoPaused && thread.state !== "spam" ? subject : null;
  const dm = phone ? await compose("number", settings, subject, { number: formatPhoneDisplay(phone) }) : await compose(ask ? "interest" : subject ? "property" : "askWhich", settings, subject);
  const sent = await sendToThread(
    { ...thread, ...patch },
    dm,
    "auto",
    settings,
    ask
      ? {
          commentId,
          asks: ask.ref,
          choices: [
            { title: INTEREST_BUTTONS.yes, payload: `details:${ask.ref}` },
            { title: INTEREST_BUTTONS.price, payload: `price:${ask.ref}` },
          ],
          plain: `${dm}\n${INTEREST_TYPED}`,
        }
      : { commentId },
  );
  // Answered unless sending failed; a conversation already waiting for the office keeps waiting.
  const state: IgState = !sent.ok || thread.state === "needs_you" ? "needs_you" : thread.state === "spam" ? "spam" : "auto";
  await updateThread(thread.id, { ...patch, state, unread: state === "auto" ? 0 : thread.unread + 1 });
  if (sent.ok) {
    const line = fillTemplate(templateText(settings.templates, "commentPublic"), { username: from.username ? `@${from.username}` : "" });
    if (line) await replyToComment(token, commentId, line).catch(noteError);
  }
}
