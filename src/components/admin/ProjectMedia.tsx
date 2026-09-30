"use client";

import { ImagePlus, Star, X } from "lucide-react";
import Image from "next/image";
import { useActionState, useTransition } from "react";
import type { Project } from "@/lib/db/schema";
import type { ActionState } from "@/lib/forms";
import { fileInputClass, ImageInput } from "./ImageInput";
import { FormStatus, SubmitButton } from "./ui";
import { ActionForm } from "@/components/ActionForm";

type Props = {
  project: Pick<Project, "coverImage" | "gallery" | "layoutPlanImage" | "brochureUrl">;
  uploadAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  removeAction: (url: string, kind: "gallery" | "cover" | "plan") => Promise<void>;
  setCoverAction: (url: string) => Promise<void>;
};

export function ProjectMedia({ project, uploadAction, removeAction, setCoverAction }: Props) {
  const [state, formAction, uploading] = useActionState<ActionState, FormData>(uploadAction, undefined);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <FormStatus state={state} />
      <ActionForm action={formAction} pending={uploading} clearFilesOn={state?.success ? state : null} className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="coverImage">
            Cover photo
          </label>
          <ImageInput id="coverImage" name="coverImage" />
          <p className="help">A landscape photo, shown on cards and at the top of the project page.</p>
        </div>
        <div>
          <label className="label" htmlFor="gallery">
            Gallery photos
          </label>
          <ImageInput id="gallery" name="gallery" multiple maxFiles={10} />
          <p className="help">Up to 10 at a time. Photos are shrunk before upload, so phone photos are fine.</p>
        </div>
        <div>
          <label className="label" htmlFor="layoutPlanImage">
            Layout plan (image)
          </label>
          <ImageInput id="layoutPlanImage" name="layoutPlanImage" />
        </div>
        <div>
          <label className="label" htmlFor="brochure">
            Brochure (PDF)
          </label>
          <input id="brochure" name="brochure" type="file" accept="application/pdf" className={fileInputClass} />
        </div>
        <div className="md:col-span-2">
          <SubmitButton>
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> Upload selected files
          </SubmitButton>
        </div>
      </ActionForm>

      <div className="grid gap-6 md:grid-cols-2">
        <Thumb title="Cover photo" src={project.coverImage} onRemove={() => start(() => removeAction(project.coverImage, "cover"))} pending={pending} />
        <Thumb title="Layout plan" src={project.layoutPlanImage} onRemove={() => start(() => removeAction(project.layoutPlanImage, "plan"))} pending={pending} contain />
      </div>

      {project.brochureUrl ? (
        <p className="text-[14px] text-ink-700">
          Brochure:{" "}
          <a href={project.brochureUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-800 underline decoration-gold-500 decoration-2 underline-offset-4">
            open the PDF
          </a>
        </p>
      ) : null}

      <div>
        <p className="label">Gallery ({project.gallery.length})</p>
        {project.gallery.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {project.gallery.map((url) => (
              <li key={url} className="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-paper-200">
                <Image src={url} alt="" fill sizes="240px" className="object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-navy-950/70 p-1.5">
                  <button type="button" disabled={pending} onClick={() => start(() => setCoverAction(url))} className="inline-flex min-h-8 items-center gap-1 rounded-[2px] bg-paper-0 px-2 text-[11.5px] font-semibold text-navy-900">
                    <Star className="h-3 w-3" aria-hidden="true" /> Cover
                  </button>
                  <button type="button" disabled={pending} onClick={() => start(() => removeAction(url, "gallery"))} className="inline-flex min-h-8 items-center gap-1 rounded-[2px] bg-danger-600 px-2 text-[11.5px] font-semibold text-paper-0">
                    <X className="h-3 w-3" aria-hidden="true" /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-ink-500">No gallery photos yet.</p>
        )}
      </div>
    </div>
  );
}

function Thumb({ title, src, onRemove, pending, contain }: { title: string; src: string; onRemove: () => void; pending: boolean; contain?: boolean }) {
  return (
    <div>
      <p className="label">{title}</p>
      {src ? (
        <div className="relative aspect-[16/10] overflow-hidden rounded-[3px] bg-paper-200">
          <Image src={src} alt="" fill sizes="400px" className={contain ? "object-contain" : "object-cover"} />
          <button type="button" disabled={pending} onClick={onRemove} className="absolute right-2 top-2 inline-flex min-h-8 items-center gap-1 rounded-[2px] bg-danger-600 px-2.5 text-[11.5px] font-semibold text-paper-0">
            <X className="h-3 w-3" aria-hidden="true" /> Remove
          </button>
        </div>
      ) : (
        <div className="flex aspect-[16/10] items-center justify-center rounded-[3px] border border-dashed border-navy-900/20 text-[13.5px] text-ink-400">Not uploaded</div>
      )}
    </div>
  );
}
