import Image from "next/image";
import type { Facing, SurveyCorner } from "@/lib/db/enums";
import { planFromCorners, planFromDimensions } from "@/lib/plan";
import { cn } from "@/lib/utils";
import { PlotPlan } from "./PlotPlan";

type Props = {
  src?: string | null;
  alt: string;
  /** Used for the drawing that stands in when there is no photograph yet. */
  corners?: SurveyCorner[] | null;
  widthFt?: number | null;
  depthFt?: number | null;
  facing?: Facing | null;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
};

/**
 * The picture at the top of a card. With no photograph it shows the plot's own outline on
 * drafting paper, so a listing without pictures still looks deliberate and says something true.
 */
export function ListingMedia({ src, alt, corners, widthFt, depthFt, facing, sizes = "100vw", priority, className, imageClassName }: Props) {
  if (src) {
    return (
      <div className={cn("relative overflow-hidden bg-paper-200", className)}>
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={cn("object-cover", imageClassName)} />
      </div>
    );
  }
  const shape = (corners && corners.length >= 3 ? planFromCorners(corners) : null) ?? planFromDimensions(widthFt ?? null, depthFt ?? null, facing);
  return (
    <div className={cn("bg-grid relative flex items-center justify-center overflow-hidden bg-paper-100 px-10 pb-7 pt-12", className)}>
      {shape ? (
        <PlotPlan shape={shape} detail="mini" width={400} height={300} className="h-full w-full" title={alt} />
      ) : (
        <svg viewBox="0 0 120 90" className="w-[38%] text-navy-800/35" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
          <path d="M14 70 40 22h46l20 48Z" strokeDasharray="5 4" />
          <path d="M60 10v14M54 16l6-6 6 6" />
        </svg>
      )}
    </div>
  );
}

/**
 * A schematic of a layout: two rows of plots either side of a road, shaded by how many are
 * still available. Stands in for a project that has no cover photograph.
 */
export function LayoutGlyph({ total, available, className }: { total: number; available: number; className?: string }) {
  const count = Math.max(8, Math.min(28, total || 16));
  const perRow = Math.ceil(count / 2);
  const openShare = total > 0 ? available / total : 0.5;
  const w = 400;
  const h = 300;
  const pad = 34;
  const gap = 5;
  const cellW = (w - pad * 2 - gap * (perRow - 1)) / perRow;
  const cellH = 74;
  const roadH = 30;
  const top = (h - (cellH * 2 + roadH)) / 2;
  const cells: { x: number; y: number; open: boolean }[] = [];
  for (let i = 0; i < perRow * 2; i++) {
    const row = i < perRow ? 0 : 1;
    const col = i % perRow;
    // Spread the available plots evenly instead of bunching them at one end.
    const open = Math.floor((i + 1) * openShare) > Math.floor(i * openShare);
    cells.push({ x: pad + col * (cellW + gap), y: top + row * (cellH + roadH), open });
  }
  return (
    <div className={cn("bg-grid relative flex items-center justify-center overflow-hidden bg-paper-100", className)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" aria-hidden="true">
        <rect x={pad - 12} y={top - 12} width={w - pad * 2 + 24} height={cellH * 2 + roadH + 24} fill="none" stroke="var(--color-navy-800)" strokeOpacity={0.35} strokeDasharray="6 5" />
        <line x1={pad - 12} x2={w - pad + 12} y1={top + cellH + roadH / 2} y2={top + cellH + roadH / 2} stroke="var(--color-navy-800)" strokeOpacity={0.3} strokeDasharray="10 8" />
        {cells.map((c, i) => (
          <rect
            key={i}
            x={c.x}
            y={c.y}
            width={cellW}
            height={cellH}
            fill={c.open ? "rgb(215 181 109 / 0.3)" : "rgb(20 38 63 / 0.1)"}
            stroke={c.open ? "var(--color-gold-600)" : "var(--color-navy-800)"}
            strokeOpacity={c.open ? 0.9 : 0.4}
            strokeWidth={1.2}
          />
        ))}
      </svg>
    </div>
  );
}
