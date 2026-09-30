import { notFound } from "next/navigation";

/** Any unmatched path under a locale renders the localized not-found page inside the site layout. */
export default function CatchAll() {
  notFound();
}
