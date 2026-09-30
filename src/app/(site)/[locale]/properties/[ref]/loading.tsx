import { PageCurtain } from "@/components/motion/PageCurtain";

/** Shown while a property page is fetched. The page renders the same screen and then lifts it. */
export default function Loading() {
  return (
    <>
      <PageCurtain mode="hold" />
      <div className="min-h-[70vh]" aria-busy="true" />
    </>
  );
}
