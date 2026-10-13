import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import type { IgMessageKind, IgState, IgTopic } from "@/lib/db/enums";
import { getProjectBySlug, getSettings, listRegions } from "@/lib/db/queries";
import { leads, type IgMessage, type IgSettings, type IgThread } from "@/lib/db/schema";
import { googleMapsLink } from "@/lib/geo";
import { pick } from "@/lib/i18n";
import { lookupListing } from "@/lib/listing-detail";
import { priceLine } from "@/lib/pricing";
import { formatPropertyNo } from "@/lib/refs";
import { siteUrl } from "@/lib/site-url";
import { formatArea, formatPhoneDisplay, normalisePhone } from "@/lib/utils";
import { getProfile, IgError, replyToComment, sendPrivateReply, sendText, type Offer } from "./api";
import {
  addMessage,
  claimReminder,
  createThread,
  findMedia,
  findThread,
  findThreadByUsername,
  getIgSettings,
  getMessage,
  getThreadById,
  lastSent,
  markSeen,
  messageExists,
  priceMessagesDue,
  recentAutoCount,
  recentOwn,
  saveIgSettings,
  tokenOf,
  updateMessage,
  updateThread,
  wasReminded,
  wroteSince,
} from "./store";
import { fillTemplate, INTEREST_BUTTONS, INTEREST_TYPED, templateText, type TemplateKey } from "./templates";
import { answerOf, commentAsks, DEFAULT_COMMENT_WORDS, findPhone, findRefs, isAck, splitWords, topicOf } from "./understand";

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
  /** A press on a button inside one of the account's messages. */
  postback?: { mid?: string; title?: string; payload?: string };
  /** They opened the conversation; `mid` is the last message they saw. */
  read?: { mid?: string };
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
        if (event.read) await handleSeen(event, entry.id ?? "");
        else await handleMessage(event, settings, entry.id ?? "");
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
    // Size only. The office gives prices on a call, so no automatic message carries one, even
    // for a listing that shows its price on the website.
    facts: [d.dimension ? `${d.dimension} ft` : "", d.areaSqft ? formatArea(d.areaSqft, d.areaUnit) : ""].filter(Boolean).join(" · "),
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

/** "Interested in this property?" with its two buttons, for a comment on its reel or the reel sent in a message. */
async function interestIn(subject: Subject, settings: IgSettings): Promise<{ text: string; via: SendWith }> {
  const text = await compose("interest", settings, subject);
  const buttons = [
    { title: INTEREST_BUTTONS.details, payload: `details:${subject.ref}` },
    { title: INTEREST_BUTTONS.price, payload: `price:${subject.ref}` },
  ];
  // Inside the message's own bubble; should Instagram refuse that, as suggestions above the keyboard; failing both, spelt out.
  return { text, via: { asks: subject.ref, offers: [{ buttons }, { choices: buttons }], plain: `${text}\n${INTEREST_TYPED}` } };
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
  /** Ways of putting buttons with the message, the preferred first, and the words to send alone should Instagram refuse them all. */
  offers?: Offer[];
  plain?: string;
  /** The property this message asks "interested?" about, kept with it so a typed answer can be placed. */
  asks?: string;
  /** Which of the set replies this is, kept with it so the same one is not sent twice running. */
  is?: string;
};

const lookOf = (offer?: Offer) => (!offer ? "plain" : "buttons" in offer ? "buttons" : "suggestions");

/**
 * Sends a message and files it. The row is written before Instagram is called, because
 * Instagram echoes every sent message back and the echo must find it already there.
 */
