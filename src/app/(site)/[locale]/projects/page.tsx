import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/motion/Reveal";
import { CtaBand } from "@/components/site/HomeSections";
import { PageIntro } from "@/components/site/PageIntro";
import { ProjectCard } from "@/components/site/ProjectCard";
import { getSettings, listPublishedProjects } from "@/lib/db/queries";
import { getDictionary, isLocale, localePath } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]/projects">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return { title: dict.projects.title, description: dict.projects.subtitle, alternates: { canonical: `/${locale}/projects` } };
}

export default async function ProjectsPage({ params }: PageProps<"/[locale]/projects">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const [settings, projects] = await Promise.all([getSettings(), listPublishedProjects()]);

  return (
    <>
      <PageIntro crumbs={[{ href: localePath(locale), label: dict.nav.home }, { label: dict.projects.title }]} title={dict.projects.title} subtitle={dict.projects.subtitle} />
      <section className="container-x py-12 sm:py-16">
        {projects.length ? (
          <Reveal mode="children" stagger={0.1} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <ProjectCard key={p.id} project={p} locale={locale} dict={dict} priority={i < 3} />
            ))}
          </Reveal>
        ) : (
          <p className="card p-10 text-center text-ink-600">{dict.projects.noProjects}</p>
        )}
      </section>
      <CtaBand locale={locale} dict={dict} settings={settings} />
    </>
  );
}
