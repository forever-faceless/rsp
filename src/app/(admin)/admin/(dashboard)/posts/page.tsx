import { ExternalLink, Film, ImageIcon, Send } from "lucide-react";
import Link from "next/link";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { ChangePost } from "@/components/admin/posts/ChangePost";
import { PostForm } from "@/components/admin/posts/PostForm";
import { ConfirmButton, PageHeader, Section, SubmitButton } from "@/components/admin/ui";
import { changePost, deletePost, postNow, schedulePost } from "@/lib/actions/posts";
import { listSurveyTargets } from "@/lib/db/queries";
import type { IgPost, IgPostStatus } from "@/lib/db/schema";
import { checkAsleep, formTimes, listPosts } from "@/lib/instagram/posts";
import { getIgSettings, tokenOf } from "@/lib/instagram/store";
import { formatRef } from "@/lib/refs";
import { cn, formatDateTime, istInputValue } from "@/lib/utils";

export const metadata = { title: "Posts" };

const STATUS_LABEL: Record<IgPostStatus, string> = {
  scheduled: "Scheduled",
  processing: "Instagram is preparing it",
  publishing: "Going up now",
  published: "Posted",
  failed: "Did not go out",
};

const STATUS_TONE: Record<IgPostStatus, string> = {
  scheduled: "bg-navy-100 text-navy-700",
  processing: "bg-gold-100 text-gold-800",
  publishing: "bg-gold-100 text-gold-800",
  published: "bg-success-100 text-success-700",
  failed: "bg-danger-100 text-danger-700",
};

/** The file as a small picture beside its row, while the site still holds it. */
function Thumb({ post }: { post: IgPost }) {
  const frame = "flex h-24 w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-navy-950 text-gold-300";
  if (!post.fileUrl) return <span className={frame}>{post.kind === "reel" ? <Film className="h-5 w-5" aria-hidden="true" /> : <ImageIcon className="h-5 w-5" aria-hidden="true" />}</span>;
  return (
    <span className={frame}>
      {post.kind === "reel" ? (
        <video src={post.fileUrl} preload="metadata" muted playsInline className="h-full w-full object-cover" />
      ) : (
        // Shown at thumbnail size from where it is stored; the picture itself is for Instagram.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.fileUrl} alt="" className="h-full w-full object-cover" />
      )}
    </span>
  );
}

