import { Check, ExternalLink, X } from "lucide-react";
import { InstagramSettingsForm, StatusButton } from "@/components/admin/inbox/InstagramSettingsForm";
import { EmptyState, PageHeader, Section, SubmitButton } from "@/components/admin/ui";
import { checkInstagram, saveInstagramSettings, syncReels, tieMedia } from "@/lib/actions/instagram";
import { listSurveyTargets } from "@/lib/db/queries";
import { getIgSettings, listIgMedia, tokenOf, webhookConfigured } from "@/lib/instagram/store";
import { formatRef } from "@/lib/refs";
import { siteUrl } from "@/lib/site-url";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Instagram" };

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px]">
      <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", done ? "bg-success-600 text-paper-0" : "bg-paper-200 text-ink-500")}>
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
      </span>
      <span className={done ? "text-ink-800" : "text-ink-600"}>{children}</span>
    </li>
  );
}

/** The connection to Instagram, the automatic replies, and which reel is about which property. */
export default async function InstagramPage() {
  const [settings, media, targets] = await Promise.all([getIgSettings(), listIgMedia(), listSurveyTargets()]);
  const hasToken = Boolean(tokenOf(settings));
  const hooked = webhookConfigured();
  const options = targets.map((t) => {
    const ref = formatRef(t.prefix, t.propertyNo, t.siteNo);
    return { value: ref, label: `${ref} · ${t.siteNo != null ? `Site in ${t.label}` : t.label}` };
  });
  const tied = media.filter((m) => m.ref).length;

  return (
    <>
      <PageHeader title="Instagram" description="Automatic replies to messages and comments, and which reel belongs to which property." back={{ href: "/admin/inbox", label: "Inbox" }} />

      <div className="space-y-6">
        <Section title="Connection" description="Set up once with Meta. Nothing here is ever shown on the website.">
          <ul className="space-y-2.5" data-ig-connection>
            <Step done={hooked}>
              {hooked ? "The site can check that what arrives really comes from Instagram." : "The app secret and the verify word are not in Vercel yet (IG_APP_SECRET and IG_VERIFY_TOKEN)."}
            </Step>
            <Step done={hasToken}>{hasToken ? "The site has the key to send messages as your account." : "The access token is not in Vercel yet (IG_ACCESS_TOKEN)."}</Step>
            <Step done={Boolean(settings.igUsername)}>{settings.igUsername ? `Connected as @${settings.igUsername}.` : "Not checked against Instagram yet. Press Check the connection."}</Step>
            <Step done={Boolean(settings.lastWebhookAt)}>
              {settings.lastWebhookAt ? (
                <>
                  Instagram last spoke to the site on <span className="num">{formatDateTime(settings.lastWebhookAt)}</span>.
                </>
              ) : (
                "Instagram has not sent the site anything yet."
              )}
            </Step>
          </ul>
          <div className="mt-4 rounded-[3px] border border-navy-900/12 bg-paper-100 px-4 py-3 text-[13.5px] text-ink-700">
            <p>
              Address Meta sends to (the callback URL): <span className="num break-all font-semibold text-navy-900">{siteUrl()}/api/instagram/webhook</span>
            </p>
            {settings.tokenExpiresAt ? (
              <p className="mt-1">
                The access token is renewed by itself; the current one is good until <span className="num">{formatDate(settings.tokenExpiresAt)}</span>.
              </p>
            ) : null}
            {settings.lastError ? <p className="mt-1 text-danger-700">Last problem: {settings.lastError}</p> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            <StatusButton action={checkInstagram}>Check the connection</StatusButton>
          </div>
        </Section>

        <Section title="Automatic replies" description="Tick the two boxes and press Save. Whatever the automation does not answer comes to you in the Inbox.">
          <InstagramSettingsForm
            action={saveInstagramSettings}
            values={{ dmAuto: settings.dmAuto, commentAuto: settings.commentAuto, commentWords: settings.commentWords, linkLocale: settings.linkLocale, templates: settings.templates ?? {} }}
          />
        </Section>

        <Section
          id="reels"
          title="Reels and posts"
          description="Tie each reel to its property. Someone who shares that reel in a message, or comments on it, then gets that property's details. A caption that carries the property number is tied by itself."
          aside={<StatusButton action={syncReels}>Bring in from Instagram</StatusButton>}
        >
          {media.length ? (
            <>
              <p className="mb-3 text-[13px] text-ink-500">
                {tied} of {media.length} tied to a property.
              </p>
              <ul className="space-y-2.5" data-ig-media>
                {media.map((m) => (
                  <li key={m.id} className="rounded-[4px] border border-navy-900/10 bg-paper-0 p-3.5">
                    <form action={tieMedia.bind(null, m.id)} className="grid gap-3 md:grid-cols-[1fr_18rem_auto] md:items-center">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-500">
                          <span className="badge bg-paper-200 text-ink-700">{m.kind === "post" ? "Post" : "Reel"}</span>
                          {m.postedAt ? <span className="num">{formatDate(m.postedAt)}</span> : <span>Learnt from a shared reel</span>}
                          {m.permalink ? (
                            <a href={m.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
                              View <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          ) : null}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[14px] text-ink-800">{m.caption || "No caption"}</p>
                      </div>
                      <select name="ref" defaultValue={m.ref} aria-label="Property this is about" className="field !py-2 text-[14px]">
                        <option value="">Not about one property</option>
                        {m.ref && !options.some((o) => o.value === m.ref) ? <option value={m.ref}>{m.ref}</option> : null}
                        {options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <SubmitButton className="btn-sm" variant="outline">
                        Save
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyState title="No reels brought in yet" text="Once Instagram is connected, press Bring in from Instagram. Reels people share in messages are also added here as they arrive." />
          )}
        </Section>
      </div>
    </>
  );
}
