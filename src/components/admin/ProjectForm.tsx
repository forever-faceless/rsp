"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PROJECT_STATUSES } from "@/lib/db/enums";
import type { Project } from "@/lib/db/schema";
import { approvalsToLines, bilingualToLines, type ActionState } from "@/lib/forms";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatPropertyNo } from "@/lib/refs";
import { regionLabel, type RegionOption } from "@/lib/regions";
import { slugify } from "@/lib/utils";
import { Checkbox, FormStatus, Input, Select, SubmitButton, Textarea } from "./ui";
import { ActionForm } from "@/components/ActionForm";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Props = { project?: Project | null; action: Action; submitLabel?: string; regions?: RegionOption[]; defaultPrefix?: string };

export function ProjectForm({ project, action, submitLabel = "Save project", regions = [], defaultPrefix }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const [slug, setSlug] = useState(project?.slug ?? "");
  const [prefix, setPrefix] = useState(project?.prefix ?? defaultPrefix ?? regions[0]?.code ?? "HSN");
  const e = state?.fieldErrors ?? {};
  const region = regions.find((r) => r.code === prefix);

  return (
    <ActionForm action={formAction} pending={pending} className="space-y-8">
      <FormStatus state={state} />

      <div className="grid gap-5 md:grid-cols-2">
        <Input label="Project name (English)" name="nameEn" required defaultValue={project?.nameEn} error={e.nameEn} onBlur={(ev) => !slug && setSlug(slugify(ev.currentTarget.value))} />
        <Input label="Project name (ಕನ್ನಡ)" name="nameKn" defaultValue={project?.nameKn} lang="kn" />
        <Input label="Web address" name="slug" value={slug} onChange={(ev) => setSlug(ev.target.value)} error={e.slug} hint={`/en/projects/${slug || "project-name"}`} autoCapitalize="none" />
        <div className={project ? "grid grid-cols-2 gap-5" : "grid gap-5 sm:grid-cols-3"}>
          <Select label="Status" name="status" defaultValue={project?.status ?? "ongoing"} options={PROJECT_STATUSES.map((s) => ({ value: s, label: en.status.project[s] }))} />
          {project ? (
            <Input label="Property number" name="__propertyNo" value={formatPropertyNo(project.prefix, project.propertyNo)} readOnly disabled className="num" hint="Fixed once issued." />
          ) : (
            <>
              <div>
                <Select label="District" name="prefix" value={prefix} onChange={(ev) => setPrefix(ev.target.value)} error={e.prefix} className="num" options={regions.map((r) => ({ value: r.code, label: regionLabel(r) }))} />
                <p className="help">
                  <Link href="/admin/settings#districts" className="font-semibold text-navy-800 underline decoration-gold-500 decoration-2 underline-offset-2">
                    Add a district
                  </Link>
                </p>
              </div>
              <div>
                <p className="label">Property number</p>
                <p className="field num !bg-paper-100" data-next-number>
                  {formatPropertyNo(prefix, region?.nextNo ?? 1)}
                </p>
                <p className="help">Given automatically when you save.</p>
              </div>
            </>
          )}
        </div>
        <Input label="Tagline (English)" name="taglineEn" defaultValue={project?.taglineEn} hint="One line shown under the name." />
        <Input label="Tagline (ಕನ್ನಡ)" name="taglineKn" defaultValue={project?.taglineKn} lang="kn" />
        <Input label="Location (English)" name="locationEn" defaultValue={project?.locationEn} placeholder="Off Ring Road, Hassan" />
        <Input label="Location (ಕನ್ನಡ)" name="locationKn" defaultValue={project?.locationKn} lang="kn" />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Textarea label="Description (English)" name="descriptionEn" rows={7} defaultValue={project?.descriptionEn} hint="Separate paragraphs with a blank line." />
        <Textarea label="Description (ಕನ್ನಡ)" name="descriptionKn" rows={7} defaultValue={project?.descriptionKn} lang="kn" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Total area (acres)" name="totalAreaAcres" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={project?.totalAreaAcres ?? ""} />
        <Input label="Total sites in the layout" name="totalSites" type="number" min="0" inputMode="numeric" defaultValue={project?.totalSites ?? ""} />
        <Input label="Price from (₹)" name="priceFrom" type="number" min="0" step="1000" inputMode="numeric" defaultValue={project?.priceFrom ?? ""} hint="Lowest site price, shown on cards." />
        <Input label="Rate per sq ft (₹)" name="pricePerSqft" type="number" min="0" inputMode="numeric" defaultValue={project?.pricePerSqft ?? ""} />
      </div>
      <Checkbox label="Show “Call for price” for this project and every site in it" name="callForPrice" defaultChecked={project?.callForPrice ?? false} hint="Prices stay here for your own reference. Untick to show them again; a single site can also be set this way on its own page." />

      <div className="grid gap-5 md:grid-cols-2">
        <Textarea
          label="Infrastructure and amenities, one per line"
          name="amenities"
          rows={6}
          defaultValue={bilingualToLines(project?.amenities)}
          hint="Format: English | ಕನ್ನಡ. The Kannada half is optional."
          placeholder={"30 ft tar roads | 30 ಅಡಿ ಡಾಂಬರು ರಸ್ತೆಗಳು\nUnderground drainage | ಭೂಗತ ಒಳಚರಂಡಿ"}
        />
        <Textarea
          label="Approvals and documents, one per line"
          name="approvals"
          rows={6}
          defaultValue={approvalsToLines(project?.approvals)}
          hint="Format: Name | ಕನ್ನಡ | Reference number. Kannada and number are optional."
          placeholder={"Layout approval, HUDA | ಲೇಔಟ್ ಅನುಮೋದನೆ | HUDA/LAY/2025/012"}
        />
      </div>

      <Input label="Brochure link (optional)" name="brochureUrl" defaultValue={project?.brochureUrl} hint="Or upload a PDF under Photos and plan after saving." wrapperClassName="max-w-xl" />

      <div className="grid gap-3 sm:grid-cols-2">
        <Checkbox label="Published" name="published" defaultChecked={project?.published ?? true} hint="Visible on the website." />
        <Checkbox label="Featured" name="featured" defaultChecked={project?.featured ?? false} hint="Shown first on the home page." />
      </div>

      <div className="sticky bottom-[58px] z-10 -mx-4 border-t border-navy-900/10 bg-paper-0/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:bottom-0">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
