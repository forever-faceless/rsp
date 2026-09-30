"use client";

import { useActionState } from "react";
import { FACINGS, LISTING_STATUSES } from "@/lib/db/enums";
import type { Site } from "@/lib/db/schema";
import { bilingualToLines, type ActionState } from "@/lib/forms";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatSiteRef } from "@/lib/refs";
import { MeasureInput } from "./MeasureInput";
import { SizeFields } from "./SizeFields";
import { Checkbox, FormStatus, Input, Select, SubmitButton, Textarea } from "./ui";
import { ActionForm } from "@/components/ActionForm";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Props = { site?: Site | null; action: Action; submitLabel?: string; prefix: string; projectNo: number; nextSiteNo?: number };

export function SiteForm({ site, action, submitLabel = "Save site", prefix, projectNo, nextSiteNo }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const e = state?.fieldErrors ?? {};
  const example = formatSiteRef(prefix, projectNo, site?.siteNo ?? nextSiteNo ?? 1);
  return (
    <ActionForm action={formAction} pending={pending} className="space-y-8">
      <FormStatus state={state} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Site number"
          name="siteNo"
          type="number"
          min="1"
          max="9999"
          inputMode="numeric"
          required
          defaultValue={site?.siteNo ?? nextSiteNo ?? ""}
          error={e.siteNo}
          hint={`Shown as ${example}. Match the number on the layout plan.`}
          className="num"
        />
        <Select label="Availability" name="status" defaultValue={site?.status ?? "available"} options={LISTING_STATUSES.map((s) => ({ value: s, label: en.status.listing[s] }))} />
        <Select label="Facing" name="facing" defaultValue={site?.facing ?? ""} options={[{ value: "", label: "Not specified" }, ...FACINGS.map((f) => ({ value: f, label: en.facing[f] }))]} />
        <div>
          <p className="label invisible" aria-hidden="true">
            Corner
          </p>
          <Checkbox label="Corner site" name="corner" defaultChecked={site?.corner ?? false} />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <SizeFields widthFt={site?.widthFt} depthFt={site?.depthFt} dimension={site?.dimension} areaSqft={site?.areaSqft} />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <MeasureInput label="Road in front" name="roadWidthFt" defaultValue={site?.roadWidthFt} />
        <Input label="Rate per sq ft (₹)" name="pricePerSqft" type="number" min="0" inputMode="numeric" defaultValue={site?.pricePerSqft ?? ""} />
        <Input label="Total price (₹)" name="price" type="number" min="0" step="1000" inputMode="numeric" defaultValue={site?.price ?? ""} hint="Leave blank to show “Call for price”." />
      </div>
      <Checkbox label="Show “Call for price” on the website" name="callForPrice" defaultChecked={site?.callForPrice ?? false} hint="The figures above stay here for your own reference and are not shown to visitors." />
      <div className="grid gap-5 md:grid-cols-2">
        <Textarea label="Description (English)" name="descriptionEn" rows={4} defaultValue={site?.descriptionEn} />
        <Textarea label="Description (ಕನ್ನಡ)" name="descriptionKn" rows={4} defaultValue={site?.descriptionKn} lang="kn" />
      </div>
      <Textarea label="Highlights, one per line" name="features" rows={4} defaultValue={bilingualToLines(site?.features)} hint="Format: English | ಕನ್ನಡ" placeholder={"Corner site with roads on two sides | ಎರಡು ಬದಿಯಲ್ಲಿ ರಸ್ತೆ ಇರುವ ಮೂಲೆ ನಿವೇಶನ"} />
      <div className="sticky bottom-[58px] z-10 -mx-4 border-t border-navy-900/10 bg-paper-0/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:bottom-0">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
