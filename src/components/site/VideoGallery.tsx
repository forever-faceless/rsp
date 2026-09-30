import { ExternalLink, Play } from "lucide-react";
import type { VideoItem } from "@/lib/db/enums";
import { cn, youtubeEmbedUrl } from "@/lib/utils";

/** Hosted files play in place, YouTube links are embedded, and anything else opens where it lives. */
export function VideoGallery({ videos, title, watchLabel, className }: { videos: VideoItem[]; title: string; watchLabel: string; className?: string }) {
  if (!videos.length) return null;
  return (
    <ul className={cn("grid gap-4", videos.length > 1 && "sm:grid-cols-2", className)}>
      {videos.map((v, i) => {
        const name = v.title || `${title} ${i + 1}`;
        const embed = v.kind === "link" ? youtubeEmbedUrl(v.url) : null;
        if (v.kind === "file") {
          return (
            <li key={v.url}>
              <video controls preload="metadata" playsInline className="aspect-video w-full bg-navy-950" aria-label={name}>
                <source src={v.url} />
              </video>
              {v.title ? <p className="mt-2 text-[14px] font-medium text-ink-700">{v.title}</p> : null}
            </li>
          );
        }
        if (embed) {
          return (
            <li key={v.url}>
              <iframe
                src={embed}
                title={name}
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="aspect-video w-full border-0 bg-navy-950"
              />
              {v.title ? <p className="mt-2 text-[14px] font-medium text-ink-700">{v.title}</p> : null}
            </li>
          );
        }
        let host = "";
        try {
          host = new URL(v.url).hostname.replace(/^www\./, "");
        } catch {
          host = "";
        }
        return (
          <li key={v.url}>
            <a
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="surface-navy bg-grid-dark group flex aspect-video flex-col items-center justify-center gap-3 p-6 text-center transition-colors hover:bg-navy-800"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold-300/50 text-gold-300 transition-transform duration-300 group-hover:scale-110">
                <Play className="h-5 w-5 translate-x-0.5" aria-hidden="true" />
              </span>
              <span className="text-[15px] font-semibold text-paper-50">{v.title || watchLabel}</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-navy-300">
                {host} <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
