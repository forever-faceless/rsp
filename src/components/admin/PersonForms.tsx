"use client";

import Image from "next/image";
import { useActionState } from "react";
import type { TeamMember, Testimonial } from "@/lib/db/schema";
import type { ActionState } from "@/lib/forms";
import { ImageInput } from "./ImageInput";
import { Checkbox, FormStatus, Input, SubmitButton, Textarea } from "./ui";
import { ActionForm } from "@/components/ActionForm";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function Photo({ photo, label }: { photo: string; label: string }) {
  return (
    <div>
      <label className="label" htmlFor="photo">
        {label}
      </label>
      <ImageInput id="photo" name="photo" />
      {photo ? (
        <div className="mt-3 flex items-center gap-4">
          <Image src={photo} alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-[3px] object-cover" />
          <Checkbox label="Remove this photo" name="removePhoto" />
        </div>
      ) : null}
    </div>
  );
}

export function TestimonialForm({ item, action, submitLabel = "Save testimonial" }: { item?: Testimonial | null; action: Action; submitLabel?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const e = state?.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} pending={pending} clearFilesOn={state?.success} className="space-y-6">
      <FormStatus state={state} />
      <div className="grid gap-5 md:grid-cols-2">
        <Input label="Name (English)" name="nameEn" required defaultValue={item?.nameEn} error={e.nameEn} />
        <Input label="Name (ಕನ್ನಡ)" name="nameKn" defaultValue={item?.nameKn} lang="kn" />
        <Input label="Context (English)" name="locationEn" defaultValue={item?.locationEn} placeholder="Bought a site in RSP Meadows" />
        <Input label="Context (ಕನ್ನಡ)" name="locationKn" defaultValue={item?.locationKn} lang="kn" />
        <Textarea label="What they said (English)" name="quoteEn" rows={5} defaultValue={item?.quoteEn} hint="Use the client's own words, with their permission." />
        <Textarea label="What they said (ಕನ್ನಡ)" name="quoteKn" rows={5} defaultValue={item?.quoteKn} lang="kn" />
      </div>
      <Photo photo={item?.photo ?? ""} label="Photo (optional)" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox label="Published" name="published" defaultChecked={item?.published ?? true} hint="Visible on the home page." />
        <Input label="Sort order" name="sortOrder" type="number" defaultValue={item?.sortOrder ?? 0} />
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}

export function TeamForm({ item, action, submitLabel = "Save team member" }: { item?: TeamMember | null; action: Action; submitLabel?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const e = state?.fieldErrors ?? {};
  return (
    <ActionForm action={formAction} pending={pending} clearFilesOn={state?.success} className="space-y-6">
      <FormStatus state={state} />
      <div className="grid gap-5 md:grid-cols-2">
        <Input label="Name (English)" name="nameEn" required defaultValue={item?.nameEn} error={e.nameEn} />
        <Input label="Name (ಕನ್ನಡ)" name="nameKn" defaultValue={item?.nameKn} lang="kn" />
        <Input label="Role (English)" name="roleEn" defaultValue={item?.roleEn} placeholder="Managing Partner" />
        <Input label="Role (ಕನ್ನಡ)" name="roleKn" defaultValue={item?.roleKn} lang="kn" />
        <Textarea label="About (English)" name="bioEn" rows={4} defaultValue={item?.bioEn} />
        <Textarea label="About (ಕನ್ನಡ)" name="bioKn" rows={4} defaultValue={item?.bioKn} lang="kn" />
        <Input label="Phone (optional)" name="phone" type="tel" inputMode="tel" defaultValue={item?.phone} className="num" hint="Shown on the website if filled in." />
      </div>
      <Photo photo={item?.photo ?? ""} label="Photo (optional)" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox label="Published" name="published" defaultChecked={item?.published ?? true} hint="Visible on the About page." />
        <Input label="Sort order" name="sortOrder" type="number" defaultValue={item?.sortOrder ?? 0} />
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
