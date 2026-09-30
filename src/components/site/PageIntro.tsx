import { HeroMotion } from "./HeroMotion";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { cn } from "@/lib/utils";

type Props = {
  crumbs: Crumb[];
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
};

/** The heading band at the top of every inner page. */
export function PageIntro({ crumbs, eyebrow, title, subtitle, children, className }: Props) {
  return (
    <section className={cn("bg-grid relative border-b border-navy-900/10", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,transparent_20%,var(--color-paper-50)_75%)]" aria-hidden="true" />
      <HeroMotion className="container-x relative py-10 sm:py-14">
        <Breadcrumbs items={crumbs} />
        {eyebrow ? (
          <p data-hero-eyebrow data-hero-hide className="eyebrow mt-8">
            {eyebrow}
          </p>
        ) : null}
        <h1 data-hero-title data-hero-hide className={cn("display-1 max-w-4xl", eyebrow ? "mt-4" : "mt-8")}>
          {title}
        </h1>
        {subtitle ? (
          <p data-hero-fade data-hero-hide className="lede mt-5 max-w-2xl">
            {subtitle}
          </p>
        ) : null}
        {children ? (
          <div data-hero-fade data-hero-hide className="mt-8">
            {children}
          </div>
        ) : null}
      </HeroMotion>
    </section>
  );
}