/** Reels and photos lined up for Instagram, what has gone out, and what did not. */
export default async function PostsPage() {
  const [posts, settings, targets] = await Promise.all([listPosts(), getIgSettings(), listSurveyTargets()]);
  const options = targets.map((t) => {
    const ref = formatRef(t.prefix, t.propertyNo, t.siteNo);
    return { value: ref, label: `${ref} · ${t.siteNo != null ? `Site in ${t.label}` : t.label}` };
  });
  const { defaultWhen, minWhen } = formTimes();

  const waiting = posts.filter((p) => p.status === "scheduled" || p.status === "processing" || p.status === "publishing").sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const failed = posts.filter((p) => p.status === "failed");
  const done = posts.filter((p) => p.status === "published").slice(0, 30);
  const connected = Boolean(tokenOf(settings));
  // Vercel calls the site every minute; that call is what sends a post when its time comes.
  const asleep = checkAsleep(settings.lastCronAt);

  return (
    <>
      <AutoRefresh seconds={20} />
      <PageHeader title="Posts" description="Reels and photos that go out on Instagram at the time you choose." />

      {!connected ? (
        <p className="mb-5 rounded-[3px] border border-navy-900/15 bg-navy-50 px-4 py-3 text-[14px] text-navy-800">
          Instagram is not connected yet, so nothing can go out.{" "}
          <Link href="/admin/instagram" className="font-semibold underline decoration-gold-500 decoration-2 underline-offset-4">
            See what is needed
          </Link>
          .
        </p>
      ) : asleep ? (
        <p className="mb-5 rounded-[3px] border border-danger-600/25 bg-danger-100 px-4 py-3 text-[14px] text-danger-700" data-posts-asleep>
          {settings.lastCronAt ? (
            <>
              The site last checked for posts to send on <span className="num">{formatDateTime(settings.lastCronAt)}</span>. It should check every minute, so nothing will go out until that is running again.
            </>
          ) : (
            "The site has not yet checked for posts to send. It should check every minute; nothing will go out until it does."
          )}
        </p>
      ) : null}

      <div className="space-y-6">
        <Section title="Schedule a post" description="Choose the file, write the caption, pick the time. The site puts it up for you.">
          <PostForm action={schedulePost} options={options} defaultWhen={defaultWhen} minWhen={minWhen} />
        </Section>

        <Section title="Coming up" description={waiting.length ? undefined : "Nothing is waiting to go out."}>
          {waiting.length ? (
            <ul className="space-y-3" data-posts-waiting>
              {waiting.map((p) => (
                <li key={p.id} className="rounded-[4px] border border-navy-900/10 bg-paper-0 p-3.5" data-post={p.id}>
                  <div className="flex gap-3.5">
                    <Thumb post={p} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-500">
                        <span className={cn("badge", STATUS_TONE[p.status])}>{STATUS_LABEL[p.status]}</span>
                        <span className="badge bg-paper-200 text-ink-700">{p.kind === "reel" ? "Reel" : "Photo"}</span>
                        {p.ref ? <span className="ref">{p.ref}</span> : null}
                      </p>
                      <p className="num mt-1.5 text-[15px] font-semibold text-navy-900">{formatDateTime(p.scheduledAt)}</p>
                      <p className="mt-1 line-clamp-3 whitespace-pre-line text-[14px] text-ink-700">{p.caption || "No caption"}</p>
                    </div>
                  </div>
                  {p.status === "scheduled" ? (
                    <>
                      <ChangePost action={changePost.bind(null, p.id)} post={{ id: p.id, caption: p.caption, when: istInputValue(p.scheduledAt), ref: p.ref }} options={options} minWhen={minWhen} />
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-navy-900/8 pt-3">
                        <form action={postNow.bind(null, p.id)}>
                          <SubmitButton className="btn-sm" variant="outline">
                            <Send className="h-3.5 w-3.5" aria-hidden="true" /> Post now
                          </SubmitButton>
                        </form>
                        <ConfirmButton action={deletePost.bind(null, p.id)} label="Delete" confirmLabel="Yes, delete it" />
                      </div>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Section>

        {failed.length ? (
          <Section title="Did not go out" description="Each says why. Put it right and send it again, or delete it.">
            <ul className="space-y-3" data-posts-failed>
              {failed.map((p) => (
                <li key={p.id} className="rounded-[4px] border border-danger-600/25 bg-paper-0 p-3.5" data-post={p.id}>
                  <div className="flex gap-3.5">
                    <Thumb post={p} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-500">
                        <span className={cn("badge", STATUS_TONE.failed)}>{STATUS_LABEL.failed}</span>
                        {p.ref ? <span className="ref">{p.ref}</span> : null}
                        <span className="num">{formatDateTime(p.scheduledAt)}</span>
                      </p>
                      <p className="mt-1.5 text-[14px] font-medium text-danger-700">{p.error || "Instagram did not take it."}</p>
                      <p className="mt-1 line-clamp-2 whitespace-pre-line text-[14px] text-ink-700">{p.caption || "No caption"}</p>
                    </div>
                  </div>
                  <ChangePost action={changePost.bind(null, p.id)} post={{ id: p.id, caption: p.caption, when: defaultWhen, ref: p.ref }} options={options} minWhen={minWhen} />
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-navy-900/8 pt-3">
                    <form action={postNow.bind(null, p.id)}>
                      <SubmitButton className="btn-sm" variant="outline">
                        <Send className="h-3.5 w-3.5" aria-hidden="true" /> Try again now
                      </SubmitButton>
                    </form>
                    <ConfirmButton action={deletePost.bind(null, p.id)} label="Delete" confirmLabel="Yes, delete it" />
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="Posted" description={done.length ? "What the site has put up for you. Deleting one here only takes it off this list; it stays on Instagram." : "Nothing has gone out from here yet."}>
          {done.length ? (
            <ul className="divide-y divide-navy-900/8" data-posts-done>
              {done.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3" data-post={p.id}>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-500">
                      <span className="badge bg-paper-200 text-ink-700">{p.kind === "reel" ? "Reel" : "Photo"}</span>
                      {p.ref ? <span className="ref">{p.ref}</span> : null}
                      <span className="num">{formatDateTime(p.publishedAt ?? p.scheduledAt)}</span>
                    </p>
                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-[14px] text-ink-700">{p.caption || "No caption"}</p>
                  </div>
                  {p.permalink ? (
                    <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                      View on Instagram <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                  <ConfirmButton action={deletePost.bind(null, p.id)} label="Remove" confirmLabel="Yes, remove from the list" icon={false} />
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      </div>
    </>
  );
}
