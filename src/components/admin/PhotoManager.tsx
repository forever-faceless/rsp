"use client";

import { Camera, ImagePlus, Star, X } from "lucide-react";
import Image from "next/image";
import { useActionState, useTransition } from "react";
import type { ActionState } from "@/lib/forms";
import { ImageInput } from "./ImageInput";
import { FormStatus, SubmitButton } from "./ui";
import { ActionForm } from "@/components/ActionForm";

type Props = {
  images: string[];
  uploadAction: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  removeAction: (url: string) => Promise<void>;
  coverAction?: (url: string) => Promise<void>;
  /** Name of the file field the upload action reads. */
  field?: string;
  hint?: string;
};

/** Photos of a property, a site or a survey. The first photo is the cover. */
export function PhotoManager({ images, uploadAction, removeAction, coverAction, field = "images", hint }: Props) {
  const [state, formAction, uploading] = useActionState<ActionState, FormData>(uploadAction, undefined);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      <ActionForm action={formAction} pending={uploading} clearFilesOn={state?.success ? state : null} className="space-y-3">
        <FormStatus state={state} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1">
            <label htmlFor={`photos-${field}`} className="label flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-gold-600" aria-hidden="true" /> Add photos
            </label>
            <ImageInput id={`photos-${field}`} name={field} multiple maxFiles={10} />
            <p className="help">{hint ?? "Up to 10 at a time. On a phone you can take them with the camera. They are shrunk before upload, so mobile data is fine."}</p>
          </div>
          <SubmitButton className="sm:mt-[26px]">
            <ImagePlus className="h-4 w-4" aria-hidden="true" /> Upload
          </SubmitButton>
        </div>
      </ActionForm>

      {images.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((url, i) => (
            <li key={url} className="relative aspect-[4/3] overflow-hidden rounded-[3px] bg-paper-200">
              <Image src={url} alt="" fill sizes="240px" className="object-cover" />
              {i === 0 && coverAction ? <span className="badge absolute left-2 top-2 bg-gold-400 text-navy-950">Cover</span> : null}
              <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-navy-950/70 p-1.5">
                {coverAction && i > 0 ? (
                  <button type="button" disabled={pending} onClick={() => start(() => coverAction(url))} className="inline-flex min-h-8 items-center gap-1 rounded-[2px] bg-paper-0 px-2 text-[11.5px] font-semibold text-navy-900">
                    <Star className="h-3 w-3" aria-hidden="true" /> Cover
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" disabled={pending} onClick={() => start(() => removeAction(url))} className="inline-flex min-h-8 items-center gap-1 rounded-[2px] bg-danger-600 px-2 text-[11.5px] font-semibold text-paper-0">
                  <X className="h-3 w-3" aria-hidden="true" /> Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-ink-500">No photos yet. Until there are, the website shows the site plan in their place.</p>
      )}
    </div>
  );
}