export async function sendToThread(thread: IgThread, text: string, sender: "auto" | "office", settings: IgSettings, via: SendWith = {}): Promise<{ ok: boolean; error?: string }> {
  const token = tokenOf(settings);
  const offers = via.offers ?? [];
  // Kept with the message: what it asks, and how its buttons went out.
  const note = (offer?: Offer) => (via.asks || via.is || offers.length ? JSON.stringify({ ...(via.asks ? { asks: via.asks } : {}), ...(via.is ? { is: via.is } : {}), ...(offers.length ? { look: lookOf(offer) } : {}) }) : "");
  const row = await addMessage({ threadId: thread.id, direction: "out", kind: "text", sender, text, raw: note(offers[0]) });
  if (!token) {
    if (row) await updateMessage(row.id, { failed: "Instagram is not connected yet." });
    return { ok: false, error: "Instagram is not connected yet." };
  }
  const send = (words: string, offer?: Offer) => (via.commentId ? sendPrivateReply(token, via.commentId, words, offer) : sendText(token, thread.igUserId, words, offer));
  let words = text;
  try {
    let sent: Awaited<ReturnType<typeof send>> | null = null;
    for (const offer of offers) {
      try {
        if (row && offer !== offers[0]) await updateMessage(row.id, { raw: note(offer) });
        sent = await send(text, offer);
        break;
      } catch (error) {
        // Instagram answered and said no, so nothing went out, and the buttons may be what it
        // refused: the next way is tried. A call that got no answer at all is never repeated,
        // since the message may have gone.
        if (!(error instanceof IgError) || error.status < 400 || error.status >= 500) throw error;
      }
    }
    if (!sent) {
      if (offers.length) {
        words = via.plain ?? text;
        if (row) await updateMessage(row.id, { text: words, raw: note() });
      }
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

/**
 * Instagram's word that someone opened the conversation. It is the nearest thing to knowing
 * a message reached them: one left in their message requests is not reported as read.
 */
async function handleSeen(event: MessagingEvent, accountId: string): Promise<void> {
  const them = event.sender?.id;
  if (!them || them === accountId) return;
  const thread = await findThread(them);
  if (thread) await markSeen(thread.id, event.read?.mid ?? "", event.timestamp ? new Date(event.timestamp) : new Date());
}

/** A press on a button inside one of the account's messages, read as a message that says the button's words. */
function pressed(event: MessagingEvent): MessagingEvent["message"] {
  const p = event.postback;
  if (!p) return undefined;
  return { mid: p.mid || `press:${event.sender?.id ?? ""}:${event.timestamp ?? ""}`, text: p.title ?? "", quick_reply: { payload: p.payload } };
}

/**
 * Which of the site's own recent messages an echo is. The same words, as a rule. A message
 * with buttons comes back without plain text, so it is known by its words inside the echo, by
 * being the one that went out with buttons, or by being the one still waiting for Instagram's id.
 */
async function ownEcho(threadId: number, text: string, message: NonNullable<MessagingEvent["message"]>): Promise<IgMessage | null> {
  const recent = await recentOwn(threadId);
  if (text) return recent.find((m) => m.text === text) ?? null;
  const whole = JSON.stringify(message);
  const template = (message.attachments ?? []).some((a) => a.type === "template");
  return (
    recent.find((m) => m.text && whole.includes(JSON.stringify(m.text).slice(1, -1))) ??
    (template ? recent.find((m) => m.raw.includes('"look":"buttons"')) : undefined) ??
    recent.find((m) => !m.mid && !m.failed && Date.now() - m.createdAt.getTime() < 60_000) ??
    null
  );
}

async function handleMessage(event: MessagingEvent, settings: IgSettings, accountId: string): Promise<void> {
  const message = event.message ?? pressed(event);
  if (!message?.mid || message.is_deleted) return; // reactions, read receipts and the like
  const echo = message.is_echo === true;
  const them = echo ? event.recipient?.id : event.sender?.id;
  if (!them || them === accountId || (settings.igUserId && them === settings.igUserId)) return;
  if (await messageExists(message.mid)) return;

  const text = (message.text ?? "").trim();
  // Under a phone number someone sends, Instagram adds a card of its own ("Phone number", with
  // Call and WhatsApp) and reports it as a second message from them: a bare template, no words.
  // It is not theirs, and answering it would follow the thank-you with a second reply.
  const cards = message.attachments ?? [];
  if (!echo && !text && cards.length > 0 && cards.every((a) => a.type === "template")) return;
  const thread = await threadFor(them, settings);
  const when = event.timestamp ? new Date(event.timestamp) : new Date();

  if (echo) {
    // Sent from this site a moment ago: only note Instagram's id for it.
    const own = await ownEcho(thread.id, text, message);
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
  // What was last said to them decides how a short answer is read.
  const last: ReturnType<typeof noteOf> = what.kind === "text" && !choice ? noteOf(await lastSent(thread.id)) : {};
  if (!choice && what.kind === "text" && !phone && !refs.length) {
    const want = last.asks ? answerOf(text) : null;
    if (want && last.asks) choice = { want, ref: last.asks };
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
  // Someone whose number is already on file as a buyer's says they want to sell: the lead follows.
  const leadId = patch.leadId ?? thread.leadId;
  if (said === "sell" && leadId) await (await getDb()).update(leads).set({ kind: "sell" }).where(eq(leads.id, leadId));

  // ----- answer, or hand over
  const live = settings.dmAuto && thread.state !== "spam" && Boolean(tokenOf(settings)) && (await recentAutoCount(thread.id)) < AUTO_LIMIT;
  const automatic = live && !thread.autoPaused;
  let reply: string | null = null;
  let via: SendWith = {};
  let state: IgState = "needs_you";
  // A bare "ok" or thumbs up asks nothing: no reply, and the conversation stays where it was.
  const quiet = automatic && what.kind === "text" && !phone && !choice && !refs.length && isAck(text);
  if (quiet) {
    state = thread.state;
  } else if (automatic) {
    if (phone) {
      reply = await compose("number", settings, known, { number: formatPhoneDisplay(phone) });
      state = "auto";
    } else if (what.kind === "reel" || what.kind === "post") {
      // A reel about a property, sent in a message: the same question a comment on it gets.
      if (subject) {
        ({ text: reply, via } = await interestIn(subject, settings));
        state = "auto";
      }
    } else if (what.kind !== "text") {
      // A story reply, a photo, a voice note: for a person to read.
    } else if (choice?.want === "price") {
      // The office gives the price on a call, so the Price button asks for their number.
      reply = await compose("askNumber", settings, known);
      via = { is: "askNumber" };
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
    } else if (said === "price" && last.is !== "askNumber") {
      // The price asked in their own words, at any point: the same answer as the button. Asked
      // again straight after it, the words are not repeated; a person takes it from there.
      reply = await compose("askNumber", settings, known);
      via = { is: "askNumber" };
      state = "auto";
    } else if (said !== "other" && !known) {
      // A hello or a question before any property is known: ask which one they mean.
      reply = await compose("askWhich", settings, null);
      state = "auto";
    }
    // Anything else is the office's, and so is whatever they ask once they have a property's
    // details. Handed over: tell them once that a person will answer, not on every message.
    if (reply === null && thread.state !== "needs_you") reply = (await compose("holding", settings, known)) || null;
  } else if (live && phone) {
    // The office is in this conversation, and it still gets the number to deal with. But the
    // person is thanked all the same: silence after a number leaves them asking whether it arrived.
    reply = await compose("number", settings, known, { number: formatPhoneDisplay(phone) });
  }
  // Once a conversation is waiting for the office it stays there until the office has dealt
  // with it, even if a later line could be answered automatically. Spam stays spam.
  if (thread.state === "needs_you" || thread.state === "spam") state = thread.state;
  patch.unread = quiet ? thread.unread : state === "auto" ? 0 : thread.unread + 1;

  await updateThread(thread.id, { ...patch, state });
  if (reply) {
    const sent = await sendToThread({ ...now, state }, reply, "auto", settings, via);
    if (!sent.ok) await updateThread(thread.id, { state: "needs_you" });
  }
}

/**
 * What was kept with a sent message: the property it asked "interested?" about, or which of
 * the set replies it was. Empty for a message that carried neither, or that never went out.
 */
function noteOf(message: { raw: string; failed: string } | null): { asks?: string; is?: string } {
  if (!message?.raw || message.failed) return {};
  try {
    const kept = JSON.parse(message.raw) as { asks?: unknown; is?: unknown };
    return { asks: typeof kept.asks === "string" ? kept.asks : undefined, is: typeof kept.is === "string" ? kept.is : undefined };
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------- one reminder after the price

/** A reminder goes half an hour after the price message, and not at all once two hours have passed. */
const REMIND_AFTER = 30 * 60 * 1000;
const REMIND_UNTIL = 2 * 60 * 60 * 1000;
/** Instagram allows a message for 24 hours after theirs; an hour is kept in hand. */
const REPLY_WINDOW = 23 * 60 * 60 * 1000;

/**
 * Someone asked the price, was asked for their number, and has sent nothing since (an "ok"
 * aside): one reminder, half an hour on. Each price message is looked at once, and a
 * conversation is reminded once ever. Left alone: anyone the office is talking to, anyone
 * who has given a number, and anyone who went on to something else. Run by the
 * minute-by-minute check.
 */
export async function remindAboutPrice(now = new Date()): Promise<number> {
  const settings = await getIgSettings();
  if (!settings.dmAuto || !tokenOf(settings)) return 0;
  let reminded = 0;
  for (const asked of await priceMessagesDue(new Date(now.getTime() - REMIND_UNTIL), new Date(now.getTime() - REMIND_AFTER))) {
    if (!(await claimReminder(asked))) continue;
    const thread = await getThreadById(asked.threadId);
    if (!thread || thread.autoPaused || thread.state !== "auto" || thread.phone || thread.leadId || !thread.ref) continue;
    if (!thread.lastInboundAt || now.getTime() - thread.lastInboundAt.getTime() > REPLY_WINDOW) continue;
    if ((await lastSent(thread.id))?.id !== asked.id || (await wasReminded(thread.id))) continue;
    if ((await wroteSince(thread.id, asked.id)).some((text) => !isAck(text))) continue;
    const subject = await subjectFor(thread.ref, settings);
    if (!subject) continue;
    const sent = await sendToThread(thread, await compose("remind", settings, subject), "auto", settings, { is: "remind" });
    if (sent.ok) reminded++;
  }
  return reminded;
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
  const ask = subject && !phone && settings.dmAuto && !thread.autoPaused && thread.state !== "spam" ? await interestIn(subject, settings) : null;
  const dm = phone ? await compose("number", settings, subject, { number: formatPhoneDisplay(phone) }) : (ask?.text ?? (await compose(subject ? "property" : "askWhich", settings, subject)));
  const sent = await sendToThread({ ...thread, ...patch }, dm, "auto", settings, { ...ask?.via, commentId });
  // Answered unless sending failed; a conversation already waiting for the office keeps waiting.
  const state: IgState = !sent.ok || thread.state === "needs_you" ? "needs_you" : thread.state === "spam" ? "spam" : "auto";
  await updateThread(thread.id, { ...patch, state, unread: state === "auto" ? 0 : thread.unread + 1 });
  if (sent.ok) {
    const line = fillTemplate(templateText(settings.templates, "commentPublic"), { username: from.username ? `@${from.username}` : "" });
    if (line) await replyToComment(token, commentId, line).catch(noteError);
  }
}
