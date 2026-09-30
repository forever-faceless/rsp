import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion/Reveal";
import { Hero } from "@/components/site/Hero";
import { CtaBand, ProcessSection, RegisterSection, SellBand, StatBand, Testimonials } from "@/components/site/HomeSections";
import { ListingCard } from "@/components/site/ListingCard";
import { ProjectCard } from "@/components/site/ProjectCard";
import { SectionHeading } from "@/components/site/SectionHeading";
import {
  countPublicListings, countRegisterFigures,
  getHeroSpecimen,
  getSettings,
  listActiveTypes,
  listFeaturedProjects,
  listFeaturedProperties,
  listPropertyCorners,
  listTestimonials,
} from "@/lib/db/queries";
import { getDictionary, isLocale, localePath } from "@/lib/i18n";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const [settings, projects, featured, testimonials, specimen, counts, types, figures] = await Promise.all([
    getSettings(),
    listFeaturedProjects(3),
    listFeaturedProperties(6),
    listTestimonials(),
    getHeroSpecimen(),
    countPublicListings(),
    listActiveTypes(),
    countRegisterFigures(),
  ]);
  // Whole rows only: four or five cards would leave a gap at the end of the grid.
  const properties = featured.slice(0, featured.length >= 6 ? 6 : featured.length >= 3 ? 3 : featured.length);
  const corners = await listPropertyCorners(properties.map((p) => p.id));

  return (
    <>
      <Hero locale={locale} dict={dict} settings={settings} specimen={specimen} types={types} />
      <StatBand dict={dict} settings={settings} available={counts.available} figures={figures} />

      {projects.length ? (
        <section className="py-16 sm:py-24">
          <div className="container-x">
            <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading eyebrow={dict.home.projectsEyebrow} title={dict.home.projectsTitle} subtitle={dict.home.projectsSubtitle} />
              <Link href={localePath(locale, "/projects")} className="link-arrow shrink-0 self-start sm:self-auto">
                {dict.common.viewAllProjects}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Reveal>
            <Reveal mode="children" stagger={0.12} className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p, i) => (
                <ProjectCard key={p.id} project={p} locale={locale} dict={dict} priority={i === 0} />
              ))}
            </Reveal>
          </div>
        </section>
      ) : null}

      {properties.length ? (
        <section className={projects.length ? "border-t border-navy-900/10 py-16 sm:py-24" : "py-16 sm:py-24"}>
          <div className="container-x">
            <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading eyebrow={dict.home.propertiesEyebrow} title={dict.home.propertiesTitle} subtitle={dict.home.propertiesSubtitle} />
              <Link href={localePath(locale, "/properties")} className="link-arrow shrink-0 self-start sm:self-auto">
                {dict.common.viewAllProperties}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Reveal>
            <Reveal mode="children" stagger={0.1} className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((p) => (
                <ListingCard key={p.id} listing={p} locale={locale} dict={dict} corners={corners.get(p.id)} />
              ))}
            </Reveal>
          </div>
        </section>
      ) : null}

      <RegisterSection dict={dict} />
      <ProcessSection eyebrow={dict.home.processEyebrow} title={dict.home.processTitle} steps={dict.home.process} />
      <SellBand locale={locale} dict={dict} />
      <Testimonials items={testimonials} locale={locale} dict={dict} />
      <CtaBand locale={locale} dict={dict} settings={settings} />
    </>
  );
}
