import { ArrowUpRight, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ProjectWithCounts } from "@/lib/db/queries";
import { fill, localePath, pick, type Dictionary, type Locale } from "@/lib/i18n";
import { formatPropertyNo } from "@/lib/refs";
import { cn, formatINRShort, formatNumber } from "@/lib/utils";
import { LayoutGlyph } from "./ListingMedia";
import { ProjectStatusBadge } from "./StatusBadge";

type Props = { project: ProjectWithCounts; locale: Locale; dict: Dictionary; priority?: boolean; className?: string };

export function ProjectCard({ project, locale, dict, priority, className }: Props) {
  const name = pick(project, "name", locale);
  const href = localePath(locale, `/projects/${project.slug}`);
  const total = project.totalSites ?? project.siteCount;
  const listed = project.siteCount;
  const available = project.status === "sold_out" ? 0 : project.availableCount;
  const share = listed > 0 ? Math.round((available / listed) * 100) : 0;
  const tagline = pick(project, "tagline", locale);
  const location = pick(project, "location", locale);
  // Only the figures that are known are shown; a blank cell reads as a missing answer.
  const facts = [
    { label: dict.projects.totalSites, value: total ? formatNumber(total) : "" },
    { label: dict.projects.area, value: project.totalAreaAcres ? `${project.totalAreaAcres} ${dict.common.acres}` : "" },
    project.callForPrice ? { label: dict.common.price, value: dict.common.onRequest } : { label: dict.common.from, value: project.priceFrom ? formatINRShort(project.priceFrom, locale) : "" },
  ].filter((f) => f.value);

  return (
    <article className={cn("card card-hover group relative flex h-full flex-col overflow-hidden", className)}>
      <div className="relative">
        {project.coverImage ? (
          <div className="relative aspect-[16/10] overflow-hidden bg-paper-200">
            <Image
              src={project.coverImage}
              alt={name}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          </div>
        ) : (
          <LayoutGlyph total={total} available={available} className="aspect-[16/10]" />
        )}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="ref">{formatPropertyNo(project.prefix, project.propertyNo)}</span>
          <ProjectStatusBadge status={project.status} label={dict.status.project[project.status]} className="shadow-card" />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h3 className="text-[1.35rem] leading-snug">
          <Link href={href} className="after:absolute after:inset-0">
            {name}
          </Link>
        </h3>
        {location ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-[14px] text-ink-500">
            <MapPin className="mt-[3px] h-3.5 w-3.5 shrink-0 text-gold-600" aria-hidden="true" />
            {location}
          </p>
        ) : null}
        {tagline ? <p className="mt-3 text-[14.5px] leading-relaxed text-ink-600">{tagline}</p> : null}

        {facts.length ? (
          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-navy-900/8 pt-4">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="label-mono">{f.label}</dt>
                <dd className="num mt-1 text-[15px] font-semibold text-navy-900">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {listed > 0 ? (
          <div className="mt-5">
            <div className="flex items-center justify-between text-[12.5px] text-ink-600">
              <span>{fill(dict.projects.availability, { available, total: listed })}</span>
            </div>
            <div className="mt-2 h-[3px] w-full bg-navy-900/10" role="presentation">
              <div className="h-full bg-gold-500 transition-[width] duration-700" style={{ width: `${share}%` }} />
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-6">
          <span className="text-[14px] font-semibold text-navy-800">{dict.common.viewProject}</span>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[3px] border border-navy-900/15 text-navy-800 transition-colors duration-300 group-hover:border-navy-800 group-hover:bg-navy-800 group-hover:text-gold-200">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </article>
  );
}
