import { notFound } from "next/navigation";

/** Any unmatched admin path renders the admin not-found page inside the shell. */
export default function CatchAll() {
  notFound();
}
