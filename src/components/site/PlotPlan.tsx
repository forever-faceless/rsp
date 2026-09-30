import { layoutPlan, type PlanShape } from "@/lib/plan";

type Props = {
  shape: PlanShape;
  /** Printed in the middle of the plot, for example "2,400 sq ft". */
  areaLabel?: string;
  /** Printed along the road, for example "30 ft road". */
  roadLabel?: string;
  tone?: "light" | "dark";
  /** "full" draws dimension lines, corner letters, scale bar and north arrow; "mini" draws the outline only. */
  detail?: "full" | "mini";
  width?: number;
  height?: number;
  className?: string;
  title?: string;
};

const tones = {
  light: {
    stroke: "var(--color-navy-800)",
    fill: "rgb(215 181 109 / 0.16)",
    dim: "var(--color-ink-400)",
    text: "var(--color-ink-700)",
    strong: "var(--color-navy-900)",
    accent: "var(--color-gold-600)",
    corner: "var(--color-paper-0)",
  },
  dark: {
    stroke: "var(--color-gold-300)",
    fill: "rgb(215 181 109 / 0.1)",
    dim: "rgb(162 178 201 / 0.55)",
    text: "var(--color-navy-200)",
    strong: "var(--color-paper-50)",
    accent: "var(--color-gold-300)",
    corner: "var(--color-navy-900)",
  },
} as const;

/**
 * A measured drawing of a plot: outline, a dimension on every side, corner letters,
 * a scale bar and a north arrow. Rendered on the server as plain SVG; the class names
 * on its parts let the hero animate the drawing stroke by stroke.
 */
export function PlotPlan({ shape, areaLabel, roadLabel, tone = "light", detail = "full", width = 440, height = 340, className, title }: Props) {
  const full = detail === "full";
  const plan = layoutPlan(shape, { width, height, padding: full ? 58 : 22 });
  const c = tones[tone];
  const mono = "var(--font-mono)";

  return (
    <svg viewBox={`0 0 ${plan.width} ${plan.height}`} className={className ?? "h-auto w-full"} role="img" aria-label={title ?? "Site plan"} preserveAspectRatio="xMidYMid meet">
      {title ? <title>{title}</title> : null}

      {full && plan.road ? (
        <g className="plan-road">
          <path d={plan.road.path} stroke={c.dim} strokeWidth={1} strokeDasharray="5 4" fill="none" />
          {roadLabel ? (
            <text
              x={plan.road.lx}
              y={plan.road.ly}
              transform={`rotate(${plan.road.angle} ${plan.road.lx} ${plan.road.ly})`}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily={mono}
              fontSize={9}
              letterSpacing="0.14em"
              fill={c.dim}
            >
              {roadLabel.toUpperCase()}
            </text>
          ) : null}
        </g>
      ) : null}

      <path className="plan-fill" d={plan.path} fill={c.fill} stroke="none" />
      <path className="plan-outline" d={plan.path} fill="none" stroke={c.stroke} strokeWidth={full ? 2 : 1.75} strokeLinejoin="miter" />

      {full
        ? plan.sides.map((s, i) =>
            s.showLabel ? (
              <g key={i} className="plan-dim">
                <line x1={s.dim.x1} y1={s.dim.y1} x2={s.dim.x2} y2={s.dim.y2} stroke={c.dim} strokeWidth={0.9} />
                {s.dim.ticks.map((t, k) => (
                  <line key={k} x1={t[0]} y1={t[1]} x2={t[2]} y2={t[3]} stroke={c.dim} strokeWidth={0.9} />
                ))}
                <text
                  x={s.lx}
                  y={s.ly}
                  transform={`rotate(${s.angle} ${s.lx} ${s.ly})`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily={mono}
                  fontSize={11.5}
                  fontWeight={500}
                  fill={c.text}
                >
                  {s.label}
                </text>
              </g>
            ) : null,
          )
        : null}

      {full
        ? plan.corners.map((p) => (
            <g key={p.label} className="plan-corner">
              <rect x={p.x - 3} y={p.y - 3} width={6} height={6} fill={c.corner} stroke={c.stroke} strokeWidth={1.5} />
              {plan.corners.length <= 8 ? (
                <text x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="central" fontFamily={mono} fontSize={10} fontWeight={600} fill={c.accent}>
                  {p.label}
                </text>
              ) : null}
            </g>
          ))
        : null}

      {full && areaLabel && plan.innerSpan > 96 ? (
        <text className="plan-area" x={plan.centre.x} y={plan.centre.y} textAnchor="middle" dominantBaseline="central" fontFamily={mono} fontSize={13} fontWeight={600} fill={c.strong}>
          {areaLabel}
        </text>
      ) : null}

      {full && plan.scaleBar ? (
        <g className="plan-scale">
          <path
            d={`M${plan.scaleBar.x} ${plan.scaleBar.y - 4} V${plan.scaleBar.y} H${plan.scaleBar.x + plan.scaleBar.length} V${plan.scaleBar.y - 4}`}
            fill="none"
            stroke={c.text}
            strokeWidth={1}
          />
          <text x={plan.scaleBar.x + plan.scaleBar.length + 6} y={plan.scaleBar.y - 2} dominantBaseline="central" fontFamily={mono} fontSize={9.5} fill={c.text}>
            {plan.scaleBar.label}
          </text>
        </g>
      ) : null}

      {full && shape.oriented ? (
        <g className="plan-north" transform={`translate(${plan.width - 26} 30)`}>
          <path d="M0 -14 L5.5 6 L0 2.5 L-5.5 6 Z" fill={c.accent} />
          <text x={0} y={17} textAnchor="middle" fontFamily={mono} fontSize={9.5} fontWeight={600} fill={c.text}>
            N
          </text>
        </g>
      ) : null}
    </svg>
  );
}
