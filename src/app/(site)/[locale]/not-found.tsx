import Link from "next/link";
import { en } from "@/lib/i18n/dictionaries/en";
import { kn } from "@/lib/i18n/dictionaries/kn";

/** Bilingual on purpose: not-found pages receive no params, so we speak both languages. */
export default function NotFound() {
  return (
    <section className="bg-grid">
      <div className="container-x py-24 text-center sm:py-32">
        <p className="num text-[13px] font-medium tracking-[0.3em] text-gold-700">404</p>
        <h1 className="display-1 mt-5">{en.notFound.title}</h1>
        <p className="mt-2 font-display text-[1.5rem] text-navy-700" lang="kn">
          {kn.notFound.title}
        </p>
        <p className="mx-auto mt-6 max-w-md text-ink-600">{en.notFound.text}</p>
        <p className="mx-auto mt-1 max-w-md text-ink-600" lang="kn">
          {kn.notFound.text}
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/en" className="btn-primary">
            {en.notFound.home}
          </Link>
          <Link href="/en/properties" className="btn-outline">
            {en.notFound.properties}
          </Link>
          <Link href="/kn" className="btn-ghost" lang="kn">
            {kn.notFound.home}
          </Link>
        </div>
      </div>
    </section>
  );
}
