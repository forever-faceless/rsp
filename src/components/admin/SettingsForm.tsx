"use client";

import Image from "next/image";
import { useActionState } from "react";
import type { Region, Settings } from "@/lib/db/schema";
import type { ActionState } from "@/lib/forms";
import { formatPropertyNo, formatSiteRef } from "@/lib/refs";
import { regionLabel } from "@/lib/regions";
import { CoordinateFields } from "./CoordinateFields";
import { ImageInput } from "./ImageInput";
import { Checkbox, FormStatus, Input, Section, Select, SubmitButton, Textarea } from "./ui";
import { ActionForm } from "@/components/ActionForm";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Figures = { sold: number; delivered: number };

export function SettingsForm({ settings, regions, figures, action }: { settings: Settings; regions: Region[]; figures: Figures; action: Action }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const e = state?.fieldErrors ?? {};
  const s = settings;
  const main = regions.find((r) => r.code === s.propertyPrefix) ?? { code: s.propertyPrefix, nextNo: 1 };

  return (
    <ActionForm action={formAction} pending={pending} clearFilesOn={state?.success} className="space-y-6">
      <FormStatus state={state} />

      <Section title="Company" description="Shown in the header, the footer and on the About page.">
        <div className="grid gap-5 md:grid-cols-2">
          <Input label="Company name (English)" name="companyNameEn" required defaultValue={s.companyNameEn} error={e.companyNameEn} />
          <Input label="Company name (ಕನ್ನಡ)" name="companyNameKn" defaultValue={s.companyNameKn} lang="kn" />
          <Input label="Tagline (English)" name="taglineEn" defaultValue={s.taglineEn} />
          <Input label="Tagline (ಕನ್ನಡ)" name="taglineKn" defaultValue={s.taglineKn} lang="kn" />
          <Input label="Area served (English)" name="serviceAreaEn" defaultValue={s.serviceAreaEn} hint="Optional. Leave blank to name no particular area." />
          <Input label="Area served (ಕನ್ನಡ)" name="serviceAreaKn" defaultValue={s.serviceAreaKn} lang="kn" />
          <Input label="Registration or RERA number" name="regNumber" defaultValue={s.regNumber} className="num" />
          <Input label="GSTIN" name="gstin" defaultValue={s.gstin} className="num uppercase" />
          <Input label="Established in (year)" name="establishedYear" type="number" min="1900" max="2100" inputMode="numeric" defaultValue={s.establishedYear ?? ""} />
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Textarea label="About the company (English)" name="aboutEn" rows={7} defaultValue={s.aboutEn} hint="Separate paragraphs with a blank line. Leave blank to use the standard text." />
          <Textarea label="About the company (ಕನ್ನಡ)" name="aboutKn" rows={7} defaultValue={s.aboutKn} lang="kn" />
        </div>
      </Section>

      <Section title="Contact" description="The first phone number appears across the whole website.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Main phone" name="phonePrimary" type="tel" inputMode="tel" defaultValue={s.phonePrimary} className="num" />
          <Input label="Second phone" name="phoneSecondary" type="tel" inputMode="tel" defaultValue={s.phoneSecondary} className="num" />
          <Input label="WhatsApp number" name="whatsapp" type="tel" inputMode="tel" defaultValue={s.whatsapp} hint="Blank uses the main phone." className="num" />
          <Input label="Email" name="email" type="email" defaultValue={s.email} />
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Textarea label="Office address (English)" name="addressEn" rows={3} defaultValue={s.addressEn} />
          <Textarea label="Office address (ಕನ್ನಡ)" name="addressKn" rows={3} defaultValue={s.addressKn} lang="kn" />
          <Input label="Office hours (English)" name="workingHoursEn" defaultValue={s.workingHoursEn} placeholder="Mon to Sat, 10:00 AM to 6:30 PM" />
          <Input label="Office hours (ಕನ್ನಡ)" name="workingHoursKn" defaultValue={s.workingHoursKn} lang="kn" />
        </div>
        <div className="mt-5">
          <CoordinateFields lat={s.officeLat} lng={s.officeLng} label="GPS location of the office" names={{ lat: "officeLat", lng: "officeLng" }} />
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <Input label="Facebook page" name="facebookUrl" type="url" defaultValue={s.facebookUrl} />
          <Input label="Instagram profile" name="instagramUrl" type="url" defaultValue={s.instagramUrl} />
          <Input label="YouTube channel" name="youtubeUrl" type="url" defaultValue={s.youtubeUrl} />
        </div>
      </Section>

      <Section title="Property numbers" description="Each district keeps its own run of numbers, and a number is never reused. New listings go into the main district unless another is chosen, and a number typed without its letters is looked up there first.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Main district"
            name="propertyPrefix"
            defaultValue={s.propertyPrefix}
            error={e.propertyPrefix}
            className="num"
            options={regions.map((r) => ({ value: r.code, label: regionLabel({ code: r.code, name: r.nameEn }) }))}
            hint="Add or rename districts in the Districts section at the bottom of this page."
          />
          <div>
            <p className="label">Next number in it</p>
            <p className="field num !bg-paper-100">{formatPropertyNo(main.code, main.nextNo)}</p>
          </div>
          <div>
            <p className="label">A site inside that project would be</p>
            <p className="field num !bg-paper-100">{formatSiteRef(main.code, main.nextNo, 12)}</p>
          </div>
        </div>
      </Section>

      <Section title="Home page" description="Leave the text blank to use the standard wording.">
        <div className="grid gap-5 md:grid-cols-2">
          <Input label="Headline (English)" name="heroTitleEn" defaultValue={s.heroTitleEn} />
          <Input label="Headline (ಕನ್ನಡ)" name="heroTitleKn" defaultValue={s.heroTitleKn} lang="kn" />
          <Textarea label="Introduction (English)" name="heroSubtitleEn" rows={3} defaultValue={s.heroSubtitleEn} />
          <Textarea label="Introduction (ಕನ್ನಡ)" name="heroSubtitleKn" rows={3} defaultValue={s.heroSubtitleKn} lang="kn" />
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="heroImage">
              Wide photo under the headline (optional)
            </label>
            <ImageInput id="heroImage" name="heroImage" />
            <p className="help">A real photograph of one of your layouts works best. Landscape, at least 2000 px wide.</p>
            {s.heroImage ? (
              <div className="mt-3 space-y-2">
                <div className="relative aspect-[21/9] overflow-hidden rounded-[3px] bg-paper-200">
                  <Image src={s.heroImage} alt="" fill sizes="600px" className="object-cover" />
                </div>
                <Checkbox label="Remove this photo" name="removeHero" />
              </div>
            ) : null}
          </div>
          <div className="space-y-4">
            <Checkbox
              label="Show the figures band on the home page"
              name="showStats"
              defaultChecked={s.showStats}
              hint="The navy strip under the headline: available now, sold, projects delivered and clients. Leave it off until the numbers are worth showing."
            />
            <p className="text-[13px] leading-relaxed text-ink-600">
              The figures count themselves. Every listing marked Sold, and every project marked Completed or Sold out, is added the moment you change it. The register holds{" "}
              <span className="num font-semibold text-navy-900">{figures.sold} sold</span> and <span className="num font-semibold text-navy-900">{figures.delivered} delivered</span> right now. The boxes below are only for business done before this
              website. They are added on top, and each sale also counts as one client.
            </p>
            <div className="grid gap-5 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
              <Input label="Sold earlier" name="statPropertiesSold" type="number" min="0" inputMode="numeric" defaultValue={s.statPropertiesSold} />
              <Input label="Projects earlier" name="statProjectsDelivered" type="number" min="0" inputMode="numeric" defaultValue={s.statProjectsDelivered} />
              <Input label="Clients earlier" name="statClients" type="number" min="0" inputMode="numeric" defaultValue={s.statClients} />
            </div>
          </div>
        </div>
      </Section>

      <div className="sticky bottom-[58px] z-10 border-t border-navy-900/10 bg-paper-100/95 py-3 backdrop-blur lg:bottom-0">
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </ActionForm>
  );
}
