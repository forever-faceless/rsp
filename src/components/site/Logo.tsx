import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  tone?: "light" | "dark";
  tagline?: string;
  className?: string;
  size?: "sm" | "md";
};

/**
 * The company logo in its wide form: the house mark with "VENTURES" beside it, cut from the
 * supplied artwork. The gold reads on paper and on navy alike, so one file serves both. It is
 * a ready-made file rather than a resized one, so it never waits on image processing.
 */
export function Logo({ href, tone = "light", tagline, className, size = "md" }: Props) {
  const dark = tone === "dark";
  return (
    <Link href={href} className={cn("group inline-flex shrink-0 flex-col items-start", className)} aria-label="RSP Ventures">
      <Image src="/brand/logo-wide-sm.webp" alt="" width={687} height={160} priority unoptimized className={cn("w-auto", size === "sm" ? "h-8" : "h-9 sm:h-[50px]")} />
      {tagline ? (
        <span className={cn("mt-1.5 whitespace-nowrap font-mono text-[9px] font-medium uppercase tracking-[0.2em] sm:text-[9.5px] sm:tracking-[0.26em]", dark ? "text-navy-300" : "text-ink-500")}>{tagline}</span>
      ) : null}
    </Link>
  );
}
